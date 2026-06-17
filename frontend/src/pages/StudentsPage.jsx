import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { printInNewWindow, createPrintDocument } from '../utils/printUtils';
import { db, storage } from '../utils/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, doc, updateDoc } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { formatActivityDateRanges, generateFilledPdf, mergePdfs, openPdfForPrinting } from '../utils/pdfTemplateUtils';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import PrintableBadge from '../components/common/PrintableBadge';
import { StudentCard, StudentRow } from '../components/Students';
import { GRADE_LEVEL_OPTIONS } from '../utils/grades';

export default function StudentsPage() {
  const navigate = useNavigate();
  const { currentEvent } = useEvent();

  const [students, setStudents] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [badgePrintMode, setBadgePrintMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [pdfTemplates, setPdfTemplates] = useState([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState(null);
  const [printingReports, setPrintingReports] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    schoolName: '',
    gradeLevel: '',
    gradYear: '',
    pdfTemplateId: ''
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editStudentId, setEditStudentId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    schoolName: '',
    gradeLevel: '',
    gradYear: '',
    pdfTemplateId: ''
  });

  // Watch for badgePrintMode changes and reset after print dialog closes
  useEffect(() => {
    if (!badgePrintMode) return;
    const timer = setTimeout(() => setBadgePrintMode(false), 3000);
    return () => clearTimeout(timer);
  }, [badgePrintMode]);

  useEffect(() => {
    const unsubTemplates = onSnapshot(collection(db, 'pdfTemplates'), (snapshot) => {
      setPdfTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubDefaults = onSnapshot(doc(db, 'settings', 'pdfDefaults'), (snap) => {
      setDefaultTemplateId(snap.exists() ? snap.data().defaultTemplateId : null);
    });
    return () => { unsubTemplates(); unsubDefaults(); };
  }, []);

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
      const data = { ...formData, overrideHours: 0, createdAt: serverTimestamp() };
      if (!data.pdfTemplateId) delete data.pdfTemplateId;
      await addDoc(collection(db, 'students'), data);
      setIsModalOpen(false);
      setFormData({ firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '', pdfTemplateId: '' });
    } catch (err) { console.error("Error adding student:", err); }
  };

  const openEditModal = (student) => {
    setEditStudentId(student.id);
    setEditFormData({
      firstName: student.firstName || '',
      lastName: student.lastName || '',
      schoolName: student.schoolName || '',
      gradeLevel: student.gradeLevel || '',
      gradYear: student.gradYear || '',
      pdfTemplateId: student.pdfTemplateId || ''
    });
    setIsEditModalOpen(true);
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    if (!editStudentId) return;
    try {
      const data = { ...editFormData };
      if (!data.pdfTemplateId) data.pdfTemplateId = null;
      await updateDoc(doc(db, 'students', editStudentId), data);
      setIsEditModalOpen(false);
      setEditStudentId(null);
    } catch (err) { console.error("Error updating student:", err); }
  };

  const filteredStudents = studentsWithHours.filter(s =>
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Selection helpers
  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      filteredStudents.forEach(s => next.add(s.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedStudents(new Set());
  };

  // Check if all filtered students are selected
  const allFilteredSelected = filteredStudents.length > 0 &&
    filteredStudents.every(s => selectedStudents.has(s.id));

  // Get students to print (selected or all if none selected)
  const getStudentsToPrint = () => {
    if (selectedStudents.size > 0) {
      return studentsWithHours.filter(s => selectedStudents.has(s.id));
    }
    return studentsWithHours;
  };

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

      const totalHours = activityEntries.reduce((acc, entry) => {
        const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
        return acc + roundTime(diff);
      }, 0);

      return {
        name: activity.name,
        dateDisplay: formatActivityDateRanges(uniqueDates),
        sortDate: uniqueDates[0],
        totalHours: totalHours.toFixed(2)
      };
    }).filter(Boolean).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  };

  const PRINT_STYLES = `
    body { background: white; margin: 0; padding: 0; }
    .ocps-form-container { font-family: Arial, sans-serif; padding: 0.25in; color: black; line-height: 1.05; font-size: 8.5pt; page-break-after: always; height: 100vh; box-sizing: border-box; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 2px; }
    th, td { border: 1px solid black; padding: 2px 6px; vertical-align: middle; }
    .field-box { border-bottom: 1px solid black; display: inline-block; min-width: 120px; padding: 0 5px; font-weight: bold; }
    .reflection-box { border: 1px solid black; height: 165px; width: 100%; margin-top: 2px; display: flex; flex-direction: column; }
    .ocps-logo { width: 40px; height: 40px; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 7pt; text-align: center; }

    .badge-page { page-break-after: always; height: 100vh; width: 100vw; display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr); gap: 0; padding: 0.25in; box-sizing: border-box; }
    .student-badge { border: 2px solid #000; padding: 0.15in; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; box-sizing: border-box; text-align: center; margin: 2px; }
    .badge-name { font-size: 14pt; font-weight: bold; margin-bottom: 4px; color: #000; }
    .badge-id { font-size: 9pt; color: #666; margin-bottom: 8px; }
  `;

  const printElementById = (id, title = 'Print', setStateReseter) => {
    const el = document.getElementById(id);
    if (!el) {
      alert('Print content not available');
      return;
    }

    if (setStateReseter) setStateReseter(true);

    const html = createPrintDocument({ title, styles: PRINT_STYLES, body: el.outerHTML });

    printInNewWindow(html, {
      onComplete: () => { if (setStateReseter) setStateReseter(false); },
      onError: () => { if (setStateReseter) setStateReseter(false); }
    });
  };

  // Returns the effective PDF template for a student (own → default → null)
  const getEffectiveTemplate = (student) => {
    const id = student.pdfTemplateId || defaultTemplateId;
    return id ? pdfTemplates.find(t => t.id === id) || null : null;
  };

  // Builds the HTML string for one student's OCPS form (used as HTML fallback)
  const buildStudentFormHtml = (student, activityLog, grandTotal) => {
    const orgName = currentEvent?.organizationName || '';
    const contactName = currentEvent?.contactName || '---';
    const activityRows = activityLog.map(act => `
      <tr class="h9">
        <td>${orgName} ${act.name || ''}</td>
        <td style="text-align:center">${act.dateDisplay}</td>
        <td>${contactName}</td>
        <td></td>
        <td style="font-weight:bold">${act.totalHours}</td>
      </tr>`).join('');
    const blankRows = Array.from({ length: Math.max(0, 10 - activityLog.length) })
      .map(() => '<tr style="height:36px"><td></td><td></td><td></td><td></td><td></td></tr>').join('');

    return `<div class="ocps-form-container">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:2px solid black;padding-bottom:4px">
        <div class="ocps-logo">OCPS</div>
        <h1 style="font-size:13pt;font-weight:bold;text-align:center;flex:1">Community/Work Service Log and Reflection</h1>
      </div>
      <table style="margin-bottom:4px"><tbody>
        <tr>
          <td style="width:33%;border:none">Student ID #: <span class="field-box" style="min-width:100px"></span></td>
          <td style="border:none">Student Name: <span class="field-box" style="min-width:220px">${student.firstName} ${student.lastName}</span></td>
        </tr>
        <tr>
          <td style="border:none">School Name: <span class="field-box" style="min-width:200px">${student.schoolName || ''}</span></td>
          <td style="border:none;text-align:right">Graduation Year: <span class="field-box" style="min-width:80px">${student.gradYear || '____'}</span></td>
        </tr>
      </tbody></table>
      <p style="font-size:7.5pt;margin:2px 0">Social/Civic Issue/Professional Area Addressing with Service Activity Log (Optional):</p>
      <div style="border-bottom:1px solid black;width:100%;margin-bottom:4px;height:16px"></div>
      <p style="font-weight:bold;font-size:8pt;margin:2px 0">Description of Volunteer/Paid Work Activity:</p>
      <div style="border-bottom:1px solid black;width:100%;margin-bottom:8px;height:16px"></div>
      <table style="margin-bottom:8px;text-align:center"><thead>
        <tr style="background:#f3f4f6;font-size:8pt">
          <th style="width:20%">Service Organization/Business</th>
          <th style="width:30%">Date(s) of Service Activity/Work</th>
          <th style="width:15%">Contact Name</th>
          <th style="width:20%">Signature of Contact</th>
          <th style="width:15%">Hours Completed</th>
        </tr>
      </thead><tbody>
        ${activityRows}${blankRows}
        <tr>
          <td colspan="4" style="text-align:right;font-weight:bold;text-transform:uppercase">Total:</td>
          <td style="font-weight:bold;background:#f9fafb">${grandTotal.toFixed(2)}</td>
        </tr>
      </tbody></table>
      <div style="margin-top:4px">
        <p style="font-weight:bold;font-size:7.5pt;margin:0">Reflection on Service Activity/Work (attach additional pages if necessary):</p>
        <p style="font-size:6.5pt;font-style:italic;margin:2px 0">Attach a copy of your pay stub for work hours if applicable. Complete the reflection below...</p>
        <div class="reflection-box">${Array.from({ length: 7 }).map(() => '<div class="reflection-line"></div>').join('')}</div>
      </div>
      <p style="font-size:7pt;margin-top:8px;font-weight:bold;line-height:1.3">By signing below, I certify that all information on this document is true and correct. I understand that if I am found to have given false testimony about these hours that the hours will be revoked and endanger my eligibility for the Bright Futures Scholarship.</p>
      <div style="margin-top:12px;display:flex;justify-content:space-between">
        <div style="font-size:8pt">Student Signature: _______________________ Date: ________</div>
        <div style="font-size:8pt">Parent Signature: ________________________ Date: ________</div>
      </div>
      <p style="font-size:5.5pt;margin-top:4px;color:#9ca3af">Revised 8/2023</p>
    </div>`;
  };

  const handlePrintReports = async () => {
    const studentsToPrint = getStudentsToPrint();
    const pdfGroup = [];
    const htmlGroup = [];

    for (const student of studentsToPrint) {
      const template = getEffectiveTemplate(student);
      if (template) {
        pdfGroup.push({ student, template });
      } else {
        htmlGroup.push(student);
      }
    }

    // PDF path: generate, merge, open print dialog
    if (pdfGroup.length > 0) {
      setPrintingReports(true);
      try {
        const allPdfBytes = [];
        for (const { student, template } of pdfGroup) {
          const storageRef = ref(storage, template.storagePath);
          const url = await getDownloadURL(storageRef);
          const response = await fetch(url);
          const templateBytes = await response.arrayBuffer();

          const activityLog = getStudentActivityLog(student.id);
          const totalCalc = activityLog.reduce((sum, a) => sum + parseFloat(a.totalHours), 0);
          const grandTotal = totalCalc + parseFloat(student.overrideHours || 0);

          const pdfBytes = await generateFilledPdf(templateBytes, template.fields, {
            student,
            totalHours: grandTotal,
            eventName: currentEvent?.name || '',
            activityLog,
            event: currentEvent,
            timeEntries: allEntries.filter(e => e.studentId === student.id && !e.isVoided),
          });
          allPdfBytes.push(pdfBytes);
        }
        const mergedBytes = await mergePdfs(allPdfBytes);
        openPdfForPrinting(mergedBytes, 'service-logs.pdf');
      } catch (err) {
        console.error('Bulk PDF generation failed:', err);
        alert('Failed to generate PDFs: ' + err.message);
      } finally {
        setPrintingReports(false);
      }
    }

    // HTML fallback path: students with no template
    if (htmlGroup.length > 0) {
      const formsHtml = htmlGroup.map(student => {
        const activityLog = getStudentActivityLog(student.id);
        const totalCalc = activityLog.reduce((sum, a) => sum + parseFloat(a.totalHours), 0);
        const grandTotal = totalCalc + parseFloat(student.overrideHours || 0);
        return buildStudentFormHtml(student, activityLog, grandTotal);
      }).join('');

      const html = createPrintDocument({ title: 'Service Logs', styles: PRINT_STYLES, body: formsHtml });
      printInNewWindow(html);
    }
  };

  const handlePrintBadges = () => {
    printElementById('print-all-badges', 'Badges', setBadgePrintMode);
  };

  const handleViewDetail = (studentId) => {
    navigate(`/admin/settings/students/${studentId}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-20 text-center"><Spinner size="lg" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            #print-all-badges { display: ${badgePrintMode ? 'block' : 'none'} !important; }

            body { background: white; margin: 0; padding: 0; }
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
            .badge-page:last-child { page-break-after: auto; }
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
            .badge-name { font-size: 14pt; font-weight: bold; margin-bottom: 4px; color: #000; }
            .badge-id { font-size: 9pt; color: #666; margin-bottom: 8px; }
            .badge-qr { margin: 0 auto; }
          }
          #print-all-badges { display: none; }
        `}
      </style>

      {/* PAGE HEADER WITH ACTIONS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 no-print">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Volunteer Roster</h1>
        </div>

        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <input
            placeholder="Search volunteers..."
            className="border border-gray-200 rounded-xl px-4 py-2 w-full md:w-64 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Button onClick={handlePrintBadges} variant="secondary">
            {selectedStudents.size > 0 ? `Print Badges (${selectedStudents.size})` : 'Print Badges'}
          </Button>
          <Button onClick={handlePrintReports} variant="secondary" disabled={printingReports} loading={printingReports}>
            {printingReports ? 'Generating...' : selectedStudents.size > 0 ? `Print Reports (${selectedStudents.size})` : 'Print Reports'}
          </Button>
          <Button onClick={() => setIsModalOpen(true)} variant="primary">+ Add Student</Button>
        </div>
      </div>

      {/* SELECTION BAR */}
      {selectedStudents.size > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center bg-primary-600 text-white text-sm font-bold px-3 py-1 rounded-full">
              {selectedStudents.size}
            </span>
            <span className="text-sm font-medium text-primary-800">
              {selectedStudents.size === 1 ? 'student selected' : 'students selected'}
            </span>
          </div>
          <div className="flex gap-2">
            <Button onClick={selectAllFiltered} variant="secondary" size="sm">
              Select All Visible ({filteredStudents.length})
            </Button>
            <Button onClick={clearSelection} variant="secondary" size="sm">
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* DESKTOP: DATA TABLE (hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden no-print">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="px-4 py-4 w-12">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(e) => {
                    if (e.target.checked) {
                      selectAllFiltered();
                    } else {
                      // Deselect only the filtered students
                      setSelectedStudents(prev => {
                        const next = new Set(prev);
                        filteredStudents.forEach(s => next.delete(s.id));
                        return next;
                      });
                    }
                  }}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                  aria-label={allFilteredSelected ? "Deselect all students" : "Select all students"}
                />
              </th>
              <th className="px-6 py-4">Student Name</th>
              <th className="px-6 py-4">School Details</th>
              <th className="px-6 py-4 text-center">Event Hours</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredStudents.map(student => (
              <StudentRow
                key={student.id}
                student={student}
                isSelected={selectedStudents.has(student.id)}
                onToggleSelection={toggleStudentSelection}
                onViewDetail={handleViewDetail}
                onEdit={openEditModal}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE: CARD LIST (visible only on mobile) */}
      <div className="block md:hidden no-print">
        {/* Mobile header with select all checkbox */}
        <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  selectAllFiltered();
                } else {
                  setSelectedStudents(prev => {
                    const next = new Set(prev);
                    filteredStudents.forEach(s => next.delete(s.id));
                    return next;
                  });
                }
              }}
              className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              aria-label={allFilteredSelected ? "Deselect all students" : "Select all students"}
            />
            <span className="text-sm font-medium text-gray-600">Select All</span>
          </label>
          <span className="text-sm text-gray-400">
            {filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'}
          </span>
        </div>

        {/* Card list with semantic HTML */}
        <ul className="space-y-3" role="list" aria-label="Student list">
          {filteredStudents.map(student => (
            <StudentCard
              key={student.id}
              student={student}
              isSelected={selectedStudents.has(student.id)}
              onToggleSelection={toggleStudentSelection}
              onViewDetail={handleViewDetail}
              onEdit={openEditModal}
            />
          ))}
        </ul>

        {/* Empty state */}
        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg font-medium">No students found</p>
            <p className="text-sm mt-1">Try adjusting your search</p>
          </div>
        )}
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
                  <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Last Name</label>
                  <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">School Name</label>
                <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                  value={formData.schoolName} onChange={e => setFormData({...formData, schoolName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grade</label>
                  <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={formData.gradeLevel} onChange={e => setFormData({...formData, gradeLevel: e.target.value})}>
                    <option value="">Select...</option>
                    {GRADE_LEVEL_OPTIONS.map(grade => (
                      <option key={grade.value} value={grade.value}>{grade.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grad Year</label>
                  <input placeholder="2027" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    value={formData.gradYear} onChange={e => setFormData({...formData, gradYear: e.target.value})} />
                </div>
              </div>
              {pdfTemplates.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Volunteer Form Template</label>
                  <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={formData.pdfTemplateId} onChange={e => setFormData({...formData, pdfTemplateId: e.target.value})}>
                    <option value="">
                      {defaultTemplateId
                        ? `Default: ${pdfTemplates.find(t => t.id === defaultTemplateId)?.name || 'Default'}`
                        : 'Use default template'}
                    </option>
                    {pdfTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-6">
                <Button type="submit" className="flex-1 py-3">Add Student</Button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm no-print">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
            <h2 className="text-2xl font-black text-gray-900 mb-6">Edit Volunteer</h2>
            <form onSubmit={handleEditStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">First Name</label>
                  <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    value={editFormData.firstName} onChange={e => setEditFormData({...editFormData, firstName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Last Name</label>
                  <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    value={editFormData.lastName} onChange={e => setEditFormData({...editFormData, lastName: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">School Name</label>
                <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                  value={editFormData.schoolName} onChange={e => setEditFormData({...editFormData, schoolName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grade</label>
                  <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={editFormData.gradeLevel} onChange={e => setEditFormData({...editFormData, gradeLevel: e.target.value})}>
                    <option value="">Select...</option>
                    {GRADE_LEVEL_OPTIONS.map(grade => (
                      <option key={grade.value} value={grade.value}>{grade.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grad Year</label>
                  <input placeholder="2027" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                    value={editFormData.gradYear} onChange={e => setEditFormData({...editFormData, gradYear: e.target.value})} />
                </div>
              </div>
              {pdfTemplates.length > 0 && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Volunteer Form Template</label>
                  <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={editFormData.pdfTemplateId} onChange={e => setEditFormData({...editFormData, pdfTemplateId: e.target.value})}>
                    <option value="">
                      {defaultTemplateId
                        ? `Default: ${pdfTemplates.find(t => t.id === defaultTemplateId)?.name || 'Default'}`
                        : 'Use default template'}
                    </option>
                    {pdfTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-3 pt-6">
                <Button type="submit" className="flex-1 py-3">Save Changes</Button>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT ALL BADGES */}
      <div id="print-all-badges">
        {(() => {
          // Group students into pages of 8
          const studentsToPrint = getStudentsToPrint();
          const pages = [];
          for (let i = 0; i < studentsToPrint.length; i += 8) {
            pages.push(studentsToPrint.slice(i, i + 8));
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
    </div>
  );
}
