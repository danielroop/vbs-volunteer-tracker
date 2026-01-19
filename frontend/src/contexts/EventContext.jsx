import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

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

  useEffect(() => {
    loadCurrentEvent();
  }, []);

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
