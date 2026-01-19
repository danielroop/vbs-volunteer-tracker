import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Connect to the local Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp({
  projectId: 'vbs-volunteer-tracker' // Matches your CLAUDE.md config
});

const db = getFirestore(app);

async function createFirstEvent() {
  const eventData = {
    name: "VBS 2026",
    organizationName: "Community Church",
    startDate: "2026-06-15",
    endDate: "2026-06-19",
    supervisorName: "Heidi Estep",
    typicalStartTime: "08:45",
    typicalEndTime: "12:00",
    createdAt: Timestamp.now()
  };

  try {
    const docRef = await db.collection('events').add(eventData);
    console.log(`✅ Event created successfully with ID: ${docRef.id}`);
  } catch (error) {
    console.error('❌ Error creating event:', error.message);
  }
}

createFirstEvent();