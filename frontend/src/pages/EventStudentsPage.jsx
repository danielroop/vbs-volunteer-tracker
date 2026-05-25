import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { printInNewWindow, createPrintDocument } from '../utils/printUtils';
import { db } from '../utils/firebase';
import {
    collection,
    onSnapshot,
    addDoc,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import PrintableBadge from '../components/common/PrintableBadge';

export default function EventStudentsPage() {
    const { eventId: paramEventId } = useParams();
    const { currentEvent } = useEvent();
    const { user } = useAuth();

    // Use URL param when navigating from event card; fall back to the selected event in Operations
    const eventId = paramEventId || currentEvent?.id;
    const isOperationsView = !paramEventId;

    const [event, setEvent] = useState(null);
    const [allStudents, setAllStudents] = useState([]);
    const [eventEntries, setEventEntries] = useState([]);
    const [eventStudentIds, setEventStudentIds] = useState(new Set());
    const [checkedInStudentIds, setCheckedInStudentIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [printingReports, setPrintingReports] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');

    const [addStudentModal, setAddStudentModal] = useState(false);
    const [addForm, setAddForm] = useState({ firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '' });
    const [addingSaving, setAddingSaving] = useState(false);

    const [importModal, setImportModal] = useState(false);
    const [importSearch, setImportSearch] = useState('');
    const [importSelected, setImportSelected] = useState(new Set());
    const [importSaving, setImportSaving] = useState(false);

    // Load event — use context if available (Operations nav), otherwise fetch from Firestore
    useEffect(() => {
        if (isOperationsView && currentEvent) {
            setEvent(currentEvent);
            return;
        }
        if (!eventId) return;
        const unsub = onSnapshot(collection(db, 'events'), snap => {
            const found = snap.docs.find(d => d.id === eventId);
            if (found) setEvent({ id: found.id, ...found.data() });
        });
        return () => unsub();
    }, [eventId, isOperationsView, currentEvent]);

    // Load all students
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'students'), snap => {
            setAllStudents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    // Load explicit eventStudents associations
    useEffect(() => {
        if (!eventId) return;
        const q = query(collection(db, 'eventStudents'), where('eventId', '==', eventId));
        const unsub = onSnapshot(q, snap => {
            setEventStudentIds(new Set(snap.docs.map(d => d.data().studentId)));
        });
        return () => unsub();
    }, [eventId]);

    // Load students who have checked in at least once
    useEffect(() => {
        if (!eventId) return;
        const q = query(collection(db, 'timeEntries'), where('eventId', '==', eventId));
        const unsub = onSnapshot(q, snap => {
            const ids = new Set();
            const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            entries.forEach(entry => {
                if (!entry.isVoided) ids.add(entry.studentId);
            });
            setEventEntries(entries);
            setCheckedInStudentIds(ids);
            setLoading(false);
        });
        return () => unsub();
    }, [eventId]);

    // Students visible in this event: explicitly added OR checked in at least once
    const eventStudents = useMemo(() => {
        return allStudents
            .filter(s => eventStudentIds.has(s.id) || checkedInStudentIds.has(s.id))
            .sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [allStudents, eventStudentIds, checkedInStudentIds]);

    const filteredStudents = useMemo(() => {
        if (!searchTerm.trim()) return eventStudents;
        return eventStudents.filter(s =>
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [eventStudents, searchTerm]);

    // Students not yet associated with this event (for import modal)
    const importableStudents = useMemo(() => {
        return allStudents
            .filter(s => !eventStudentIds.has(s.id) && !checkedInStudentIds.has(s.id))
            .filter(s => {
                if (!importSearch.trim()) return true;
                return `${s.firstName} ${s.lastName}`.toLowerCase().includes(importSearch.toLowerCase());
            })
            .sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [allStudents, eventStudentIds, checkedInStudentIds, importSearch]);

    const handleAddStudent = async (e) => {
        e.preventDefault();
        setAddingSaving(true);
        try {
            const docRef = await addDoc(collection(db, 'students'), {
                ...addForm,
                overrideHours: 0,
                createdAt: serverTimestamp(),
            });
            await addDoc(collection(db, 'eventStudents'), {
                eventId,
                studentId: docRef.id,
                addedAt: serverTimestamp(),
                addedBy: user?.uid || 'admin',
            });
            setAddStudentModal(false);
            setAddForm({ firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '' });
        } catch (err) {
            console.error('Error adding student:', err);
        } finally {
            setAddingSaving(false);
        }
    };

    const handleImport = async () => {
        if (importSelected.size === 0) return;
        setImportSaving(true);
        try {
            await Promise.all(
                [...importSelected].map(studentId =>
                    addDoc(collection(db, 'eventStudents'), {
                        eventId,
                        studentId,
                        addedAt: serverTimestamp(),
                        addedBy: user?.uid || 'admin',
                    })
                )
            );
            setImportModal(false);
            setImportSelected(new Set());
            setImportSearch('');
        } catch (err) {
            console.error('Error importing students:', err);
        } finally {
            setImportSaving(false);
        }
    };

    const toggleImportSelect = (id) => {
        setImportSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const roundTime = (hours) => Math.round(hours * 4) / 4;

    const PRINT_STYLES = `
        body { background: white; margin: 0; padding: 0; }
        .badge-page { page-break-after: always; height: 100vh; width: 100vw; display: grid; grid-template-columns: repeat(2, 1fr); grid-template-rows: repeat(4, 1fr); gap: 0; padding: 0.25in; box-sizing: border-box; }
        .badge-page:last-child { page-break-after: auto; }
        .student-badge { border: 2px solid #000; padding: 0.15in; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; box-sizing: border-box; text-align: center; margin: 2px; }
        .badge-name { font-size: 14pt; font-weight: bold; margin-bottom: 4px; color: #000; }
        .badge-id { font-size: 9pt; color: #666; margin-bottom: 8px; }
        .badge-qr { margin: 0 auto; }
        .ocps-form-container { font-family: Arial, sans-serif; padding: 0.25in; color: black; line-height: 1.05; font-size: 8.5pt; page-break-after: always; height: 100vh; box-sizing: border-box; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 2px; }
        th, td { border: 1px solid black; padding: 2px 6px; vertical-align: middle; }
        .field-box { border-bottom: 1px solid black; display: inline-block; min-width: 120px; padding: 0 5px; font-weight: bold; }
        .reflection-box { border: 1px solid black; height: 165px; width: 100%; margin-top: 2px; display: flex; flex-direction: column; }
        .reflection-line { border-bottom: 1px solid #ddd; flex: 1; }
        .ocps-logo { width: 40px; height: 40px; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 7pt; text-align: center; }
    `;

    const getStudentActivityLog = (studentId) => {
        if (!event?.activities || eventEntries.length === 0) return [];

        return event.activities.map(activity => {
            const activityEntries = eventEntries.filter(entry =>
                entry.studentId === studentId &&
                entry.activityId === activity.id &&
                entry.checkOutTime &&
                !entry.isVoided
            );
            if (activityEntries.length === 0) return null;

            const uniqueDates = [...new Set(activityEntries.map(entry =>
                new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(entry.checkInTime.toDate())
            ))].sort();

            const totalHours = activityEntries.reduce((acc, entry) => {
                const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
                return acc + roundTime(diff);
            }, 0);

            return {
                name: activity.name,
                dateDisplay: uniqueDates.map(date => {
                    const parsed = new Date(date);
                    return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear().toString().slice(-2)}`;
                }).join(', '),
                totalHours: totalHours.toFixed(2)
            };
        }).filter(Boolean);
    };

    const handlePrintBadges = () => {
        const pages = [];
        for (let i = 0; i < eventStudents.length; i += 8) {
            pages.push(eventStudents.slice(i, i + 8));
        }

        const body = pages.map((pageStudents, pageIndex) => (
            `<div class="badge-page" data-page="${pageIndex + 1}">` +
            pageStudents.map(student => renderToStaticMarkup(
                <PrintableBadge student={student} eventId={eventId} />
            )).join('') +
            Array.from({ length: Math.max(0, 8 - pageStudents.length) })
                .map(() => '<div class="student-badge" style="border:none"></div>')
                .join('') +
            '</div>'
        )).join('');

        const html = createPrintDocument({ title: `${event?.name || 'Event'} Badges`, styles: PRINT_STYLES, body });
        printInNewWindow(html);
    };

    const buildStudentFormHtml = (student, activityLog, grandTotal) => {
        const orgName = event?.organizationName || '';
        const contactName = event?.contactName || '---';
        const activityRows = activityLog.map(activity => `
            <tr>
                <td>${orgName} ${activity.name || ''}</td>
                <td style="text-align:center">${activity.dateDisplay}</td>
                <td>${contactName}</td>
                <td></td>
                <td style="font-weight:bold">${activity.totalHours}</td>
            </tr>
        `).join('');
        const blankRows = Array.from({ length: Math.max(0, 10 - activityLog.length) })
            .map(() => '<tr style="height:36px"><td></td><td></td><td></td><td></td><td></td></tr>')
            .join('');

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

    const handlePrintReports = () => {
        setPrintingReports(true);
        try {
            const formsHtml = eventStudents.map(student => {
                const activityLog = getStudentActivityLog(student.id);
                const totalCalc = activityLog.reduce((sum, activity) => sum + parseFloat(activity.totalHours), 0);
                const grandTotal = totalCalc + parseFloat(student.overrideHours || 0);
                return buildStudentFormHtml(student, activityLog, grandTotal);
            }).join('');

            const html = createPrintDocument({ title: `${event?.name || 'Event'} Service Logs`, styles: PRINT_STYLES, body: formsHtml });
            printInNewWindow(html);
        } finally {
            setPrintingReports(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="p-20 text-center"><Spinner size="lg" /></div>
            </div>
        );
    }

    return (
        <div>
            {/* Page header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    {!isOperationsView && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">
                            <Link to="/admin/settings/events" className="hover:text-primary-600">Events</Link>
                            <span>/</span>
                            <span className="text-gray-600">{event?.name || eventId}</span>
                            <span>/</span>
                            <span className="text-gray-600">Students</span>
                        </div>
                    )}
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        {event?.name || 'Event'} — Students
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">
                        {searchTerm.trim()
                            ? `${filteredStudents.length} of ${eventStudents.length} student${eventStudents.length !== 1 ? 's' : ''}`
                            : `${eventStudents.length} student${eventStudents.length !== 1 ? 's' : ''}`
                        } associated with this event
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0 items-center">
                    <input
                        type="search"
                        placeholder="Search students…"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="border border-gray-200 rounded-xl px-4 py-2 text-sm w-52 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
                        aria-label="Search students"
                    />
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Button variant="secondary" onClick={handlePrintBadges} disabled={eventStudents.length === 0}>
                        Print Badges
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={handlePrintReports}
                        disabled={eventStudents.length === 0 || printingReports}
                        loading={printingReports}
                    >
                        {printingReports ? 'Generating...' : 'Print Reports'}
                    </Button>
                    {allStudents.length > eventStudents.length && (
                        <Button
                            variant="secondary"
                            onClick={() => { setImportModal(true); setImportSearch(''); setImportSelected(new Set()); }}
                        >
                            Import from System
                        </Button>
                    )}
                    <Button variant="primary" onClick={() => setAddStudentModal(true)}>
                        + Add Student
                    </Button>
                </div>
            </div>

            {/* Student list */}
            {eventStudents.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border p-12 text-center text-gray-400">
                    <p className="text-lg font-bold mb-2">No students yet</p>
                    <p className="text-sm">Add a new student or import existing ones from the system.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <th className="px-6 py-4">Name</th>
                                <th className="px-6 py-4">School</th>
                                <th className="px-6 py-4">Grade</th>
                                <th className="px-6 py-4">Grad Year</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredStudents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        <p className="font-bold">No students match your search</p>
                                        <p className="text-sm mt-1">Try a different name.</p>
                                    </td>
                                </tr>
                            ) : filteredStudents.map(s => (
                                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-gray-900">
                                        {s.firstName} {s.lastName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{s.schoolName || '—'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{s.gradeLevel || '—'}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600">{s.gradYear || '—'}</td>
                                    <td className="px-6 py-4">
                                        {checkedInStudentIds.has(s.id) ? (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                                Checked In
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                                                Added
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            to={`/admin/settings/students/${s.id}`}
                                            className="text-xs font-bold text-primary-600 hover:underline"
                                        >
                                            View Details
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Student Modal */}
            {addStudentModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 max-h-[85vh] overflow-y-auto">
                        <h2 className="text-2xl font-black mb-6 text-gray-900">Add New Student</h2>
                        <form onSubmit={handleAddStudent} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">First Name</label>
                                    <input
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={addForm.firstName}
                                        onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Last Name</label>
                                    <input
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={addForm.lastName}
                                        onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">School Name</label>
                                <input
                                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={addForm.schoolName}
                                    onChange={e => setAddForm(f => ({ ...f, schoolName: e.target.value }))}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grade Level</label>
                                    <input
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={addForm.gradeLevel}
                                        onChange={e => setAddForm(f => ({ ...f, gradeLevel: e.target.value }))}
                                        type="number"
                                        min="9"
                                        max="12"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grad Year</label>
                                    <input
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={addForm.gradYear}
                                        onChange={e => setAddForm(f => ({ ...f, gradYear: e.target.value }))}
                                        placeholder="e.g. 2027"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button type="submit" className="flex-1" disabled={addingSaving} loading={addingSaving}>
                                    Add Student
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setAddStudentModal(false)}
                                    className="px-6 py-3 text-gray-400 font-bold hover:bg-gray-100 rounded-2xl transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Import from System Modal */}
            {importModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[85vh] flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Import Students</h2>
                                <p className="text-sm text-gray-500 mt-1">Add existing students from the system to this event.</p>
                            </div>
                            <button
                                onClick={() => setImportModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-4"
                                aria-label="Close"
                            >
                                ×
                            </button>
                        </div>

                        <input
                            type="search"
                            placeholder="Search by name…"
                            value={importSearch}
                            onChange={e => setImportSearch(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none mb-4"
                        />

                        <div className="flex-1 overflow-y-auto min-h-0 border border-gray-100 rounded-xl">
                            {importableStudents.length === 0 ? (
                                <p className="p-6 text-center text-gray-400 text-sm">
                                    {importSearch ? 'No matches found.' : 'All students are already in this event.'}
                                </p>
                            ) : (
                                <ul className="divide-y divide-gray-50">
                                    {importableStudents.map(s => (
                                        <li key={s.id}>
                                            <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={importSelected.has(s.id)}
                                                    onChange={() => toggleImportSelect(s.id)}
                                                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                />
                                                <div>
                                                    <p className="text-sm font-bold text-gray-900">{s.firstName} {s.lastName}</p>
                                                    <p className="text-xs text-gray-500">{s.schoolName} {s.gradYear ? `· ${s.gradYear}` : ''}</p>
                                                </div>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-100">
                            <span className="text-sm text-gray-500">
                                {importSelected.size > 0 ? `${importSelected.size} selected` : 'Select students to import'}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setImportModal(false)}
                                    className="px-4 py-2 text-gray-400 font-bold hover:bg-gray-100 rounded-xl transition-colors text-sm"
                                >
                                    Cancel
                                </button>
                                <Button
                                    onClick={handleImport}
                                    disabled={importSelected.size === 0 || importSaving}
                                    loading={importSaving}
                                >
                                    Add {importSelected.size > 0 ? `${importSelected.size} ` : ''}Student{importSelected.size !== 1 ? 's' : ''}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
