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
      orderBy('checkInTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [studentId, currentEvent?.id]);

  const roundTime = (hours) => Math.round(hours * 4) / 4;

  /**
   * Complex Date Logic: Groups consecutive dates into ranges and identifies gaps
   */
  const activityLog = useMemo(() => {
    if (!currentEvent?.activities || entries.length === 0) return [];

    return currentEvent.activities.map(activity => {
      const activityEntries = entries.filter(e => e.activityId === activity.id && e.checkOutTime);
      if (activityEntries.length === 0) return null;

      // 1. Get unique sorted dates for this activity
      const uniqueDates = [...new Set(activityEntries.map(e => 
        e.checkInTime.toDate().toISOString().split('T')[0]
      ))].sort();

      // 2. Identify consecutive groups
      const groups = [];
      if (uniqueDates.length > 0) {
        let currentGroup = [uniqueDates[0]];
        for (let i = 1; i < uniqueDates.length; i++) {
          const prev = new Date(uniqueDates[i - 1]);
          const curr = new Date(uniqueDates[i]);
          const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

          if (diffDays === 1) {
            currentGroup.push(uniqueDates[i]);
          } else {
            groups.push(currentGroup);
            currentGroup = [uniqueDates[i]];
          }
        }
        groups.push(currentGroup);
      }

      // 3. Format strings like "1/1/26 - 1/3/26, 1/5/26"
      const dateStrings = groups.map(group => {
        const start = new Date(group[0]);
        const end = new Date(group[group.length - 1]);
        const startStr = `${start.getMonth() + 1}/${start.getDate()}/${start.getFullYear().toString().slice(-2)}`;
        const endStr = `${end.getMonth() + 1}/${end.getDate()}/${end.getFullYear().toString().slice(-2)}`;
        
        return group.length > 1 ? `${startStr} - ${endStr}` : startStr;
      });

      const totalHours = activityEntries.reduce((acc, entry) => {
        const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
        return acc + roundTime(diff);
      }, 0);

      return { 
        name: activity.name, 
        dateDisplay: dateStrings.join(', '), 
        totalHours: totalHours.toFixed(2) 
      };
    }).filter(Boolean);
  }, [entries, currentEvent]);

  const totalCalculatedHours = activityLog.reduce((sum, act) => sum + parseFloat(act.totalHours), 0);
  const overrideHours = parseFloat(student?.overrideHours || 0);
  const grandTotal = totalCalculatedHours + overrideHours;

  const handlePrint = (mode) => {
    setPrintMode(mode);
    setTimeout(() => { window.print(); setPrintMode(null); }, 150);
  };

  if (loading) return <div className="p-20 text-center"><Spinner size="lg" /></div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            #printable-badge { display: ${printMode === 'badge' ? 'flex' : 'none'} !important; }
            #ocps-form { display: ${printMode === 'form' ? 'block' : 'none'} !important; }
            
            body { background: white; margin: 0; padding: 0; }
            .ocps-form-container { 
              font-family: Arial, sans-serif; 
              padding: 0.3in; 
              color: black;
              line-height: 1.1;
              font-size: 9pt;
            }
            table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
            th, td { border: 1px solid black; padding: 4px 8px; vertical-align: middle; }
            .field-box { border-bottom: 1px solid black; display: inline-block; min-width: 120px; padding: 0 5px; font-weight: bold; }
            .reflection-box { border: 1px solid black; height: 210px; width: 100%; margin-top: 4px; display: flex; flex-direction: column; }
            .reflection-line { border-bottom: 1px solid #eee; flex: 1; }
            .ocps-logo { width: 45px; height: 45px; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 8pt; text-align: center; }
          }
          #printable-badge, #ocps-form { display: none; }
        `}
      </style>

      {/* ADMIN UI (no-print) */}
      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <button onClick={() => navigate(-1)} className="text-primary-600 font-bold hover:underline mb-2 block">← Back to Roster</button>
          <h1 className="text-3xl font-black text-gray-900">{student?.firstName} {student?.lastName}</h1>
          <p className="text-gray-500 font-medium">{student?.schoolName} • Grade {student?.gradeLevel}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => handlePrint('form')} variant="secondary">📄 Print Service Log</Button>
          <Button onClick={() => handlePrint('badge')} variant="primary">🖨️ Print Badge</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 no-print">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border p-6 h-fit">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Summary</h3>
          <div className="space-y-4">
            {activityLog.map(act => (
              <div key={act.name} className="flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-600">{act.name}</span>
                <span className="text-sm font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{act.totalHours}</span>
              </div>
            ))}
            <div className="pt-4 border-t-2 border-dashed flex justify-between items-center">
              <span className="text-sm font-black text-primary-700 uppercase">Grand Total</span>
              <span className="text-2xl font-black text-primary-600">{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
             <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50"><tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider"><th className="px-6 py-4">Date</th><th className="px-6 py-4">Bucket</th><th className="px-6 py-4 text-right">Hours</th></tr></thead>
               <tbody className="divide-y divide-gray-200">
                 {entries.map(e => (
                   <tr key={e.id} className="text-sm">
                     <td className="px-6 py-4">{e.checkInTime.toDate().toLocaleDateString()}</td>
                     <td className="px-6 py-4 uppercase font-bold text-[10px] text-blue-600">{currentEvent?.activities?.find(a => a.id === e.activityId)?.name}</td>
                     <td className="px-6 py-4 text-right font-black">{e.checkOutTime ? roundTime((e.checkOutTime.seconds - e.checkInTime.seconds) / 3600).toFixed(2) : '---'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      </div>

      {/* OCPS FORM (Matches Rev 8/2023) */}
      <div id="ocps-form" className="ocps-form-container">
        <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
          <div className="ocps-logo">OCPS</div>
          <h1 className="text-xl font-bold text-center flex-1">Community/Work Service Log and Reflection</h1>
        </div>

        <table className="mb-2">
          <tbody>
            <tr>
              <td className="w-1/3 border-none">Student ID #: <span className="field-box" style={{minWidth:'100px'}}></span></td>
              <td className="border-none">Student Name: <span className="field-box" style={{minWidth:'220px'}}>{student?.firstName} {student?.lastName}</span></td>
            </tr>
            <tr>
              <td className="border-none">School Name: <span className="field-box" style={{minWidth:'200px'}}>{student?.schoolName}</span></td>
              <td className="border-none text-right">Graduation Year: <span className="field-box" style={{minWidth:'80px'}}>{student?.gradYear || '____'}</span></td>
            </tr>
          </tbody>
        </table>

        <p className="text-[8pt] mb-1">Social/Civic Issue/Professional Area Addressing with Service Activity Log (Optional):</p>
        <div className="border-b border-black w-full mb-2 h-5"></div>
        <p className="font-bold text-[9pt] mb-1">Description of Volunteer/Paid Work Activity:</p>
        <div className="border-b border-black w-full mb-4 h-5"></div>

        <table className="mb-2 text-center">
          <thead>
            <tr className="bg-gray-100 text-[8pt]">
              <th className="w-[20%]">Service Organization/Business</th>
              <th className="w-[30%]">Date(s) of Service Activity/Work</th>
              <th className="w-[15%]">Contact Name</th>
              <th className="w-[20%]">Signature of Contact</th>
              <th className="w-[15%]">Hours Completed</th>
            </tr>
          </thead>
          <tbody>
            {activityLog.map((act, i) => (
              <tr key={i} className="h-9">
                <td>{currentEvent?.organizationName}</td>
                <td className="text-center">{act.dateDisplay}</td>
                <td>{currentEvent?.contactName || '---'}</td>
                <td></td>
                <td className="font-bold">{act.totalHours}</td>
              </tr>
            ))}
            {/* Blank placeholder rows to maintain form length */}
            {[...Array(Math.max(0, 10 - activityLog.length))].map((_, i) => (
              <tr key={`blank-${i}`} className="h-9">
                <td></td><td></td><td></td><td></td><td></td>
              </tr>
            ))}
            <tr>
              <td colSpan="4" className="text-right font-bold uppercase">Total:</td>
              <td className="font-bold bg-gray-50">{grandTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-2">
          <p className="font-bold text-[8pt] mb-0">Reflection on Service Activity/Work (attach additional pages if necessary):</p>
          <p className="text-[7pt] italic mb-1">Attach a copy of your pay stub for work hours if applicable. Complete the reflection below...</p>
          <div className="reflection-box">
             {[...Array(8)].map((_, i) => <div key={i} className="reflection-line"></div>)}
          </div>
        </div>

        <p className="text-[7.5pt] mt-4 font-bold leading-tight">By signing below, I certify that all information on this document is true and correct. I understand that if I am found to have given false testimony about these hours that the hours will be revoked and endanger my eligibility for the Bright Futures Scholarship.</p>
        
        <div className="mt-6 flex justify-between">
          <div className="text-[8.5pt]">Student Signature: _______________________ Date: ________</div>
          <div className="text-[8.5pt]">Parent Signature: ________________________ Date: ________</div>
        </div>
        <p className="text-[6pt] mt-2 text-gray-400">Revised 8/2023</p>
      </div>

      <div id="printable-badge" className="hidden">
        <h1 className="text-xl font-bold">{student?.firstName} {student?.lastName}</h1>
        <QRCodeSVG value={`${studentId}|${currentEvent?.id}|vbs-checksum`} size={120} />
      </div>
    </div>
  );
}