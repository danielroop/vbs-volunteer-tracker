import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { doc, updateDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import { useAuth } from '../contexts/AuthContext';

export default function EventsPage() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    // Access the context methods
    const { currentEvent, loadEventById } = useEvent();
    const { user } = useAuth();

    useEffect(() => {
        const q = query(collection(db, 'events'), orderBy('startDate', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setEvents(eventData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSwitchEvent = async (eventId) => {
        if (!user) return;

        try {
            // Save the preference to the logged-in user's admin document
            const userRef = doc(db, 'admins', user.uid);
            await updateDoc(userRef, {
                selectedEventId: eventId
            });
            console.log("Preference saved to user profile");
        } catch (error) {
            console.error("Error saving event preference:", error);
        }    // Optional: Add a toast or notification here that the event switched
    };

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-bold mb-8 text-gray-900">Events Management</h1>

                {loading ? (
                    <div className="text-center py-10">Loading events...</div>
                ) : (
                    <div className="grid gap-4">
                        {events.map((event) => {
                            const isActive = currentEvent?.id === event.id; // Check if this is the active one

                            return (
                                <div
                                    key={event.id}
                                    className={`bg-white p-6 rounded-lg shadow-md border-l-4 transition-all ${isActive ? 'border-primary-600 ring-2 ring-primary-100' : 'border-gray-200'
                                        }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h2 className="text-xl font-bold text-gray-800">
                                                {event.name} {isActive && <span className="ml-2 text-sm font-normal text-primary-600">(Active)</span>}
                                            </h2>
                                            <p className="text-gray-500 text-sm">📅 {event.startDate} - {event.endDate}</p>
                                        </div>

                                        <Button
                                            variant={isActive ? "secondary" : "primary"}
                                            onClick={() => handleSwitchEvent(event.id)}
                                            disabled={isActive}
                                        >
                                            {isActive ? 'Current Event' : 'Switch to Event'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}