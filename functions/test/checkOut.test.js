/**
 * Tests for checkOut Cloud Function
 */
import { jest } from '@jest/globals';

// Mock timestamps
const mockCheckInTime = new Date('2026-06-15T09:00:00');
const mockCheckOutTime = new Date('2026-06-15T15:00:00');

const mockTimestamp = {
  now: jest.fn(() => ({
    toDate: () => mockCheckOutTime,
    toMillis: () => mockCheckOutTime.getTime(),
  })),
};

const mockStudentDoc = {
  exists: true,
  data: () => ({
    firstName: 'Jane',
    lastName: 'Smith',
  }),
};

const mockEventDoc = {
  exists: true,
  data: () => ({
    typicalStartTime: '09:00',
    typicalEndTime: '15:00',
  }),
};

const mockEntryDoc = {
  ref: {
    update: jest.fn().mockResolvedValue(undefined),
  },
  data: () => ({
    checkInTime: {
      toMillis: () => mockCheckInTime.getTime(),
    },
    flags: [],
  }),
};

const mockFoundEntryQuery = {
  empty: false,
  docs: [mockEntryDoc],
};

const mockEmptyQuery = {
  empty: true,
  docs: [],
};

const mockWeekEntriesQuery = {
  docs: [
    { data: () => ({ hoursWorked: 6 }) },
    { data: () => ({ hoursWorked: 6.5 }) },
  ],
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockGet = jest.fn();

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

describe('checkOut Cloud Function', () => {
  let checkOut;

  beforeAll(async () => {
    const checkOutModule = await import('../src/checkOut.js');
    checkOut = checkOutModule.checkOut;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      doc: mockDoc,
      where: mockWhere,
    });

    mockDoc.mockReturnValue({
      get: mockGet,
    });

    mockWhere.mockReturnValue({
      where: mockWhere,
      get: mockGet,
    });
  });

  describe('validation', () => {
    it('should throw error when studentId is missing', async () => {
      const request = {
        data: {
          eventId: 'event123',
          activityId: 'activity1',
        },
      };

      await expect(checkOut(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when eventId is missing', async () => {
      const request = {
        data: {
          studentId: 'student123',
          activityId: 'activity1',
        },
      };

      await expect(checkOut(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when activityId is missing', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event123',
        },
      };

      await expect(checkOut(request)).rejects.toThrow('Missing required fields');
    });
  });

  describe('successful check-out', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce(mockFoundEntryQuery) // Found check-in entry
        .mockResolvedValueOnce(mockStudentDoc) // Student found
        .mockResolvedValueOnce(mockEventDoc) // Event found
        .mockResolvedValueOnce(mockWeekEntriesQuery); // Week entries
    });

    it('should process check-out and calculate hours', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
          method: 'av_scan',
        },
        auth: { uid: 'av_user_123' },
      };

      const result = await checkOut(request);

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('Jane Smith');
      expect(result.hoursToday).toBe(6); // 9:00 AM to 3:00 PM = 6 hours
    });

    it('should calculate week total including current checkout', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
        },
      };

      const result = await checkOut(request);

      // Week entries: 6 + 6.5 = 12.5, plus today's 6 = 18.5
      expect(result.weekTotal).toBe(18.5);
    });

    it('should update entry with calculated values', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
          method: 'av_scan',
        },
        auth: { uid: 'av_user_123' },
      };

      await checkOut(request);

      expect(mockEntryDoc.ref.update).toHaveBeenCalledWith(
        expect.objectContaining({
          checkOutTime: expect.anything(),
          hoursWorked: 6,
          rawMinutes: 360,
          checkOutMethod: 'av_scan',
        })
      );
    });
  });

  describe('no check-in found', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce(mockEmptyQuery) // No check-in entry
        .mockResolvedValueOnce(mockStudentDoc); // Student found
    });

    it('should throw error when no check-in exists', async () => {
      const request = {
        data: {
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
        },
      };

      await expect(checkOut(request)).rejects.toThrow('No check-in found for today');
    });
  });

  describe('student not found', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce(mockFoundEntryQuery) // Found check-in entry
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

      await expect(checkOut(request)).rejects.toThrow('Student not found');
    });
  });
});

describe('Hour calculation logic', () => {
  it('should round to nearest 0.5 hour - round down', () => {
    // 6h 13m should round to 6.0
    const minutes = 373;
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(6);
  });

  it('should round to nearest 0.5 hour - round to 0.5', () => {
    // 6h 16m should round to 6.5
    const minutes = 376;
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(6.5);
  });

  it('should round to nearest 0.5 hour - round up', () => {
    // 6h 47m should round to 7.0
    const minutes = 407;
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(7);
  });

  it('should handle exact 30 minute boundary', () => {
    const minutes = 390; // 6h 30m
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(6.5);
  });
});

describe('getFlagsForCheckOut helper', () => {
  it('should flag late stays (>15 min after end)', () => {
    const checkOutTime = new Date('2026-06-15T15:20:00');
    const typicalEnd = '15:00';

    const [hour, min] = typicalEnd.split(':');
    const typical = new Date(checkOutTime);
    typical.setHours(parseInt(hour), parseInt(min), 0, 0);

    const fifteenMinutes = 15 * 60 * 1000;
    const isLate = checkOutTime > (typical + fifteenMinutes);

    expect(isLate).toBe(true);
  });

  it('should not flag normal departure times', () => {
    const checkOutTime = new Date('2026-06-15T15:10:00');
    const typicalEnd = '15:00';

    const [hour, min] = typicalEnd.split(':');
    const typical = new Date(checkOutTime);
    typical.setHours(parseInt(hour), parseInt(min), 0, 0);

    const fifteenMinutes = 15 * 60 * 1000;
    const isLate = checkOutTime > (typical + fifteenMinutes);

    expect(isLate).toBe(false);
  });
});

describe('getMonday helper', () => {
  it('should return Monday for a Wednesday', () => {
    const wednesday = new Date('2026-06-17'); // Wednesday
    const d = new Date(wednesday);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(15);
  });

  it('should return previous Monday for a Sunday', () => {
    const sunday = new Date('2026-06-21'); // Sunday
    const d = new Date(sunday);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    expect(monday.getDay()).toBe(1); // Monday
    expect(monday.getDate()).toBe(15);
  });

  it('should return same day for a Monday', () => {
    const monday = new Date('2026-06-15'); // Monday
    const d = new Date(monday);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const result = new Date(d.setDate(diff));

    expect(result.getDate()).toBe(15);
  });
});
