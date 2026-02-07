
import { jest } from '@jest/globals';

// Mock Firebase Admin
const mockTimestamp = {
    fromDate: jest.fn((date) => ({
        toDate: () => date,
        toMillis: () => date.getTime(),
    })),
    now: jest.fn(() => ({
        toDate: () => new Date(),
        toMillis: () => Date.now(),
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
        name: 'VBS 2026',
    }),
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
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

describe('createManualTimeEntry Cloud Function', () => {
    let createManualTimeEntry;

    beforeAll(async () => {
        const module = await import('../src/manualEntry.js');
        createManualTimeEntry = module.createManualTimeEntry;
    });

    beforeEach(() => {
        jest.clearAllMocks();

        mockCollection.mockReturnValue({
            doc: mockDoc,
            add: mockAdd,
        });

        mockDoc.mockReturnValue({
            get: mockGet,
        });

        mockAdd.mockResolvedValue({ id: 'newEntryId' });
    });

    it('should create a manual time entry successfully', async () => {
        mockGet
            .mockResolvedValueOnce(mockStudentDoc)
            .mockResolvedValueOnce(mockEventDoc);

        const request = {
            data: {
                studentId: 'student123',
                eventId: 'event123',
                activityId: 'activity1',
                date: '2026-06-15',
                startTime: '09:00',
                endTime: '11:00'
            }
        };

        const result = await createManualTimeEntry(request);

        expect(result.success).toBe(true);
        expect(result.entryId).toBe('newEntryId');
        expect(result.hoursWorked).toBe(2);

        expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({
            studentId: 'student123',
            entry_source: 'manual',
            checkInMethod: 'manual',
            checkOutMethod: 'manual',
            hoursWorked: 2,
            rawMinutes: 120
        }));
    });

    it('should throw error if end time is before start time', async () => {
        const request = {
            data: {
                studentId: 'student123',
                eventId: 'event123',
                activityId: 'activity1',
                date: '2026-06-15',
                startTime: '11:00',
                endTime: '09:00'
            }
        };

        await expect(createManualTimeEntry(request)).rejects.toThrow('End time must be after start time');
    });

    it('should throw error if required fields are missing', async () => {
        const request = {
            data: {
                studentId: 'student123',
                // Missing other fields
            }
        };
        await expect(createManualTimeEntry(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error if student not found', async () => {
        mockGet.mockResolvedValueOnce({ exists: false }); // Student not found

        const request = {
            data: {
                studentId: 'student123',
                eventId: 'event123',
                activityId: 'activity1',
                date: '2026-06-15',
                startTime: '09:00',
                endTime: '11:00'
            }
        };

        await expect(createManualTimeEntry(request)).rejects.toThrow('Student not found');
    });

    it('should throw error if event not found', async () => {
        mockGet
            .mockResolvedValueOnce(mockStudentDoc)
            .mockResolvedValueOnce({ exists: false }); // Event not found

        const request = {
            data: {
                studentId: 'student123',
                eventId: 'event123',
                activityId: 'activity1',
                date: '2026-06-15',
                startTime: '09:00',
                endTime: '11:00'
            }
        };

        await expect(createManualTimeEntry(request)).rejects.toThrow('Event not found');
    });
});
