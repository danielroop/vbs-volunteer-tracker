import React, { useState, useEffect, useRef } from 'react';
import { db, functions } from '../../utils/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import useQRScanner from '../../hooks/useQRScanner';
import Spinner from '../common/Spinner';
import { useParams, Link } from 'react-router-dom';
import { parseQRData } from '../../utils/qrCodeGenerator'; // Added shared utility

export default function SelfCheckout() {
  const { eventId: urlEventId, activityId: urlActivityId } = useParams();
  
  const [localEvent, setLocalEvent] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const isStarting = useRef(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const eventsSnap = await getDocs(collection(db, 'events'));
        const eventsList = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllEvents(eventsList);

        if (urlEventId) {
          const match = eventsList.find(e => e.id === urlEventId);
          if (match) setLocalEvent(match);
        }
      } catch (err) {
        console.error("Error loading scanner data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [urlEventId]);

  const { startScanning, stopScanning } = useQRScanner({
  onSuccess: async (data) => {    
    // Ensure we are working with a string. 
    // If 'data' is an object, extract the text property.
    const qrString = typeof data === 'string' ? data : data?.rawData || data?.data;


    if (!qrString) {
      return showMessage('error', 'Could not read QR data');
    }

    // Pass the confirmed string to your utility
    const { studentId, eventId: qrEventId, isValid, error } = parseQRData(qrString);

    if (!isValid) {
      return showMessage('error', error || 'Invalid QR Code');
    }

    if (qrEventId !== urlEventId) {
      return showMessage('error', 'Wrong Event Badge');
    }

    try {
      const checkInFn = httpsCallable(functions, 'checkOut');
      const result = await checkInFn({
        studentId,
        eventId: urlEventId,
        activityId: urlActivityId,
        scannedBy: 'av_scan'
      });
      
      if (result.data.success) {
        showMessage('success', `✓ ${result.data.studentName} Checked Out`);
      }
    } catch (err) {
      showMessage('error', err.message);
    }
  }
});

  const hasValidEvent = !!localEvent;
  const currentActivity = localEvent?.activities?.find(a => a.id === urlActivityId);
  const hasValidActivity = !!currentActivity;

  useEffect(() => {
    if (!loading && hasValidEvent && hasValidActivity && !isStarting.current) {
      isStarting.current = true;
      setTimeout(() => {
        startScanning('qr-reader').catch(() => isStarting.current = false);
      }, 500);
      return () => stopScanning();
    }
  }, [loading, hasValidEvent, hasValidActivity, startScanning, stopScanning]);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  if (loading) return <div className="p-20 text-center"><Spinner /></div>;

  if (!hasValidEvent) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-primary-600 mb-4 flex justify-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-6">Select Event</h2>
          <div className="space-y-3">
            {allEvents.map(event => (
              <Link 
                key={event.id} 
                to={`/scan/${event.id}`}
                className="block p-4 bg-white hover:bg-primary-50 border border-gray-200 hover:border-primary-300 rounded-xl transition-all font-bold text-gray-700 shadow-sm"
              >
                {event.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!hasValidActivity) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-orange-100">
          <div className="text-orange-500 mb-4 flex justify-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center text-gray-900 mb-1">{localEvent.name}</h2>
          <p className="text-gray-500 text-center mb-6 text-sm font-medium uppercase tracking-wider">Select Activity Type</p>
          <div className="space-y-3">
            {localEvent.activities?.map(act => (
              <Link 
                key={act.id} 
                to={`/scan/${urlEventId}/${act.id}`}
                className="block p-4 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl transition-all"
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-700">{act.name}</span>
                  <span className="text-orange-400">→</span>
                </div>
              </Link>
            ))}
          </div>
          <button 
            onClick={() => window.location.href = '/scan'} 
            className="mt-6 w-full text-center text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            ← Back to Event Selection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-4 border-t-4 border-primary-600">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{localEvent?.name} - CHECKOUT</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  {currentActivity?.name}
                </span>
                <span className="text-xs text-gray-400 font-medium">Check-Out Mode</span>
              </div>
            </div>
            <Link to={`/scan/${urlEventId}`} className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full hover:bg-primary-100">
              Change Activity
            </Link>
          </div>
        </div>

        <div className="bg-black rounded-2xl overflow-hidden min-h-[300px] mb-4 shadow-inner">
          <div id="qr-reader" className="w-full"></div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl shadow-lg border-2 animate-bounce ${
            message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            <p className="font-bold text-center">{message.text}</p>
          </div>
        )}
      </div>
    </div>
  );
}