import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  updateDoc
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

const EventContext = createContext(null);

const getCreatedMillis = (event) => {
  const createdAt = event.createdAt;
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === 'function') return createdAt.toMillis();
  if (typeof createdAt.seconds === 'number') return createdAt.seconds * 1000;
  return new Date(createdAt).getTime() || 0;
};

const sortEvents = (eventList) => {
  return [...eventList].sort((a, b) => {
    const createdDiff = getCreatedMillis(b) - getCreatedMillis(a);
    if (createdDiff !== 0) return createdDiff;
    return (b.name || '').localeCompare(a.name || '');
  });
};

export function useEvent() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvent must be used within an EventProvider');
  }
  return context;
}

export function EventProvider({ children }) {
  const [currentEvent, setCurrentEvent] = useState(null);
  const [events, setEvents] = useState([]);
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

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'events'), (snapshot) => {
      const eventList = snapshot.docs.map(eventDoc => ({
        id: eventDoc.id,
        ...eventDoc.data()
      }));
      setEvents(sortEvents(eventList));
    }, (err) => {
      console.error('Error loading events:', err);
      setError('Failed to load events');
    });

    return () => unsubscribe();
  }, [user]);

  /**
   * Updates the Admin's selected event in Firestore
   */
  const switchActiveEvent = async (eventId) => {
    if (!user) return;
    try {
      const selectedEvent = events.find(event => event.id === eventId);
      if (selectedEvent) {
        setCurrentEvent(selectedEvent);
      }
      const adminRef = doc(db, 'admins', user.uid);
      // This persistent update ensures your selection follows you across devices
      await updateDoc(adminRef, { selectedEventId: eventId });
    } catch (err) {
      console.error('Error switching active event:', err);
      setError('Failed to save event selection');
    }
  };

  const loadDefaultEvent = async () => {
    const snap = await getDocs(collection(db, 'events'));
    if (!snap.empty) {
      const eventList = sortEvents(snap.docs.map(eventDoc => ({
        id: eventDoc.id,
        ...eventDoc.data()
      })));
      setCurrentEvent(eventList[0]);
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
    events,
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
