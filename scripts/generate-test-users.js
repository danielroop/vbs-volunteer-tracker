import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

const app = initializeApp({ projectId: 'vbs-volunteer-tracker' });
const db = getFirestore(app);

const firstNames = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Christopher', 'Karen',
  'Charles', 'Lisa', 'Daniel', 'Nancy', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra',
  'Donald', 'Ashley', 'Steven', 'Kimberly', 'Andrew', 'Emily', 'Paul', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa', 'Timothy', 'Deborah'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzales', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

const schools = [
  'Windermere High', 'Horizon High', 'West Orange High', 'Bishop Moore Catholic', 
  'Foundation Academy', 'The First Academy', 'Central Florida Christian Academy', 
  'Family Christian School', 'Winter Garden Christian Academy', 'Legacy High'
];

async function generateStudents(count = 50) {
  console.log(`🚀 Generating ${count} unique volunteers (Grades 5-12)...`);
  const batch = db.batch();
  const usedNames = new Set(); // Internal check to ensure total uniqueness

  let i = 0;
  while (i < count) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${lastName}`;

    if (!usedNames.has(fullName)) {
      usedNames.add(fullName);
      const school = schools[Math.floor(Math.random() * schools.length)];
      const grade = Math.floor(Math.random() * 8) + 5; 
      
      const studentData = {
        firstName,
        lastName,
        schoolName: school,
        gradeLevel: grade,
        gradYear: 2026 + (12 - grade),
        overrideHours: 0,
        createdAt: Timestamp.now()
      };

      const docRef = db.collection('students').doc();
      batch.set(docRef, studentData);
      i++;
    }
  }

  try {
    await batch.commit();
    console.log(`✅ Successfully added ${count} unique students.`);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateStudents(50);