import React, { useState, useEffect } from 'react';
import { functions } from '../../utils/firebase';
import { httpsCallable } from 'firebase/functions';
import { useEvent } from '../../contexts/EventContext';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { queueCheckIn } from '../../utils/offlineStorage';
import useQRScanner from '../../hooks/useQRScanner';
import Spinner from '../common/Spinner';

/**
 * AV Scanner Component
 * Per PRD Section 3.2.1: Morning Check-In (AV Scanning)
 * - Quick lanyard distribution
 * - Shows last 5 scans
 * - Audio/visual confirmation
 * - Works offline
 */
export default function AVScanner() {
  const { currentEvent, loading: eventLoading } = useEvent();
  const { isOnline, pendingCount } = useOfflineSync();
  const [recentScans, setRecentScans] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState(null);

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

  // Start scanning when component mounts
  useEffect(() => {
    if (!eventLoading && currentEvent) {
      startScanning('qr-reader');
    }

    return () => {
      stopScanning();
    };
  }, [eventLoading, currentEvent]);

  /**
   * Handle successful QR code scan
   */
  async function handleScanSuccess(data) {
    const { studentId, eventId } = data;

    // Validate event matches
    if (eventId !== currentEvent?.id) {
      showMessage('error', 'Invalid QR code: Wrong event');
      playErrorSound();
      return;
    }

    setScanning(true);

    try {
      if (isOnline) {
        // Online: Call Firebase function
        const checkInFunction = httpsCallable(functions, 'checkIn');
        const result = await checkInFunction({
          studentId,
          eventId,
          scannedBy: 'av_scan'
        });

        if (result.data.success) {
          handleCheckInSuccess(result.data);
        } else {
          showMessage('warning', result.data.error);
          playErrorSound();
        }
      } else {
        // Offline: Queue for later sync
        await queueCheckIn({ studentId, eventId, scannedBy: 'av_scan' });
        showMessage('success', 'Queued for sync (offline)');
        playSuccessSound();

        // Add to recent scans
        addToRecentScans({
          studentName: 'Offline Scan',
          time: new Date(),
          status: 'queued'
        });
      }
    } catch (error) {
      console.error('Check-in error:', error);
      showMessage('error', error.message);
      playErrorSound();
    } finally {
      setScanning(false);
    }
  }

  /**
   * Handle check-in success
   */
  function handleCheckInSuccess(data) {
    showMessage('success', `✓ ${data.studentName} checked in`);
    playSuccessSound();

    // Add to recent scans
    addToRecentScans({
      studentName: data.studentName,
      time: data.checkInTime,
      status: 'checked-in'
    });
  }

  /**
   * Handle scan error
   */
  function handleScanError(error) {
    showMessage('error', error.message);
  }

  /**
   * Add scan to recent scans list (keep last 5)
   */
  function addToRecentScans(scan) {
    setRecentScans(prev => [scan, ...prev].slice(0, 5));
  }

  /**
   * Show message with auto-dismiss
   */
  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  /**
   * Play success sound
   */
  function playSuccessSound() {
    // TODO: Implement audio feedback
    // const audio = new Audio('/sounds/beep-success.mp3');
    // audio.play().catch(console.error);
  }

  /**
   * Play error sound
   */
  function playErrorSound() {
    // TODO: Implement audio feedback
    // const audio = new Audio('/sounds/beep-error.mp3');
    // audio.play().catch(console.error);
  }

  if (eventLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {currentEvent?.name || 'VBS'} - Volunteer Scanner
          </h1>
          <p className="text-gray-600 mt-1">{currentEvent?.organizationName}</p>

          {/* Status indicators */}
          <div className="flex gap-4 mt-4">
            <div className={`flex items-center ${isOnline ? 'text-green-600' : 'text-amber-600'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${isOnline ? 'bg-green-600' : 'bg-amber-600'}`}></div>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            {pendingCount.total > 0 && (
              <div className="text-amber-600">
                ⚠️ {pendingCount.total} pending sync
              </div>
            )}
          </div>
        </div>

        {/* Scanner */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div id="qr-reader" className="w-full"></div>

          {/* Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-100 text-green-800' :
              message.type === 'warning' ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {/* Scan error */}
          {scanError && (
            <div className="mt-4 p-4 bg-red-100 text-red-800 rounded-lg">
              {scanError}
            </div>
          )}
        </div>

        {/* Recent Scans */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Scans</h2>

          {recentScans.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No scans yet</p>
          ) : (
            <ul className="space-y-2">
              {recentScans.map((scan, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <span className="text-green-600 mr-3">✓</span>
                    <span className="font-medium">{scan.studentName}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {new Date(scan.time).toLocaleTimeString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 text-center text-gray-600">
            Total scanned: {recentScans.length}
          </div>
        </div>
      </div>
    </div>
  );
}
