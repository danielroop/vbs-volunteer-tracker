import { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from 'firebase/firestore';
import { getTodayDateString } from '../utils/hourCalculations';

/**
 * Hook for managing time entries
 * @param {Object} options - Query options
 * @param {string} options.eventId - Event ID to filter by
 * @param {string} options.date - Date to filter by (YYYY-MM-DD)
 * @param {string} options.studentId - Student ID to filter by
 * @param {boolean} options.realtime - Enable real-time updates
 */
export function useTimeEntries(options = {}) {
  const {
    eventId,
    date = getTodayDateString(),
    studentId,
    realtime = false
  } = options;

  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!eventId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query
    const timeEntriesRef = collection(db, 'timeEntries');
    let q = query(
      timeEntriesRef,
      where('eventId', '==', eventId)
    );

    if (date) {
      q = query(q, where('date', '==', date));
    }

    if (studentId) {
      q = query(q, where('studentId', '==', studentId));
    }

    // Add ordering
    q = query(q, orderBy('checkInTime', 'desc'));

    // Set up listener or one-time fetch
    if (realtime) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const entries = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore timestamps to Date objects
            checkInTime: doc.data().checkInTime?.toDate(),
            checkOutTime: doc.data().checkOutTime?.toDate(),
            createdAt: doc.data().createdAt?.toDate(),
          }));
          setTimeEntries(entries);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching time entries:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      // One-time fetch (non-realtime)
      import('firebase/firestore').then(({ getDocs }) => {
        getDocs(q)
          .then(snapshot => {
            const entries = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              checkInTime: doc.data().checkInTime?.toDate(),
              checkOutTime: doc.data().checkOutTime?.toDate(),
              createdAt: doc.data().createdAt?.toDate(),
            }));
            setTimeEntries(entries);
            setLoading(false);
          })
          .catch(err => {
            console.error('Error fetching time entries:', err);
            setError(err.message);
            setLoading(false);
          });
      });
    }
  }, [eventId, date, studentId, realtime]);

  /**
   * Update a time entry
   * @param {string} entryId - Entry ID to update
   * @param {Object} updates - Fields to update
   */
  const updateTimeEntry = async (entryId, updates) => {
    try {
      const entryRef = doc(db, 'timeEntries', entryId);
      await updateDoc(entryRef, updates);
      return { success: true };
    } catch (error) {
      console.error('Error updating time entry:', error);
      return { success: false, error: error.message };
    }
  };

  return {
    timeEntries,
    loading,
    error,
    updateTimeEntry,
  };
}

export default useTimeEntries;
