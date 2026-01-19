import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  onSnapshot, 
  orderBy, 
  limit, 
  updateDoc // Added this import
} from 'firebase/firestore';
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
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Listen to the user's specific admin settings
    const userPrefsRef = doc(db, 'admins', user.uid);
    
    const unsubscribe = onSnapshot(userPrefsRef, async (userDoc) => {
      const selectedId = userDoc.data()?.selectedEventId;

      if (selectedId) {
        await loadEventById(selectedId);
      } else {
        await loadDefaultEvent();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Updates the Admin's selected event in Firestore
   */
  const switchActiveEvent = async (eventId) => {
    if (!user) return;
    try {
      const adminRef = doc(db, 'admins', user.uid);
      // This persistent update ensures your selection follows you across devices
      await updateDoc(adminRef, { selectedEventId: eventId });
    } catch (err) {
      console.error('Error switching active event:', err);
      setError('Failed to save event selection');
    }
  };

  const loadDefaultEvent = async () => {
    const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      setCurrentEvent({ id: snap.docs[0].id, ...snap.docs[0].data() });
    }
  };

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

  const refreshEvent = async () => {
    if (currentEvent?.id) {
      await loadEventById(currentEvent.id);
    }
  };

  const value = {
    currentEvent,
    loading,
    error,
    loadEventById,
    switchActiveEvent, // Now exported for use in EventsPage.jsx
    refreshEvent,
  };

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
}

export default EventContext;