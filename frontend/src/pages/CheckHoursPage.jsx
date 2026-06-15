import React, { useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../utils/firebase';
import useQRScanner from '../hooks/useQRScanner';
import Spinner from '../components/common/Spinner';

const qrReaderId = 'hours-qr-reader';

function formatHours(hours) {
  return `${Number(hours || 0).toFixed(2)} ${Number(hours || 0) === 1 ? 'hour' : 'hours'}`;
}

function formatDate(value) {
  if (!value) return 'Date unavailable';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.415 0l-3.25-3.25a1 1 0 111.415-1.42l2.543 2.543 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

export default function CheckHoursPage() {
  const [lookup, setLookup] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [manualQrData, setManualQrData] = useState('');
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const lookupInFlight = useRef(false);

  const selectedEvent = useMemo(() => {
    if (!lookup?.events?.length) return null;
    return lookup.events.find((event) => event.id === selectedEventId) || null;
  }, [lookup, selectedEventId]);

  const loadHours = async (qrData) => {
    if (!qrData || lookupInFlight.current) return;

    lookupInFlight.current = true;
    setStatus({ type: 'loading', message: 'Looking up hours...' });

    try {
      const checkHoursLogged = httpsCallable(functions, 'checkHoursLogged');
      const result = await checkHoursLogged({ qrData });

      if (!result.data?.success) {
        throw new Error(result.data?.error || 'Unable to load hours');
      }

      setLookup(result.data);
      setSelectedEventId(null);
      setStatus({ type: 'success', message: 'Badge scanned' });
      await stopScanning();
    } catch (error) {
      setStatus({ type: 'error', message: error.message || 'Unable to load hours' });
    } finally {
      lookupInFlight.current = false;
    }
  };

  const { isScanning, error: scannerError, startScanning, stopScanning } = useQRScanner({
    onSuccess: (data) => loadHours(data.rawData),
    onError: (error) => {
      setStatus({ type: 'error', message: error.message || 'Invalid QR code' });
    },
    qrbox: { width: 260, height: 260 },
    validateQrData: false,
  });

  const handleStartScanner = async () => {
    setStatus({ type: 'idle', message: '' });
    await startScanning(qrReaderId);
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    loadHours(manualQrData.trim());
  };

  const resetLookup = async () => {
    await stopScanning();
    setLookup(null);
    setSelectedEventId(null);
    setManualQrData('');
    setStatus({ type: 'idle', message: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-primary-700">Volunteer hours</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">Check Hours Logged</h1>
        </div>

        {!lookup ? (
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="overflow-hidden rounded-lg bg-black">
                <div id={qrReaderId} className="min-h-[320px] w-full" />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleStartScanner}
                  disabled={isScanning || status.type === 'loading'}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isScanning ? 'Scanner Active' : 'Scan QR Code'}
                </button>
                {isScanning && (
                  <button
                    type="button"
                    onClick={stopScanning}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                  >
                    Stop Scanner
                  </button>
                )}
              </div>
              {(scannerError || status.message) && (
                <div className={`mt-4 rounded-md border px-4 py-3 text-sm font-semibold ${
                  status.type === 'error' || scannerError
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : status.type === 'loading'
                      ? 'border-blue-200 bg-blue-50 text-blue-800'
                      : 'border-green-200 bg-green-50 text-green-800'
                }`}>
                  {status.type === 'loading' && <Spinner size="sm" className="mr-2 inline-block" />}
                  {scannerError || status.message}
                </div>
              )}
            </div>

            <form onSubmit={handleManualSubmit} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-black text-gray-900">Enter Badge Data</h2>
              <label htmlFor="manual-qr-data" className="mt-4 block text-sm font-bold text-gray-700">
                QR code text or student ID
              </label>
              <textarea
                id="manual-qr-data"
                value={manualQrData}
                onChange={(event) => setManualQrData(event.target.value)}
                rows={4}
                className="mt-2 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Scan a badge, or enter the student ID"
              />
              <button
                type="submit"
                disabled={!manualQrData.trim() || status.type === 'loading'}
                className="mt-4 w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue
              </button>
            </form>
          </section>
        ) : (
          <section className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-900">{lookup.student.fullName || 'Volunteer'}</h2>
                  <dl className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-3">
                    <div>
                      <dt className="font-bold text-gray-900">School</dt>
                      <dd>{lookup.student.schoolName || 'Not listed'}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-gray-900">Grade</dt>
                      <dd>{lookup.student.gradeLevel || 'Not listed'}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-gray-900">All Credited Hours</dt>
                      <dd>{formatHours(lookup.totalHours)}</dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  onClick={resetLookup}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  Scan Another Code
                </button>
              </div>
            </div>

            {lookup.events.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-900">
                No completed service hours have been logged yet.
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div>
                  <h3 className="mb-3 text-lg font-black text-gray-900">Which event are you interested in?</h3>
                  <nav className="space-y-2" aria-label="Worked events">
                  {lookup.events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setSelectedEventId(event.id)}
                      className={`w-full rounded-lg border p-4 text-left shadow-sm transition ${
                        selectedEvent?.id === event.id
                          ? 'border-primary-300 bg-primary-50 text-primary-950'
                          : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-3 text-sm font-black">
                        {event.name}
                        {selectedEvent?.id === event.id && <CheckIcon />}
                      </span>
                      <span className="mt-1 block text-xs font-bold text-gray-500">{formatHours(event.totalHours)}</span>
                    </button>
                  ))}
                  </nav>
                </div>

                {selectedEvent ? (
                  <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <div className="border-b border-gray-200 p-4 sm:p-6">
                      <h3 className="text-xl font-black text-gray-900">{selectedEvent.name}</h3>
                      <p className="mt-1 text-sm font-bold text-primary-700">{formatHours(selectedEvent.totalHours)}</p>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {selectedEvent.entries.map((entry) => (
                        <div key={entry.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
                          <div>
                            <p className="text-sm font-black text-gray-900">{entry.activityName}</p>
                            <p className="mt-1 text-sm text-gray-600">
                              {formatDate(entry.date || entry.checkInTime)} · {formatTime(entry.checkInTime)} to {formatTime(entry.checkOutTime)}
                            </p>
                          </div>
                          <p className="rounded-md bg-green-50 px-3 py-2 text-sm font-black text-green-700 sm:text-right">
                            {formatHours(entry.hours)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm font-semibold text-gray-500">
                    Choose an event to see the credited hours for that event.
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
