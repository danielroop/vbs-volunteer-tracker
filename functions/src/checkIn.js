import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Check-In Cloud Function
 * Per PRD Section 3.2.1: Morning Check-In (AV Scanning)
 *
 * @param {Object} request.data
 * @param {string} request.data.studentId - Student ID
 * @param {string} request.data.eventId - Event ID
 * @param {string} request.data.activityId - Activity ID
 * @param {string} request.data.scannedBy - Who scanned (e.g., 'av_scan')
 */
export const checkIn = onCall(async (request) => {
  const { studentId, eventId, activityId, scannedBy } = request.data;

  // Validate required fields
  if (!studentId || !eventId || !activityId) {
    throw new HttpsError('invalid-argument', 'Missing required fields: studentId, eventId, and activityId');
  }

  const db = getFirestore();
  const today = new Date().toISOString().split('T')[0]; // "2026-06-15"

  try {
    // Check if already checked in today
    const existingQuery = await db.collection('timeEntries')
      .where('studentId', '==', studentId)
      .where('eventId', '==', eventId)
      .where('activityId', '==', activityId)
      .where('date', '==', today)
      .where('checkOutTime', '==', null)
      .get();

    // Get student info
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      throw new HttpsError('not-found', 'Student not found');
    }
    const student = studentDoc.data();

    if (!existingQuery.empty) {
      const existingEntry = existingQuery.docs[0].data();
      const checkInTime = existingEntry.checkInTime.toDate();
      return {
        success: false,
        error: `${student.firstName} Already checked in at ${checkInTime.toLocaleTimeString()}`,
        duplicate: true
      };
    }

    // Get event info for flagging
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      throw new HttpsError('not-found', 'Event not found');
    }
    const event = eventDoc.data();

    // Create time entry
    const checkInTime = Timestamp.now();
    const flags = getFlagsForCheckIn(checkInTime.toDate(), event.typicalStartTime || '09:00');

    const entry = {
      studentId,
      eventId,
      activityId,
      date: today,
      checkInTime,
      checkInBy: scannedBy || 'av_scan',
      checkInMethod: 'av_scan',
      checkOutTime: null,
      checkOutBy: null,
      checkOutMethod: null,
      hoursWorked: null,
      rawMinutes: null,
      reviewStatus: flags.length > 0 ? 'flagged' : 'pending',
      flags,
      modifiedBy: null,
      modificationReason: null,
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection('timeEntries').add(entry);

    return {
      success: true,
      studentName: `${student.firstName} ${student.lastName}`,
      checkInTime: checkInTime.toDate().toISOString(),
      entryId: docRef.id,
      flags
    };
  } catch (error) {
    console.error('Check-in error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Helper function to check if check-in should be flagged
 * Per PRD Section 3.4.2: Flag if >15 min before typical start
 */
function getFlagsForCheckIn(checkInTime, typicalStart) {
  const flags = [];
  const [hour, min] = typicalStart.split(':');
  const typical = new Date(checkInTime);
  typical.setHours(parseInt(hour), parseInt(min), 0, 0);

  // Flag if >15 min early
  const fifteenMinutes = 15 * 60 * 1000;
  if (checkInTime < (typical - fifteenMinutes)) {
    flags.push('early_arrival');
  }

  return flags;
}
