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

// User Management Functions
export { createUser, updateUser, deleteUser, listUsers, resetUserPassword } from './src/userManagement.js';

// Daily Review Functions (PRD Section 3.5.2)
export { forceCheckOut, forceAllCheckOut, getDailyReviewSummary } from './src/dailyReview.js';

// Void/Restore Functions (Soft Delete)
export { voidTimeEntry, restoreTimeEntry } from './src/voidEntry.js';
