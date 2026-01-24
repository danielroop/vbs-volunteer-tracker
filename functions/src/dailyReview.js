import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Force Check-Out Cloud Function
 * Per PRD Section 3.5.2: Daily Review (Nightly)
 * Forces a checkout for students who forgot to check out
 *
 * @param {Object} request.data
 * @param {string} request.data.entryId - Time entry ID
 * @param {string} request.data.checkOutTime - ISO timestamp for checkout
 * @param {string} request.data.reason - Reason for forced checkout (required)
 */
export const forceCheckOut = onCall(async (request) => {
  const { entryId, checkOutTime, reason } = request.data;

  // Validate required fields
  if (!entryId || !checkOutTime || !reason) {
    throw new HttpsError('invalid-argument', 'Missing required fields: entryId, checkOutTime, and reason');
  }

  // Verify the user is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const db = getFirestore();
  const userId = request.auth.uid;

  try {
    const entryRef = db.collection('timeEntries').doc(entryId);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) {
      throw new HttpsError('not-found', 'Time entry not found');
    }

    const entry = entryDoc.data();

    // Check if already checked out
    if (entry.checkOutTime) {
      throw new HttpsError('already-exists', 'Student has already checked out');
    }

    // Parse the checkout time
    const checkOutTimestamp = Timestamp.fromDate(new Date(checkOutTime));
    const checkInMs = entry.checkInTime.toMillis();
    const checkOutMs = checkOutTimestamp.toMillis();

    // Validate checkout is after check-in
    if (checkOutMs <= checkInMs) {
      throw new HttpsError('invalid-argument', 'Check-out time must be after check-in time');
    }

    // Calculate hours
    const minutes = Math.floor((checkOutMs - checkInMs) / 1000 / 60);
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2; // Round to nearest 0.5

    // Get existing flags and add forced_checkout flag
    const flags = [...(entry.flags || [])];
    if (!flags.includes('forced_checkout')) {
      flags.push('forced_checkout');
    }

    // Update entry - keep original scan data separate from override
    await entryRef.update({
      checkOutTime: checkOutTimestamp,
      checkOutBy: userId,
      checkOutMethod: 'forced',
      hoursWorked: rounded,
      rawMinutes: minutes,
      flags,
      // Override tracking - separate from original scan data
      forcedCheckoutReason: reason,
      forcedCheckoutBy: userId,
      forcedCheckoutAt: Timestamp.now()
    });

    // Get student info for response
    const studentDoc = await db.collection('students').doc(entry.studentId).get();
    const student = studentDoc.exists ? studentDoc.data() : { firstName: 'Unknown', lastName: 'Student' };

    return {
      success: true,
      studentName: `${student.firstName} ${student.lastName}`,
      hoursWorked: rounded,
      rawMinutes: minutes,
      message: `Forced checkout recorded for ${student.firstName} ${student.lastName}`
    };
  } catch (error) {
    console.error('Force checkout error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Force All Check-Out Cloud Function
 * Per PRD Section 3.5.2: Daily Review (Nightly)
 * Forces checkout for all students who haven't checked out yet
 * Uses each activity's end time as the checkout time
 *
 * @param {Object} request.data
 * @param {string} request.data.eventId - Event ID
 * @param {string} request.data.date - Date (YYYY-MM-DD)
 * @param {string} request.data.reason - Reason for bulk forced checkout
 */
export const forceAllCheckOut = onCall(async (request) => {
  const { eventId, date, reason } = request.data;

  // Validate required fields
  if (!eventId || !date) {
    throw new HttpsError('invalid-argument', 'Missing required fields: eventId and date');
  }

  // Verify the user is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const db = getFirestore();
  const userId = request.auth.uid;

  try {
    // Get event to access activity end times
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      throw new HttpsError('not-found', 'Event not found');
    }
    const event = eventDoc.data();

    // Create activity end time map
    const activityEndTimes = {};
    if (event.activities) {
      event.activities.forEach(a => {
        activityEndTimes[a.id] = a.endTime || event.typicalEndTime || '15:00';
      });
    }
    const defaultEndTime = event.typicalEndTime || '15:00';

    // Get all entries without checkout for this date
    const entriesQuery = await db.collection('timeEntries')
      .where('eventId', '==', eventId)
      .where('date', '==', date)
      .where('checkOutTime', '==', null)
      .get();

    if (entriesQuery.empty) {
      return {
        success: true,
        checkedOutCount: 0,
        message: 'No students need checkout'
      };
    }

    // Batch update all entries
    const batch = db.batch();
    let checkedOutCount = 0;

    for (const doc of entriesQuery.docs) {
      const entry = doc.data();

      // Get end time for this activity
      const endTime = activityEndTimes[entry.activityId] || defaultEndTime;
      const [hours, mins] = endTime.split(':');

      // Create checkout timestamp using the entry date and activity end time
      const checkOutDate = new Date(date);
      checkOutDate.setHours(parseInt(hours), parseInt(mins), 0, 0);
      const checkOutTimestamp = Timestamp.fromDate(checkOutDate);

      // Calculate hours
      const checkInMs = entry.checkInTime.toMillis();
      const checkOutMs = checkOutTimestamp.toMillis();
      const minutes = Math.floor((checkOutMs - checkInMs) / 1000 / 60);
      const hoursWorked = Math.round((minutes / 60) * 2) / 2;

      // Get existing flags and add forced_checkout
      const flags = [...(entry.flags || [])];
      if (!flags.includes('forced_checkout')) {
        flags.push('forced_checkout');
      }

      batch.update(doc.ref, {
        checkOutTime: checkOutTimestamp,
        checkOutBy: userId,
        checkOutMethod: 'forced_bulk',
        hoursWorked,
        rawMinutes: minutes,
        flags,
        forcedCheckoutReason: reason || 'End of day bulk checkout',
        forcedCheckoutBy: userId,
        forcedCheckoutAt: Timestamp.now()
      });

      checkedOutCount++;
    }

    await batch.commit();

    return {
      success: true,
      checkedOutCount,
      message: `Successfully checked out ${checkedOutCount} students`
    };
  } catch (error) {
    console.error('Force all checkout error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Get Daily Review Summary Cloud Function
 * Returns aggregated stats for daily review page
 *
 * @param {Object} request.data
 * @param {string} request.data.eventId - Event ID
 * @param {string} request.data.date - Date (YYYY-MM-DD)
 */
export const getDailyReviewSummary = onCall(async (request) => {
  const { eventId, date } = request.data;

  if (!eventId || !date) {
    throw new HttpsError('invalid-argument', 'Missing required fields: eventId and date');
  }

  const db = getFirestore();

  try {
    const entriesQuery = await db.collection('timeEntries')
      .where('eventId', '==', eventId)
      .where('date', '==', date)
      .get();

    const summary = {
      total: entriesQuery.docs.length,
      flagged: 0,
      noCheckout: 0,
      modified: 0
    };

    entriesQuery.docs.forEach(doc => {
      const data = doc.data();

      if (!data.checkOutTime) {
        summary.noCheckout++;
      }

      if (data.flags && data.flags.length > 0) {
        summary.flagged++;
      }

      if (data.modificationReason || data.forcedCheckoutReason) {
        summary.modified++;
      }
    });

    return {
      success: true,
      summary
    };
  } catch (error) {
    console.error('Get daily review summary error:', error);
    throw new HttpsError('internal', error.message);
  }
});
