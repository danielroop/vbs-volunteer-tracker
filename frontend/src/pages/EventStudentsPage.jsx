import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { printInNewWindow, createPrintDocument } from '../utils/printUtils';
import { db, storage } from '../utils/firebase';
import {
    collection,
    onSnapshot,
    addDoc,
    deleteDoc,
    doc,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { generateFilledPdf, mergePdfs, openPdfForPrinting } from '../utils/pdfTemplateUtils';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import PrintableBadge from '../components/common/PrintableBadge';
import { GRADE_LEVEL_OPTIONS } from '../utils/grades';

const normalizeTemplateText = (value = '') =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

const SCHOOL_TEMPLATE_ALIASES = [
    { school: ['bishopmoore', 'bishopmoorecatholic'], template: ['bishopmoore'] },
    { school: ['thefirstacademy', 'firstacademy', 'tfa'], template: ['thefirstacademy', 'firstacademy', 'tfa'] },
];

const findTemplateForSchool = (schoolName, templates) => {
    const normalizedSchool = normalizeTemplateText(schoolName);
    if (!normalizedSchool) return null;

    const templateMatches = (template, values) => {
        const normalizedTemplate = normalizeTemplateText(`${template.name || ''} ${template.fileName || ''}`);
        return values.some(value => normalizedTemplate.includes(value));
    };

    const exactMatch = templates.find(template => {
        const normalizedTemplate = normalizeTemplateText(`${template.name || ''} ${template.fileName || ''}`);
        return normalizedTemplate &&
            (normalizedTemplate.includes(normalizedSchool) || normalizedSchool.includes(normalizedTemplate));
    });
    if (exactMatch) return exactMatch;

    const alias = SCHOOL_TEMPLATE_ALIASES.find(item =>
        item.school.some(value => normalizedSchool.includes(value))
    );
    if (alias) {
        const aliasMatch = templates.find(template => templateMatches(template, alias.template));
        if (aliasMatch) return aliasMatch;
    }

    const ocpsTemplate = templates.find(template => templateMatches(template, ['ocps']));
    if (ocpsTemplate) return ocpsTemplate;

    return null;
};

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
    const [eventStudentDocIds, setEventStudentDocIds] = useState({});
    const [checkedInStudentIds, setCheckedInStudentIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [printingReports, setPrintingReports] = useState(false);
    const [removingStudentId, setRemovingStudentId] = useState(null);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    const [pdfTemplates, setPdfTemplates] = useState([]);
    const [defaultTemplateId, setDefaultTemplateId] = useState(null);

    const [searchTerm, setSearchTerm] = useState('');

    const [addStudentModal, setAddStudentModal] = useState(false);
    const [addForm, setAddForm] = useState({ firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '', pdfTemplateId: '' });
    const [addingSaving, setAddingSaving] = useState(false);

    const [importModal, setImportModal] = useState(false);
    const [importSearch, setImportSearch] = useState('');
    const [importSelected, setImportSelected] = useState(new Set());
    const [importSaving, setImportSaving] = useState(false);

    useEffect(() => {
        const unsubTemplates = onSnapshot(collection(db, 'pdfTemplates'), snap => {
            setPdfTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubDefaults = onSnapshot(doc(db, 'settings', 'pdfDefaults'), snap => {
            setDefaultTemplateId(snap.exists() ? snap.data().defaultTemplateId : null);
        });
        return () => {
            unsubTemplates();
            unsubDefaults();
        };
    }, []);

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
            const docIds = {};
            snap.docs.forEach(d => {
                docIds[d.data().studentId] = d.id;
            });
            setEventStudentDocIds(docIds);
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

    const eventStudentIds = useMemo(
        () => new Set(Object.keys(eventStudentDocIds)),
        [eventStudentDocIds]
    );

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

    const allFilteredSelected = filteredStudents.length > 0 &&
        filteredStudents.every(s => selectedStudents.has(s.id));

    const getStudentsToPrint = () => {
        if (selectedStudents.size > 0) {
            return eventStudents.filter(s => selectedStudents.has(s.id));
        }
        return filteredStudents;
    };

    const toggleStudentSelection = (studentId) => {
        setSelectedStudents(prev => {
            const next = new Set(prev);
            next.has(studentId) ? next.delete(studentId) : next.add(studentId);
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

    const selectedPrintCount = eventStudents.filter(s => selectedStudents.has(s.id)).length;
    const printStudentCount = selectedStudents.size > 0 ? selectedPrintCount : filteredStudents.length;

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

    const handleRemoveStudent = async (studentId) => {
        const eventStudentDocId = eventStudentDocIds[studentId];
        if (!eventStudentDocId) return;

        setRemovingStudentId(studentId);
        try {
            await deleteDoc(doc(db, 'eventStudents', eventStudentDocId));
        } catch (err) {
            console.error('Error removing student:', err);
        } finally {
            setRemovingStudentId(null);
        }
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        setAddingSaving(true);
        try {
            const studentData = { ...addForm, overrideHours: 0, createdAt: serverTimestamp() };
            if (!studentData.pdfTemplateId) delete studentData.pdfTemplateId;
            const docRef = await addDoc(collection(db, 'students'), {
                ...studentData,
            });
            await addDoc(collection(db, 'eventStudents'), {
                eventId,
                studentId: docRef.id,
                addedAt: serverTimestamp(),
                addedBy: user?.uid || 'admin',
            });
            setAddStudentModal(false);
            setAddForm({ firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '', pdfTemplateId: '' });
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
                    return `${parsed.getUTCMonth() + 1}/${parsed.getUTCDate()}/${parsed.getUTCFullYear().toString().slice(-2)}`;
                }).join(', '),
                sortDate: uniqueDates[0],
                totalHours: totalHours.toFixed(2)
            };
        }).filter(Boolean).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    };

    const getEffectiveTemplate = (student) => {
        if (student.pdfTemplateId) {
            return pdfTemplates.find(template => template.id === student.pdfTemplateId) || null;
        }

        const schoolTemplate = findTemplateForSchool(student.schoolName, pdfTemplates);
        if (schoolTemplate) return schoolTemplate;

        return defaultTemplateId ? pdfTemplates.find(template => template.id === defaultTemplateId) || null : null;
    };

    const handlePrintBadges = () => {
        const studentsToPrint = getStudentsToPrint();
        const pages = [];
        for (let i = 0; i < studentsToPrint.length; i += 8) {
            pages.push(studentsToPrint.slice(i, i + 8));
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

    const handlePrintReports = async () => {
        const studentsToPrint = getStudentsToPrint();
        const pdfGroup = [];
        const missingTemplateStudents = [];

        studentsToPrint.forEach(student => {
            const template = getEffectiveTemplate(student);
            if (template) {
                pdfGroup.push({ student, template });
            } else {
                missingTemplateStudents.push(student);
            }
        });

        if (missingTemplateStudents.length > 0) {
            const names = missingTemplateStudents
                .map(student => `${student.firstName} ${student.lastName}`.trim())
                .join(', ');
            alert(`Cannot print reports until every student has a PDF template. Missing template for: ${names}`);
            return;
        }

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
                    const totalCalc = activityLog.reduce((sum, activity) => sum + parseFloat(activity.totalHours), 0);
                    const grandTotal = totalCalc + parseFloat(student.overrideHours || 0);

                    const pdfBytes = await generateFilledPdf(templateBytes, template.fields, {
                        student,
                        totalHours: grandTotal,
                        eventName: event?.name || '',
                        activityLog,
                        event,
                        timeEntries: eventEntries.filter(entry => entry.studentId === student.id && !entry.isVoided),
                    });
                    allPdfBytes.push(pdfBytes);
                }

                const mergedBytes = await mergePdfs(allPdfBytes);
                openPdfForPrinting(mergedBytes, `${event?.name || 'event'}-service-logs.pdf`);
            } catch (err) {
                console.error('Event PDF generation failed:', err);
                alert('Failed to generate PDFs: ' + err.message);
            } finally {
                setPrintingReports(false);
            }
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
                        <Button variant="secondary" onClick={handlePrintBadges} disabled={printStudentCount === 0}>
                            {selectedStudents.size > 0 ? `Print Badges (${selectedPrintCount})` : 'Print Badges'}
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handlePrintReports}
                            disabled={printStudentCount === 0 || printingReports}
                            loading={printingReports}
                        >
                            {printingReports ? 'Generating...' : selectedStudents.size > 0 ? `Print Reports (${selectedPrintCount})` : 'Print Reports'}
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
            </div>

            {selectedStudents.size > 0 && (
                <div className="bg-primary-50 border border-primary-200 rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3">
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
                                <th className="px-4 py-4 w-12">
                                    <input
                                        type="checkbox"
                                        checked={allFilteredSelected}
                                        onChange={e => {
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
                                        className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                                        aria-label={allFilteredSelected ? 'Deselect all students' : 'Select all students'}
                                    />
                                </th>
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
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        <p className="font-bold">No students match your search</p>
                                        <p className="text-sm mt-1">Try a different name.</p>
                                    </td>
                                </tr>
                            ) : filteredStudents.map(s => (
                                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${selectedStudents.has(s.id) ? 'bg-primary-50' : ''}`}>
                                    <td className="px-4 py-4">
                                        <input
                                            type="checkbox"
                                            checked={selectedStudents.has(s.id)}
                                            onChange={() => toggleStudentSelection(s.id)}
                                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                                            aria-label={`Select ${s.firstName} ${s.lastName}`}
                                        />
                                    </td>
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
                                        <div className="flex items-center justify-end gap-4">
                                            <Link
                                                to={`/admin/settings/students/${s.id}`}
                                                className="text-xs font-bold text-primary-600 hover:underline"
                                            >
                                                View Details
                                            </Link>
                                            {eventStudentDocIds[s.id] && !checkedInStudentIds.has(s.id) && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveStudent(s.id)}
                                                    disabled={removingStudentId === s.id}
                                                    className="text-xs font-bold text-red-500 hover:text-red-700 disabled:opacity-50"
                                                >
                                                    {removingStudentId === s.id ? 'Removing...' : 'Remove'}
                                                </button>
                                            )}
                                            {checkedInStudentIds.has(s.id) && (
                                                <span className="text-xs text-gray-300" title="Cannot remove a student with time entries">
                                                    Remove
                                                </span>
                                            )}
                                        </div>
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
                                    <select
                                        className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                        value={addForm.gradeLevel}
                                        onChange={e => setAddForm(f => ({ ...f, gradeLevel: e.target.value }))}
                                    >
                                        <option value="">Select...</option>
                                        {GRADE_LEVEL_OPTIONS.map(grade => (
                                            <option key={grade.value} value={grade.value}>{grade.label}</option>
                                        ))}
                                    </select>
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
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">PDF Template</label>
                                <select
                                    className="w-full border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-primary-500 outline-none"
                                    value={addForm.pdfTemplateId}
                                    onChange={e => setAddForm(f => ({ ...f, pdfTemplateId: e.target.value }))}
                                >
                                    <option value="">
                                        {defaultTemplateId
                                            ? `Default: ${pdfTemplates.find(t => t.id === defaultTemplateId)?.name || 'Default'}`
                                            : 'Use default template'}
                                    </option>
                                    {pdfTemplates.map(template => (
                                        <option key={template.id} value={template.id}>{template.name}</option>
                                    ))}
                                </select>
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
