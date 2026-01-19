import React, { useState, useEffect, useRef } from 'react';
import { db, functions } from '../../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEvent } from '../../contexts/EventContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { queueCheckIn } from '../../utils/offlineStorage';
import useQRScanner from '../../hooks/useQRScanner';
import Spinner from '../common/Spinner';
import { useParams } from 'react-router-dom';

/**
 * AV Scanner Component
 * Uses local state for event metadata to prevent "reverting" global context.
 */
export default function AVScanner() {
  const { isOnline, pendingCount } = useOfflineSync();
  const { eventId: urlEventId } = useParams(); // Renamed to avoid collision with QR data
  
  const [localEvent, setLocalEvent] = useState(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [recentScans, setRecentScans] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);
  
  // Guard to prevent multiple scanner starts
  const isStarting = useRef(false);

  // 1. Fetch event metadata based ONLY on the URL ID
  useEffect(() => {
    async function fetchMetadata() {
      if (!urlEventId) return;
      try {
        const eventRef = doc(db, 'events', urlEventId);
        const snap = await getDoc(eventRef);
        
        if (snap.exists()) {
          setLocalEvent({ id: snap.id, ...snap.data() });
        } else {
          console.error("No event found for ID:", urlEventId);
        }
      } catch (err) {
        console.error("Metadata fetch failed:", err);
      } finally {
        setEventLoading(false);
      }
    }
    fetchMetadata();
  }, [urlEventId]);

  // QR Scanner hook
  const {
    isScanning,
    error: scanError,
    startScanning,
    stopScanning
  } = useQRScanner({
    onSuccess: handleScanSuccess,
    onError: handleScanError
  });

  // 2. Controlled scanner start/stop with initialization delay
  useEffect(() => {
    if (!eventLoading && localEvent && !isStarting.current) {
      isStarting.current = true;
      
      // Delay allows the 'qr-reader' div to fully render and the camera to prep
      const timer = setTimeout(() => {
        startScanning('qr-reader').catch((err) => {
          console.error("Scanner start failed:", err);
          isStarting.current = false;
        });
      }, 500);

      return () => {
        clearTimeout(timer);
        stopScanning();
        isStarting.current = false;
      };
    }
  }, [eventLoading, localEvent]);

  /**
   * Handle successful QR code scan
   */
  async function handleScanSuccess(data) {
    // Correctly identifying student and event from QR payload
    const { studentId, eventId: qrEventId } = data;

    // Validate QR event matches the scanner's URL event
    if (qrEventId !== urlEventId) {
      showMessage('error', 'Wrong Event: This student is registered for a different session.');
      return;
    }

    setScanning(true);
    try {
      if (isOnline) {
        const checkInFunction = httpsCallable(functions, 'checkIn');
        const result = await checkInFunction({
          studentId,
          eventId: urlEventId,
          scannedBy: 'av_scan'
        });

        if (result.data.success) {
          handleCheckInSuccess(result.data);
        } else {
          showMessage('warning', result.data.error);
        }
      } else {
        await queueCheckIn({ studentId, eventId: urlEventId, scannedBy: 'av_scan' });
        showMessage('success', 'Queued (Offline Mode)');
        addToRecentScans({
          studentName: 'Offline Scan',
          time: new Date(),
          status: 'queued'
        });
      }
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setScanning(false);
    }
  }

  function handleCheckInSuccess(data) {
    showMessage('success', `✓ ${data.studentName} checked in`);
    addToRecentScans({
      studentName: data.studentName,
      time: data.checkInTime || new Date(),
      status: 'checked-in'
    });
  }

  function handleScanError(error) {
    // Suppress common initialization errors to keep the UI clean
    if (!error.message?.includes('IndexSizeError') && !error.message?.includes('0')) {
      console.warn("Scanner warning:", error.message);
    }
  }

  function addToRecentScans(scan) {
    setRecentScans(prev => [scan, ...prev].slice(0, 5));
  }

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading scanner details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {localEvent?.name || 'Unknown Event'}
          </h1>
          <p className="text-gray-600">{localEvent?.organizationName}</p>

          <div className="flex gap-4 mt-4 text-sm font-medium">
            <div className={isOnline ? 'text-green-600' : 'text-amber-600'}>
              <span className="inline-block w-2 h-2 rounded-full bg-current mr-2"></span>
              {isOnline ? 'Online' : 'Offline Mode'}
            </div>
            {pendingCount?.total > 0 && (
              <div className="text-amber-600">
                ⚠️ {pendingCount.total} Syncing...
              </div>
            )}
          </div>
        </div>

        {/* Scanner Viewport */}
        <div className="bg-black rounded-lg overflow-hidden shadow-inner mb-4 relative min-h-[300px]">
          <div id="qr-reader" className="w-full"></div>
          {scanning && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
              <Spinner size="md" color="white" />
            </div>
          )}
        </div>

        {/* Status Messages */}
        {message && (
          <div className={`mb-4 p-4 rounded-lg shadow-sm border ${
            message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
            message.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-red-50 border-red-200 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Recent Activity Feed */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold mb-4 text-gray-700">Recent Activity</h2>
          {recentScans.length === 0 ? (
            <p className="text-gray-400 italic text-center py-4">No scans recorded for this session yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentScans.map((scan, i) => (
                <li key={i} className="py-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900">{scan.studentName}</span>
                    <p className="text-xs text-gray-500 uppercase">{scan.status}</p>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(scan.time).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}