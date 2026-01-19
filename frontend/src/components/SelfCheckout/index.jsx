import React, { useState, useEffect, useRef } from 'react';
import { db, functions } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import useQRScanner from '../../hooks/useQRScanner';
import Spinner from '../common/Spinner';
import { useParams } from 'react-router-dom';

export default function SelfCheckout() {
  const { isOnline, pendingCount } = useOfflineSync();
  const { eventId: urlEventId, activityId } = useParams(); // Capture activityId from URL
  
  const [localEvent, setLocalEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const isStarting = useRef(false);

  useEffect(() => {
    async function fetchMetadata() {
      if (!urlEventId) return;
      try {
        const snap = await getDoc(doc(db, 'events', urlEventId));
        if (snap.exists()) {
          setLocalEvent({ id: snap.id, ...snap.data() });
        }
      } finally {
        setEventLoading(false);
      }
    }
    fetchMetadata();
  }, [urlEventId]);

  const { startScanning, stopScanning } = useQRScanner({
    onSuccess: async (data) => {
      const { studentId, eventId: qrEventId } = data;
      if (qrEventId !== urlEventId) return showMessage('error', 'Wrong Event');

      try {
        const checkInFn = httpsCallable(functions, 'checkOut');
        const result = await checkInFn({
          studentId,
          eventId: urlEventId,
          activityId: activityId, // Pass the specific activity ID to Firebase
          scannedBy: 'av_scan'
        });
        if (result.data.success) showMessage('success', `✓ ${result.data.studentName} Checked In`);
      } catch (err) {
        showMessage('error', err.message);
      }
    }
  });

  useEffect(() => {
    if (!eventLoading && localEvent && !isStarting.current) {
      isStarting.current = true;
      setTimeout(() => {
        startScanning('qr-reader').catch(() => isStarting.current = false);
      }, 500);
      return () => stopScanning();
    }
  }, [eventLoading, localEvent]);

  // Find the display name for the current activity
  const currentActivity = localEvent?.activities?.find(a => a.id === activityId);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  if (eventLoading) return <div className="p-20 text-center"><Spinner /></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-4 border-t-4 border-primary-600">
          <h1 className="text-xl font-bold text-gray-900">{localEvent?.name} - Check Out</h1>
          {/* Visual indicator of the selected activity bucket */}
          <div className="mt-2 inline-block bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-bold uppercase tracking-tight">
            Logging: {currentActivity?.name || 'General Hours'}
          </div>
        </div>

        <div className="bg-black rounded-lg overflow-hidden min-h-[300px] mb-4 relative">
          <div id="qr-reader" className="w-full"></div>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mb-4 ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}