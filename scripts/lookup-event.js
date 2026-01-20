import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Connect to the local Firestore emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp({ projectId: 'vbs-volunteer-tracker' });
const db = getFirestore(app);

async function getEventJson(eventId) {
  console.log(`🔍 Fetching JSON for event: ${eventId}...`);

  try {
    const docRef = db.collection('events').doc(eventId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      console.error('❌ Error: Event not found.');
      return;
    }

    // This converts the Firestore document into a standard JS object
    const eventData = {
      id: docSnap.id,
      ...docSnap.data()
    };

    // Output to console
    console.log('\n--- EVENT JSON DATA ---');
    console.log(JSON.stringify(eventData, null, 2));
    console.log('------------------------\n');

    // Optional: Save to a file
    const fileName = `event_${eventId}.json`;
    fs.writeFileSync(fileName, JSON.stringify(eventData, null, 2));
    console.log(`💾 Data saved to ${fileName}`);

  } catch (error) {
    console.error('❌ Error fetching event:', error.message);
  }
}

// The specific ID you requested
getEventJson('9hkuf2x6K8YcIdtuMmbG');