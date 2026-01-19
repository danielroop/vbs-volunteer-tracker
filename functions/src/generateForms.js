import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Generate Forms Cloud Function
 * Per PRD Section 3.6: Form Generation
 *
 * Generates school-specific volunteer forms (OCPS, NJHS, NHS, etc.)
 * with student hours filled in.
 *
 * @param {Object} request.data
 * @param {string} request.data.eventId - Event ID
 * @param {string[]} request.data.studentIds - Array of student IDs (or empty for all)
 * @param {string} request.data.formType - Optional: Filter by form type
 */
export const generateForms = onCall(async (request) => {
  const { eventId, studentIds, formType } = request.data;

  // Validate required fields
  if (!eventId) {
    throw new HttpsError('invalid-argument', 'Missing required field: eventId');
  }

  // TODO: Implement authentication check
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to generate forms');
  }

  const db = getFirestore();

  try {
    // Get event info
    const eventDoc = await db.collection('events').doc(eventId).get();
    if (!eventDoc.exists) {
      throw new HttpsError('not-found', 'Event not found');
    }
    const event = eventDoc.data();

    // Build students query
    let studentsQuery = db.collection('students').where('eventId', '==', eventId);

    if (formType) {
      studentsQuery = studentsQuery.where('formType', '==', formType);
    }

    if (studentIds && studentIds.length > 0) {
      studentsQuery = studentsQuery.where('__name__', 'in', studentIds);
    }

    const studentsSnapshot = await studentsQuery.get();

    if (studentsSnapshot.empty) {
      throw new HttpsError('not-found', 'No students found matching criteria');
    }

    // TODO: Implement PDF generation
    // For each student:
    // 1. Get all their time entries
    // 2. Calculate total hours (Monday = training, Tue-Fri = VBS week)
    // 3. Load appropriate PDF template based on student.formType
    // 4. Fill PDF fields (name, hours, dates, supervisor)
    // 5. Save filled PDF to Firebase Storage
    // 6. Return download URLs

    const results = [];

    for (const studentDoc of studentsSnapshot.docs) {
      const student = { id: studentDoc.id, ...studentDoc.data() };

      // Get student's time entries
      const entriesSnapshot = await db.collection('timeEntries')
        .where('studentId', '==', student.id)
        .where('eventId', '==', eventId)
        .where('reviewStatus', 'in', ['approved', 'pending'])
        .get();

      let trainingHours = 0;
      let vbsWeekHours = 0;

      entriesSnapshot.docs.forEach(doc => {
        const entry = doc.data();
        const hours = entry.hoursWorked || 0;

        // Assuming Monday is training day (adjust logic as needed)
        const dayOfWeek = new Date(entry.date).getDay();
        if (dayOfWeek === 1) { // Monday
          trainingHours += hours;
        } else {
          vbsWeekHours += hours;
        }
      });

      const totalHours = trainingHours + vbsWeekHours;

      results.push({
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        formType: student.formType,
        trainingHours,
        vbsWeekHours,
        totalHours,
        // pdfUrl: 'TODO: Generate PDF and upload to Storage'
      });
    }

    return {
      success: true,
      formsGenerated: results.length,
      results,
      message: 'Form generation completed (PDF generation not yet implemented)'
    };
  } catch (error) {
    console.error('Form generation error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});
