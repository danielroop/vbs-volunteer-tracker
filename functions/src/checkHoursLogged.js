import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

function generateChecksum(studentId, eventId) {
  const combined = `${studentId}${eventId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}

function parseQRData(qrData) {
  if (typeof qrData !== 'string') {
    return { isValid: false, error: 'Missing QR data' };
  }

  const parts = qrData.split('|');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Invalid QR code format' };
  }

  const [studentId, eventId, checksum] = parts;
  if (!studentId || !eventId || !checksum) {
    return { isValid: false, error: 'Invalid QR code format' };
  }

  return {
    studentId,
    eventId,
    checksum,
    isValid: generateChecksum(studentId, eventId) === checksum,
    error: 'Invalid QR code',
  };
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return null;
}

function getHours(entry) {
  if (typeof entry.hoursWorked === 'number') {
    return entry.hoursWorked;
  }

  if (!entry.checkInTime || !entry.checkOutTime) {
    return 0;
  }

  const checkInMs = typeof entry.checkInTime.toMillis === 'function'
    ? entry.checkInTime.toMillis()
    : entry.checkInTime.seconds * 1000;
  const checkOutMs = typeof entry.checkOutTime.toMillis === 'function'
    ? entry.checkOutTime.toMillis()
    : entry.checkOutTime.seconds * 1000;
  const hours = (checkOutMs - checkInMs) / 1000 / 60 / 60;
  return Math.round(hours * 4) / 4;
}

function publicStudentProfile(student, studentId) {
  return {
    id: studentId,
    firstName: student.firstName || '',
    lastName: student.lastName || '',
    fullName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
    schoolName: student.schoolName || '',
    gradeLevel: student.gradeLevel || '',
    gradYear: student.gradYear || '',
  };
}

/**
 * Public QR-backed hour lookup for students.
 *
 * The QR checksum gates access to a single student. The response intentionally
 * returns only hour-report fields, not contact or emergency data.
 */
export const checkHoursLogged = onCall({ cors: true }, async (request) => {
  const { qrData } = request.data || {};
  const parsed = parseQRData(qrData);

  if (!parsed.isValid) {
    throw new HttpsError('invalid-argument', parsed.error || 'Invalid QR code');
  }

  const db = getFirestore();

  try {
    const studentDoc = await db.collection('students').doc(parsed.studentId).get();
    if (!studentDoc.exists) {
      throw new HttpsError('not-found', 'Student not found');
    }

    const entriesSnap = await db.collection('timeEntries')
      .where('studentId', '==', parsed.studentId)
      .get();

    const creditedEntries = entriesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((entry) => !entry.isVoided && entry.checkOutTime);

    const eventIds = [...new Set(creditedEntries.map((entry) => entry.eventId).filter(Boolean))];
    const eventDocs = await Promise.all(
      eventIds.map(async (eventId) => {
        const snap = await db.collection('events').doc(eventId).get();
        return [eventId, snap.exists ? snap.data() : null];
      })
    );
    const eventsById = Object.fromEntries(eventDocs);

    const events = eventIds.map((eventId) => {
      const event = eventsById[eventId] || {};
      const activityNames = new Map((event.activities || []).map((activity) => [activity.id, activity.name]));
      const entries = creditedEntries
        .filter((entry) => entry.eventId === eventId)
        .map((entry) => ({
          id: entry.id,
          activityId: entry.activityId || '',
          activityName: activityNames.get(entry.activityId) || entry.activityName || entry.activityId || 'Service Hours',
          date: entry.date || '',
          checkInTime: timestampToIso(entry.checkInTime),
          checkOutTime: timestampToIso(entry.checkOutTime),
          hours: getHours(entry),
        }))
        .sort((a, b) => (a.checkInTime || '').localeCompare(b.checkInTime || ''));

      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      return {
        id: eventId,
        name: event.name || eventId,
        organizationName: event.organizationName || '',
        startDate: event.startDate || '',
        endDate: event.endDate || '',
        totalHours,
        entries,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    return {
      success: true,
      scannedEventId: parsed.eventId,
      student: publicStudentProfile(studentDoc.data(), studentDoc.id),
      events,
      totalHours: events.reduce((sum, event) => sum + event.totalHours, 0),
    };
  } catch (error) {
    console.error('Check hours logged error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});
