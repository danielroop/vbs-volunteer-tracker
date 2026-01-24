import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Bulk Approve Cloud Function
 * Per PRD Section 3.5.2: Daily Review (Nightly)
 * Approves multiple time entries at once
 *
 * @param {Object} request.data
 * @param {string} request.data.eventId - Event ID
 * @param {string} request.data.date - Date to approve (YYYY-MM-DD)
 * @param {string[]} request.data.entryIds - Array of entry IDs to approve (optional, approves all if not provided)
 * @param {boolean} request.data.excludeFlagged - If true, skips flagged entries (default: true)
 */
export const bulkApprove = onCall(async (request) => {
  const { eventId, date, entryIds, excludeFlagged = true } = request.data;

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
    let entriesQuery;

    if (entryIds && entryIds.length > 0) {
      // Approve specific entries
      // Firestore limits 'in' queries to 30 items, so we batch if needed
      const batches = [];
      for (let i = 0; i < entryIds.length; i += 30) {
        batches.push(entryIds.slice(i, i + 30));
      }

      const allDocs = [];
      for (const batch of batches) {
        const querySnapshot = await db.collection('timeEntries')
          .where('__name__', 'in', batch)
          .get();
        allDocs.push(...querySnapshot.docs);
      }

      entriesQuery = { docs: allDocs };
    } else {
      // Approve all entries for the date
      entriesQuery = await db.collection('timeEntries')
        .where('eventId', '==', eventId)
        .where('date', '==', date)
        .where('reviewStatus', '==', 'pending')
        .get();
    }

    if (entriesQuery.docs.length === 0) {
      return {
        success: true,
        approvedCount: 0,
        message: 'No entries to approve'
      };
    }

    // Filter out flagged entries if requested
    const entriesToApprove = excludeFlagged
      ? entriesQuery.docs.filter(doc => {
          const data = doc.data();
          return data.reviewStatus !== 'flagged' && data.reviewStatus !== 'approved';
        })
      : entriesQuery.docs.filter(doc => doc.data().reviewStatus !== 'approved');

    // Batch update
    const batchWrite = db.batch();
    let approvedCount = 0;

    for (const doc of entriesToApprove) {
      batchWrite.update(doc.ref, {
        reviewStatus: 'approved',
        approvedBy: userId,
        approvedAt: Timestamp.now()
      });
      approvedCount++;
    }

    await batchWrite.commit();

    return {
      success: true,
      approvedCount,
      totalEntries: entriesQuery.docs.length,
      message: `Approved ${approvedCount} entries`
    };
  } catch (error) {
    console.error('Bulk approve error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

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

    // Update entry
    await entryRef.update({
      checkOutTime: checkOutTimestamp,
      checkOutBy: userId,
      checkOutMethod: 'forced',
      hoursWorked: rounded,
      rawMinutes: minutes,
      flags,
      reviewStatus: 'flagged', // Forced checkouts should be reviewed
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
      pending: 0,
      flagged: 0,
      approved: 0,
      noCheckout: 0
    };

    entriesQuery.docs.forEach(doc => {
      const data = doc.data();

      if (!data.checkOutTime) {
        summary.noCheckout++;
      }

      switch (data.reviewStatus) {
        case 'pending':
          summary.pending++;
          break;
        case 'flagged':
          summary.flagged++;
          break;
        case 'approved':
          summary.approved++;
          break;
        default:
          summary.pending++;
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
