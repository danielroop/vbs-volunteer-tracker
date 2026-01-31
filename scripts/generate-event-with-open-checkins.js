import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

/**
 * generate-event-with-open-checkins.js
 * Usage:
 * Emulator:   node generate-event-with-open-checkins.js
 * Production: NODE_ENV=production node generate-event-with-open-checkins.js
 */

const isProd = process.env.NODE_ENV === 'production';

if (!isProd) {
  // --- EMULATOR CONFIGURATION ---
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

  initializeApp({
    projectId: 'vbs-volunteer-tracker'
  });

  console.log('🔌 Connected to local FIRESTORE EMULATOR');
} else {
  // --- PRODUCTION CONFIGURATION ---
  const serviceAccount = JSON.parse(
    readFileSync(new URL('./service-account.json', import.meta.url))
  );

  initializeApp({
    credential: cert(serviceAccount),
    projectId: 'vbs-volunteer-tracker'
  });

  console.log('🚀 Connected to PRODUCTION Firebase instance');
}

const db = getFirestore();

// Helper to add random minutes (positive or negative)
const addRandomMinutes = (date, range = 15) => {
  const result = new Date(date);
  const offset = Math.floor(Math.random() * (range * 2 + 1)) - range;
  result.setMinutes(result.getMinutes() + offset);
  return result;
};

const pad = (v) => String(v).padStart(2, '0');
const formatTimeHHMM = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

async function run() {
  console.log('🚀 Creating event with two 6+ hour activities that started 4 hours ago...');

  // 1) Compute start/end times
  const now = new Date();
  const start = new Date(now);
  start.setHours(start.getHours() - 4); // starts 4 hours prior to current time
  start.setSeconds(0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + 6); // at least 6 hours long

  const startStr = formatTimeHHMM(start);
  const endStr = formatTimeHHMM(end);

  // 2) Create event document
  const eventData = {
    name: `Open Checkins Test ${now.toISOString()}`,
    organizationName: 'Test Organization',
    contactName: 'script_gen',
    startDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(start),
    endDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(end),
    activities: [
      { id: 'training', name: 'Training', startTime: startStr, endTime: endStr },
      { id: 'work-hours', name: 'Work Hours', startTime: startStr, endTime: endStr }
    ],
    createdAt: Timestamp.now()
  };

  try {
    const eventRef = await db.collection('events').add(eventData);
    console.log(`✅ Created event with ID: ${eventRef.id}`);

    // 3) Fetch students
    const studentsSnap = await db.collection('students').get();
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (students.length === 0) {
      console.warn('⚠️ No students found. Add students before running this script.');
      return;
    }

    // 4) Create time entries for work-hours where students are checked in but not checked out
    const batch = db.batch();
    let count = 0;

    students.forEach(student => {
      const checkIn = addRandomMinutes(start, 30); // +/- 30 minutes around the activity start

      const tRef = db.collection('timeEntries').doc();
      batch.set(tRef, {
        studentId: student.id,
        eventId: eventRef.id,
        activityId: 'work-hours',
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(checkIn),
        checkInTime: Timestamp.fromDate(checkIn),
        checkOutTime: null, // Not yet checked out
        checkInBy: 'script_gen',
        checkInMethod: 'script',
        checkOutBy: null,
        checkOutMethod: null,
        reviewStatus: 'pending',
        flags: [],
        createdAt: Timestamp.now()
      });
      count++;
    });

    await batch.commit();
    console.log(`✅ Created ${count} open check-in time entries for event ${eventRef.id}`);
    console.log(`Event startTime=${startStr} endTime=${endStr}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

run();
