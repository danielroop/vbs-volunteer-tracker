import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Connect to emulators if in development
if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  console.log('🔧 Connecting to Firebase Emulators...');

  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL);
  connectFirestoreEmulator(
    db,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST,
    parseInt(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT)
  );
  connectFunctionsEmulator(
    functions,
    import.meta.env.VITE_FIRESTORE_EMULATOR_HOST,
    5001
  );
  connectStorageEmulator(
    storage,
    import.meta.env.VITE_STORAGE_EMULATOR_HOST,
    parseInt(import.meta.env.VITE_STORAGE_EMULATOR_PORT)
  );

  console.log('✅ Connected to Firebase Emulators');
}

export default app;
