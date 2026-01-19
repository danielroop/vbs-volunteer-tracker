import React, { useState, useEffect } from 'react';
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
  const [printMode, setPrintMode] = useState(null); // 'badge' or 'form'

  useEffect(() => {
    async function fetchStudent() {
      const docRef = doc(db, 'students', studentId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setStudent({ id: snap.id, ...snap.data() });
      }
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

  const totalEventHours = entries.reduce((acc, entry) => {
    if (entry.checkInTime && entry.checkOutTime) {
      const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
      return acc + roundTime(diff);
    }
    return acc;
  }, 0);

  // Print Handlers
  const handlePrintBadge = () => {
    setPrintMode('badge');
    // Short timeout to allow state to propagate before browser opens print dialog
    setTimeout(() => { window.print(); setPrintMode(null); }, 150);
  };

  const handlePrintForm = () => {
    setPrintMode('form');
    setTimeout(() => { window.print(); setPrintMode(null); }, 150);
  };

  // QR Payload String
  const qrValue = `${studentId}|${currentEvent?.id}|vbs-checksum`;

  if (loading) return <div className="p-20 text-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: white; margin: 0; padding: 0; }
            
            /* Toggle visibility based on printMode state */
            #printable-badge { display: ${printMode === 'badge' ? 'flex' : 'none'} !important; }
            #ocps-form { display: ${printMode === 'form' ? 'block' : 'none'} !important; }

            #printable-badge {
              position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
              width: 4in; height: 3in; border: 1px solid #000;
              display: flex; flex-direction: column; align-items: center; 
              justify-content: center; text-align: center;
            }
            .ocps-form-container {
              font-family: "Times New Roman", Times, serif;
              padding: 0.5in;
              color: black;
              width: 100%;
            }
            .underline-box { border-bottom: 1px solid black; display: inline-block; min-width: 180px; padding: 0 8px; }
          }
          #printable-badge, #ocps-form { display: none; }
        `}
      </style>

      {/* Screen Header - Hidden during print */}
      <div className="flex justify-between items-center mb-6 no-print">
        <button onClick={() => navigate(-1)} className="text-primary-600 hover:underline">
          ← Back to Roster
        </button>
        <div className="flex gap-3">
          <Button onClick={handlePrintForm} variant="secondary">📄 Print OCPS Service Form</Button>
          <Button onClick={handlePrintBadge} variant="primary">🖨️ Print Badge</Button>
        </div>
      </div>

      {/* Dashboard UI - Hidden during print */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 text-center">
            <div className="w-20 h-20 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-3xl font-bold mb-4 mx-auto">
              {student?.firstName[0]}{student?.lastName[0]}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{student?.firstName} {student?.lastName}</h1>
            <p className="text-gray-500 mb-4">Grade {student?.gradeLevel} • {student?.schoolName}</p>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <label className="text-xs font-bold text-yellow-700 uppercase tracking-wider">Event Hours Total</label>
              <p className="text-3xl font-black text-yellow-900">
                {(totalEventHours + (student?.overrideHours || 0)).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-bold text-gray-600 uppercase">Recent Sessions</h2>
            </div>
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase">Duration</th>
                  <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map((entry) => (
                  <tr key={entry.id} className="text-sm hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{entry.checkInTime.toDate().toLocaleDateString()}</td>
                    <td className="px-6 py-4 text-gray-500">
                      {entry.checkInTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                      {entry.checkOutTime ? entry.checkOutTime.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending...'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-700">
                      {entry.checkOutTime ? roundTime((entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600).toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT CONTENT: Lanyard Badge */}
      <div id="printable-badge">
        <h1 style={{ fontSize: '28pt', fontWeight: 'bold', margin: '0' }}>{student?.firstName} {student?.lastName}</h1>
        <p style={{ fontSize: '16pt', margin: '10px 0' }}>Grade {student?.gradeLevel} Volunteer</p>
        <div style={{ margin: '20px 0' }}>
          <QRCodeSVG value={qrValue} size={160} level="H" />
        </div>
        <p style={{ fontSize: '12pt', color: '#444' }}>{currentEvent?.name}</p>
      </div>

      {/* PRINT CONTENT: OCPS Service Form */}
      <div id="ocps-form" className="ocps-form-container">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold uppercase underline">Community Service Log and Reflection</h1>
          <p className="text-xl mt-2 font-serif">Orange County Public Schools</p>
        </div>
        
        <div className="space-y-6 mb-10 text-lg">
          <p>Student Name: <span className="underline-box font-bold">{student?.firstName} {student?.lastName}</span> Grade: <span className="underline-box">{student?.gradeLevel}</span></p>
          <p>Organization: <span className="underline-box font-bold">{currentEvent?.organizationName || 'Volunteer Program'}</span></p>
        </div>

        <table className="w-full border-collapse border-2 border-black mb-10">
          <thead>
            <tr className="bg-gray-100">
              <th className="border-2 border-black p-3 text-left">Date</th>
              <th className="border-2 border-black p-3 text-left">Description of Service Activity</th>
              <th className="border-2 border-black p-3 text-center">Hours</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td className="border-2 border-black p-3">{entry.checkInTime.toDate().toLocaleDateString()}</td>
                <td className="border-2 border-black p-3">Volunteer Service - {currentEvent?.name}</td>
                <td className="border-2 border-black p-3 text-center">
                  {entry.checkOutTime ? roundTime((entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600).toFixed(2) : '—'}
                </td>
              </tr>
            ))}
            {student?.overrideHours !== 0 && (
              <tr>
                <td className="border-2 border-black p-3 italic">Adj.</td>
                <td className="border-2 border-black p-3 italic font-serif">Administrative Adjustment / Additional Service Hours</td>
                <td className="border-2 border-black p-3 text-center">{student?.overrideHours}</td>
              </tr>
            )}
            <tr className="font-bold border-t-4 border-black">
              <td colSpan="2" className="border-2 border-black p-4 text-right text-xl">TOTAL SERVICE HOURS:</td>
              <td className="border-2 border-black p-4 text-center text-xl">{(totalEventHours + (student?.overrideHours || 0)).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-24 flex justify-between px-4">
          <div className="text-center">
            <div className="border-b-2 border-black w-72 mb-1"></div>
            <p className="font-serif">Site Supervisor Signature</p>
          </div>
          <div className="text-center">
            <div className="border-b-2 border-black w-40 mb-1"></div>
            <p className="font-serif">Date</p>
          </div>
        </div>

        <p className="mt-16 text-xs italic font-serif text-gray-600">
          Note: Hours are calculated and rounded to the nearest 15-minute increment (0.25 hrs) per program requirements.
        </p>
      </div>
    </div>
  );
}