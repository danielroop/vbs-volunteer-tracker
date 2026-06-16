import { jest } from '@jest/globals';

function generateQRData(studentId, eventId) {
  const combined = `${studentId}${eventId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const checksum = Math.abs(hash).toString(36).substring(0, 6);
  return `${studentId}|${eventId}|${checksum}`;
}

const makeTimestamp = (iso) => ({
  seconds: Math.floor(new Date(iso).getTime() / 1000),
  toDate: () => new Date(iso),
  toMillis: () => new Date(iso).getTime(),
});

const mockCollection = jest.fn();
const mockStudentDoc = jest.fn();
const mockEventDoc = jest.fn();
const mockWhere = jest.fn();
const mockGet = jest.fn();

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: mockCollection,
  }),
}));

jest.unstable_mockModule('firebase-functions/v2/https', () => ({
  onCall: (...args) => args[args.length - 1],
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

describe('checkHoursLogged Cloud Function', () => {
  let checkHoursLogged;

  beforeAll(async () => {
    const module = await import('../src/checkHoursLogged.js');
    checkHoursLogged = module.checkHoursLogged;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockImplementation((name) => {
      if (name === 'students') {
        return { doc: mockStudentDoc };
      }
      if (name === 'events') {
        return { doc: mockEventDoc };
      }
      return { where: mockWhere };
    });

    mockStudentDoc.mockReturnValue({
      get: jest.fn().mockResolvedValue({
        id: 'student123',
        exists: true,
        data: () => ({
          firstName: 'Jane',
          lastName: 'Smith',
          schoolName: 'Central High',
          gradeLevel: '10',
          email: 'private@example.com',
        }),
      }),
    });

    mockEventDoc.mockImplementation((eventId) => ({
      get: jest.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          name: eventId === 'event456' ? 'VBS 2026' : 'Setup Day',
          organizationName: 'Faith Church',
          activities: [{ id: 'work-hours', name: 'Work Hours' }],
        }),
      }),
    }));

    mockWhere.mockReturnValue({ get: mockGet });
    mockGet.mockResolvedValue({
      docs: [
        {
          id: 'entry1',
          data: () => ({
            studentId: 'student123',
            eventId: 'event456',
            activityId: 'work-hours',
            date: '2026-06-15',
            checkInTime: makeTimestamp('2026-06-15T09:00:00-04:00'),
            checkOutTime: makeTimestamp('2026-06-15T12:00:00-04:00'),
            hoursWorked: 3,
            isVoided: false,
          }),
        },
        {
          id: 'entry2',
          data: () => ({
            studentId: 'student123',
            eventId: 'event789',
            activityId: 'work-hours',
            date: '2026-06-13',
            checkInTime: makeTimestamp('2026-06-13T10:00:00-04:00'),
            checkOutTime: makeTimestamp('2026-06-13T12:00:00-04:00'),
            hoursWorked: 2,
            isVoided: false,
          }),
        },
        {
          id: 'voided',
          data: () => ({
            studentId: 'student123',
            eventId: 'event456',
            checkInTime: makeTimestamp('2026-06-15T13:00:00-04:00'),
            checkOutTime: makeTimestamp('2026-06-15T14:00:00-04:00'),
            hoursWorked: 1,
            isVoided: true,
          }),
        },
      ],
    });
  });

  it('returns sanitized student info and credited hours grouped by event', async () => {
    const result = await checkHoursLogged({
      data: { qrData: generateQRData('student123', 'event456') },
    });

    expect(result.success).toBe(true);
    expect(result.student).toEqual({
      id: 'student123',
      firstName: 'Jane',
      lastName: 'Smith',
      fullName: 'Jane Smith',
      schoolName: 'Central High',
      gradeLevel: '10',
      gradYear: '',
    });
    expect(result.student.email).toBeUndefined();
    expect(result.totalHours).toBe(5);
    expect(result.events).toHaveLength(2);
    expect(result.events.find((event) => event.id === 'event456').entries).toHaveLength(1);
  });

  it('accepts student-id-only badge data', async () => {
    const result = await checkHoursLogged({
      data: { qrData: 'student123' },
    });

    expect(result.success).toBe(true);
    expect(result.scannedEventId).toBeNull();
    expect(result.student.fullName).toBe('Jane Smith');
    expect(result.totalHours).toBe(5);
  });

  it('calculates credited hours from timestamps before falling back to stored hoursWorked', async () => {
    mockGet.mockResolvedValueOnce({
      docs: [
        {
          id: 'entry1',
          data: () => ({
            studentId: 'student123',
            eventId: 'event456',
            activityId: 'work-hours',
            date: '2026-06-15',
            checkInTime: makeTimestamp('2026-06-15T09:00:00-04:00'),
            checkOutTime: makeTimestamp('2026-06-15T12:15:00-04:00'),
            hoursWorked: 3.5,
            isVoided: false,
          }),
        },
      ],
    });

    const result = await checkHoursLogged({
      data: { qrData: generateQRData('student123', 'event456') },
    });

    expect(result.totalHours).toBe(3.25);
    expect(result.events[0].entries[0].hours).toBe(3.25);
  });

  it('rejects QR data with an invalid checksum', async () => {
    await expect(checkHoursLogged({
      data: { qrData: 'student123|event456|bad' },
    })).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
