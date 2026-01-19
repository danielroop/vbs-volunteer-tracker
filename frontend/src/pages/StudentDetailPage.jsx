import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../utils/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import { QRCodeSVG } from 'qrcode.react';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const { currentEvent } = useEvent();
  const navigate = useNavigate();
  
  const [student, setStudent] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [printMode, setPrintMode] = useState(null);

  useEffect(() => {
    async function fetchStudent() {
      const docRef = doc(db, 'students', studentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) setStudent({ id: snap.id, ...snap.data() });
    }
    if (studentId) fetchStudent();
  }, [studentId]);

  useEffect(() => {
    if (!studentId || !currentEvent?.id) return;

    const q = query(
      collection(db, 'timeEntries'),
      where('studentId', '==', studentId),
      where('eventId', '==', currentEvent.id),
      orderBy('checkInTime', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentId, currentEvent?.id]);

  const roundTime = (hours) => Math.round(hours * 4) / 4;

  // --- Calculations for UI Breakdown ---
  const activityBreakdown = useMemo(() => {
    if (!currentEvent?.activities) return [];

    return currentEvent.activities.map(activity => {
      const activityEntries = entries.filter(e => e.activityId === activity.id);
      const total = activityEntries.reduce((acc, entry) => {
        if (entry.checkInTime && entry.checkOutTime) {
          const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
          return acc + roundTime(diff);
        }
        return acc;
      }, 0);
      return { ...activity, total };
    });
  }, [entries, currentEvent]);

  const totalCalculatedHours = activityBreakdown.reduce((sum, act) => sum + act.total, 0);

  // Print Handlers
  const handlePrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => { window.print(); setPrintMode(null); }, 150);
  };

  if (loading) return <div className="p-20 text-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            #printable-badge { display: ${printMode === 'badge' ? 'flex' : 'none'} !important; }
            #ocps-form { display: ${printMode === 'form' ? 'block' : 'none'} !important; }
            #printable-badge {
              position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
              width: 4in; height: 3in; border: 1px solid #000;
              display: flex; flex-direction: column; align-items: center; justify-content: center;
            }
            .ocps-form-container { font-family: serif; padding: 0.5in; color: black; }
          }
          #printable-badge, #ocps-form { display: none; }
        `}
      </style>

      {/* Header */}
      <div className="flex justify-between items-center mb-6 no-print">
        <button onClick={() => navigate(-1)} className="text-primary-600 font-bold hover:underline">
          ← Back to Roster
        </button>
        <div className="flex gap-3">
          <Button onClick={() => handlePrint('form')} variant="secondary">📄 OCPS Form</Button>
          <Button onClick={() => handlePrint('badge')} variant="primary">🖨️ Print Badge</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
        {/* Left Side: Profile & Activity Breakdown */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
            <div className="w-20 h-20 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-3xl font-bold mb-4 mx-auto">
              {student?.firstName?.[0]}{student?.lastName?.[0]}
            </div>
            <h1 className="text-xl font-bold">{student?.firstName} {student?.lastName}</h1>
            <p className="text-gray-500 text-sm">Grade {student?.gradeLevel}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-6">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Hours Breakdown</h3>
            <div className="space-y-4">
              {activityBreakdown.map(act => (
                <div key={act.id} className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">{act.name}</span>
                  <span className="text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{act.total.toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-4 border-t flex justify-between items-center">
                <span className="text-sm font-black text-primary-700 uppercase">Grand Total</span>
                <span className="text-lg font-black text-primary-800">
                  {(totalCalculatedHours + (student?.overrideHours || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Session History */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Activity</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Time In/Out</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {entries.map((entry) => {
                  const activityName = currentEvent?.activities?.find(a => a.id === entry.activityId)?.name || 'General';
                  const duration = entry.checkOutTime 
                    ? roundTime((entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600)
                    : 0;

                  return (
                    <tr key={entry.id} className="text-sm hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">{entry.checkInTime.toDate().toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-100">
                          {activityName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500">
                        {entry.checkInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                        {entry.checkOutTime ? entry.checkOutTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-gray-900">
                        {entry.checkOutTime ? duration.toFixed(2) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT CONTENT: OCPS Form (Grouped by Activity Type) */}
      <div id="ocps-form" className="ocps-form-container">
        <h1 className="text-center text-2xl font-bold uppercase underline mb-8">Community Service Log</h1>
        <p className="mb-4">Student Name: <strong>{student?.firstName} {student?.lastName}</strong></p>
        <table className="w-full border-collapse border-2 border-black">
          <thead>
            <tr className="bg-gray-100 font-bold">
              <th className="border-2 border-black p-2 text-left">Activity Type</th>
              <th className="border-2 border-black p-2 text-center">Calculated Hours</th>
            </tr>
          </thead>
          <tbody>
            {activityBreakdown.map(act => (
              <tr key={act.id}>
                <td className="border-2 border-black p-2">{act.name}</td>
                <td className="border-2 border-black p-2 text-center">{act.total.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="border-2 border-black p-2 text-right">TOTAL HOURS:</td>
              <td className="border-2 border-black p-2 text-center">
                {(totalCalculatedHours + (student?.overrideHours || 0)).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="mt-20 border-t border-black w-64 pt-1">Supervisor Signature</div>
      </div>

      {/* PRINT CONTENT: Badge */}
      <div id="printable-badge">
        <h1 className="text-2xl font-bold">{student?.firstName} {student?.lastName}</h1>
        <QRCodeSVG value={`${studentId}|${currentEvent?.id}|vbs-checksum`} size={150} />
        <p className="text-xs mt-2 uppercase">{currentEvent?.name}</p>
      </div>
    </div>
  );
}