import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Connect to emulators in development (optional)
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const firestoreHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const authHost = import.meta.env.VITE_AUTH_EMULATOR_HOST || 'localhost:9099';

  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, `http://${authHost}`);
  connectFunctionsEmulator(functions, 'localhost', 5001);

  console.log('🔧 Connected to Firebase Emulators');
}

export default app;
