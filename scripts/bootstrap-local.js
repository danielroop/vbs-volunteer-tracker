#!/usr/bin/env node

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * bootstrap-local.js
 *
 * Seeds the Firebase emulators with a usable local environment:
 * - default admin user
 * - one VBS event with training and work-hours activities
 * - randomized student volunteers
 * - realistic time entries through day 2 of the work-hours activity
 *
 * Usage:
 *   node bootstrap-local.js
 *   node bootstrap-local.js --students 100
 *   node bootstrap-local.js -n 100
 *   node bootstrap-local.js 100
 */

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

const app = initializeApp({ projectId: 'vbs-volunteer-tracker' });
const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_ADMIN = {
  email: 'admin@vbstrack.local',
  password: 'Admin123!VBS',
  name: 'System Administrator',
  role: 'admin'
};

const DEFAULT_STUDENT_COUNT = 50;
const TIME_ZONE = 'America/New_York';

const firstNames = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Charles', 'Lisa', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Paul', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah',
  'Caleb', 'Hannah', 'Isaac', 'Grace', 'Noah', 'Ava', 'Ethan', 'Mia', 'Lucas', 'Sophia',
  'Mason', 'Isabella', 'Logan', 'Charlotte', 'Elijah', 'Amelia', 'Owen', 'Harper', 'Wyatt', 'Evelyn'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzales', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts',
  'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Cooper', 'Richardson'
];

const schools = [
  'Windermere High', 'Horizon High', 'West Orange High', 'Bishop Moore Catholic',
  'Foundation Academy', 'The First Academy', 'Central Florida Christian Academy',
  'Family Christian School', 'Winter Garden Christian Academy', 'Legacy High'
];

function parseStudentCount(argv) {
  const studentsFlagIndex = argv.findIndex(arg => arg === '--students' || arg === '-n');
  const rawCount = studentsFlagIndex >= 0 ? argv[studentsFlagIndex + 1] : argv.find(arg => /^\d+$/.test(arg));
  const count = Number.parseInt(rawCount || DEFAULT_STUDENT_COUNT, 10);

  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Student count must be a positive integer.');
  }

  if (count > firstNames.length * lastNames.length) {
    throw new Error(`Student count is too high for unique generated names. Max: ${firstNames.length * lastNames.length}.`);
  }

  return count;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function atTime(date, hour, minute) {
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
}

function addMinutes(date, minutes) {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function choose(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(date);
}

function calculateHours(checkIn, checkOut) {
  if (!checkOut) {
    return { rawMinutes: null, hoursWorked: null };
  }

  const rawMinutes = Math.floor((checkOut.getTime() - checkIn.getTime()) / 1000 / 60);
  const hoursWorked = Math.round((rawMinutes / 60) * 2) / 2;
  return { rawMinutes, hoursWorked };
}

function attendanceOffset() {
  const roll = Math.random();

  if (roll < 0.78) return randomInt(-15, 15);
  if (roll < 0.92) return randomInt(16, 35);
  if (roll < 0.97) return randomInt(-30, -16);
  return randomInt(36, 60);
}

function checkoutOffset() {
  const roll = Math.random();

  if (roll < 0.82) return randomInt(-15, 15);
  if (roll < 0.94) return randomInt(16, 30);
  return randomInt(-30, -16);
}

function buildTimeEntry({ studentId, eventId, activityId, checkIn, checkOut, flags = [] }) {
  const { rawMinutes, hoursWorked } = calculateHours(checkIn, checkOut);

  return {
    studentId,
    eventId,
    activityId,
    date: formatDate(checkIn),
    checkInTime: Timestamp.fromDate(checkIn),
    checkOutTime: checkOut ? Timestamp.fromDate(checkOut) : null,
    checkInBy: 'script_gen',
    checkInMethod: 'script',
    checkOutBy: checkOut ? 'script_gen' : null,
    checkOutMethod: checkOut ? 'script' : null,
    entry_source: 'bootstrap-local',
    hoursWorked,
    rawMinutes,
    reviewStatus: 'pending',
    flags,
    isVoided: false,
    createdAt: Timestamp.now()
  };
}

async function commitInChunks(writes, label) {
  const chunkSize = 450;

  for (let i = 0; i < writes.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = writes.slice(i, i + chunkSize);

    chunk.forEach(({ ref, data }) => batch.set(ref, data));
    await batch.commit();
  }

  console.log(`✅ ${label}: ${writes.length}`);
}

async function setupAdmin() {
  let user;

  try {
    user = await auth.getUserByEmail(DEFAULT_ADMIN.email);
    console.log(`✓ Admin user already exists: ${DEFAULT_ADMIN.email}`);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') {
      throw error;
    }

    user = await auth.createUser({
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
      emailVerified: true,
      displayName: DEFAULT_ADMIN.name
    });
    console.log(`✅ Admin user created: ${DEFAULT_ADMIN.email}`);
  }

  const adminRef = db.collection('admins').doc(user.uid);
  const adminDoc = await adminRef.get();

  await adminRef.set({
    email: DEFAULT_ADMIN.email,
    name: DEFAULT_ADMIN.name,
    role: DEFAULT_ADMIN.role,
    createdAt: adminDoc.exists ? adminDoc.data().createdAt : Timestamp.now(),
    isActive: true
  }, { merge: true });

  return user;
}

async function createEvent() {
  const today = atTime(new Date(), 0, 0);
  const trainingDate = addDays(today, -2);
  const workStartDate = addDays(today, -1);
  const workEndDate = addDays(workStartDate, 4);

  const eventData = {
    name: `Local VBS Bootstrap ${formatDate(today)}`,
    organizationName: 'Community Church',
    contactName: 'Heidi Estep',
    supervisorName: 'Heidi Estep',
    startDate: formatDate(trainingDate),
    endDate: formatDate(workEndDate),
    typicalStartTime: '09:30',
    typicalEndTime: '12:30',
    activities: [
      {
        id: 'training',
        name: 'Training',
        startDate: formatDate(trainingDate),
        endDate: formatDate(trainingDate),
        startTime: '08:00',
        endTime: '14:00'
      },
      {
        id: 'work-hours',
        name: 'Work Hours',
        startDate: formatDate(workStartDate),
        endDate: formatDate(workEndDate),
        startTime: '09:30',
        endTime: '12:30'
      }
    ],
    createdAt: Timestamp.now()
  };

  const eventRef = await db.collection('events').add(eventData);
  console.log(`✅ Event created: ${eventData.name} (${eventRef.id})`);

  return {
    eventId: eventRef.id,
    trainingDate,
    workStartDate,
    workEndDate
  };
}

async function createStudents(count) {
  const writes = [];
  const students = [];
  const usedNames = new Set();

  while (students.length < count) {
    const firstName = choose(firstNames);
    const lastName = choose(lastNames);
    const fullName = `${firstName} ${lastName}`;

    if (usedNames.has(fullName)) continue;
    usedNames.add(fullName);

    const gradeLevel = randomInt(5, 12);
    const student = {
      firstName,
      lastName,
      schoolName: choose(schools),
      gradeLevel,
      gradYear: new Date().getFullYear() + (12 - gradeLevel),
      overrideHours: 0,
      createdAt: Timestamp.now(),
      seedSource: 'bootstrap-local'
    };
    const ref = db.collection('students').doc();

    writes.push({ ref, data: student });
    students.push({ id: ref.id, ...student });
  }

  await commitInChunks(writes, 'Students created');
  return students;
}

async function createTimeEntries(students, eventId, trainingDate, workStartDate) {
  const writes = [];

  students.forEach((student) => {
    if (Math.random() >= 0.12) {
      const checkIn = addMinutes(atTime(trainingDate, 8, 0), attendanceOffset());
      const checkOut = addMinutes(atTime(trainingDate, 14, 0), checkoutOffset());
      const flags = [];

      if (checkIn > addMinutes(atTime(trainingDate, 8, 0), 15)) flags.push('late_arrival');

      writes.push({
        ref: db.collection('timeEntries').doc(),
        data: buildTimeEntry({
          studentId: student.id,
          eventId,
          activityId: 'training',
          checkIn,
          checkOut,
          flags
        })
      });
    }

    for (let day = 0; day < 2; day++) {
      const workDate = addDays(workStartDate, day);
      const noShowChance = day === 0 ? 0.16 : 0.08;

      if (Math.random() < noShowChance) continue;

      const baseCheckIn = atTime(workDate, 9, 30);
      const baseCheckOut = atTime(workDate, 12, 30);
      const checkIn = addMinutes(baseCheckIn, attendanceOffset());
      const forgotCheckout = Math.random() < (day === 1 ? 0.08 : 0.04);
      const checkOut = forgotCheckout ? null : addMinutes(baseCheckOut, checkoutOffset());
      const flags = [];

      if (checkIn > addMinutes(baseCheckIn, 15)) flags.push('late_arrival');
      if (!checkOut) flags.push('missing_checkout');

      writes.push({
        ref: db.collection('timeEntries').doc(),
        data: buildTimeEntry({
          studentId: student.id,
          eventId,
          activityId: 'work-hours',
          checkIn,
          checkOut,
          flags
        })
      });
    }
  });

  await commitInChunks(writes, 'Time entries created');
  return writes.length;
}

async function main() {
  const studentCount = parseStudentCount(process.argv.slice(2));

  console.log('🔌 Connected to local Firebase emulators');
  console.log(`🚀 Bootstrapping local data with ${studentCount} students...\n`);

  await setupAdmin();
  const { eventId, trainingDate, workStartDate, workEndDate } = await createEvent();
  const students = await createStudents(studentCount);
  const timeEntryCount = await createTimeEntries(students, eventId, trainingDate, workStartDate);

  console.log('\n✅ Local bootstrap complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Admin email:    ${DEFAULT_ADMIN.email}`);
  console.log(`Admin password: ${DEFAULT_ADMIN.password}`);
  console.log(`Event ID:       ${eventId}`);
  console.log(`Training date:  ${formatDate(trainingDate)} 08:00-14:00`);
  console.log(`Work dates:     ${formatDate(workStartDate)} through ${formatDate(workEndDate)} 09:30-12:30`);
  console.log(`Students:       ${students.length}`);
  console.log(`Time entries:   ${timeEntryCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch((error) => {
  console.error('\n❌ Bootstrap failed:', error.message);
  process.exit(1);
});
