import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { generateQRData } from '../frontend/src/utils/qrCodeGenerator.js';
import QRCode from 'qrcode';
import fs from 'fs';

// Connect to local emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp({ projectId: 'vbs-volunteer-tracker' });
const db = getFirestore(app);

async function createStudentAndQR(eventId) {
  const studentData = {
    firstName: "Test",
    lastName: "Student",
    gradeLevel: "10th",
    schoolName: "Horizon High",
    formType: "ocps",
    eventId: eventId,
    createdAt: new Date()
  };

  try {
    // 1. Create the student in Firestore
    const docRef = await db.collection('students').add(studentData);
    const studentId = docRef.id;
    console.log(`✅ Student created with ID: ${studentId}`);

    // 2. Generate the formatted QR data string
    const qrString = generateQRData(studentId, eventId);
    console.log(`🔗 QR String: ${qrString}`);

    // 3. Save as an image file on your Mac
    await QRCode.toFile('./test-qr-code.png', qrString, {
      width: 500,
      margin: 2
    });
    
    console.log("📂 QR code saved to ./test-qr-code.png");
    console.log("👉 Open this image on your phone or screen and point your webcam at it!");

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Replace with the Event ID you got from your previous script
createStudentAndQR('uIBglYdGeoMKtuDtYmtn');