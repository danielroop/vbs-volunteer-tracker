import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * Void Time Entry Cloud Function
 * Soft-deletes a time entry by marking it as voided.
 * Preserves the entry for audit trail while excluding it from calculations.
 *
 * @param {Object} request.data
 * @param {string} request.data.entryId - Time entry ID to void
 * @param {string} request.data.voidReason - Reason for voiding (min 5 characters)
 */
export const voidTimeEntry = onCall(async (request) => {
  const { entryId, voidReason } = request.data;

  // Validate required fields
  if (!entryId || !voidReason) {
    throw new HttpsError('invalid-argument', 'Missing required fields: entryId and voidReason');
  }

  // Validate void reason length
  if (typeof voidReason !== 'string' || voidReason.trim().length < 5) {
    throw new HttpsError('invalid-argument', 'Void reason must be at least 5 characters');
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

    // Check if already voided
    if (entry.isVoided) {
      throw new HttpsError('already-exists', 'Time entry is already voided');
    }

    // Build change log entry
    const changeLogEntry = {
      timestamp: new Date().toISOString(),
      modifiedBy: userId,
      type: 'void',
      reason: voidReason.trim(),
      description: `Entry voided. Reason: ${voidReason.trim()}`
    };

    const existingChangeLog = entry.changeLog || [];

    await entryRef.update({
      isVoided: true,
      voidReason: voidReason.trim(),
      voidedAt: Timestamp.now(),
      voidedBy: userId,
      changeLog: [...existingChangeLog, changeLogEntry]
    });

    // Get student info for response
    const studentDoc = await db.collection('students').doc(entry.studentId).get();
    const student = studentDoc.exists ? studentDoc.data() : { firstName: 'Unknown', lastName: 'Student' };

    return {
      success: true,
      studentName: `${student.firstName} ${student.lastName}`,
      message: `Time entry voided for ${student.firstName} ${student.lastName}`
    };
  } catch (error) {
    console.error('Void entry error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Restore Voided Time Entry Cloud Function
 * Restores a previously voided time entry back to active state.
 *
 * @param {Object} request.data
 * @param {string} request.data.entryId - Time entry ID to restore
 */
export const restoreTimeEntry = onCall(async (request) => {
  const { entryId } = request.data;

  // Validate required fields
  if (!entryId) {
    throw new HttpsError('invalid-argument', 'Missing required field: entryId');
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

    // Check if entry is actually voided
    if (!entry.isVoided) {
      throw new HttpsError('failed-precondition', 'Time entry is not voided');
    }

    // Build change log entry
    const changeLogEntry = {
      timestamp: new Date().toISOString(),
      modifiedBy: userId,
      type: 'restore',
      reason: `Restored from void (was: "${entry.voidReason}")`,
      description: `Entry restored from voided state`
    };

    const existingChangeLog = entry.changeLog || [];

    await entryRef.update({
      isVoided: false,
      voidReason: null,
      voidedAt: null,
      voidedBy: null,
      changeLog: [...existingChangeLog, changeLogEntry]
    });

    // Get student info for response
    const studentDoc = await db.collection('students').doc(entry.studentId).get();
    const student = studentDoc.exists ? studentDoc.data() : { firstName: 'Unknown', lastName: 'Student' };

    return {
      success: true,
      studentName: `${student.firstName} ${student.lastName}`,
      message: `Time entry restored for ${student.firstName} ${student.lastName}`
    };
  } catch (error) {
    console.error('Restore entry error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});
