import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Connect to the local Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp({ projectId: 'vbs-volunteer-tracker' });
const db = getFirestore(app);

async function cleanupStudents() {
  console.log("🧹 Starting cleanup of student records...");

  try {
    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.get();

    if (snapshot.empty) {
      console.log("No students found to clean up.");
      return;
    }

    const batch = db.batch();
    let deletedCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const firstName = data.firstName?.trim();

      // Keep records for Cayden or Braedan (case-insensitive check)
      const shouldKeep = 
        firstName?.toLowerCase() === 'cayden' || 
        firstName?.toLowerCase() === 'braedan';

      if (!shouldKeep) {
        batch.delete(doc.ref);
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      await batch.commit();
      console.log(`✅ Cleanup complete. Deleted ${deletedCount} records.`);
      console.log(`✨ Kept records for Cayden and Braedan.`);
    } else {
      console.log("No records met the deletion criteria.");
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  }
}

cleanupStudents();