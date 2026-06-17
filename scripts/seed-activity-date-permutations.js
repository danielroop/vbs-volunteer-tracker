#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.FIREBASE_STORAGE_EMULATOR_HOST = process.env.FIREBASE_STORAGE_EMULATOR_HOST || 'localhost:9199';

const PROJECT_ID = 'vbs-volunteer-tracker';
const BUCKET_NAME = 'vbs-volunteer-tracker.firebasestorage.app';
const SEED_SOURCE = 'issue-115-activity-date-permutations';
const EVENT_ID = 'issue115-date-permutations';
const TEMPLATE_ID = 'issue115-compact-date-template';
const TEMPLATE_STORAGE_PATH = 'pdfTemplates/issue115-compact-date-template.pdf';
const TEMPLATE_DIR_URL = existsSync(fileURLToPath(new URL('./data/templates/', import.meta.url)))
  ? new URL('./data/templates/', import.meta.url)
  : new URL('./templates/', import.meta.url);

const app = initializeApp({
  projectId: PROJECT_ID,
  storageBucket: BUCKET_NAME,
});
const db = getFirestore(app);
const bucket = getStorage(app).bucket(BUCKET_NAME);

const students = [
  {
    id: 'issue115-single-date',
    firstName: 'Ivy',
    lastName: 'SingleDate',
    schoolName: 'West Orange High',
    gradeLevel: 10,
    gradYear: 2028,
    notes: 'One service date. Activity Table should show 6/9.',
  },
  {
    id: 'issue115-consecutive-range',
    firstName: 'Caleb',
    lastName: 'ConsecutiveRange',
    schoolName: 'West Orange High',
    gradeLevel: 11,
    gradYear: 2027,
    notes: 'Four consecutive dates. Activity Table should show 6/9-6/12.',
  },
  {
    id: 'issue115-mixed-dates',
    firstName: 'Mia',
    lastName: 'MixedDates',
    schoolName: 'West Orange High',
    gradeLevel: 9,
    gradYear: 2029,
    notes: 'Consecutive dates plus a gap. Activity Table should show 6/9-6/11, 6/13.',
  },
  {
    id: 'issue115-duplicate-dates',
    firstName: 'Leo',
    lastName: 'DuplicateDates',
    schoolName: 'West Orange High',
    gradeLevel: 12,
    gradYear: 2026,
    notes: 'Multiple entries on one date plus another date. Activity Table should dedupe to 6/9-6/10.',
  },
  {
    id: 'issue115-long-date-list',
    firstName: 'Nina',
    lastName: 'LongDateList',
    schoolName: 'West Orange High',
    gradeLevel: 10,
    gradYear: 2028,
    notes: 'Many non-consecutive dates. Activity Table should stay compact and shrink if needed.',
  },
  {
    id: 'issue115-multiple-activities',
    firstName: 'Taylor',
    lastName: 'MultipleActivities',
    schoolName: 'West Orange High',
    gradeLevel: 8,
    gradYear: 2030,
    notes: 'Two activity rows: one single date and one date range.',
  },
];

const activities = [
  {
    id: 'morning-service',
    name: 'Morning Service',
    startDate: '2026-06-09',
    endDate: '2026-06-13',
    startTime: '09:00',
    endTime: '12:00',
  },
  {
    id: 'afternoon-service',
    name: 'Afternoon Service',
    startDate: '2026-06-09',
    endDate: '2026-06-13',
    startTime: '13:00',
    endTime: '15:00',
  },
  {
    id: 'extended-service',
    name: 'Extended Service',
    startDate: '2026-06-01',
    endDate: '2026-06-19',
    startTime: '09:00',
    endTime: '12:00',
  },
];

const scenarios = {
  'issue115-single-date': [
    { activityId: 'morning-service', date: '2026-06-09', start: '09:00', end: '12:00' },
  ],
  'issue115-consecutive-range': [
    { activityId: 'morning-service', date: '2026-06-09', start: '09:00', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-10', start: '09:00', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-11', start: '09:00', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-12', start: '09:00', end: '12:00' },
  ],
  'issue115-mixed-dates': [
    { activityId: 'morning-service', date: '2026-06-09', start: '09:00', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-10', start: '09:00', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-11', start: '09:00', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-13', start: '09:00', end: '12:00' },
  ],
  'issue115-duplicate-dates': [
    { activityId: 'morning-service', date: '2026-06-09', start: '09:00', end: '10:30' },
    { activityId: 'morning-service', date: '2026-06-09', start: '10:30', end: '12:00' },
    { activityId: 'morning-service', date: '2026-06-10', start: '09:00', end: '12:00' },
  ],
  'issue115-long-date-list': [
    { activityId: 'extended-service', date: '2026-06-01', start: '09:00', end: '12:00' },
    { activityId: 'extended-service', date: '2026-06-03', start: '09:00', end: '12:00' },
    { activityId: 'extended-service', date: '2026-06-05', start: '09:00', end: '12:00' },
    { activityId: 'extended-service', date: '2026-06-07', start: '09:00', end: '12:00' },
    { activityId: 'extended-service', date: '2026-06-09', start: '09:00', end: '12:00' },
    { activityId: 'extended-service', date: '2026-06-11', start: '09:00', end: '12:00' },
    { activityId: 'extended-service', date: '2026-06-13', start: '09:00', end: '12:00' },
  ],
  'issue115-multiple-activities': [
    { activityId: 'morning-service', date: '2026-06-09', start: '09:00', end: '12:00' },
    { activityId: 'afternoon-service', date: '2026-06-10', start: '13:00', end: '15:00' },
    { activityId: 'afternoon-service', date: '2026-06-11', start: '13:00', end: '15:00' },
    { activityId: 'afternoon-service', date: '2026-06-12', start: '13:00', end: '15:00' },
  ],
};

function asDate(date, time) {
  return new Date(`${date}T${time}:00-04:00`);
}

function hoursBetween(start, end) {
  return Math.round(((end.getTime() - start.getTime()) / 3600000) * 4) / 4;
}

function buildEntry(studentId, row, index) {
  const checkIn = asDate(row.date, row.start);
  const checkOut = asDate(row.date, row.end);
  const hoursWorked = hoursBetween(checkIn, checkOut);

  return {
    id: `${studentId}-${index + 1}`,
    data: {
      studentId,
      eventId: EVENT_ID,
      activityId: row.activityId,
      date: row.date,
      checkInTime: Timestamp.fromDate(checkIn),
      checkOutTime: Timestamp.fromDate(checkOut),
      checkInBy: 'issue115_seed',
      checkInMethod: 'script',
      checkOutBy: 'issue115_seed',
      checkOutMethod: 'script',
      entry_source: SEED_SOURCE,
      seedSource: SEED_SOURCE,
      hoursWorked,
      rawMinutes: Math.round(hoursWorked * 60),
      reviewStatus: 'approved',
      flags: [],
      isVoided: false,
      createdAt: Timestamp.now(),
    },
  };
}

async function deleteSeedTimeEntries() {
  const snapshot = await db.collection('timeEntries').where('seedSource', '==', SEED_SOURCE).get();
  if (snapshot.empty) return 0;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  return snapshot.size;
}

function loadTemplateFields() {
  const mapping = JSON.parse(readFileSync(new URL('ocps_mapping.json', TEMPLATE_DIR_URL), 'utf8'));
  const fields = mapping.templates[0].fields;
  return fields.map(field => {
    if (field.type !== 'activityTable') return field;

    return {
      ...field,
      label: 'Activity Table Date Permutations',
      maxRows: 7,
      columns: field.columns.map(column => {
        if (column.key === 'activityDates') {
          return { ...column, maxWidth: 14, fontSize: 10 };
        }
        return column;
      }),
    };
  });
}

async function uploadTemplatePdf() {
  const token = randomUUID();
  await bucket.upload(fileURLToPath(new URL('ocps-2024-2025_community_service_form_2 (1).pdf', TEMPLATE_DIR_URL)), {
    destination: TEMPLATE_STORAGE_PATH,
    contentType: 'application/pdf',
    metadata: {
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
}

async function seed() {
  console.log('🔌 Using local Firebase emulators');
  console.log(`Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`Storage:   ${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);

  await uploadTemplatePdf();

  const deletedEntries = await deleteSeedTimeEntries();
  const batch = db.batch();

  batch.set(db.collection('pdfTemplates').doc(TEMPLATE_ID), {
    name: 'Issue 115 Compact Date Test Template',
    fileName: 'ocps-issue115-date-test.pdf',
    storagePath: TEMPLATE_STORAGE_PATH,
    pageWidth: 612,
    pageHeight: 792,
    pageCount: 1,
    fields: loadTemplateFields(),
    seedSource: SEED_SOURCE,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  batch.set(db.collection('settings').doc('pdfDefaults'), {
    defaultTemplateId: TEMPLATE_ID,
    seedSource: SEED_SOURCE,
    updatedAt: Timestamp.now(),
  }, { merge: true });

  batch.set(db.collection('events').doc(EVENT_ID), {
    name: 'Issue 115 Date Formatting Test Event',
    organizationName: 'Community Church Date Lab',
    contactName: 'Heidi Estep',
    supervisorName: 'Heidi Estep',
    contactPhone: '(555) 115-0617',
    description: 'Deterministic local data for testing compact Activity Table date formatting.',
    startDate: '2026-06-01',
    endDate: '2026-06-19',
    typicalStartTime: '09:00',
    typicalEndTime: '12:00',
    activities,
    seedSource: SEED_SOURCE,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });

  students.forEach(student => {
    batch.set(db.collection('students').doc(student.id), {
      ...student,
      overrideHours: 0,
      pdfTemplateId: TEMPLATE_ID,
      seedSource: SEED_SOURCE,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });

    batch.set(db.collection('eventStudents').doc(`${EVENT_ID}_${student.id}`), {
      eventId: EVENT_ID,
      studentId: student.id,
      addedAt: Timestamp.now(),
      addedBy: 'issue115_seed',
      seedSource: SEED_SOURCE,
    }, { merge: true });

    scenarios[student.id].forEach((row, index) => {
      const entry = buildEntry(student.id, row, index);
      batch.set(db.collection('timeEntries').doc(entry.id), entry.data);
    });
  });

  await batch.commit();

  console.log('\n✅ Issue #115 sample data ready');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Event:       Issue 115 Date Formatting Test Event`);
  console.log(`Event ID:    ${EVENT_ID}`);
  console.log(`Template:    Issue 115 Compact Date Test Template`);
  console.log(`Old entries removed before reseed: ${deletedEntries}`);
  console.log('\nStudents to inspect:');
  console.log('  Ivy SingleDate          → single date: 6/9');
  console.log('  Caleb ConsecutiveRange  → consecutive range: 6/9-6/12');
  console.log('  Mia MixedDates          → mixed range/list: 6/9-6/11, 6/13');
  console.log('  Leo DuplicateDates      → duplicate check-ins deduped: 6/9-6/10');
  console.log('  Nina LongDateList       → long date text/font-fit case');
  console.log('  Taylor MultipleActivities → multiple Activity Table rows');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

seed().catch(error => {
  console.error('\n❌ Failed to seed issue #115 data:', error.message);
  process.exit(1);
});
