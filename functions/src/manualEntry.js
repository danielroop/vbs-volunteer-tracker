import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Create Manual Time Entry Cloud Function
 * Allows admins to manually log time for students.
 *
 * @param {Object} request.data
 * @param {string} request.data.studentId - Student ID
 * @param {string} request.data.eventId - Event ID
 * @param {string} request.data.activityId - Activity ID
 * @param {string} request.data.date - Date string (YYYY-MM-DD)
 * @param {string} request.data.startTime - Start time string (HH:MM)
 * @param {string} request.data.endTime - End time string (HH:MM)
 */
export const createManualTimeEntry = onCall(async (request) => {
  const { studentId, eventId, activityId, date, startTime, endTime } = request.data;

  // Validate required fields
  if (!studentId || !eventId || !activityId || !date || !startTime || !endTime) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  // Validate time logic
  const startDateTime = new Date(`${date}T${startTime}`);
  const endDateTime = new Date(`${date}T${endTime}`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
      throw new HttpsError('invalid-argument', 'Invalid date or time format');
  }

  if (endDateTime <= startDateTime) {
    throw new HttpsError('invalid-argument', 'End time must be after start time');
  }

  const db = getFirestore();

  try {
     // Verify student exists
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      throw new HttpsError('not-found', 'Student not found');
    }

    // Verify event exists
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
        throw new HttpsError('not-found', 'Event not found');
    }

    // Calculate duration
    const diffMs = endDateTime - startDateTime;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const hoursWorked = Math.round((diffMinutes / 60) * 2) / 2; // Round to nearest 0.5

    const entry = {
      studentId,
      eventId,
      activityId,
      date,
      checkInTime: Timestamp.fromDate(startDateTime),
      checkOutTime: Timestamp.fromDate(endDateTime),
      checkInMethod: 'manual',
      checkOutMethod: 'manual',
      entry_source: 'manual',
      hoursWorked,
      rawMinutes: diffMinutes,
      checkInBy: 'admin', // or specific user if context is available, but for now 'admin' is safe assumption for manual entry
      checkOutBy: 'admin',
      reviewStatus: 'approved', // Manual entries are implicitly approved
      flags: [],
      isVoided: false,
      createdAt: Timestamp.now(),
      modifiedBy: 'admin',
      modifiedAt: Timestamp.now(),
      modificationReason: 'Manual entry creation',
      changeLog: []
    };

    const docRef = await db.collection('timeEntries').add(entry);

    return {
      success: true,
      entryId: docRef.id,
      hoursWorked
    };

  } catch (error) {
    console.error('Manual entry error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});
