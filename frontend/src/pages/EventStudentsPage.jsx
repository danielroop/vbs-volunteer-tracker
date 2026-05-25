import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../utils/firebase';
import {
    collection,
    onSnapshot,
    addDoc,
    getDocs,
    query,
    where,
    serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';

export default function EventStudentsPage() {
    const { eventId: paramEventId } = useParams();
    const { currentEvent } = useEvent();
    const { user } = useAuth();

    // Use URL param when navigating from event card; fall back to the selected event in Operations
    const eventId = paramEventId || currentEvent?.id;
    const isOperationsView = !paramEventId;

    const [event, setEvent] = useState(null);
    const [allStudents, setAllStudents] = useState([]);
    const [eventStudentIds, setEventStudentIds] = useState(new Set());
    const [checkedInStudentIds, setCheckedInStudentIds] = useState(new Set());
    const [loading, setLoading] = useState(true);

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
            snap.docs.forEach(d => {
                if (!d.data().isVoided) ids.add(d.data().studentId);
            });
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
