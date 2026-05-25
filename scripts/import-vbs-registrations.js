#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const STUDENT_REGISTRATION_TYPES = new Set([
  'middle school registrant (current 6th-8th grader)',
  'high school registrant (current 9th-12th grader)',
]);
const ADULT_REGISTRATION_TYPE = '18+ registrant';

const DEFAULT_PROJECT_ID = 'vbs-volunteer-tracker';

const FIELD_ALIASES = {
  registrationType: ['RegistrationType', 'Registration Type', 'Registrant Type', 'Ticket Type'],
  firstName: ['First Name', 'FirstName', 'Volunteer First Name', 'Registrant First Name', 'Participant First Name', 'Attendee First Name'],
  lastName: ['Last Name', 'LastName', 'Volunteer Last Name', 'Registrant Last Name', 'Participant Last Name', 'Attendee Last Name'],
  fullName: ['Name', 'Full Name', 'Registrant Name', 'Participant Name', 'Attendee Name'],
  email: ['Email', 'Email Address', 'Volunteer Email', 'Registrant Email', 'Primary Email', 'Parent Email'],
  phone: ['Phone', 'Phone Number', 'Volunteer Cell Phone', 'Mobile Phone', 'Registrant Phone'],
  schoolName: ['School', 'School Name', 'Current School'],
  gradeLevel: ['Grade', 'Grade Level', 'Current Grade', 'What grade are you currently in?', 'What grade will you attend in the Fall of 2026?'],
  gradYear: ['Graduation Year', 'Grad Year', 'High School Graduation Year'],
};

function parseArgs(argv) {
  const options = {
    filePath: null,
    eventId: null,
    projectId: DEFAULT_PROJECT_ID,
    serviceAccount: null,
    emulator: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];

    if (arg === '--event-id') options.eventId = next();
    else if (arg === '--project') options.projectId = next();
    else if (arg === '--service-account') options.serviceAccount = next();
    else if (arg === '--emulator') options.emulator = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (!options.filePath) {
      options.filePath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.filePath) {
    throw new Error('Missing registrations CSV path.');
  }

  return options;
}

function printUsage() {
  console.log(`Usage:
  node scripts/import-vbs-registrations.js registrations.csv [options]

Options:
  --event-id event-id              Existing event to import students into
  --emulator                       Use local Firestore/Auth emulators
  --project project-id             Firebase project ID (default: vbs-volunteer-tracker)
  --service-account path.json      Service account JSON for production imports
  --dry-run                        Parse and report without writing

If --event-id is omitted, the script lists available events and prompts for a
selection when run in an interactive terminal. Non-interactive runs must pass
--event-id.`);
}

function initializeFirebase(options) {
  if (options.emulator) {
    process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||= 'localhost:9099';
  }

  if (getApps().length) return;

  if (options.serviceAccount) {
    const serviceAccount = JSON.parse(readFileSync(resolve(options.serviceAccount), 'utf8'));
    initializeApp({
      credential: cert(serviceAccount),
      projectId: options.projectId,
    });
    return;
  }

  initializeApp({ projectId: options.projectId });
}

function parseCsv(content) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(field);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(value => value.trim() !== '')) rows.push(row);

  if (rows.length === 0) return [];

  const headers = rows[0].map(header => header.replace(/^\uFEFF/, '').trim());
  return rows.slice(1).map(rawRow => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (rawRow[index] || '').trim();
    });
    return record;
  });
}

function readRegistrations(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension !== '.csv') {
    throw new Error('Please export the registration spreadsheet as CSV before importing.');
  }

  return parseCsv(readFileSync(resolve(filePath), 'utf8'));
}

function normalize(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function compact(value) {
  return normalize(value).replace(/[^a-z0-9]/g, '');
}

function getField(row, fieldName) {
  const aliases = FIELD_ALIASES[fieldName] || [fieldName];
  const directKey = aliases.find(alias => Object.prototype.hasOwnProperty.call(row, alias));
  if (directKey) return row[directKey].trim();

  const normalizedAliases = aliases.map(compact);
  const fuzzyKey = Object.keys(row).find(key => normalizedAliases.includes(compact(key)));
  return fuzzyKey ? row[fuzzyKey].trim() : '';
}

function splitName(row) {
  const firstName = getField(row, 'firstName');
  const lastName = getField(row, 'lastName');
  if (firstName || lastName) return { firstName, lastName };

  const fullName = getField(row, 'fullName');
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts.slice(0, -1).join(' '),
    lastName: parts[parts.length - 1],
  };
}

function inferGradeLevel(registrationType, rawGrade) {
  const gradeMatch = String(rawGrade || registrationType || '').match(/\b(6|7|8|9|10|11|12)(?:th|st|nd|rd)?\b/);
  return gradeMatch ? gradeMatch[1] : '';
}

function inferGradYear(gradeLevel) {
  const grade = Number.parseInt(gradeLevel, 10);
  if (!Number.isInteger(grade)) return '';
  const now = new Date();
  const schoolYearEnd = now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
  return String(schoolYearEnd + (12 - grade));
}

function toStudent(row) {
  const { firstName, lastName } = splitName(row);
  const gradeLevel = inferGradeLevel(getField(row, 'registrationType'), getField(row, 'gradeLevel'));

  return {
    firstName,
    lastName,
    schoolName: getField(row, 'schoolName'),
    gradeLevel,
    gradYear: getField(row, 'gradYear') || inferGradYear(gradeLevel),
    overrideHours: 0,
  };
}

function toAdult(row) {
  const { firstName, lastName } = splitName(row);
  const name = `${firstName} ${lastName}`.trim() || getField(row, 'fullName');
  return {
    name,
    email: normalize(getField(row, 'email')),
    phone: getField(row, 'phone'),
  };
}

function classifyRows(rows) {
  const students = [];
  const adults = [];
  const skipped = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const registrationType = normalize(getField(row, 'registrationType'));

    if (STUDENT_REGISTRATION_TYPES.has(registrationType)) {
      const student = toStudent(row);
      if (!student.firstName || !student.lastName) {
        skipped.push({ rowNumber, reason: 'student row missing first or last name' });
      } else {
        students.push({ rowNumber, row, student });
      }
      return;
    }

    if (registrationType === ADULT_REGISTRATION_TYPE) {
      const adult = toAdult(row);
      if (!adult.name || !adult.email) {
        skipped.push({ rowNumber, reason: 'adult row missing name or email' });
      } else {
        adults.push({ rowNumber, row, adult });
      }
      return;
    }

    skipped.push({ rowNumber, reason: `unsupported RegistrationType: ${getField(row, 'registrationType') || '(blank)'}` });
  });

  return { students, adults, skipped };
}

function studentKeys(student) {
  const nameKey = `${compact(student.firstName)}:${compact(student.lastName)}`;
  const keys = [];
  if (compact(student.gradYear)) keys.push(`${nameKey}:grad:${compact(student.gradYear)}`);
  if (compact(student.schoolName)) keys.push(`${nameKey}:school:${compact(student.schoolName)}`);
  if (keys.length === 0) keys.push(nameKey);
  return keys;
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(14);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

async function loadExistingStudents(db) {
  const snapshot = await db.collection('students').get();
  const byKey = new Map();

  snapshot.docs.forEach(doc => {
    const student = { id: doc.id, ...doc.data() };
    studentKeys(student).forEach(key => {
      if (!byKey.has(key)) byKey.set(key, student);
    });
  });

  return byKey;
}

async function loadExistingEventStudentIds(db, eventId) {
  const snapshot = await db.collection('eventStudents').where('eventId', '==', eventId).get();
  return new Set(snapshot.docs.map(doc => doc.data().studentId).filter(Boolean));
}

async function commitStudentImports(db, imports, eventId, userId, dryRun) {
  const existingStudents = dryRun ? new Map() : await loadExistingStudents(db);
  const existingEventStudentIds = dryRun ? new Set() : await loadExistingEventStudentIds(db, eventId);
  const created = [];
  const matched = [];
  const eventLinksCreated = [];
  const eventLinksExisting = [];
  const importSeenKeys = new Set();
  const linkedStudentIds = new Set();

  for (const item of imports) {
    const keys = studentKeys(item.student);
    const existing = keys.map(key => existingStudents.get(key)).find(Boolean);
    let studentId = existing?.id;

    if (existing) {
      matched.push({ rowNumber: item.rowNumber, student: existing });
    } else {
      const duplicateImportKey = keys.find(key => importSeenKeys.has(key));
      if (duplicateImportKey) {
        matched.push({ rowNumber: item.rowNumber, student: { ...item.student, id: '(duplicate in import)' } });
        continue;
      }

      const ref = dryRun ? { id: `dry-run-student-${item.rowNumber}`, set: async () => {} } : db.collection('students').doc();
      studentId = ref.id;
      const data = {
        ...item.student,
        createdAt: Timestamp.now(),
        importSource: 'vbs-registration-import',
      };

      if (!dryRun) await ref.set(data);
      created.push({ rowNumber: item.rowNumber, student: { id: studentId, ...data } });
      keys.forEach(key => existingStudents.set(key, { id: studentId, ...data }));
    }

    keys.forEach(key => importSeenKeys.add(key));

    if (existingEventStudentIds.has(studentId)) {
      eventLinksExisting.push({ eventId, studentId });
      continue;
    }

    if (linkedStudentIds.has(studentId)) continue;
    linkedStudentIds.add(studentId);

    const link = {
      eventId,
      studentId,
      addedAt: Timestamp.now(),
      addedBy: userId || 'script_import',
      source: 'vbs-registration-import',
    };
    eventLinksCreated.push(link);
    existingEventStudentIds.add(studentId);
  }

  if (!dryRun) {
    for (let i = 0; i < eventLinksCreated.length; i += 450) {
      const batch = db.batch();
      eventLinksCreated.slice(i, i + 450).forEach(link => {
        batch.set(db.collection('eventStudents').doc(), link);
      });
      await batch.commit();
    }
  }

  return { created, matched, eventLinksCreated, eventLinksExisting };
}

async function upsertAdults(auth, db, imports, dryRun) {
  const authCreated = [];
  const authMatched = [];
  const profilesCreated = [];
  const profilesUpdated = [];

  for (const item of imports) {
    let userRecord;
    let createdPassword = null;

    if (dryRun) {
      createdPassword = generatePassword();
      userRecord = { uid: `dry-run-${item.rowNumber}`, email: item.adult.email, displayName: item.adult.name };
      authCreated.push({ rowNumber: item.rowNumber, user: userRecord, password: createdPassword });
      profilesCreated.push({ rowNumber: item.rowNumber, user: userRecord });
      continue;
    }

    try {
      userRecord = await auth.getUserByEmail(item.adult.email);
      authMatched.push({ rowNumber: item.rowNumber, user: userRecord });
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;

      createdPassword = generatePassword();
      userRecord = await auth.createUser({
        email: item.adult.email,
        password: createdPassword,
        displayName: item.adult.name,
        emailVerified: true,
      });
      authCreated.push({ rowNumber: item.rowNumber, user: userRecord, password: createdPassword });
    }

    const userRef = db.collection('users').doc(userRecord.uid);
    const existingDoc = await userRef.get();
    await userRef.set({
      email: item.adult.email,
      name: item.adult.name,
      phone: item.adult.phone || existingDoc.data()?.phone || '',
      role: 'adult_volunteer',
      isActive: true,
      createdAt: existingDoc.exists ? existingDoc.data().createdAt : Timestamp.now(),
      updatedAt: Timestamp.now(),
      importSource: existingDoc.exists ? existingDoc.data().importSource : 'vbs-registration-import',
    }, { merge: true });

    if (existingDoc.exists) {
      profilesUpdated.push({ rowNumber: item.rowNumber, user: userRecord });
    } else {
      profilesCreated.push({ rowNumber: item.rowNumber, user: userRecord });
    }
  }

  return { authCreated, authMatched, profilesCreated, profilesUpdated };
}

function getCreatedMillis(event) {
  const createdAt = event.createdAt;
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000;
  return new Date(createdAt).getTime() || 0;
}

async function loadEvents(db) {
  const snapshot = await db.collection('events').get();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => {
      const createdDiff = getCreatedMillis(b) - getCreatedMillis(a);
      if (createdDiff !== 0) return createdDiff;
      return (a.name || '').localeCompare(b.name || '');
    });
}

function formatEventChoice(event, index) {
  const dates = [event.startDate, event.endDate].filter(Boolean).join(' to ');
  const organization = event.organizationName ? ` - ${event.organizationName}` : '';
  const dateLabel = dates ? ` (${dates})` : '';
  return `${index + 1}. ${event.name || '(unnamed event)'}${organization}${dateLabel}\n   id: ${event.id}`;
}

async function promptForEvent(events) {
  if (!process.stdin.isTTY) {
    throw new Error('Missing --event-id. Run this command in an interactive terminal to choose from available events, or pass --event-id explicitly.');
  }

  console.log('\nAvailable events');
  events.forEach((event, index) => console.log(formatEventChoice(event, index)));

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const answer = (await rl.question('\nSelect event by number or id: ')).trim();
      const numericChoice = Number.parseInt(answer, 10);
      const selected = Number.isInteger(numericChoice) && String(numericChoice) === answer
        ? events[numericChoice - 1]
        : events.find(event => event.id === answer);

      if (selected) return selected;
      console.log('That selection was not found.');
    }
  } finally {
    rl.close();
  }

  throw new Error('No valid event selected.');
}

async function resolveTargetEvent(db, options) {
  if (options.eventId) {
    if (options.dryRun && !db) {
      return {
        eventId: options.eventId,
        eventData: { id: options.eventId, name: '(not verified in dry-run)' },
      };
    }

    const eventDoc = await db.collection('events').doc(options.eventId).get();
    if (!eventDoc.exists) {
      throw new Error(`Event not found: ${options.eventId}`);
    }

    return {
      eventId: eventDoc.id,
      eventData: { id: eventDoc.id, ...eventDoc.data() },
    };
  }

  if (!db) {
    throw new Error('Missing --event-id.');
  }

  const events = await loadEvents(db);
  if (events.length === 0) {
    throw new Error('No events found. Create an event in the app first, then rerun the import.');
  }

  const selected = await promptForEvent(events);
  return {
    eventId: selected.id,
    eventData: selected,
  };
}

function printCredentials(createdAdults) {
  if (createdAdults.length === 0) return;

  console.log('\nNew adult volunteer credentials');
  console.log('email,password,name');
  createdAdults.forEach(({ user, password }) => {
    console.log(`${user.email},${password},${user.displayName || ''}`);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const registrations = readRegistrations(options.filePath);
  const { students, adults, skipped } = classifyRows(registrations);

  if (!options.eventId && !process.stdin.isTTY) {
    throw new Error('Missing --event-id. Run this command in an interactive terminal to choose from available events, or pass --event-id explicitly.');
  }

  const needsFirebase = !options.dryRun || !options.eventId;

  if (needsFirebase) {
    initializeFirebase(options);
  }
  const auth = options.dryRun ? null : getAuth();
  const db = needsFirebase ? getFirestore() : null;

  console.log(`Import file: ${options.filePath}`);
  console.log(`Rows parsed: ${registrations.length}`);
  console.log(`Students: ${students.length}`);
  console.log(`Adults: ${adults.length}`);
  console.log(`Skipped: ${skipped.length}`);

  const { eventId, eventData } = await resolveTargetEvent(db, options);
  const studentResult = await commitStudentImports(db, students, eventId, 'script_import', options.dryRun);
  const adultResult = await upsertAdults(auth, db, adults, options.dryRun);

  console.log('\nImport complete');
  console.log(`Event: ${eventData.name} (${eventId})`);
  console.log(`Students created: ${studentResult.created.length}`);
  console.log(`Students matched: ${studentResult.matched.length}`);
  console.log(`Event student links created: ${studentResult.eventLinksCreated.length}`);
  console.log(`Event student links already existing: ${studentResult.eventLinksExisting.length}`);
  console.log(`Adult Auth accounts created: ${adultResult.authCreated.length}`);
  console.log(`Adult Auth accounts matched: ${adultResult.authMatched.length}`);
  console.log(`Adult profiles created/restored: ${adultResult.profilesCreated.length}`);
  console.log(`Adult profiles updated: ${adultResult.profilesUpdated.length}`);

  if (skipped.length > 0) {
    console.log('\nSkipped rows');
    skipped.slice(0, 25).forEach(item => console.log(`Row ${item.rowNumber}: ${item.reason}`));
    if (skipped.length > 25) console.log(`...and ${skipped.length - 25} more`);
  }

  printCredentials(adultResult.authCreated);
}

main().catch((error) => {
  console.error(`\nImport failed: ${error.message}`);
  process.exit(1);
});
