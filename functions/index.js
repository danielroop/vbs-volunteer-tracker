/**
 * Firebase Cloud Functions Entry Point
 * VBS Volunteer Tracker
 */
process.env.TZ = 'America/New_York';


import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin
initializeApp();

// Export Cloud Functions
export { checkIn } from './src/checkIn.js';
export { checkOut } from './src/checkOut.js';
export { generateForms } from './src/generateForms.js';
