import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp({ projectId: 'vbs-volunteer-tracker' });
const db = getFirestore(app);

const EVENT_ID = '9hkuf2x6K8YcIdtuMmbG';

async function checkInStudentsToday(count = 45) {
  console.log(`🚀 Checking in ${count} students for today's session...`);

  try {
    const studentsSnap = await db.collection('students').get();
    const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (students.length === 0) {
      console.error("❌ No students found in database.");
      return;
    }

    const batch = db.batch();
    const now = new Date();
    
    // Check in the first 45 students found
    const studentsToCheckIn = students.slice(0, count);

    studentsToCheckIn.forEach((student) => {
      const entryRef = db.collection('timeEntries').doc();
      
      batch.set(entryRef, {
        studentId: student.id,
        eventId: EVENT_ID,
        activityId: 'work-hours',
        // Check-in time is 'now' with a slight random variance for realism
        checkInTime: Timestamp.fromDate(new Date(now.getTime() - Math.random() * 30 * 60000)),
        checkOutTime: null, // Leaving this null makes them "Currently Checked In"
        scannedBy: 'live_test_script'
      });
    });

    await batch.commit();
    console.log(`✅ Success! ${studentsToCheckIn.length} students are now marked as Checked In.`);
    console.log(`📊 Check your dashboard to see the 'Volunteers On-Site' count update.`);

  } catch (error) {
    console.error("❌ Error during check-in:", error.message);
  }
}

checkInStudentsToday(45);