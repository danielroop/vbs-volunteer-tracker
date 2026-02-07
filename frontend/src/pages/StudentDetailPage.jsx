import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { printInNewWindow, createPrintDocument } from '../utils/printUtils';
import { formatTime, formatHours } from '../utils/hourCalculations';
import { db } from '../utils/firebase';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, Timestamp, updateDoc } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';
import Header from '../components/common/Header';
import Spinner from '../components/common/Spinner';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import PrintableBadge from '../components/common/PrintableBadge';
import { ServiceLogEntry } from '../components/ServiceLog';

export default function StudentDetailPage() {
    const { studentId } = useParams();
    const { currentEvent } = useEvent();
    const navigate = useNavigate();

    const [student, setStudent] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [printMode, setPrintMode] = useState(null);
    const [notesModal, setNotesModal] = useState({ isOpen: false, entry: null });

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
            const dateStrings = groups.map(group => {
                const start = new Date(group[0]);
                const end = new Date(group[group.length - 1]);
                const startStr = `${start.getMonth() + 1}/${start.getDate()}/${start.getFullYear().toString().slice(-2)}`;
                const endStr = `${end.getMonth() + 1}/${end.getDate()}/${end.getFullYear().toString().slice(-2)}`;

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
                totalHours: totalHours.toFixed(2)
            };
        }).filter(Boolean);
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

    const handlePrint = (mode) => {
        if (mode === 'form' && hasUncheckedOutEntries) {
            alert('Cannot print Service Log: This student has time entries that are not checked out. Please ensure all entries have checkout times before printing.');
            return;
        }

        // Keep printMode state only for UX; actual printing happens in a new window
        setPrintMode(mode);

        if (mode === 'badge') {
            printElementById('printable-badge', 'Badge');
        } else {
            printElementById('ocps-form', 'Service Log');
        }
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

            // Build change log message
            const oldIn = editModal.originalCheckInTime ? formatTime(new Date(editModal.originalCheckInTime)) : 'none';
            const newIn = formatTime(checkInTime);
            const oldOut = editModal.originalCheckOutTime ? formatTime(new Date(editModal.originalCheckOutTime)) : 'none';
            const newOut = checkOutTime ? formatTime(checkOutTime) : 'none';

            const changeDescription = `Changed Check-In from ${oldIn} to ${newIn} and Check-Out from ${oldOut} to ${newOut} for "${editModal.reason}"`;

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

    if (loading) return (
        <div className="min-h-screen bg-gray-50">
            <Header />
            <div className="p-20 text-center"><Spinner size="lg" /></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <Header />
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

            /* Badge printing styles */
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
            .badge-name {
              font-size: 16pt;
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
            .badge-event {
              font-size: 8pt;
              color: #333;
              margin-top: 8px;
              text-transform: uppercase;
              font-weight: bold;
            }
          }
          #printable-badge, #ocps-form { display: none; }
        `}
            </style>

            {/* ADMIN UI (no-print) */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 no-print">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{student?.firstName} {student?.lastName}</h1>
                    <p className="text-gray-500 font-medium text-sm sm:text-base">{student?.schoolName} • Grade {student?.gradeLevel}</p>
                </div>
                <div className="flex gap-3 flex-wrap sm:flex-nowrap">
                    <Button onClick={() => handlePrint('form')} variant="secondary" className="flex-1 sm:flex-none min-h-[44px]">Print Service Log</Button>
                    <Button onClick={() => handlePrint('badge')} variant="primary" className="flex-1 sm:flex-none min-h-[44px]">Print Badge</Button>
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

                <div className="lg:col-span-3">
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

            {/* OCPS FORM (Matches Rev 8/2023) */}
            <div id="ocps-form" className="ocps-form-container">
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

                        {/* Current Override Info */}
                        {(notesModal.entry.forcedCheckoutReason || notesModal.entry.modificationReason) && (
                            <div className="bg-blue-50 p-3 rounded-lg">
                                <p className="text-xs font-semibold text-blue-600 uppercase mb-2">Current Override</p>
                                {notesModal.entry.forcedCheckoutReason && (
                                    <p className="text-sm text-blue-700">
                                        <span className="text-lg mr-1">⚡</span> {notesModal.entry.forcedCheckoutReason}
                                    </p>
                                )}
                                {notesModal.entry.modificationReason && (
                                    <p className="text-sm text-blue-700">
                                        <span className="text-lg mr-1">✏️</span> {notesModal.entry.modificationReason}
                                    </p>
                                )}
                            </div>
                        )}

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
            </div>
        </div>
    );
}