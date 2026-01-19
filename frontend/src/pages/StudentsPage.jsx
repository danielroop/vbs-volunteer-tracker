import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../utils/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

export default function StudentsPage() {
  const navigate = useNavigate();
  const { currentEvent } = useEvent();
  
  const [students, setStudents] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    schoolName: '',
    gradeLevel: '',
    gradYear: ''
  });

  useEffect(() => {
    // 1. Listen for all student records
    const unsubStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Listen for entries linked to the active event to show current totals
    let unsubEntries = () => {};
    if (currentEvent?.id) {
      const q = query(collection(db, 'timeEntries'), where('eventId', '==', currentEvent.id));
      unsubEntries = onSnapshot(q, (snapshot) => {
        setAllEntries(snapshot.docs.map(doc => doc.data()));
        setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      unsubStudents();
      unsubEntries();
    };
  }, [currentEvent?.id]);

  const roundTime = (hours) => Math.round(hours * 4) / 4;

  // Calculate live totals for the table view
  const studentsWithHours = useMemo(() => {
    return students.map(student => {
      const studentEntries = allEntries.filter(e => e.studentId === student.id && e.checkOutTime);
      const totalHours = studentEntries.reduce((acc, entry) => {
        const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
        return acc + roundTime(diff);
      }, 0);
      return { 
        ...student, 
        eventTotal: totalHours + parseFloat(student.overrideHours || 0) 
      };
    }).sort((a, b) => a.lastName.localeCompare(b.lastName));
  }, [students, allEntries]);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'students'), {
        ...formData,
        overrideHours: 0,
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setFormData({ firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '' });
    } catch (err) { console.error("Error adding student:", err); }
  };

  const filteredStudents = studentsWithHours.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <Link to="/" className="text-primary-600 font-bold text-sm hover:underline mb-2 block">← Back to Dashboard</Link>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Volunteer Roster</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 font-medium text-sm">Active Event:</span>
            <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">
              {currentEvent?.name || 'No Event Selected'}
            </span>
          </div>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <input 
            placeholder="Search volunteers..."
            className="border border-gray-200 rounded-xl px-4 py-2 w-full md:w-64 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button onClick={() => setIsModalOpen(true)} variant="primary">+ Add Student</Button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">Student Name</th>
              <th className="px-6 py-4">School Details</th>
              <th className="px-6 py-4 text-center">Event Hours</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.map(student => (
              <tr 
                key={student.id} 
                className="group hover:bg-primary-50 transition-colors cursor-pointer"
                onClick={() => navigate(`/students/${student.id}`)} // Row click navigation
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-gray-900 group-hover:text-primary-700">
                    {student.lastName}, {student.firstName}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
                    Grad: {student.gradYear || '----'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">{student.schoolName || '---'}</div>
                  <div className="text-[10px] font-black text-primary-500 uppercase">
                    Grade {student.gradeLevel || '--'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-black ${
                    student.eventTotal > 0 ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {student.eventTotal.toFixed(2)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents the row's own onClick from firing twice
                      navigate(`/admin/students/${student.id}`); // Navigates to your admin path
                    }}
                    className="text-primary-600 font-bold text-xs bg-white border border-primary-200 px-4 py-1.5 rounded-lg group-hover:bg-primary-600 group-hover:text-white transition-all shadow-sm">
                    View Detail →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CREATE STUDENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Register Volunteer</h2>
            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">First Name</label>
                  <input required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500" 
                    value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Last Name</label>
                  <input required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500" 
                    value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">School Name</label>
                <input required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500" 
                  value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grade</label>
                  <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={formData.gradeLevel} onChange={e => setFormData({...formData, gradeLevel: e.target.value})}>
                    <option value="">Select...</option>
                    {[9, 10, 11, 12].map(g => <option key={g} value={g}>{g}th Grade</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grad Year</label>
                  <input placeholder="2027" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500" 
                    value={formData.gradYear} onChange={e => setFormData({...formData, gradYear: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-3 pt-6">
                <Button type="submit" className="flex-1 py-3">Add Student</Button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}