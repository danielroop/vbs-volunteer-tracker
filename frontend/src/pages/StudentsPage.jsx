import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../utils/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import PrintableBadge from '../components/common/PrintableBadge';

export default function StudentsPage() {
  const navigate = useNavigate();
  const { currentEvent } = useEvent();

  const [students, setStudents] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [badgePrintMode, setBadgePrintMode] = useState(false);

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

  // Calculate activity logs for each student (for printing)
  const getStudentActivityLog = (studentId) => {
    if (!currentEvent?.activities || allEntries.length === 0) return [];

    return currentEvent.activities.map(activity => {
      const activityEntries = allEntries.filter(e =>
        e.studentId === studentId &&
        e.activityId === activity.id &&
        e.checkOutTime
      );
      if (activityEntries.length === 0) return null;

      // Get unique sorted dates for this activity
      const uniqueDates = [...new Set(activityEntries.map(e =>
        new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(e.checkInTime.toDate())
      ))].sort();

      // Identify consecutive groups
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

      // Format strings like "1/1/26 - 1/3/26, 1/5/26"
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
  };

  const handlePrintReports = () => {
    setPrintMode(true);
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 150);
  };

  const handlePrintBadges = () => {
    setBadgePrintMode(true);
    setTimeout(() => {
      window.print();
      setBadgePrintMode(false);
    }, 150);
  };

  if (loading) return <div className="p-20 text-center"><Spinner size="lg" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            #print-all-forms { display: ${printMode ? 'block' : 'none'} !important; }
            #print-all-badges { display: ${badgePrintMode ? 'block' : 'none'} !important; }

            body { background: white; margin: 0; padding: 0; }
            .ocps-form-container {
              font-family: Arial, sans-serif;
              padding: 0.25in;
              color: black;
              line-height: 1.05;
              font-size: 8.5pt;
              page-break-after: always;
              height: 100vh;
              box-sizing: border-box;
            }
            .ocps-form-container:last-child {
              page-break-after: auto;
            }
            table { border-collapse: collapse; width: 100%; margin-bottom: 2px; }
            th, td { border: 1px solid black; padding: 2px 6px; vertical-align: middle; }
            .field-box { border-bottom: 1px solid black; display: inline-block; min-width: 120px; padding: 0 5px; font-weight: bold; }
            .reflection-box { border: 1px solid black; height: 165px; width: 100%; margin-top: 2px; display: flex; flex-direction: column; }
            .reflection-line { border-bottom: 1px solid #eee; flex: 1; }
            .ocps-logo { width: 40px; height: 40px; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 7pt; text-align: center; }

            /* Badge printing styles */
            .badge-page {
              page-break-after: always;
              height: 100vh;
              width: 100vw;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              grid-template-rows: repeat(4, 1fr);
              gap: 0;
              padding: 0.25in;
              box-sizing: border-box;
            }
            .badge-page:last-child {
              page-break-after: auto;
            }
            .student-badge {
              border: 2px solid #000;
              padding: 0.15in;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: white;
              box-sizing: border-box;
              text-align: center;
              margin: 2px;
            }
            .badge-name {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 4px;
              color: #000;
            }
            .badge-id {
              font-size: 9pt;
              color: #666;
              margin-bottom: 8px;
            }
            .badge-qr {
              margin: 0 auto;
            }
          }
          #print-all-forms { display: none; }
          #print-all-badges { display: none; }
        `}
      </style>

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 no-print">
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
          <Button onClick={handlePrintBadges} variant="secondary">🎫 Print Badges</Button>
          <Button onClick={handlePrintReports} variant="secondary">📄 Print Reports</Button>
          <Button onClick={() => setIsModalOpen(true)} variant="primary">+ Add Student</Button>
        </div>
      </div>

      {/* DATA TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden no-print">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm no-print">
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

      {/* PRINT ALL FORMS */}
      <div id="print-all-forms">
        {studentsWithHours.map((student) => {
          const activityLog = getStudentActivityLog(student.id);
          const totalCalculatedHours = activityLog.reduce((sum, act) => sum + parseFloat(act.totalHours), 0);
          const overrideHours = parseFloat(student?.overrideHours || 0);
          const grandTotal = totalCalculatedHours + overrideHours;

          return (
            <div key={student.id} className="ocps-form-container">
              <div className="flex items-center justify-between mb-2 border-b-2 border-black pb-1">
                <div className="ocps-logo">OCPS</div>
                <h1 className="text-lg font-bold text-center flex-1">Community/Work Service Log and Reflection</h1>
              </div>

              <table className="mb-1">
                <tbody>
                  <tr>
                    <td className="w-1/3 border-none">Student ID #: <span className="field-box" style={{ minWidth: '100px' }}></span></td>
                    <td className="border-none">Student Name: <span className="field-box" style={{ minWidth: '220px' }}>{student.firstName} {student.lastName}</span></td>
                  </tr>
                  <tr>
                    <td className="border-none">School Name: <span className="field-box" style={{ minWidth: '200px' }}>{student.schoolName}</span></td>
                    <td className="border-none text-right">Graduation Year: <span className="field-box" style={{ minWidth: '80px' }}>{student.gradYear || '____'}</span></td>
                  </tr>
                </tbody>
              </table>

              <p className="text-[7.5pt] mb-0.5">Social/Civic Issue/Professional Area Addressing with Service Activity Log (Optional):</p>
              <div className="border-b border-black w-full mb-1 h-4"></div>
              <p className="font-bold text-[8pt] mb-0.5">Description of Volunteer/Paid Work Activity:</p>
              <div className="border-b border-black w-full mb-2 h-4"></div>

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
                      <td>{currentEvent?.organizationName} {act?.name}</td>
                      <td className="text-center">{act.dateDisplay}</td>
                      <td>{currentEvent?.contactName || '---'}</td>
                      <td></td>
                      <td className="font-bold">{act.totalHours}</td>
                    </tr>
                  ))}
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

              <div className="mt-1">
                <p className="font-bold text-[7.5pt] mb-0">Reflection on Service Activity/Work (attach additional pages if necessary):</p>
                <p className="text-[6.5pt] italic mb-0.5">Attach a copy of your pay stub for work hours if applicable. Complete the reflection below...</p>
                <div className="reflection-box">
                  {[...Array(7)].map((_, i) => <div key={i} className="reflection-line"></div>)}
                </div>
              </div>

              <p className="text-[7pt] mt-2 font-bold leading-tight">By signing below, I certify that all information on this document is true and correct. I understand that if I am found to have given false testimony about these hours that the hours will be revoked and endanger my eligibility for the Bright Futures Scholarship.</p>

              <div className="mt-3 flex justify-between">
                <div className="text-[8pt]">Student Signature: _______________________ Date: ________</div>
                <div className="text-[8pt]">Parent Signature: ________________________ Date: ________</div>
              </div>
              <p className="text-[5.5pt] mt-1 text-gray-400">Revised 8/2023</p>
            </div>
          );
        })}
      </div>

      {/* PRINT ALL BADGES */}
      <div id="print-all-badges">
        {(() => {
          // Group students into pages of 8
          const pages = [];
          for (let i = 0; i < studentsWithHours.length; i += 8) {
            pages.push(studentsWithHours.slice(i, i + 8));
          }

          return pages.map((pageStudents, pageIndex) => (
            <div key={`page-${pageIndex}`} className="badge-page">
              {pageStudents.map((student) => (
                <PrintableBadge
                  key={student.id}
                  student={student}
                  eventId={currentEvent?.id}
                />
              ))}
              {/* Fill remaining slots with empty badges if needed */}
              {[...Array(Math.max(0, 8 - pageStudents.length))].map((_, i) => (
                <div key={`empty-${i}`} className="student-badge" style={{ border: 'none' }}></div>
              ))}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}