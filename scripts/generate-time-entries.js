import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

/**
 * generate-time-entries.js
 * Usage:
 * Emulator:   node generate-time-entries.js
 * Production: NODE_ENV=production node generate-time-entries.js
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

const EVENT_ID = 'qyJ9b9SOB0zzIrenV5ev';

// Helper to add random minutes (positive or negative)
const addRandomMinutes = (date, range = 15) => {
  const result = new Date(date);
  const offset = Math.floor(Math.random() * (range * 2 + 1)) - range;
  result.setMinutes(result.getMinutes() + offset);
  return result;
};

async function generateVBSData() {
  console.log("🚀 Generating attendance for VBS 2026...");

  const studentsSnap = await db.collection('students').get();
  const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  if (students.length === 0) {
    console.error("❌ No students found. Run generate-test-users.js first.");
    return;
  }

  const batch = db.batch();
  let entriesCount = 0;

  // Configuration
  const vbsStartDate = new Date('2026-01-24'); // Assuming a Monday start for VBS
  const trainingDate = new Date();
  trainingDate.setDate(trainingDate.getDate() + 7);
  trainingDate.setHours(9, 0, 0, 0);

  students.forEach((student, index) => {
    // 1. Training Logic (Exclude 2 students)
    if (index >= 2) {
      const trainIn = addRandomMinutes(trainingDate, 5);
      const trainOut = new Date(trainIn);
      trainOut.setHours(trainOut.getHours() + 6);

      const tRef = db.collection('timeEntries').doc();
      batch.set(tRef, {
        studentId: student.id,
        eventId: EVENT_ID,
        activityId: 'training',
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(trainIn),
        checkInTime: Timestamp.fromDate(trainIn),
        checkOutTime: Timestamp.fromDate(trainOut),
        checkInBy: 'script_gen',
        checkInMethod: 'script',
        checkOutBy: 'script_gen',
        checkOutMethod: 'script',
        reviewStatus: 'pending',
        flags: [],
        createdAt: Timestamp.now()
      });
      entriesCount++;
    }

    // 2. Work Hours Logic (Daily for 5 days)
    const isSkipsDays = index < 10;
    const daysToSkip = isSkipsDays ? [Math.floor(Math.random() * 5), Math.floor(Math.random() * 5)] : [];

    for (let day = 0; day < 5; day++) {
      if (isSkipsDays && daysToSkip.includes(day)) continue;

      const currentDay = new Date(vbsStartDate);
      currentDay.setDate(vbsStartDate.getDate() + day);

      const baseStart = new Date(currentDay);
      if (day === 0) {
        baseStart.setHours(8, 30, 0, 0);
      } else {
        baseStart.setHours(8, 45, 0, 0);
      }

      const baseEnd = new Date(currentDay);
      baseEnd.setHours(12, 0, 0, 0);

      const checkIn = addRandomMinutes(baseStart, 15);

      // Logic: No one checks out on Day 4 (the 5th day)
      // Logic: 10% chance a student "forgets" to check out on any other day
      const isLastDay = day === 4;
      const forgotCheckOut = Math.random() < 0.10;
      const shouldSkipCheckOut = isLastDay || forgotCheckOut;

      const checkOut = shouldSkipCheckOut ? null : addRandomMinutes(baseEnd, 15);

      const wRef = db.collection('timeEntries').doc();
      batch.set(wRef, {
        studentId: student.id,
        eventId: EVENT_ID,
        activityId: 'work-hours',
        date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(checkIn),
        checkInTime: Timestamp.fromDate(checkIn),
        // If checkOut is null, we don't call Timestamp.fromDate
        checkOutTime: checkOut ? Timestamp.fromDate(checkOut) : null,
        checkInBy: 'script_gen',
        checkInMethod: 'script',
        // Set these to null if they didn't check out
        checkOutBy: checkOut ? 'script_gen' : null,
        checkOutMethod: checkOut ? 'script' : null,
        reviewStatus: 'pending',
        flags: [],
        createdAt: Timestamp.now()
      });
      entriesCount++;
    }
  });

  try {
    await batch.commit();
    console.log(`✅ Success! Generated ${entriesCount} time entries.`);
  } catch (err) {
    console.error("❌ Batch failed:", err.message);
  }
}

generateVBSData();