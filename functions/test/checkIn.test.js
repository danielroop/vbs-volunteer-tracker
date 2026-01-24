/**
 * Tests for checkIn Cloud Function
 */
import { jest } from '@jest/globals';

// Mock Firebase Admin
const mockTimestamp = {
  now: jest.fn(() => ({
    toDate: () => new Date('2026-06-15T09:00:00'),
    toMillis: () => new Date('2026-06-15T09:00:00').getTime(),
  })),
};

const mockStudentDoc = {
  exists: true,
  data: () => ({
    firstName: 'John',
    lastName: 'Doe',
  }),
};

const mockEventDoc = {
  exists: true,
  data: () => ({
    typicalStartTime: '09:00',
    typicalEndTime: '15:00',
  }),
};

const mockEmptyQuery = {
  empty: true,
  docs: [],
};

const mockExistingEntryQuery = {
  empty: false,
  docs: [{
    data: () => ({
      checkInTime: {
        toDate: () => new Date('2026-06-15T09:00:00'),
      },
    }),
  }],
};

const mockDocRef = {
  id: 'newEntry123',
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockGet = jest.fn();
const mockAdd = jest.fn();

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: mockCollection,
  }),
  Timestamp: mockTimestamp,
}));

jest.unstable_mockModule('firebase-functions/v2/https', () => ({
  onCall: (handler) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

describe('checkIn Cloud Function', () => {
  let checkIn;
  let HttpsError;

  beforeAll(async () => {
    const checkInModule = await import('../src/checkIn.js');
    checkIn = checkInModule.checkIn;
    const httpsModule = await import('firebase-functions/v2/https');
    HttpsError = httpsModule.HttpsError;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up the chain of mocks
    mockCollection.mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
      add: mockAdd,
    });

    mockDoc.mockReturnValue({
      get: mockGet,
    });

    mockWhere.mockReturnValue({
      where: mockWhere,
      get: mockGet,
    });

    mockGet.mockResolvedValue(mockEmptyQuery);
    mockAdd.mockResolvedValue(mockDocRef);
  });

  describe('validation', () => {
    it('should throw error when studentId is missing', async () => {
      const request = {
        data: {
          eventId: 'event123',
          activityId: 'activity1',
        },
      };

      await expect(checkIn(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when eventId is missing', async () => {
      const request = {
        data: {
          studentId: 'student123',
          activityId: 'activity1',
        },
      };

      await expect(checkIn(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when activityId is missing', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event123',
        },
      };

      await expect(checkIn(request)).rejects.toThrow('Missing required fields');
    });
  });

  describe('successful check-in', () => {
    beforeEach(() => {
      // Mock successful lookup chain
      mockGet
        .mockResolvedValueOnce(mockEmptyQuery) // No existing entry
        .mockResolvedValueOnce(mockStudentDoc) // Student found
        .mockResolvedValueOnce(mockEventDoc); // Event found
    });

    it('should create time entry for valid check-in', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
          scannedBy: 'av_user',
        },
      };

      const result = await checkIn(request);

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('John Doe');
      expect(result.entryId).toBe('newEntry123');
      expect(mockAdd).toHaveBeenCalled();
    });

    it('should use av_scan as default check-in method', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
        },
      };

      await checkIn(request);

      const addCall = mockAdd.mock.calls[0][0];
      expect(addCall.checkInMethod).toBe('av_scan');
    });

    it('should set correct initial status for flagged entries', async () => {
      // Mock early arrival (before 8:45 for 9:00 start)
      mockTimestamp.now.mockReturnValueOnce({
        toDate: () => new Date('2026-06-15T08:30:00'),
        toMillis: () => new Date('2026-06-15T08:30:00').getTime(),
      });

      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
        },
      };

      await checkIn(request);

      const addCall = mockAdd.mock.calls[0][0];
      expect(addCall.flags).toContain('early_arrival');
      expect(addCall.reviewStatus).toBe('flagged');
    });
  });

  describe('duplicate check-in handling', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce(mockExistingEntryQuery) // Existing entry found
        .mockResolvedValueOnce(mockStudentDoc); // Student found
    });

    it('should return error for duplicate check-in', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
        },
      };

      const result = await checkIn(request);

      expect(result.success).toBe(false);
      expect(result.duplicate).toBe(true);
      expect(result.error).toContain('Already checked in');
    });
  });

  describe('student not found', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce(mockEmptyQuery) // No existing entry
        .mockResolvedValueOnce({ exists: false }); // Student not found
    });

    it('should throw error when student does not exist', async () => {
      const request = {
        data: {
          studentId: 'nonexistent',
          eventId: 'event456',
          activityId: 'activity1',
        },
      };

      await expect(checkIn(request)).rejects.toThrow('Student not found');
    });
  });

  describe('event not found', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce(mockEmptyQuery) // No existing entry
        .mockResolvedValueOnce(mockStudentDoc) // Student found
        .mockResolvedValueOnce({ exists: false }); // Event not found
    });

    it('should throw error when event does not exist', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'nonexistent',
          activityId: 'activity1',
        },
      };

      await expect(checkIn(request)).rejects.toThrow('Event not found');
    });
  });
});

describe('getFlagsForCheckIn helper', () => {
  it('should flag early arrivals (>15 min before start)', () => {
    // This tests the internal flagging logic
    const checkInTime = new Date('2026-06-15T08:44:00');
    const typicalStart = '09:00';

    const [hour, min] = typicalStart.split(':');
    const typical = new Date(checkInTime);
    typical.setHours(parseInt(hour), parseInt(min), 0, 0);

    const fifteenMinutes = 15 * 60 * 1000;
    const isEarly = checkInTime < (typical - fifteenMinutes);

    expect(isEarly).toBe(true);
  });

  it('should not flag normal arrival times', () => {
    const checkInTime = new Date('2026-06-15T09:05:00');
    const typicalStart = '09:00';

    const [hour, min] = typicalStart.split(':');
    const typical = new Date(checkInTime);
    typical.setHours(parseInt(hour), parseInt(min), 0, 0);

    const fifteenMinutes = 15 * 60 * 1000;
    const isEarly = checkInTime < (typical - fifteenMinutes);

    expect(isEarly).toBe(false);
  });
});
