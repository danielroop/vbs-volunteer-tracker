/**
 * Tests for Void/Restore Time Entry Cloud Functions
 * voidTimeEntry, restoreTimeEntry
 */
import { jest } from '@jest/globals';

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

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGet = jest.fn();
const mockUpdate = jest.fn().mockResolvedValue(undefined);

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

describe('voidTimeEntry Cloud Function', () => {
  let voidTimeEntry;

  beforeAll(async () => {
    const voidModule = await import('../src/voidEntry.js');
    voidTimeEntry = voidModule.voidTimeEntry;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      doc: mockDoc,
    });

    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
    });
  });

  describe('validation', () => {
    it('should throw error when entryId is missing', async () => {
      const request = {
        data: {
          voidReason: 'Duplicate entry created by mistake',
        },
        auth: { uid: 'admin123' },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when voidReason is missing', async () => {
      const request = {
        data: {
          entryId: 'entry123',
        },
        auth: { uid: 'admin123' },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error when voidReason is less than 5 characters', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: 'Bad',
        },
        auth: { uid: 'admin123' },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('Void reason must be at least 5 characters');
    });

    it('should throw error when voidReason is whitespace-only and under 5 chars', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: '  ab  ',
        },
        auth: { uid: 'admin123' },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('Void reason must be at least 5 characters');
    });

    it('should throw error when user is not authenticated', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: 'Duplicate entry',
        },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('User must be authenticated');
    });
  });

  describe('entry not found', () => {
    it('should throw error when entry does not exist', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const request = {
        data: {
          entryId: 'nonexistent',
          voidReason: 'Duplicate entry',
        },
        auth: { uid: 'admin123' },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('Time entry not found');
    });
  });

  describe('already voided', () => {
    it('should throw error when entry is already voided', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          isVoided: true,
          voidReason: 'Previously voided',
          studentId: 'student123',
        }),
      });

      const request = {
        data: {
          entryId: 'entry123',
          voidReason: 'Another reason',
        },
        auth: { uid: 'admin123' },
      };

      await expect(voidTimeEntry(request)).rejects.toThrow('Time entry is already voided');
    });
  });

  describe('successful void', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            isVoided: false,
            studentId: 'student123',
            changeLog: [],
          }),
        })
        .mockResolvedValueOnce(mockStudentDoc);
    });

    it('should successfully void a time entry', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: 'Duplicate entry created by mistake',
        },
        auth: { uid: 'admin123' },
      };

      const result = await voidTimeEntry(request);

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('Jane Smith');
      expect(result.message).toContain('Jane Smith');
    });

    it('should update the entry with void fields', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: 'Duplicate entry created by mistake',
        },
        auth: { uid: 'admin123' },
      };

      await voidTimeEntry(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isVoided: true,
          voidReason: 'Duplicate entry created by mistake',
          voidedBy: 'admin123',
        })
      );
    });

    it('should add a change log entry', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: 'Duplicate entry created by mistake',
        },
        auth: { uid: 'admin123' },
      };

      await voidTimeEntry(request);

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.changeLog).toHaveLength(1);
      expect(updateCall.changeLog[0].type).toBe('void');
      expect(updateCall.changeLog[0].reason).toBe('Duplicate entry created by mistake');
    });

    it('should trim whitespace from void reason', async () => {
      const request = {
        data: {
          entryId: 'entry123',
          voidReason: '  Duplicate entry  ',
        },
        auth: { uid: 'admin123' },
      };

      await voidTimeEntry(request);

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.voidReason).toBe('Duplicate entry');
    });
  });
});

describe('restoreTimeEntry Cloud Function', () => {
  let restoreTimeEntry;

  beforeAll(async () => {
    const voidModule = await import('../src/voidEntry.js');
    restoreTimeEntry = voidModule.restoreTimeEntry;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      doc: mockDoc,
    });

    mockDoc.mockReturnValue({
      get: mockGet,
      update: mockUpdate,
    });
  });

  describe('validation', () => {
    it('should throw error when entryId is missing', async () => {
      const request = {
        data: {},
        auth: { uid: 'admin123' },
      };

      await expect(restoreTimeEntry(request)).rejects.toThrow('Missing required field');
    });

    it('should throw error when user is not authenticated', async () => {
      const request = {
        data: {
          entryId: 'entry123',
        },
      };

      await expect(restoreTimeEntry(request)).rejects.toThrow('User must be authenticated');
    });
  });

  describe('entry not found', () => {
    it('should throw error when entry does not exist', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const request = {
        data: {
          entryId: 'nonexistent',
        },
        auth: { uid: 'admin123' },
      };

      await expect(restoreTimeEntry(request)).rejects.toThrow('Time entry not found');
    });
  });

  describe('not voided', () => {
    it('should throw error when entry is not voided', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          isVoided: false,
          studentId: 'student123',
        }),
      });

      const request = {
        data: {
          entryId: 'entry123',
        },
        auth: { uid: 'admin123' },
      };

      await expect(restoreTimeEntry(request)).rejects.toThrow('Time entry is not voided');
    });
  });

  describe('successful restore', () => {
    beforeEach(() => {
      mockGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            isVoided: true,
            voidReason: 'Duplicate entry',
            voidedAt: { toDate: () => new Date() },
            voidedBy: 'admin456',
            studentId: 'student123',
            changeLog: [
              {
                timestamp: new Date().toISOString(),
                modifiedBy: 'admin456',
                type: 'void',
                reason: 'Duplicate entry',
                description: 'Entry voided. Reason: Duplicate entry',
              },
            ],
          }),
        })
        .mockResolvedValueOnce(mockStudentDoc);
    });

    it('should successfully restore a voided entry', async () => {
      const request = {
        data: {
          entryId: 'entry123',
        },
        auth: { uid: 'admin123' },
      };

      const result = await restoreTimeEntry(request);

      expect(result.success).toBe(true);
      expect(result.studentName).toBe('Jane Smith');
      expect(result.message).toContain('restored');
    });

    it('should reset void fields to null', async () => {
      const request = {
        data: {
          entryId: 'entry123',
        },
        auth: { uid: 'admin123' },
      };

      await restoreTimeEntry(request);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          isVoided: false,
          voidReason: null,
          voidedAt: null,
          voidedBy: null,
        })
      );
    });

    it('should add a restore entry to the change log', async () => {
      const request = {
        data: {
          entryId: 'entry123',
        },
        auth: { uid: 'admin123' },
      };

      await restoreTimeEntry(request);

      const updateCall = mockUpdate.mock.calls[0][0];
      expect(updateCall.changeLog).toHaveLength(2); // Original void + restore
      expect(updateCall.changeLog[1].type).toBe('restore');
      expect(updateCall.changeLog[1].reason).toContain('Duplicate entry');
    });
  });
});
