import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../utils/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Spinner from '../components/common/Spinner';
import { Link } from 'react-router-dom'; // Added for navigation to details page

export default function StudentsPage() {
  const { currentEvent } = useEvent();
  const [students, setStudents] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [tempHours, setTempHours] = useState("");

  useEffect(() => {
    if (!currentEvent?.id) {
      setLoading(false);
      return;
    }

    const qStudents = query(
      collection(db, 'students'),
      where('eventId', '==', currentEvent.id)
    );

    const qEntries = query(
      collection(db, 'timeEntries'),
      where('eventId', '==', currentEvent.id)
    );

    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubEntries = onSnapshot(qEntries, (snapshot) => {
      setTimeEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubStudents();
      unsubEntries();
    };
  }, [currentEvent?.id]);

  const roundTime = (hours) => {
    return Math.round(hours * 4) / 4;
  };

  const handleUpdateOverride = async (studentId) => {
    try {
      const studentRef = doc(db, 'students', studentId);
      await updateDoc(studentRef, {
        overrideHours: tempHours === "" ? 0 : parseFloat(tempHours)
      });
      setEditingId(null);
    } catch (err) {
      console.error("Error updating override:", err);
    }
  };

  const calculateStudentStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    return students.map(student => {
      const studentEntries = timeEntries.filter(e => e.studentId === student.id);
      
      const sorted = [...studentEntries].sort((a, b) => 
        (b.checkInTime?.seconds || 0) - (a.checkInTime?.seconds || 0)
      );

      const lastIn = sorted[0]?.checkInTime?.toDate() || null;
      const lastOut = sorted.find(e => e.checkOutTime)?.checkOutTime?.toDate() || null;

      let eventTotal = 0;
      let todayTotal = 0;

      studentEntries.forEach(entry => {
        if (entry.checkInTime && entry.checkOutTime) {
          const duration = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
          const rounded = roundTime(duration);
          eventTotal += rounded;

          const entryDate = entry.checkInTime.toDate().toISOString().split('T')[0];
          if (entryDate === todayStr) {
            todayTotal += rounded;
          }
        }
      });

      // Combine calculated hours with Admin Override
      const override = student.overrideHours || 0;
      const finalTotal = eventTotal + override;

      return {
        ...student,
        lastCheckin: lastIn ? lastIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        lastCheckout: lastOut ? lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
        todayHours: todayTotal.toFixed(2),
        calculatedEventHours: eventTotal.toFixed(2),
        overrideHours: override.toFixed(2),
        finalTotal: finalTotal.toFixed(2)
      };
    });
  }, [students, timeEntries]);

  if (loading) return <div className="flex justify-center p-20"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Volunteer Roster</h1>
        <p className="text-sm text-gray-500">Event Context: <span className="font-semibold text-primary-600">{currentEvent?.name}</span></p>
      </div>

      <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase">Volunteer Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase text-center">Last In/Out</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">Today</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">System Total</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-orange-600 uppercase">Admin Override</th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-900 uppercase">Final Total</th>
              <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {calculateStudentStats.map((student) => (
              <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{student.firstName} {student.lastName}</div>
                  <div className="text-xs text-gray-500">Grade {student.gradeLevel}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-xs text-center text-gray-600">
                  <div>In: {student.lastCheckin}</div>
                  <div>Out: {student.lastCheckout}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-medium text-gray-700">{student.todayHours}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                  {student.calculatedEventHours}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  {editingId === student.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <input 
                        type="number" 
                        className="w-16 border rounded px-1 text-sm py-1"
                        value={tempHours}
                        onChange={(e) => setTempHours(e.target.value)}
                        autoFocus
                      />
                      <button onClick={() => handleUpdateOverride(student.id)} className="text-green-600 text-lg">✓</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setEditingId(student.id); setTempHours(student.overrideHours); }}
                      className={`text-sm font-bold px-2 py-1 rounded border border-dashed ${parseFloat(student.overrideHours) !== 0 ? 'bg-orange-50 border-orange-300 text-orange-700' : 'text-gray-400 border-gray-300'}`}
                    >
                      {student.overrideHours > 0 ? `+${student.overrideHours}` : student.overrideHours < 0 ? student.overrideHours : 'Add'}
                    </button>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="text-sm font-black text-gray-900 bg-yellow-100 px-3 py-1 rounded-full">
                    {student.finalTotal} hrs
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <Link 
                    to={`/admin/students/${student.id}`}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors shadow-sm"
                  >
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}