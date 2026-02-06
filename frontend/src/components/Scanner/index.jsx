import React, { useState, useEffect, useRef, act } from 'react';
import { db, functions } from '../../utils/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import useQRScanner from '../../hooks/useQRScanner';
import ScannerHeader from '../common/ScannerHeader';
import Spinner from '../common/Spinner';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { parseQRData } from '../../utils/qrCodeGenerator';
export default function Scanner() {
  const { eventId: urlEventId, activityId: urlActivityId, action: urlAction } = useParams();
  const navigate = useNavigate();

  const [localEvent, setLocalEvent] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const isStarting = useRef(false);
  const isProcessing = useRef(false);
  const pauseAfterValidScan = 2000;

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

  // Auto-select single activity if not provided
  useEffect(() => {
    if (!loading && localEvent && !urlActivityId && localEvent.activities?.length === 1) {
      navigate(`/scan/${urlEventId}/${localEvent.activities[0].id}${urlAction ? `/${urlAction}` : ''}`, { replace: true });
    }
  }, [loading, localEvent, urlActivityId, urlEventId, urlAction, navigate]);

  const { startScanning: startScanningFn, stopScanning: stopScanningFn } = useQRScanner({
    onSuccess: async (data) => {
      const qrString = typeof data === 'string' ? data : data?.rawData || data?.data;


      if (isProcessing.current) {
        console.log("still processing...");
        return 
      } else {
        console.log("started processing a qr scan");
        deactivateScanner();
      }

      if (!qrString) {
        activateScanner();
        console.log("didn't get any data from qrscan");
        return showMessage('error', 'Could not read QR data');
      }

      const { studentId, eventId: qrEventId, isValid, error } = parseQRData(qrString);

      if (!isValid) {
        activateScanner();
        console.log("parsing QR data failed");
        return showMessage('error', error || 'Invalid QR Code');
      }

      if (qrEventId !== urlEventId) {
        activateScanner();
        console.log("QR data is not what we are looking for");
        return showMessage('error', 'Wrong Event Badge');
      }

      try {
        const functionName = urlAction === 'checkout' ? 'checkOut' : 'checkIn';
        const actionFn = httpsCallable(functions, functionName);
        const result = await actionFn({
          studentId,
          eventId: urlEventId,
          activityId: urlActivityId,
          scannedBy: 'av_scan'
        });

        if (result.data.success) {
          const actionText = urlAction === 'checkout' ? 'Checked Out' : 'Checked In';
          
          activateScanner();

          console.log("scan is complete a new scan can start");
          showMessage('success', `✓ ${result.data.studentName} ${actionText}`);
        } else {
          console.log("server side call failed");
          activateScanner();
          showMessage('error', result.data.error || 'Action failed');
        }
      } catch (err) {
        activateScanner();
        console.log("http call failed");
        showMessage('error', err.message);
      }
    }
  });

  // Use refs for scanner functions to avoid effect re-triggering when
  // useQRScanner recreates callbacks (e.g. after getCameras updates state)
  const startScanningRef = useRef(startScanningFn);
  const stopScanningRef = useRef(stopScanningFn);
  startScanningRef.current = startScanningFn;
  stopScanningRef.current = stopScanningFn;

  const hasValidEvent = !!localEvent;
  const currentActivity = localEvent?.activities?.find(a => a.id === urlActivityId);
  const hasValidActivity = !!currentActivity;
  const hasValidAction = urlAction === 'checkin' || urlAction === 'checkout';

  useEffect(() => {
    if (!loading && hasValidEvent && hasValidActivity && hasValidAction && !isStarting.current) {
      isStarting.current = true;
      const timeoutId = setTimeout(() => {
        startScanningRef.current('qr-reader').catch(() => {
          isStarting.current = false;
        });
      }, 500);
      return () => {
        clearTimeout(timeoutId);
        stopScanningRef.current();
        isStarting.current = false;
      };
    }
  }, [loading, hasValidEvent, hasValidActivity, hasValidAction]);

  function showMessage(type, text) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  }

  function activateScanner(){
    console.log(`activating scanner will be enabled in ${pauseAfterValidScan} ms`);
    setTimeout(() => {
      isProcessing.current = false;
    }, pauseAfterValidScan);
  }

  function deactivateScanner(){
    isProcessing.current = true;
  }

  if (loading) return <div className="p-20 text-center"><Spinner /></div>;

  // Step 1: Select Event
  if (!hasValidEvent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ScannerHeader />
        <div className="p-6 flex items-center justify-center">
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
      </div>
    );
  }

  // Step 2: Select Activity
  if (!hasValidActivity) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ScannerHeader />
        <div className="p-6 flex items-center justify-center">
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
                to={`/scan/${urlEventId}/${act.id}${urlAction ? `/${urlAction}` : ''}`}
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
            onClick={() => navigate('/scan')}
            className="mt-6 w-full text-center text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            ← Back to Event Selection
          </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Select Action (Check-in or Check-out)
  if (!hasValidAction) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ScannerHeader />
        <div className="p-6 flex items-center justify-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          <div className="text-blue-500 mb-4 flex justify-center">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center text-gray-900 mb-1">{localEvent.name}</h2>
          <p className="text-gray-500 text-center mb-2 text-sm font-medium">{currentActivity.name}</p>
          <p className="text-gray-500 text-center mb-6 text-sm font-medium uppercase tracking-wider">Select Action</p>
          <div className="space-y-3">
            <Link
              to={`/scan/${urlEventId}/${urlActivityId}/checkin`}
              className="block p-4 bg-green-50 hover:bg-green-100 border border-green-200 hover:border-green-400 rounded-xl transition-all"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-green-700">Check In</span>
                <span className="text-green-400">→</span>
              </div>
            </Link>
            <Link
              to={`/scan/${urlEventId}/${urlActivityId}/checkout`}
              className="block p-4 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-400 rounded-xl transition-all"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-red-700">Check Out</span>
                <span className="text-red-400">→</span>
              </div>
            </Link>
          </div>
          <button
            onClick={() => navigate(`/scan/${urlEventId}`)}
            className="mt-6 w-full text-center text-xs text-gray-400 hover:text-gray-600 font-medium"
          >
            ← Back to Activity Selection
          </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Scanner View
  const actionLabel = urlAction === 'checkout' ? 'Check-Out' : 'Check-In';
  const actionColor = urlAction === 'checkout' ? 'red' : 'green';

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-4 border-t-4 border-primary-600">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{localEvent?.name}</h1>
              <div className="mt-1 flex items-center gap-2">
                <span className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-[10px] font-black uppercase">
                  {currentActivity?.name}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                  urlAction === 'checkout'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-green-100 text-green-800'
                }`}>
                  {actionLabel} Mode
                </span>
              </div>
            </div>
            <Link to={`/scan/${urlEventId}/${urlActivityId}`} className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full hover:bg-primary-100">
              Change Action
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
