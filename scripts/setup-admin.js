#!/usr/bin/env node

/**
 * Setup Admin User in Firebase Emulator
 *
 * This script creates the initial admin user in the Firebase Auth emulator
 * and adds them to the admins collection in Firestore.
 *
 * Usage: node scripts/setup-admin.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

// Initialize Firebase Admin with emulator
const app = initializeApp({
  projectId: 'demo-vbs-tracker'
});

const auth = getAuth(app);
const db = getFirestore(app);

const DEFAULT_ADMIN = {
  email: 'admin@vbstrack.local',
  password: 'Admin123!VBS',
  name: 'System Administrator',
  role: 'admin'
};

async function setupAdmin() {
  console.log('🚀 Setting up admin user in Firebase Emulator...\n');

  try {
    // Check if user already exists
    let user;
    try {
      user = await auth.getUserByEmail(DEFAULT_ADMIN.email);
      console.log(`✓ Admin user already exists: ${DEFAULT_ADMIN.email}`);
      console.log(`  UID: ${user.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create the user
        console.log(`Creating admin user: ${DEFAULT_ADMIN.email}`);
        user = await auth.createUser({
          email: DEFAULT_ADMIN.email,
          password: DEFAULT_ADMIN.password,
          emailVerified: true,
          displayName: DEFAULT_ADMIN.name
        });
        console.log(`✓ Admin user created successfully`);
        console.log(`  UID: ${user.uid}`);
      } else {
        throw error;
      }
    }

    // Add/update admin document in Firestore
    const adminRef = db.collection('admins').doc(user.uid);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      await adminRef.set({
        email: DEFAULT_ADMIN.email,
        name: DEFAULT_ADMIN.name,
        role: DEFAULT_ADMIN.role,
        createdAt: new Date(),
        isActive: true
      });
      console.log(`✓ Admin document created in Firestore`);
    } else {
      console.log(`✓ Admin document already exists in Firestore`);
    }

    console.log('\n✅ Admin setup complete!\n');
    console.log('Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email:    ${DEFAULT_ADMIN.email}`);
    console.log(`Password: ${DEFAULT_ADMIN.password}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('You can now login at: http://localhost:3000/login\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error setting up admin:', error.message);
    process.exit(1);
  }
}

setupAdmin();
