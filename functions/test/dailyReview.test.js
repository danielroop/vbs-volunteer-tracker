/**
 * Tests for Daily Review Cloud Functions
 * bulkApprove, forceCheckOut, getDailyReviewSummary
 */
import { jest } from '@jest/globals';

// Mock timestamps
const mockCheckInTime = new Date('2026-06-15T09:00:00');
const mockCheckOutTime = new Date('2026-06-15T15:00:00');

const mockTimestamp = {
  now: jest.fn(() => ({
    toDate: () => new Date(),
    toMillis: () => Date.now(),
  })),
  fromDate: jest.fn((date) => ({
    toDate: () => date,
    toMillis: () => date.getTime(),
  })),
};

const mockStudentDoc = {
  exists: true,
  data: () => ({
    firstName: 'Jane',
    lastName: 'Smith',
  }),
};

const mockTimeEntryDoc = {
  ref: {
    update: jest.fn().mockResolvedValue(undefined),
  },
  data: () => ({
    checkInTime: {
      toMillis: () => mockCheckInTime.getTime(),
    },
    checkOutTime: null,
    flags: [],
    reviewStatus: 'pending',
    studentId: 'student123',
  }),
};

const mockApprovedEntryDoc = {
  ref: {
    update: jest.fn().mockResolvedValue(undefined),
  },
  data: () => ({
    checkInTime: {
      toMillis: () => mockCheckInTime.getTime(),
    },
    checkOutTime: {
      toMillis: () => mockCheckOutTime.getTime(),
    },
    flags: [],
    reviewStatus: 'approved',
    studentId: 'student123',
  }),
};

const mockPendingEntries = {
  docs: [
    {
      id: 'entry1',
      ref: { update: jest.fn().mockResolvedValue(undefined) },
      data: () => ({
        reviewStatus: 'pending',
        checkOutTime: { toMillis: () => mockCheckOutTime.getTime() },
        flags: [],
      }),
    },
    {
      id: 'entry2',
      ref: { update: jest.fn().mockResolvedValue(undefined) },
      data: () => ({
        reviewStatus: 'pending',
        checkOutTime: { toMillis: () => mockCheckOutTime.getTime() },
        flags: [],
      }),
    },
  ],
};

const mockFlaggedEntry = {
  id: 'entry3',
  ref: { update: jest.fn().mockResolvedValue(undefined) },
  data: () => ({
    reviewStatus: 'flagged',
    checkOutTime: { toMillis: () => mockCheckOutTime.getTime() },
    flags: ['early_arrival'],
  }),
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockWhere = jest.fn();
const mockGet = jest.fn();
const mockBatch = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: mockCollection,
    batch: () => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
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

describe('bulkApprove Cloud Function', () => {
  let bulkApprove;

  beforeAll(async () => {
    const dailyReviewModule = await import('../src/dailyReview.js');
    bulkApprove = dailyReviewModule.bulkApprove;
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
    it('should throw error when eventId is missing', async () => {
      const request = {
        data: {
          date: '2026-06-15',
        },
        auth: { uid: 'admin123' },
      };

      await expect(bulkApprove(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when date is missing', async () => {
      const request = {
        data: {
          eventId: 'event123',
        },
        auth: { uid: 'admin123' },
      };

      await expect(bulkApprove(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when user is not authenticated', async () => {
      const request = {
        data: {
          eventId: 'event123',
          date: '2026-06-15',
        },
        // No auth
      };

      await expect(bulkApprove(request)).rejects.toThrow('User must be authenticated');
    });
  });

  describe('successful bulk approve', () => {
    beforeEach(() => {
      mockGet.mockResolvedValueOnce(mockPendingEntries);
    });

    it('should approve all pending entries', async () => {
      const request = {
        data: {
          eventId: 'event123',
          date: '2026-06-15',
        },
        auth: { uid: 'admin123' },
      };

      const result = await bulkApprove(request);

      expect(result.success).toBe(true);
      expect(result.approvedCount).toBe(2);
    });

    it('should return zero when no entries to approve', async () => {
      mockGet.mockReset();
      mockGet.mockResolvedValueOnce({ docs: [] });

      const request = {
        data: {
          eventId: 'event123',
          date: '2026-06-15',
        },
        auth: { uid: 'admin123' },
      };

      const result = await bulkApprove(request);

      expect(result.success).toBe(true);
      expect(result.approvedCount).toBe(0);
    });
  });

  describe('exclude flagged entries', () => {
    it('should skip flagged entries when excludeFlagged is true', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [...mockPendingEntries.docs, mockFlaggedEntry],
      });

      const request = {
        data: {
          eventId: 'event123',
          date: '2026-06-15',
          excludeFlagged: true,
        },
        auth: { uid: 'admin123' },
      };

      const result = await bulkApprove(request);

      expect(result.success).toBe(true);
      // Should only approve 2 pending entries, not the flagged one
      expect(result.approvedCount).toBe(2);
      expect(result.totalEntries).toBe(3);
    });
  });
});

describe('forceCheckOut Cloud Function', () => {
  let forceCheckOut;

  beforeAll(async () => {
    const dailyReviewModule = await import('../src/dailyReview.js');
    forceCheckOut = dailyReviewModule.forceCheckOut;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      doc: mockDoc,
    });

    mockDoc.mockReturnValue({
      get: mockGet,
    });
  });

  describe('validation', () => {
    it('should throw error when entryId is missing', async () => {
      const request = {
        data: {
          checkOutTime: '2026-06-15T15:00:00Z',
          reason: 'Forgot to check out',
        },
        auth: { uid: 'admin123' },
      };

      await expect(forceCheckOut(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when checkOutTime is missing', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          reason: 'Forgot to check out',
        },
        auth: { uid: 'admin123' },
      };

      await expect(forceCheckOut(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when reason is missing', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          checkOutTime: '2026-06-15T15:00:00Z',
        },
        auth: { uid: 'admin123' },
      };

      await expect(forceCheckOut(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when user is not authenticated', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          checkOutTime: '2026-06-15T15:00:00Z',
          reason: 'Forgot to check out',
        },
        // No auth
      };

      await expect(forceCheckOut(request)).rejects.toThrow('User must be authenticated');
    });
  });

  describe('entry not found', () => {
    it('should throw error when entry does not exist', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const request = {
        data: {
          entryId: 'nonexistent',
          checkOutTime: '2026-06-15T15:00:00Z',
          reason: 'Forgot to check out',
        },
        auth: { uid: 'admin123' },
      };

      await expect(forceCheckOut(request)).rejects.toThrow('Time entry not found');
    });
  });

  describe('already checked out', () => {
    it('should throw error when student is already checked out', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          checkInTime: {
            toMillis: () => mockCheckInTime.getTime(),
          },
          checkOutTime: {
            toMillis: () => mockCheckOutTime.getTime(),
          },
        }),
      });

      const request = {
        data: {
          entryId: 'entry123',
          checkOutTime: '2026-06-15T15:00:00Z',
          reason: 'Forgot to check out',
        },
        auth: { uid: 'admin123' },
      };

      await expect(forceCheckOut(request)).rejects.toThrow('Student has already checked out');
    });
  });

  describe('successful force checkout', () => {
    beforeEach(() => {
      const mockEntryRef = {
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            checkInTime: {
              toMillis: () => mockCheckInTime.getTime(),
            },
            checkOutTime: null,
            flags: [],
            studentId: 'student123',
          }),
          ref: mockEntryRef,
        })
        .mockResolvedValueOnce(mockStudentDoc);

      mockDoc.mockReturnValue({
        get: mockGet,
        update: mockEntryRef.update,
      });
    });

    it('should successfully force checkout a student', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          checkOutTime: '2026-06-15T15:00:00Z',
          reason: 'Forgot to check out, confirmed with parent',
        },
        auth: { uid: 'admin123' },
      };

      const result = await forceCheckOut(request);

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('Jane Smith');
      expect(result.hoursWorked).toBe(6); // 9am to 3pm = 6 hours
    });
  });
});

describe('getDailyReviewSummary Cloud Function', () => {
  let getDailyReviewSummary;

  beforeAll(async () => {
    const dailyReviewModule = await import('../src/dailyReview.js');
    getDailyReviewSummary = dailyReviewModule.getDailyReviewSummary;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      where: mockWhere,
    });

    mockWhere.mockReturnValue({
      where: mockWhere,
      get: mockGet,
    });
  });

  describe('validation', () => {
    it('should throw error when eventId is missing', async () => {
      const request = {
        data: {
          date: '2026-06-15',
        },
      };

      await expect(getDailyReviewSummary(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when date is missing', async () => {
      const request = {
        data: {
          eventId: 'event123',
        },
      };

      await expect(getDailyReviewSummary(request)).rejects.toThrow('Missing required fields');
    });
  });

  describe('successful summary', () => {
    it('should return correct summary counts', async () => {
      mockGet.mockResolvedValueOnce({
        docs: [
          { data: () => ({ reviewStatus: 'pending', checkOutTime: {} }) },
          { data: () => ({ reviewStatus: 'pending', checkOutTime: {} }) },
          { data: () => ({ reviewStatus: 'approved', checkOutTime: {} }) },
          { data: () => ({ reviewStatus: 'flagged', checkOutTime: {} }) },
          { data: () => ({ reviewStatus: 'pending', checkOutTime: null }) }, // No checkout
        ],
      });

      const request = {
        data: {
          eventId: 'event123',
          date: '2026-06-15',
        },
      };

      const result = await getDailyReviewSummary(request);

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(5);
      expect(result.summary.pending).toBe(3);
      expect(result.summary.approved).toBe(1);
      expect(result.summary.flagged).toBe(1);
      expect(result.summary.noCheckout).toBe(1);
    });

    it('should handle empty results', async () => {
      mockGet.mockResolvedValueOnce({ docs: [] });

      const request = {
        data: {
          eventId: 'event123',
          date: '2026-06-15',
        },
      };

      const result = await getDailyReviewSummary(request);

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(0);
      expect(result.summary.pending).toBe(0);
      expect(result.summary.approved).toBe(0);
      expect(result.summary.flagged).toBe(0);
      expect(result.summary.noCheckout).toBe(0);
    });
  });
});

describe('Hour calculation in forceCheckOut', () => {
  it('should correctly calculate 6 hours', () => {
    const checkInMs = mockCheckInTime.getTime(); // 9:00 AM
    const checkOutMs = mockCheckOutTime.getTime(); // 3:00 PM
    const minutes = Math.floor((checkOutMs - checkInMs) / 1000 / 60);
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(minutes).toBe(360); // 6 hours in minutes
    expect(rounded).toBe(6);
  });

  it('should round to nearest 0.5 hour - round down', () => {
    // 6h 10m should round to 6.0
    const minutes = 370;
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(6);
  });

  it('should round to nearest 0.5 hour - round to 0.5', () => {
    // 6h 20m should round to 6.5
    const minutes = 380;
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(6.5);
  });

  it('should round to nearest 0.5 hour - round up', () => {
    // 6h 45m should round to 7.0 (6.75 * 2 = 13.5, rounds to 14, /2 = 7)
    const minutes = 405;
    const hours = minutes / 60;
    const rounded = Math.round(hours * 2) / 2;

    expect(rounded).toBe(7);
  });
});
