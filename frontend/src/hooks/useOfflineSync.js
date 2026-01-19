import { useState, useEffect, useCallback } from 'react';
import { functions } from '../utils/firebase';
import { httpsCallable } from 'firebase/functions';
import {
  getPendingCheckIns,
  getPendingCheckOuts,
  deletePendingCheckIn,
  deletePendingCheckOut,
  getPendingCounts
} from '../utils/offlineStorage';

/**
 * Hook for managing offline sync operations
 * Automatically syncs pending check-ins and check-outs when online
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState({ checkIns: 0, checkOuts: 0, total: 0 });
  const [syncErrors, setSyncErrors] = useState([]);

  // Update online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update pending counts
  const updatePendingCounts = useCallback(async () => {
    const counts = await getPendingCounts();
    setPendingCount(counts);
  }, []);

  // Check pending counts on mount and when online status changes
  useEffect(() => {
    updatePendingCounts();
  }, [updatePendingCounts]);

  /**
   * Sync all pending check-ins and check-outs
   */
  const syncPending = useCallback(async () => {
    if (!isOnline || isSyncing) {
      return { success: false, error: 'Cannot sync while offline or already syncing' };
    }

    setIsSyncing(true);
    setSyncErrors([]);
    const errors = [];

    try {
      // Sync check-ins
      const pendingCheckIns = await getPendingCheckIns();
      const checkInFunction = httpsCallable(functions, 'checkIn');

      for (const item of pendingCheckIns) {
        try {
          await checkInFunction({
            studentId: item.studentId,
            eventId: item.eventId,
            scannedBy: item.scannedBy || 'offline_sync'
          });
          await deletePendingCheckIn(item.id);
        } catch (error) {
          console.error('Failed to sync check-in:', error);
          errors.push({ type: 'check-in', item, error: error.message });
        }
      }

      // Sync check-outs
      const pendingCheckOuts = await getPendingCheckOuts();
      const checkOutFunction = httpsCallable(functions, 'checkOut');

      for (const item of pendingCheckOuts) {
        try {
          await checkOutFunction({
            studentId: item.studentId,
            eventId: item.eventId,
            method: item.method || 'self_scan'
          });
          await deletePendingCheckOut(item.id);
        } catch (error) {
          console.error('Failed to sync check-out:', error);
          errors.push({ type: 'check-out', item, error: error.message });
        }
      }

      // Update counts
      await updatePendingCounts();

      setSyncErrors(errors);
      return {
        success: errors.length === 0,
        syncedCount: pendingCheckIns.length + pendingCheckOuts.length - errors.length,
        errors
      };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, error: error.message };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCounts]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount.total > 0 && !isSyncing) {
      console.log('Auto-syncing pending items...');
      syncPending();
    }
  }, [isOnline, pendingCount.total, isSyncing, syncPending]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    syncErrors,
    syncPending,
    updatePendingCounts,
  };
}

export default useOfflineSync;
