import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { printInNewWindow, createPrintDocument } from '../utils/printUtils';
import { formatTime, formatHours } from '../utils/hourCalculations';
import { generateFilledPdf, openPdfForPrinting } from '../utils/pdfTemplateUtils';

import { db, functions, storage } from '../utils/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, Timestamp, updateDoc, getDocs } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';

import { useEvent } from '../contexts/EventContext';
import { Link } from 'react-router-dom';
import { buildEditChangeDescription } from '../utils/changeDescriptions';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PrintableBadge from '../components/common/PrintableBadge';
import { ServiceLogEntry } from '../components/ServiceLog';
import { GRADE_LEVEL_OPTIONS } from '../utils/grades';

export default function StudentDetailPage() {
    const { studentId } = useParams();
    const { currentEvent } = useEvent();
    const navigate = useNavigate();

    const [student, setStudent] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [eventHistory, setEventHistory] = useState([]); // [{eventId, eventName, totalHours}]
    const [printMode, setPrintMode] = useState(null);
    const [notesModal, setNotesModal] = useState({ isOpen: false, entry: null });

    // PDF template state
    const [pdfTemplates, setPdfTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);
    const [defaultTemplateId, setDefaultTemplateId] = useState(null);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    // Edit student info modal state
    const [editStudentModal, setEditStudentModal] = useState({ isOpen: false });
    const [editStudentForm, setEditStudentForm] = useState({
        firstName: '', lastName: '', schoolName: '', gradeLevel: '', gradYear: '', pdfTemplateId: ''
    });

    const openEditStudentModal = () => {
        setEditStudentForm({
            firstName: student?.firstName || '',
            lastName: student?.lastName || '',
            schoolName: student?.schoolName || '',
            gradeLevel: student?.gradeLevel || '',
            gradYear: student?.gradYear || '',
            pdfTemplateId: student?.pdfTemplateId || ''
        });
        setEditStudentModal({ isOpen: true });
    };

    const handleEditStudentSave = async (e) => {
        e.preventDefault();
        try {
            const data = { ...editStudentForm };
            if (!data.pdfTemplateId) data.pdfTemplateId = null;
            await updateDoc(doc(db, 'students', studentId), data);
            setStudent(prev => ({ ...prev, ...data }));
            setEditStudentModal({ isOpen: false });
        } catch (err) {
            console.error('Failed to update student:', err);
        }
    };

    // Edit hours modal state
    const [editModal, setEditModal] = useState({
        isOpen: false,
        entry: null,
        originalCheckInTime: '',
        originalCheckOutTime: '',
        checkInTime: '',
        checkOutTime: '',
        reason: '',
        loading: false,
        error: null
    });

    // Void entry modal state
    const [voidModal, setVoidModal] = useState({
        isOpen: false,
        entry: null,
        reason: '',
        loading: false,
        error: null
    });

    // Manual entry modal state
    const [manualModal, setManualModal] = useState({
        isOpen: false,
        date: '',
        activityId: '',
        startTime: '',
        endTime: '',
        loading: false,
        error: null
    });

    // Watch for printMode changes and reset after print dialog closes
    useEffect(() => {
        if (printMode === null) return; // Only act when printMode is set

        // Reset print mode after print dialog closes
        const timer = setTimeout(() => {
            setPrintMode(null);
        }, 3000);

        return () => clearTimeout(timer);
    }, [printMode]);

    useEffect(() => {
        async function fetchStudent() {
            const docRef = doc(db, 'students', studentId);
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = { id: snap.id, ...snap.data() };
                setStudent(data);
                if (data.pdfTemplateId) setSelectedTemplateId(data.pdfTemplateId);
            }
        }
        if (studentId) fetchStudent();
    }, [studentId]);

    // Load cross-event history for this student
    useEffect(() => {
        if (!studentId) return;

        async function loadEventHistory() {
            const [entriesSnap, eventsSnap] = await Promise.all([
                getDocs(query(collection(db, 'timeEntries'), where('studentId', '==', studentId))),
                getDocs(collection(db, 'events')),
            ]);

            const eventsMap = {};
            eventsSnap.docs.forEach(d => { eventsMap[d.id] = d.data().name || d.id; });

            const hoursByEvent = {};
            entriesSnap.docs.forEach(d => {
                const data = d.data();
                if (data.isVoided || !data.checkOutTime) return;
                const diff = (data.checkOutTime.seconds - data.checkInTime.seconds) / 3600;
                const rounded = Math.round(diff * 4) / 4;
                hoursByEvent[data.eventId] = (hoursByEvent[data.eventId] || 0) + rounded;
            });

            setEventHistory(
                Object.entries(hoursByEvent)
                    .map(([eventId, totalHours]) => ({ eventId, eventName: eventsMap[eventId] || eventId, totalHours }))
                    .sort((a, b) => a.eventName.localeCompare(b.eventName))
            );
        }

        loadEventHistory();
    }, [studentId]);

    // Fetch PDF templates and default template setting
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
            const activityEntries = entries.filter(e => e.activityId === activity.id && !e.isVoided);
            if (activityEntries.length === 0) return null;

            // 1. Get unique sorted dates for this activity
            const uniqueDates = [...new Set(activityEntries.map(e =>
                new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(e.checkInTime.toDate())
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

            // 3. Default Checkout Times to end of Activity if one is missing
            const updatedActivityEntries = activityEntries.map(entry => {
                // Check if checkoutTime is missing, null, or undefined
                if (!entry.checkOutTime) {
                    const datePart = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(entry.checkInTime.toDate());
                    const defaultedDateTime = `${datePart}T${activity.endTime}`;
                    const timestampValue = Timestamp.fromDate(new Date(defaultedDateTime));

                    return {
                        ...entry,
                        checkOutTime: timestampValue, // Use the activity's default end time
                        isDefaulted: true
                    };
                }

                // If checkoutTime exists, return the entry as-is
                return entry;
            });

            // 4. Format strings like "1/1/26 - 1/3/26, 1/5/26"
            // Use UTC methods since uniqueDates are YYYY-MM-DD strings parsed as midnight UTC
            const dateStrings = groups.map(group => {
                const start = new Date(group[0]);
                const end = new Date(group[group.length - 1]);
                const startStr = `${start.getUTCMonth() + 1}/${start.getUTCDate()}/${start.getUTCFullYear().toString().slice(-2)}`;
                const endStr = `${end.getUTCMonth() + 1}/${end.getUTCDate()}/${end.getUTCFullYear().toString().slice(-2)}`;

                return group.length > 1 ? `${startStr} - ${endStr}` : startStr;
            });

            const totalHours = updatedActivityEntries.reduce((acc, entry) => {
                // Only Count the Hours if not defaulted                 
                if (entry.isDefaulted) return acc;

                const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
                return acc + roundTime(diff);
            }, 0);

            return {
                name: activity.name,
                dateDisplay: dateStrings.join(', '),
                sortDate: uniqueDates[0],
                totalHours: totalHours.toFixed(2)
            };
        }).filter(Boolean).sort((a, b) => a.sortDate.localeCompare(b.sortDate));
    }, [entries, currentEvent]);

    const totalCalculatedHours = activityLog.reduce((sum, act) => sum + parseFloat(act.totalHours), 0);

    const overrideHours = parseFloat(student?.overrideHours || 0);

    // Check if there are any non-voided entries without checkout times
    const hasUncheckedOutEntries = entries.some(entry => !entry.isVoided && !entry.checkOutTime);
    const grandTotal = totalCalculatedHours + overrideHours;

    /**
     * Enriched entries with calculated hours for display in the table
     */
    const enrichedEntries = useMemo(() => {
        if (entries.length === 0) return [];

        return entries.map(entry => {
            if (!entry.checkOutTime) {
                // No checkout time - hours cannot be calculated
                return {
                    ...entry,
                    actualHours: null
                };
            }

            // Real checkout exists - calculate hours
            const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
            return {
                ...entry,
                actualHours: roundTime(diff)
            };
        });
    }, [entries]);

    // Print helper: render the DOM element into a standalone document and print (Safari-compatible)
    const PRINT_STYLES = `
      body { background: white; margin: 0; padding: 0; }
      .ocps-form-container { font-family: Arial, sans-serif; padding: 0.3in; color: black; line-height: 1.1; font-size: 9pt; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 4px; }
      th, td { border: 1px solid black; padding: 4px 8px; vertical-align: middle; }
      .field-box { border-bottom: 1px solid black; display: inline-block; min-width: 120px; padding: 0 5px; font-weight: bold; }
      .reflection-box { border: 1px solid black; height: 210px; width: 100%; margin-top: 4px; display: flex; flex-direction: column; }
      .reflection-line { border-bottom: 1px solid #eee; flex: 1; }
      .ocps-logo { width: 45px; height: 45px; border: 1px solid black; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 8pt; text-align: center; }

      .student-badge { border: 2px solid #000; padding: 0.25in; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; box-sizing: border-box; text-align: center; width: 3.5in; height: 2.5in; }
      .badge-name { font-size: 16pt; font-weight: bold; margin-bottom: 4px; color: #000; }
      .badge-id { font-size: 9pt; color: #666; margin-bottom: 8px; }
      .badge-qr { margin: 0 auto; }
      .badge-event { font-size: 8pt; color: #333; margin-top: 8px; text-transform: uppercase; font-weight: bold; }
    `;

    const printElementById = (id, title = 'Print') => {
        const el = document.getElementById(id);
        if (!el) {
            alert('Print content not available');
            return;
        }

        const html = createPrintDocument({
            title,
            styles: PRINT_STYLES,
            body: el.outerHTML
        });

        printInNewWindow(html, {
            onComplete: () => setPrintMode(null),
            onError: () => setPrintMode(null)
        });
    };

    // Handle template assignment change
    const handleTemplateChange = async (templateId) => {
        setSelectedTemplateId(templateId || null);
        if (studentId) {
            try {
                await updateDoc(doc(db, 'students', studentId), {
                    pdfTemplateId: templateId || null
                });
            } catch (err) {
                console.error('Failed to save template assignment:', err);
            }
        }
    };

    // Print service log: student template → default template → HTML fallback
    const handlePrintForm = async () => {
        if (hasUncheckedOutEntries) {
            alert('Cannot print Service Log: This student has time entries that are not checked out. Please ensure all entries have checkout times before printing.');
            return;
        }

        const effectiveTemplateId = selectedTemplateId || defaultTemplateId;
        const template = pdfTemplates.find(t => t.id === effectiveTemplateId);

        if (template) {
            if (!template.fields || template.fields.length === 0) {
                alert('The selected template has no mapped fields. Please map fields in Settings > PDF Templates first.');
                return;
            }
            setGeneratingPdf(true);
            try {
                const storageRef = ref(storage, template.storagePath);
                const url = await getDownloadURL(storageRef);
                const response = await fetch(url);
                const templateBytes = await response.arrayBuffer();

                const pdfBytes = await generateFilledPdf(templateBytes, template.fields, {
                    student,
                    totalHours: grandTotal,
                    eventName: currentEvent?.name || '',
                    activityLog,
                    event: currentEvent,
                    timeEntries: entries.filter(e => !e.isVoided),
                });

                openPdfForPrinting(pdfBytes, `${student.firstName}_${student.lastName}_service_log.pdf`);
            } catch (err) {
                console.error('PDF generation failed:', err);
                alert('Failed to generate PDF: ' + err.message);
            } finally {
                setGeneratingPdf(false);
            }
        } else {
            // HTML fallback: no template configured
            setPrintMode('form');
            printElementById('ocps-form', 'Service Log');
        }
    };

    const handlePrint = (mode) => {
        setPrintMode(mode);
        printElementById('printable-badge', 'Badge');
    };

    // Format date for datetime-local input using LOCAL time (not UTC)
    const formatDateTimeLocal = (date) => {
        if (!date) return '';
        const d = date instanceof Date ? date : date.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Open edit modal
    const openEditModal = (entry) => {
        const originalIn = formatDateTimeLocal(entry.checkInTime);
        const originalOut = entry.checkOutTime ? formatDateTimeLocal(entry.checkOutTime) : '';

        setEditModal({
            isOpen: true,
            entry,
            originalCheckInTime: originalIn,
            originalCheckOutTime: originalOut,
            checkInTime: originalIn,
            checkOutTime: originalOut,
            reason: '',
            loading: false,
            error: null
        });
    };

    // Handle edit save
    const handleEditSave = async () => {
        if (!editModal.entry || !editModal.reason) {
            setEditModal(prev => ({ ...prev, error: 'Reason is required' }));
            return;
        }

        setEditModal(prev => ({ ...prev, loading: true, error: null }));

        try {
            const checkInTime = new Date(editModal.checkInTime);
            const checkOutTime = editModal.checkOutTime ? new Date(editModal.checkOutTime) : null;

            // Calculate hours if both times exist
            let hoursWorked = null;
            let rawMinutes = null;
            if (checkInTime && checkOutTime) {
                const minutes = Math.floor((checkOutTime - checkInTime) / 1000 / 60);
                rawMinutes = minutes;
                hoursWorked = Math.round((minutes / 60) * 2) / 2; // Round to nearest 0.5
            }

            // Build smart change description (only includes fields that actually changed)
            const changeDescription = buildEditChangeDescription({
                originalCheckInTime: editModal.originalCheckInTime,
                newCheckInTime: editModal.checkInTime,
                originalCheckOutTime: editModal.originalCheckOutTime,
                newCheckOutTime: editModal.checkOutTime,
                reason: editModal.reason
            });

            // Skip saving if no actual changes were made
            if (!changeDescription) {
                setEditModal(prev => ({ ...prev, error: 'No changes detected. Modify check-in or check-out times before saving.' }));
                setEditModal(prev => ({ ...prev, loading: false }));
                return;
            }

            // Create change log entry
            const changeLogEntry = {
                timestamp: new Date().toISOString(),
                modifiedBy: 'admin',
                type: 'edit',
                oldCheckInTime: editModal.originalCheckInTime,
                newCheckInTime: editModal.checkInTime,
                oldCheckOutTime: editModal.originalCheckOutTime,
                newCheckOutTime: editModal.checkOutTime,
                reason: editModal.reason,
                description: changeDescription
            };

            // Get existing change log or create new array
            const existingChangeLog = editModal.entry.changeLog || [];

            const entryRef = doc(db, 'timeEntries', editModal.entry.id);
            await updateDoc(entryRef, {
                checkInTime,
                checkOutTime,
                hoursWorked,
                rawMinutes,
                modifiedBy: 'admin',
                modificationReason: changeDescription,
                modifiedAt: new Date(),
                changeLog: [...existingChangeLog, changeLogEntry]
            });

            setEditModal({
                isOpen: false,
                entry: null,
                originalCheckInTime: '',
                originalCheckOutTime: '',
                checkInTime: '',
                checkOutTime: '',
                reason: '',
                loading: false,
                error: null
            });
        } catch (error) {
            console.error('Edit save error:', error);
            setEditModal(prev => ({
                ...prev,
                loading: false,
                error: error.message || 'Failed to save changes'
            }));
        }
    };

    // Open void modal
    const openVoidModal = (entry) => {
        setVoidModal({
            isOpen: true,
            entry,
            reason: '',
            loading: false,
            error: null
        });
    };

    // Handle void entry
    const handleVoidEntry = async () => {
        if (!voidModal.entry || !voidModal.reason || voidModal.reason.trim().length < 5) {
            setVoidModal(prev => ({ ...prev, error: 'Void reason must be at least 5 characters' }));
            return;
        }

        setVoidModal(prev => ({ ...prev, loading: true, error: null }));

        try {
            const voidTimeEntryFunc = httpsCallable(functions, 'voidTimeEntry');
            const result = await voidTimeEntryFunc({
                entryId: voidModal.entry.id,
                voidReason: voidModal.reason.trim()
            });

            if (result.data.success) {
                setVoidModal({
                    isOpen: false,
                    entry: null,
                    reason: '',
                    loading: false,
                    error: null
                });
            }
        } catch (error) {
            console.error('Void entry error:', error);
            setVoidModal(prev => ({
                ...prev,
                loading: false,
                error: error.message || 'Failed to void entry'
            }));
        }
    };

    // Handle restore entry
    const handleRestoreEntry = async (entry) => {
        if (!confirm(`Are you sure you want to restore this voided entry?`)) {
            return;
        }

        try {
            const restoreTimeEntryFunc = httpsCallable(functions, 'restoreTimeEntry');
            await restoreTimeEntryFunc({ entryId: entry.id });
        } catch (error) {
            console.error('Restore entry error:', error);
            alert('Failed to restore entry: ' + (error.message || 'Unknown error'));
        }
    };

    // Open manual modal
    const openManualModal = () => {
        const today = new Date();
        const dateStr = formatDateTimeLocal(today).split('T')[0];
        // Default to first activity
        const defaultActivity = currentEvent?.activities?.[0];
        const defaultActivityId = defaultActivity?.id || '';

        setManualModal({
            isOpen: true,
            date: dateStr,
            activityId: defaultActivityId,
            startTime: defaultActivity?.startTime || '08:00',
            endTime: defaultActivity?.endTime || '09:00',
            loading: false,
            error: null
        });
    };

    // Handle manual save
    const handleManualSave = async () => {
        // Validation matches backend
        if (!manualModal.date || !manualModal.activityId || !manualModal.startTime || !manualModal.endTime) {
            setManualModal(prev => ({ ...prev, error: 'All fields are required' }));
            return;
        }

        if (manualModal.endTime <= manualModal.startTime) {
            setManualModal(prev => ({ ...prev, error: 'End time must be after start time' }));
            return;
        }

        setManualModal(prev => ({ ...prev, loading: true, error: null }));

        try {
            const createManualTimeEntryFunc = httpsCallable(functions, 'createManualTimeEntry');
            await createManualTimeEntryFunc({
                studentId,
                eventId: currentEvent.id,
                activityId: manualModal.activityId,
                date: manualModal.date,
                startTime: manualModal.startTime,
                endTime: manualModal.endTime
            });

            setManualModal(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            console.error('Manual entry error:', error);
            setManualModal(prev => ({ ...prev, loading: false, error: error.message || 'Failed to create entry' }));
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50">
            <div className="p-20 text-center"><Spinner size="lg" /></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto p-6">
                <style>
                    {`
          @media print {
            .no-print { display: none !important; }
            #printable-badge { display: ${printMode === 'badge' ? 'flex' : 'none'} !important; }

            body { background: white; margin: 0; padding: 0; }

            #printable-badge {
              justify-content: center;
              align-items: center;
              padding: 0.5in;
            }
            .student-badge {
              border: 2px solid #000;
              padding: 0.25in;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: white;
              box-sizing: border-box;
              text-align: center;
              width: 3.5in;
              height: 2.5in;
            }
            .badge-name { font-size: 16pt; font-weight: bold; margin-bottom: 4px; color: #000; }
            .badge-id { font-size: 9pt; color: #666; margin-bottom: 8px; }
            .badge-qr { margin: 0 auto; }
            .badge-event { font-size: 8pt; color: #333; margin-top: 8px; text-transform: uppercase; font-weight: bold; }
          }
          #printable-badge { display: none; }
        `}
                </style>

                {/* ADMIN UI (no-print) */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 no-print">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{student?.firstName} {student?.lastName}</h1>
                        <p className="text-gray-500 font-medium text-sm sm:text-base">{student?.schoolName} • Grade {student?.gradeLevel}</p>
                    </div>
                    <div className="flex gap-3 flex-wrap sm:flex-nowrap items-center">
                        <Button onClick={openEditStudentModal} variant="secondary" className="flex-1 sm:flex-none min-h-[44px]">Edit Student</Button>
                        <Button
                            onClick={handlePrintForm}
                            variant="secondary"
                            disabled={generatingPdf}
                            loading={generatingPdf}
                            className="flex-1 sm:flex-none min-h-[44px]"
                        >
                            Print Service Log
                        </Button>
                        <Button onClick={() => handlePrint('badge')} variant="primary" className="flex-1 sm:flex-none min-h-[44px]">Print Badge</Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 no-print">
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white rounded-2xl shadow-sm border p-6">
                        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Summary</h3>
                        <div className="space-y-4">
                            {activityLog.map(act => (
                                <div key={act.name} className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-600">{act.name}</span>
                                    <span className="text-sm font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{act.totalHours}</span>
                                </div>
                            ))}
                            <div className="pt-4 border-t-2 border-dashed">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-black text-primary-700 uppercase">Grand Total</span>
                                    <span className="text-2xl font-black text-primary-600">{grandTotal.toFixed(2)}</span>
                                </div>
                                {hasUncheckedOutEntries && (
                                    <p className="text-xs text-red-600 mt-2 italic">Some entries are not checked out</p>
                                )}
                            </div>
                        </div>
                        </div>

                        {eventHistory.length > 0 && (
                            <div className="bg-white rounded-2xl shadow-sm border p-6">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Event History</h3>
                                <div className="space-y-2">
                                    {eventHistory.map(ev => (
                                        <div key={ev.eventId} className="flex justify-between items-center">
                                            <Link
                                                to={`/admin/settings/events/${ev.eventId}/students`}
                                                className="text-sm font-semibold text-primary-700 hover:underline truncate"
                                            >
                                                {ev.eventName}
                                            </Link>
                                            <span className="text-sm font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg ml-2 shrink-0">
                                                {ev.totalHours.toFixed(2)} hrs
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-3">
                        {/* Header for Time Entries */}
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-900 hidden md:block">Service Log</h3>
                            <Button onClick={openManualModal} variant="primary" size="sm" className="ml-auto">
                                + Add Time Entry
                            </Button>
                        </div>

                        {/* DESKTOP: Table view (hidden on mobile, visible on md+) */}
                        <div className="hidden md:block bg-white rounded-2xl shadow-sm border overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Bucket</th>
                                        <th className="px-6 py-4 text-center">Check In</th>
                                        <th className="px-6 py-4 text-center">Check Out</th>
                                        <th className="px-6 py-4 text-right">Hours</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {enrichedEntries.map(e => (
                                        <ServiceLogEntry
                                            key={e.id}
                                            entry={e}
                                            activity={currentEvent?.activities?.find(a => a.id === e.activityId)}
                                            mode="row"
                                            onEdit={openEditModal}
                                            onViewHistory={(entry) => setNotesModal({ isOpen: true, entry })}
                                            onVoid={openVoidModal}
                                            onRestore={handleRestoreEntry}
                                        />
                                    ))}
                                </tbody>
                            </table>
                            {enrichedEntries.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    No service log entries found
                                </div>
                            )}
                        </div>

                        {/* MOBILE: Card view (visible on mobile, hidden on md+) */}
                        <div className="block md:hidden">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Service Log</h3>
                                <span className="text-xs text-gray-500">{enrichedEntries.length} {enrichedEntries.length === 1 ? 'entry' : 'entries'}</span>
                            </div>
                            {enrichedEntries.length > 0 ? (
                                <ul role="list" className="space-y-3">
                                    {enrichedEntries.map(e => (
                                        <li key={e.id}>
                                            <ServiceLogEntry
                                                entry={e}
                                                activity={currentEvent?.activities?.find(a => a.id === e.activityId)}
                                                mode="card"
                                                onEdit={openEditModal}
                                                onViewHistory={(entry) => setNotesModal({ isOpen: true, entry })}
                                                onVoid={openVoidModal}
                                                onRestore={handleRestoreEntry}
                                            />
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
                                    No service log entries found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* HTML fallback form — only used when no PDF template is configured */}
                <div id="ocps-form" style={{ display: 'none' }} className="ocps-form-container">
                    <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
                        <div className="ocps-logo">OCPS</div>
                        <h1 className="text-xl font-bold text-center flex-1">Community/Work Service Log and Reflection</h1>
                    </div>
                    <table className="mb-2">
                        <tbody>
                            <tr>
                                <td className="w-1/3 border-none">Student ID #: <span className="field-box" style={{ minWidth: '100px' }}></span></td>
                                <td className="border-none">Student Name: <span className="field-box" style={{ minWidth: '220px' }}>{student?.firstName} {student?.lastName}</span></td>
                            </tr>
                            <tr>
                                <td className="border-none">School Name: <span className="field-box" style={{ minWidth: '200px' }}>{student?.schoolName}</span></td>
                                <td className="border-none text-right">Graduation Year: <span className="field-box" style={{ minWidth: '80px' }}>{student?.gradYear || '____'}</span></td>
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

                <div id="printable-badge">
                    {student && (
                        <PrintableBadge
                            student={student}
                            eventId={currentEvent?.id}
                            eventName={currentEvent?.name}
                            size="large"
                        />
                    )}
                </div>

                {/* View Notes Modal */}
                <Modal
                    isOpen={notesModal.isOpen}
                    onClose={() => setNotesModal({ isOpen: false, entry: null })}
                    title="Entry Change History"
                    size="lg"
                >
                    {notesModal.entry && (
                        <div className="space-y-4">
                            <div className="bg-gray-100 p-3 rounded-lg">
                                <p className="text-sm text-gray-600">
                                    <span className="font-semibold">Date:</span> {notesModal.entry.checkInTime?.toDate?.().toLocaleDateString() || 'N/A'}
                                </p>
                                <p className="text-sm text-gray-600">
                                    <span className="font-semibold">Activity:</span> {currentEvent?.activities?.find(a => a.id === notesModal.entry.activityId)?.name || 'Unknown'}
                                </p>
                            </div>

                            {/* Change Log History */}
                            {notesModal.entry.changeLog && notesModal.entry.changeLog.length > 0 ? (
                                <div>
                                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Change History</p>
                                    <div className="space-y-3 max-h-64 overflow-y-auto">
                                        {notesModal.entry.changeLog.map((log, idx) => (
                                            <div key={idx} className="border-l-2 border-blue-400 pl-3 py-1">
                                                <p className="text-xs text-gray-500">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                    {log.type === 'force_checkout' && <span className="ml-2 text-blue-600 font-medium">Force Checkout</span>}
                                                    {log.type === 'force_checkout_bulk' && <span className="ml-2 text-blue-600 font-medium">Bulk Force Checkout</span>}
                                                    {log.type === 'edit' && <span className="ml-2 text-green-600 font-medium">Edit</span>}
                                                </p>
                                                <p className="text-sm text-gray-700 mt-1">{log.description}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic">No change history available.</p>
                            )}
                        </div>
                    )}
                </Modal>

                {/* Edit Hours Modal */}
                <Modal
                    isOpen={editModal.isOpen}
                    onClose={() => setEditModal({ ...editModal, isOpen: false })}
                    title="Edit Hours"
                    size="md"
                    footer={
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => setEditModal({ ...editModal, isOpen: false })}
                                disabled={editModal.loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleEditSave}
                                loading={editModal.loading}
                            >
                                Save Changes
                            </Button>
                        </>
                    }
                >
                    {editModal.entry && (
                        <div className="space-y-4">
                            <div>
                                <p className="text-gray-600">
                                    Editing hours for:{' '}
                                    <span className="font-bold text-gray-900">
                                        {student?.firstName} {student?.lastName}
                                    </span>
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Date: {editModal.entry.checkInTime?.toDate?.()?.toLocaleDateString() || 'N/A'} | Activity: {currentEvent?.activities?.find(a => a.id === editModal.entry.activityId)?.name || 'Unknown'}
                                </p>
                            </div>

                            {/* Original Times (Read-Only) */}
                            <div className="bg-gray-100 p-3 rounded-lg">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Original Values</p>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">Check-In:</span>{' '}
                                        <span className="font-medium">
                                            {editModal.originalCheckInTime ? formatTime(new Date(editModal.originalCheckInTime)) : 'None'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">Check-Out:</span>{' '}
                                        <span className="font-medium">
                                            {editModal.originalCheckOutTime ? formatTime(new Date(editModal.originalCheckOutTime)) : 'None'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Editable Times */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        New Check-In Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={editModal.checkInTime}
                                        onChange={(e) => setEditModal(prev => ({
                                            ...prev,
                                            checkInTime: e.target.value
                                        }))}
                                        className="input-field w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        New Check-Out Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={editModal.checkOutTime}
                                        onChange={(e) => setEditModal(prev => ({
                                            ...prev,
                                            checkOutTime: e.target.value
                                        }))}
                                        className="input-field w-full"
                                    />
                                </div>
                            </div>

                            {editModal.checkInTime && editModal.checkOutTime && (
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-sm text-gray-600">
                                        Calculated hours:{' '}
                                        <span className="font-bold">
                                            {(() => {
                                                const checkIn = new Date(editModal.checkInTime);
                                                const checkOut = new Date(editModal.checkOutTime);
                                                const minutes = Math.floor((checkOut - checkIn) / 1000 / 60);
                                                const hours = Math.round((minutes / 60) * 2) / 2;
                                                return formatHours(hours);
                                            })()}
                                        </span>
                                    </p>
                                </div>
                            )}

                            {/* Existing Change Log */}
                            {editModal.entry.changeLog && editModal.entry.changeLog.length > 0 && (
                                <div className="bg-blue-50 p-3 rounded-lg">
                                    <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Previous Changes</p>
                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                        {editModal.entry.changeLog.map((log, idx) => (
                                            <div key={idx} className="text-xs text-blue-700">
                                                <span className="text-gray-500">{new Date(log.timestamp).toLocaleString()}:</span> {log.description}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason for Change <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={editModal.reason}
                                    onChange={(e) => setEditModal(prev => ({
                                        ...prev,
                                        reason: e.target.value
                                    }))}
                                    placeholder="e.g., Helped with setup, adjusted based on supervisor feedback"
                                    className="input-field w-full h-24 resize-none"
                                />
                            </div>

                            {editModal.error && (
                                <div className="text-red-600 text-sm">
                                    {editModal.error}
                                </div>
                            )}
                        </div>
                    )}
                </Modal>

                {/* Void Entry Modal */}
                <Modal
                    isOpen={voidModal.isOpen}
                    onClose={() => setVoidModal({ ...voidModal, isOpen: false })}
                    title="Void Time Entry"
                    size="md"
                    footer={
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => setVoidModal({ ...voidModal, isOpen: false })}
                                disabled={voidModal.loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleVoidEntry}
                                loading={voidModal.loading}
                                disabled={!voidModal.reason || voidModal.reason.trim().length < 5}
                            >
                                Void Entry
                            </Button>
                        </>
                    }
                >
                    {voidModal.entry && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                                <p className="text-sm text-amber-800 font-medium">
                                    This will void the time entry, excluding it from all hour calculations.
                                    The entry will be preserved for audit purposes.
                                </p>
                            </div>

                            <div>
                                <p className="text-gray-600">
                                    Voiding entry for:{' '}
                                    <span className="font-bold text-gray-900">
                                        {student?.firstName} {student?.lastName}
                                    </span>
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Date: {voidModal.entry.checkInTime?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                    {' | '}
                                    Activity: {currentEvent?.activities?.find(a => a.id === voidModal.entry.activityId)?.name || 'Unknown'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Reason for Voiding <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={voidModal.reason}
                                    onChange={(e) => setVoidModal(prev => ({
                                        ...prev,
                                        reason: e.target.value
                                    }))}
                                    placeholder="e.g., Duplicate entry, scanned wrong student, data entry error"
                                    className="input-field w-full h-24 resize-none"
                                />
                                {voidModal.reason && voidModal.reason.trim().length < 5 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Minimum 5 characters required ({5 - voidModal.reason.trim().length} more needed)
                                    </p>
                                )}
                            </div>

                            {voidModal.error && (
                                <div className="text-red-600 text-sm">
                                    {voidModal.error}
                                </div>
                            )}
                        </div>
                    )}
                </Modal>
                {/* Manual Entry Modal */}
                <Modal
                    isOpen={manualModal.isOpen}
                    onClose={() => setManualModal({ ...manualModal, isOpen: false })}
                    title="Log Manual Hours"
                    size="md"
                    footer={
                        <>
                            <Button
                                variant="secondary"
                                onClick={() => setManualModal({ ...manualModal, isOpen: false })}
                                disabled={manualModal.loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleManualSave}
                                loading={manualModal.loading}
                            >
                                Save Entry
                            </Button>
                        </>
                    }
                >
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={manualModal.date}
                                onChange={(e) => setManualModal(prev => ({ ...prev, date: e.target.value }))}
                                className="input-field w-full"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Activity (Bucket) <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={manualModal.activityId}
                                onChange={(e) => {
                                    const newActivityId = e.target.value;
                                    const activity = currentEvent?.activities?.find(a => a.id === newActivityId);
                                    setManualModal(prev => ({
                                        ...prev,
                                        activityId: newActivityId,
                                        startTime: activity?.startTime || prev.startTime,
                                        endTime: activity?.endTime || prev.endTime
                                    }));
                                }}
                                className="input-field w-full"
                            >
                                {currentEvent?.activities?.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Start Time <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    aria-label="Start Time"
                                    value={manualModal.startTime}
                                    onChange={(e) => setManualModal(prev => ({ ...prev, startTime: e.target.value }))}
                                    className="input-field w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    End Time <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="time"
                                    aria-label="End Time"
                                    value={manualModal.endTime}
                                    onChange={(e) => setManualModal(prev => ({ ...prev, endTime: e.target.value }))}
                                    className="input-field w-full"
                                />
                            </div>
                        </div>

                        {manualModal.error && (
                            <div className="text-red-600 text-sm">
                                {manualModal.error}
                            </div>
                        )}
                    </div>
                </Modal>

                {/* EDIT STUDENT MODAL */}
                {editStudentModal.isOpen && (
                    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm no-print">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
                            <h2 className="text-2xl font-black text-gray-900 mb-6">Edit Student</h2>
                            <form onSubmit={handleEditStudentSave} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">First Name</label>
                                        <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                                            value={editStudentForm.firstName} onChange={e => setEditStudentForm(f => ({...f, firstName: e.target.value}))} />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Last Name</label>
                                        <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                                            value={editStudentForm.lastName} onChange={e => setEditStudentForm(f => ({...f, lastName: e.target.value}))} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">School Name</label>
                                    <input className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                                        value={editStudentForm.schoolName} onChange={e => setEditStudentForm(f => ({...f, schoolName: e.target.value}))} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grade</label>
                                        <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={editStudentForm.gradeLevel} onChange={e => setEditStudentForm(f => ({...f, gradeLevel: e.target.value}))}>
                                            <option value="">Select...</option>
                                            {GRADE_LEVEL_OPTIONS.map(grade => (
                                                <option key={grade.value} value={grade.value}>{grade.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Grad Year</label>
                                        <input placeholder="2027" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
                                            value={editStudentForm.gradYear} onChange={e => setEditStudentForm(f => ({...f, gradYear: e.target.value}))} />
                                    </div>
                                </div>
                                {pdfTemplates.length > 0 && (
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Volunteer Form Template</label>
                                        <select className="w-full border border-gray-200 rounded-xl p-3 outline-none" value={editStudentForm.pdfTemplateId} onChange={e => setEditStudentForm(f => ({...f, pdfTemplateId: e.target.value}))}>
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
                                    <button type="button" onClick={() => setEditStudentModal({ isOpen: false })} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
