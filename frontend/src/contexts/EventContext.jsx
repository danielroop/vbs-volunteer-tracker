import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';

const EventContext = createContext(null);

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}

export function EventProvider({ children }) {
  const [currentEvent, setCurrentEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth(); // Access the logged-in user

  useEffect(() => {
    if (!user) {
          setLoading(false);
          return;
        }

        // 1. Listen to the user's specific admin settings
        const userPrefsRef = doc(db, 'admins', user.uid);
        
        const unsubscribe = onSnapshot(userPrefsRef, async (userDoc) => {
          const selectedId = userDoc.data()?.selectedEventId;

          if (selectedId) {
            // 2. Load the user's specific selection
            await loadEventById(selectedId);
          } else {
            // 3. Fallback: Load the most recently created event
            await loadDefaultEvent();
          }
          setLoading(false);
        });

        return () => unsubscribe();
  }, [user]);

  /**
   * Load the most recently created event as default
   */
  const loadDefaultEvent = async () => {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setCurrentEvent({ id: snap.docs[0].id, ...snap.docs[0].data() });
    }
  };

  /**
   * Load the current active event
   * For MVP, we'll load the most recent event
   * In production, you might want to filter by date range or status
   */
  const loadCurrentEvent = async () => {
    try {
      setLoading(true);
      const eventsRef = collection(db, 'events');
      const q = query(eventsRef);
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        // For MVP, use the first (or most recent) event
        const eventDoc = snapshot.docs[0];
        setCurrentEvent({
          id: eventDoc.id,
          ...eventDoc.data()
        });
      } else {
        setError('No events found. Please create an event first.');
      }
    } catch (err) {
      console.error('Error loading event:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load a specific event by ID
   * @param {string} eventId
   */
  const loadEventById = async (eventId) => {
    try {
      setLoading(true);
      const eventDoc = await getDoc(doc(db, 'events', eventId));

      if (eventDoc.exists()) {
        setCurrentEvent({
          id: eventDoc.id,
          ...eventDoc.data()
        });
        setError(null);
      } else {
        setError('Event not found');
      }
    } catch (err) {
      console.error('Error loading event:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Refresh the current event data
   */
  const refreshEvent = async () => {
    if (currentEvent?.id) {
      await loadEventById(currentEvent.id);
    } else {
      await loadCurrentEvent();
    }
  };

  const value = {
    currentEvent,
    loading,
    error,
    loadEventById,
    refreshEvent,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

export default EventContext;
