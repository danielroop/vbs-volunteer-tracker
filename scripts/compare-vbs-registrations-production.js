#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { extname, resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const DEFAULT_PROJECT_ID = 'vbs-volunteer-tracker';
const VBS_2026_SCHOOL_YEAR_END = 2026;

const STUDENT_REGISTRATION_TYPES = new Set([
  'middle school registrant (current 6th-8th grader)',
  'high school registrant (current 9th-12th grader)',
]);
const ADULT_REGISTRATION_TYPE = '18+ registrant';

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
    eventId: '9hkuf2x6K8YcIdtuMmbG',
    projectId: DEFAULT_PROJECT_ID,
    serviceAccount: null,
    listEvents: false,
    applyMissing: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];

    if (arg === '--event-id') options.eventId = next();
    else if (arg === '--project') options.projectId = next();
    else if (arg === '--service-account') options.serviceAccount = next();
    else if (arg === '--list-events') options.listEvents = true;
    else if (arg === '--apply-missing') options.applyMissing = true;
    else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (!options.filePath) {
      options.filePath = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.filePath && !options.listEvents) throw new Error('Missing registrations CSV path.');
  if (!options.serviceAccount) throw new Error('Missing --service-account path.json.');
  if (!options.eventId && !options.listEvents) throw new Error('Missing --event-id.');
  return options;
}

function printUsage() {
  console.log(`Usage:
  node scripts/compare-vbs-registrations-production.js registrations.csv \\
    --service-account scripts/service-account.json \\
    --event-id 9hkuf2x6K8YcIdtuMmbG

  node scripts/compare-vbs-registrations-production.js --list-events \\
    --service-account scripts/service-account.json

This script is read-only. It compares CSV student rows to Firestore students
linked to the event, and adult rows to Firebase Auth/user profiles.

Pass --apply-missing to create only the CSV students/adults reported missing.`);
}

function initializeFirebase(options) {
  if (getApps().length) return;
  const serviceAccount = JSON.parse(readFileSync(resolve(options.serviceAccount), 'utf8'));
  initializeApp({
    credential: cert(serviceAccount),
    projectId: options.projectId,
  });
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
  if (extname(filePath).toLowerCase() !== '.csv') {
    throw new Error('Please provide a CSV file.');
  }

  const bytes = readFileSync(resolve(filePath));
  return parseCsv(new TextDecoder('windows-1252').decode(bytes));
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
  return String(VBS_2026_SCHOOL_YEAR_END + (12 - grade));
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
      if (!student.firstName || !student.lastName) skipped.push({ rowNumber, reason: 'student row missing first or last name' });
      else students.push({ rowNumber, student });
      return;
    }

    if (registrationType === ADULT_REGISTRATION_TYPE) {
      const adult = toAdult(row);
      if (!adult.name || !adult.email) skipped.push({ rowNumber, reason: 'adult row missing name or email' });
      else adults.push({ rowNumber, adult });
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
  keys.push(nameKey);
  return keys;
}

function studentLabel(student) {
  return `${student.firstName || ''} ${student.lastName || ''}`.trim();
}

function adultLabel(adult) {
  return `${adult.name || '(no name)'} <${adult.email || 'no email'}>`;
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(14);
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

async function loadEventStudents(db, eventId) {
  const linksSnapshot = await db.collection('eventStudents').where('eventId', '==', eventId).get();
  const ids = [...new Set(linksSnapshot.docs.map(doc => doc.data().studentId).filter(Boolean))];
  const students = [];

  for (let i = 0; i < ids.length; i += 300) {
    const docs = await Promise.all(ids.slice(i, i + 300).map(id => db.collection('students').doc(id).get()));
    docs.forEach(doc => {
      if (doc.exists) students.push({ id: doc.id, ...doc.data() });
    });
  }

  return students;
}

function indexStudents(students) {
  const byKey = new Map();
  students.forEach(student => {
    studentKeys(student).forEach(key => {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(student);
    });
  });
  return byKey;
}

function findStudent(student, byKey) {
  for (const key of studentKeys(student)) {
    const matches = byKey.get(key);
    if (matches?.length) return matches[0];
  }
  return null;
}

async function compareStudents(db, csvStudents, eventId) {
  const prodStudents = await loadEventStudents(db, eventId);
  const prodByKey = indexStudents(prodStudents);
  const csvByKey = indexStudents(csvStudents.map(item => item.student));

  const missingInProd = csvStudents.filter(item => !findStudent(item.student, prodByKey));
  const extraInProd = prodStudents.filter(student => !findStudent(student, csvByKey));

  return { prodStudents, missingInProd, extraInProd };
}

async function compareAdults(auth, db, csvAdults) {
  const missingAuth = [];
  const missingProfiles = [];
  const matched = [];

  for (const item of csvAdults) {
    let userRecord = null;
    try {
      userRecord = await auth.getUserByEmail(item.adult.email);
    } catch (error) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    let profile = null;
    if (userRecord) {
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      if (userDoc.exists) profile = { id: userDoc.id, ...userDoc.data() };
    }

    if (!userRecord) missingAuth.push(item);
    else if (!profile) missingProfiles.push({ ...item, userRecord });
    else matched.push({ ...item, userRecord, profile });
  }

  const profileSnapshot = await db.collection('users').where('role', '==', 'adult_volunteer').get();
  const csvEmails = new Set(csvAdults.map(item => normalize(item.adult.email)));
  const extraProfiles = profileSnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(profile => !csvEmails.has(normalize(profile.email)));

  return { missingAuth, missingProfiles, matched, extraProfiles };
}

async function createMissingStudents(db, missingStudents, eventId) {
  const created = [];

  for (const item of missingStudents) {
    const studentRef = db.collection('students').doc();
    const studentData = {
      ...item.student,
      overrideHours: 0,
      createdAt: Timestamp.now(),
      importSource: 'vbs-registration-import',
    };

    const linkData = {
      eventId,
      studentId: studentRef.id,
      addedAt: Timestamp.now(),
      addedBy: 'script_import',
      source: 'vbs-registration-import',
    };

    const batch = db.batch();
    batch.set(studentRef, studentData);
    batch.set(db.collection('eventStudents').doc(), linkData);
    await batch.commit();

    created.push({ rowNumber: item.rowNumber, id: studentRef.id, student: studentData });
  }

  return created;
}

async function createMissingAdults(auth, db, missingAuth, missingProfiles) {
  const createdAuth = [];
  const createdProfiles = [];

  for (const item of missingAuth) {
    const password = generatePassword();
    const userRecord = await auth.createUser({
      email: item.adult.email,
      password,
      displayName: item.adult.name,
      emailVerified: true,
    });

    await db.collection('users').doc(userRecord.uid).set({
      email: item.adult.email,
      name: item.adult.name,
      phone: item.adult.phone,
      role: 'adult_volunteer',
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      importSource: 'vbs-registration-import',
    });

    createdAuth.push({ rowNumber: item.rowNumber, user: userRecord, password, adult: item.adult });
    createdProfiles.push({ rowNumber: item.rowNumber, user: userRecord, adult: item.adult });
  }

  for (const item of missingProfiles) {
    await db.collection('users').doc(item.userRecord.uid).set({
      email: item.adult.email,
      name: item.adult.name,
      phone: item.adult.phone,
      role: 'adult_volunteer',
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      importSource: 'vbs-registration-import',
    });
    createdProfiles.push({ rowNumber: item.rowNumber, user: item.userRecord, adult: item.adult });
  }

  return { createdAuth, createdProfiles };
}

function printList(title, items, format, limit = 50) {
  console.log(`\n${title}: ${items.length}`);
  items.slice(0, limit).forEach(item => console.log(`- ${format(item)}`));
  if (items.length > limit) console.log(`...and ${items.length - limit} more`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  initializeFirebase(options);
  const db = getFirestore();
  const auth = getAuth();

  if (options.listEvents) {
    const snapshot = await db.collection('events').get();
    console.log(`Production events: ${snapshot.size}`);
    snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .forEach(event => {
        const dates = [event.startDate, event.endDate].filter(Boolean).join(' to ');
        const dateLabel = dates ? ` (${dates})` : '';
        console.log(`- ${event.name || '(unnamed event)'}${dateLabel}: ${event.id}`);
      });
    return;
  }

  const registrations = readRegistrations(options.filePath);
  const { students, adults, skipped } = classifyRows(registrations);

  const eventDoc = await db.collection('events').doc(options.eventId).get();
  if (!eventDoc.exists) throw new Error(`Event not found: ${options.eventId}`);

  const studentResult = await compareStudents(db, students, options.eventId);
  const adultResult = await compareAdults(auth, db, adults);

  console.log(`CSV: ${options.filePath}`);
  console.log(`Event: ${eventDoc.data().name || '(unnamed event)'} (${eventDoc.id})`);
  console.log(`CSV rows parsed: ${registrations.length}`);
  console.log(`CSV students: ${students.length}`);
  console.log(`CSV adults: ${adults.length}`);
  console.log(`CSV skipped: ${skipped.length}`);
  console.log(`Production event students: ${studentResult.prodStudents.length}`);
  console.log(`Production adult profiles: ${adultResult.matched.length + adultResult.extraProfiles.length}`);

  printList(
    'CSV students missing from production event',
    studentResult.missingInProd,
    item => `row ${item.rowNumber}: ${studentLabel(item.student)} grad ${item.student.gradYear || '(unknown)'}`,
  );
  printList(
    'Production event students not in CSV',
    studentResult.extraInProd,
    student => `${studentLabel(student)} grad ${student.gradYear || '(unknown)'} [${student.id}]`,
  );
  printList(
    'CSV adults missing Firebase Auth account',
    adultResult.missingAuth,
    item => `row ${item.rowNumber}: ${adultLabel(item.adult)}`,
  );
  printList(
    'CSV adults missing Firestore user profile',
    adultResult.missingProfiles,
    item => `row ${item.rowNumber}: ${adultLabel(item.adult)} [auth uid ${item.userRecord.uid}]`,
  );
  printList(
    'Production adult profiles not in CSV',
    adultResult.extraProfiles,
    profile => `${profile.name || '(no name)'} <${profile.email || 'no email'}> [${profile.id}]`,
  );

  if (options.applyMissing) {
    console.log('\nApplying missing CSV records to production...');
    const createdStudents = await createMissingStudents(db, studentResult.missingInProd, options.eventId);
    const createdAdults = await createMissingAdults(auth, db, adultResult.missingAuth, adultResult.missingProfiles);

    console.log(`Students created and linked to event: ${createdStudents.length}`);
    createdStudents.forEach(item => {
      console.log(`- row ${item.rowNumber}: ${studentLabel(item.student)} [${item.id}]`);
    });
    console.log(`Adult Auth accounts created: ${createdAdults.createdAuth.length}`);
    console.log(`Adult profiles created: ${createdAdults.createdProfiles.length}`);

    if (createdAdults.createdAuth.length > 0) {
      console.log('\nNew adult volunteer credentials');
      console.log('email,password,name');
      createdAdults.createdAuth.forEach(({ user, password }) => {
        console.log(`${user.email},${password},${user.displayName || ''}`);
      });
    }
  }

  if (skipped.length > 0) {
    printList('Skipped CSV rows', skipped, item => `row ${item.rowNumber}: ${item.reason}`, 25);
  }
}

main().catch(error => {
  console.error(`\nCompare failed: ${error.message}`);
  process.exit(1);
});
