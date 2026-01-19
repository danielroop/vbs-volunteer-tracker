import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Check-Out Cloud Function
 * Per PRD Section 3.3: Student Check-Out Flow
 *
 * @param {Object} request.data
 * @param {string} request.data.studentId - Student ID
 * @param {string} request.data.eventId - Event ID
 * @param {string} request.data.method - Check-out method: 'self_scan' | 'av_scan'
 */
export const checkOut = onCall(async (request) => {
  const { studentId, eventId, activityId, method } = request.data;

  // Validate required fields
  if (!studentId || !eventId || !activityId) {
    throw new HttpsError('invalid-argument', 'Missing required fields: studentId, eventId, and activityId');
  }

  const db = getFirestore();
  const today = new Date().toISOString().split('T')[0];

  try {
    // Find today's entry
    const entriesQuery = await db.collection('timeEntries')
      .where('studentId', '==', studentId)
      .where('eventId', '==', eventId)
      .where('activityId', '==', activityId)
      .where('date', '==', today)
      .where('checkOutTime', '==', null)
      .get();

    if (entriesQuery.empty) {
      throw new HttpsError('not-found', 'No check-in found for today');
    }

    const entryDoc = entriesQuery.docs[0];
    const entry = entryDoc.data();

    // Calculate hours
    const checkOutTime = Timestamp.now();
    const checkInMs = entry.checkInTime.toMillis();
    const checkOutMs = checkOutTime.toMillis();
    const minutes = Math.floor((checkOutMs - checkInMs) / 1000 / 60);
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2; // Round to nearest 0.5

    // Get event for flagging
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      throw new HttpsError('not-found', 'Event not found');
    }
    const event = eventDoc.data();

    // Combine existing flags with checkout flags
    const checkOutFlags = getFlagsForCheckOut(checkOutTime.toDate(), event.typicalEndTime || '15:00');
    const allFlags = [...(entry.flags || []), ...checkOutFlags];

    // Update entry
    await entryDoc.ref.update({
      checkOutTime,
      checkOutBy: method === 'self_scan' ? 'student_self' : (request.auth?.uid || 'av'),
      checkOutMethod: method || 'self_scan',
      hoursWorked: rounded,
      rawMinutes: minutes,
      flags: allFlags,
      reviewStatus: allFlags.length > 0 ? 'flagged' : 'pending'
    });

    // Get student for response
    const studentDoc = await db.collection('students').doc(studentId).get();
    if (!studentDoc.exists) {
      throw new HttpsError('not-found', 'Student not found');
    }
    const student = studentDoc.data();

    // Get week total (Monday to today)
    const weekStart = getMonday(new Date(today));
    const weekEntriesQuery = await db.collection('timeEntries')
      .where('studentId', '==', studentId)
      .where('eventId', '==', eventId)
      .where('date', '>=', weekStart.toISOString().split('T')[0])
      .where('checkOutTime', '!=', null)
      .get();

    const weekTotal = weekEntriesQuery.docs.reduce((sum, doc) => {
      return sum + (doc.data().hoursWorked || 0);
    }, 0);

    return {
      success: true,
      studentName: `${student.firstName} ${student.lastName}`,
      hoursToday: rounded,
      weekTotal: weekTotal + rounded,
      checkOutTime: checkOutTime.toDate().toISOString(),
      flags: allFlags
    };
  } catch (error) {
    console.error('Check-out error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Helper function to check if check-out should be flagged
 * Per PRD Section 3.4.2: Flag if >15 min after typical end
 */
function getFlagsForCheckOut(checkOutTime, typicalEnd) {
  const flags = [];
  const [hour, min] = typicalEnd.split(':');
  const typical = new Date(checkOutTime);
  typical.setHours(parseInt(hour), parseInt(min), 0, 0);

  // Flag if >15 min late
  const fifteenMinutes = 15 * 60 * 1000;
  if (checkOutTime > (typical + fifteenMinutes)) {
    flags.push('late_stay');
  }

  return flags;
}

/**
 * Get Monday of the current week
 */
function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}
