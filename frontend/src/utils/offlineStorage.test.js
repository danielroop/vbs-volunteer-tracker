import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock idb module
const mockStore = {
  pendingCheckIns: [],
  pendingCheckOuts: [],
};

let idCounter = 1;

const mockDB = {
  add: vi.fn((storeName, item) => {
    const id = idCounter++;
    const itemWithId = { ...item, id };
    if (storeName === 'pendingCheckIns') {
      mockStore.pendingCheckIns.push(itemWithId);
    } else {
      mockStore.pendingCheckOuts.push(itemWithId);
    }
    return Promise.resolve(id);
  }),
  getAll: vi.fn((storeName) => {
    if (storeName === 'pendingCheckIns') {
      return Promise.resolve([...mockStore.pendingCheckIns]);
    }
    return Promise.resolve([...mockStore.pendingCheckOuts]);
  }),
  delete: vi.fn((storeName, id) => {
    if (storeName === 'pendingCheckIns') {
      mockStore.pendingCheckIns = mockStore.pendingCheckIns.filter(item => item.id !== id);
    } else {
      mockStore.pendingCheckOuts = mockStore.pendingCheckOuts.filter(item => item.id !== id);
    }
    return Promise.resolve();
  }),
  count: vi.fn((storeName) => {
    if (storeName === 'pendingCheckIns') {
      return Promise.resolve(mockStore.pendingCheckIns.length);
    }
    return Promise.resolve(mockStore.pendingCheckOuts.length);
  }),
  clear: vi.fn((storeName) => {
    if (storeName === 'pendingCheckIns') {
      mockStore.pendingCheckIns = [];
    } else {
      mockStore.pendingCheckOuts = [];
    }
    return Promise.resolve();
  }),
};

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}));

import {
  queueCheckIn,
  queueCheckOut,
  getPendingCheckIns,
  getPendingCheckOuts,
  deletePendingCheckIn,
  deletePendingCheckOut,
  getPendingCounts,
  clearAllPending,
} from './offlineStorage';

describe('offlineStorage', () => {
  beforeEach(() => {
    // Reset mock store
    mockStore.pendingCheckIns = [];
    mockStore.pendingCheckOuts = [];
    idCounter = 1;
    vi.clearAllMocks();
  });

  describe('queueCheckIn', () => {
    it('should add check-in data to pending queue', async () => {
      const checkInData = {
        studentId: 'student123',
        eventId: 'event456',
        activityId: 'activity1',
      };

      const id = await queueCheckIn(checkInData);

      expect(id).toBe(1);
      expect(mockDB.add).toHaveBeenCalledWith(
        'pendingCheckIns',
        expect.objectContaining({
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should add timestamp to check-in data', async () => {
      const before = Date.now();
      await queueCheckIn({ studentId: 'test' });
      const after = Date.now();

      const addCall = mockDB.add.mock.calls[0][1];
      expect(addCall.timestamp).toBeGreaterThanOrEqual(before);
      expect(addCall.timestamp).toBeLessThanOrEqual(after);
    });

    it('should queue multiple check-ins with unique IDs', async () => {
      const id1 = await queueCheckIn({ studentId: 'student1' });
      const id2 = await queueCheckIn({ studentId: 'student2' });

      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });
  });

  describe('queueCheckOut', () => {
    it('should add check-out data to pending queue', async () => {
      const checkOutData = {
        studentId: 'student123',
        eventId: 'event456',
        activityId: 'activity1',
      };

      const id = await queueCheckOut(checkOutData);

      expect(id).toBe(1);
      expect(mockDB.add).toHaveBeenCalledWith(
        'pendingCheckOuts',
        expect.objectContaining({
          studentId: 'student123',
          eventId: 'event456',
          activityId: 'activity1',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('getPendingCheckIns', () => {
    it('should return all pending check-ins', async () => {
      await queueCheckIn({ studentId: 'student1' });
      await queueCheckIn({ studentId: 'student2' });

      const pending = await getPendingCheckIns();

      expect(pending).toHaveLength(2);
      expect(pending[0].studentId).toBe('student1');
      expect(pending[1].studentId).toBe('student2');
    });

    it('should return empty array when no pending check-ins', async () => {
      const pending = await getPendingCheckIns();

      expect(pending).toHaveLength(0);
    });
  });

  describe('getPendingCheckOuts', () => {
    it('should return all pending check-outs', async () => {
      await queueCheckOut({ studentId: 'student1' });
      await queueCheckOut({ studentId: 'student2' });

      const pending = await getPendingCheckOuts();

      expect(pending).toHaveLength(2);
    });

    it('should return empty array when no pending check-outs', async () => {
      const pending = await getPendingCheckOuts();

      expect(pending).toHaveLength(0);
    });
  });

  describe('deletePendingCheckIn', () => {
    it('should remove check-in from pending queue', async () => {
      const id = await queueCheckIn({ studentId: 'student1' });
      await queueCheckIn({ studentId: 'student2' });

      await deletePendingCheckIn(id);

      const pending = await getPendingCheckIns();
      expect(pending).toHaveLength(1);
      expect(pending[0].studentId).toBe('student2');
    });
  });

  describe('deletePendingCheckOut', () => {
    it('should remove check-out from pending queue', async () => {
      const id = await queueCheckOut({ studentId: 'student1' });
      await queueCheckOut({ studentId: 'student2' });

      await deletePendingCheckOut(id);

      const pending = await getPendingCheckOuts();
      expect(pending).toHaveLength(1);
      expect(pending[0].studentId).toBe('student2');
    });
  });

  describe('getPendingCounts', () => {
    it('should return counts for both queues', async () => {
      await queueCheckIn({ studentId: 'student1' });
      await queueCheckIn({ studentId: 'student2' });
      await queueCheckOut({ studentId: 'student3' });

      const counts = await getPendingCounts();

      expect(counts.checkIns).toBe(2);
      expect(counts.checkOuts).toBe(1);
      expect(counts.total).toBe(3);
    });

    it('should return zeros when queues are empty', async () => {
      const counts = await getPendingCounts();

      expect(counts.checkIns).toBe(0);
      expect(counts.checkOuts).toBe(0);
      expect(counts.total).toBe(0);
    });
  });

  describe('clearAllPending', () => {
    it('should clear both queues', async () => {
      await queueCheckIn({ studentId: 'student1' });
      await queueCheckIn({ studentId: 'student2' });
      await queueCheckOut({ studentId: 'student3' });

      await clearAllPending();

      const checkIns = await getPendingCheckIns();
      const checkOuts = await getPendingCheckOuts();

      expect(checkIns).toHaveLength(0);
      expect(checkOuts).toHaveLength(0);
    });
  });

  describe('data persistence', () => {
    it('should preserve all fields in queued data', async () => {
      const originalData = {
        studentId: 'student123',
        eventId: 'event456',
        activityId: 'activity789',
        customField: 'customValue',
      };

      await queueCheckIn(originalData);
      const pending = await getPendingCheckIns();

      expect(pending[0]).toMatchObject(originalData);
      expect(pending[0]).toHaveProperty('id');
      expect(pending[0]).toHaveProperty('timestamp');
    });
  });
});
