import { openDB } from 'idb';

const DB_NAME = 'vbs-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  PENDING_CHECK_INS: 'pendingCheckIns',
  PENDING_CHECK_OUTS: 'pendingCheckOuts',
};

/**
 * Initialize the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.PENDING_CHECK_INS)) {
        const checkInStore = db.createObjectStore(STORES.PENDING_CHECK_INS, {
          keyPath: 'id',
          autoIncrement: true
        });
        checkInStore.createIndex('timestamp', 'timestamp');
      }

      if (!db.objectStoreNames.contains(STORES.PENDING_CHECK_OUTS)) {
        const checkOutStore = db.createObjectStore(STORES.PENDING_CHECK_OUTS, {
          keyPath: 'id',
          autoIncrement: true
        });
        checkOutStore.createIndex('timestamp', 'timestamp');
      }
    },
  });
}

/**
 * Queue a check-in for offline processing
 * @param {Object} data - Check-in data
 * @returns {Promise<number>} The ID of the queued item
 */
export async function queueCheckIn(data) {
  const db = await initDB();
  const item = {
    ...data,
    timestamp: Date.now(),
  };
  return db.add(STORES.PENDING_CHECK_INS, item);
}

/**
 * Queue a check-out for offline processing
 * @param {Object} data - Check-out data
 * @returns {Promise<number>} The ID of the queued item
 */
export async function queueCheckOut(data) {
  const db = await initDB();
  const item = {
    ...data,
    timestamp: Date.now(),
  };
  return db.add(STORES.PENDING_CHECK_OUTS, item);
}

/**
 * Get all pending check-ins
 * @returns {Promise<Array>}
 */
export async function getPendingCheckIns() {
  const db = await initDB();
  return db.getAll(STORES.PENDING_CHECK_INS);
}

/**
 * Get all pending check-outs
 * @returns {Promise<Array>}
 */
export async function getPendingCheckOuts() {
  const db = await initDB();
  return db.getAll(STORES.PENDING_CHECK_OUTS);
}

/**
 * Delete a pending check-in
 * @param {number} id - The ID of the item to delete
 * @returns {Promise<void>}
 */
export async function deletePendingCheckIn(id) {
  const db = await initDB();
  return db.delete(STORES.PENDING_CHECK_INS, id);
}

/**
 * Delete a pending check-out
 * @param {number} id - The ID of the item to delete
 * @returns {Promise<void>}
 */
export async function deletePendingCheckOut(id) {
  const db = await initDB();
  return db.delete(STORES.PENDING_CHECK_OUTS, id);
}

/**
 * Get count of all pending items
 * @returns {Promise<Object>} { checkIns, checkOuts, total }
 */
export async function getPendingCounts() {
  const db = await initDB();
  const checkIns = await db.count(STORES.PENDING_CHECK_INS);
  const checkOuts = await db.count(STORES.PENDING_CHECK_OUTS);

  return {
    checkIns,
    checkOuts,
    total: checkIns + checkOuts,
  };
}

/**
 * Clear all pending data (use with caution)
 * @returns {Promise<void>}
 */
export async function clearAllPending() {
  const db = await initDB();
  await db.clear(STORES.PENDING_CHECK_INS);
  await db.clear(STORES.PENDING_CHECK_OUTS);
}
