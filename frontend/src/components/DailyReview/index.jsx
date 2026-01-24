import React, { useState, useEffect, useMemo } from 'react';
import { db, functions } from '../../utils/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEvent } from '../../contexts/EventContext';
import { formatTime, formatHours, getTodayDateString } from '../../utils/hourCalculations';
import Button from '../common/Button';
import Modal from '../common/Modal';

/**
 * Daily Review Component
 * Per PRD Section 3.5.2: Daily Review (Nightly)
 * - Review and approve hours
 * - Flag early/late times
 * - Bulk approve
 * - Individual adjustments
 * - Force checkout
 * - Export CSV/PDF
 */
export default function DailyReview() {
  const { currentEvent } = useEvent();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [timeEntries, setTimeEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bulkApproving, setBulkApproving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Force checkout modal state
  const [forceCheckoutModal, setForceCheckoutModal] = useState({
    isOpen: false,
    entry: null,
    checkOutTime: '',
    reason: '',
    loading: false,
    error: null
  });

  // Edit hours modal state
  const [editModal, setEditModal] = useState({
    isOpen: false,
    entry: null,
    checkInTime: '',
    checkOutTime: '',
    reason: '',
    loading: false,
    error: null
  });

  // Load students
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
    });
    return () => unsubscribe();
  }, []);

  // Load time entries for selected date
  useEffect(() => {
    if (!currentEvent?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, 'timeEntries'),
      where('eventId', '==', currentEvent.id),
      where('date', '==', selectedDate)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const entries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        checkInTime: doc.data().checkInTime?.toDate?.() || doc.data().checkInTime,
        checkOutTime: doc.data().checkOutTime?.toDate?.() || doc.data().checkOutTime,
      }));
      setTimeEntries(entries);
      setLoading(false);
    }, (error) => {
      console.error('Error loading time entries:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentEvent?.id, selectedDate]);

  // Create student lookup map
  const studentMap = useMemo(() => {
    const map = {};
    students.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  // Merge entries with student data and apply filters
  const filteredEntries = useMemo(() => {
    return timeEntries
      .map(entry => ({
        ...entry,
        student: studentMap[entry.studentId] || { firstName: 'Unknown', lastName: 'Student' }
      }))
      .filter(entry => {
        // Search filter
        const fullName = `${entry.student.firstName} ${entry.student.lastName}`.toLowerCase();
        if (searchTerm && !fullName.includes(searchTerm.toLowerCase())) {
          return false;
        }

        // Status filter
        if (statusFilter === 'flagged' && entry.reviewStatus !== 'flagged') return false;
        if (statusFilter === 'approved' && entry.reviewStatus !== 'approved') return false;
        if (statusFilter === 'pending' && entry.reviewStatus !== 'pending') return false;
        if (statusFilter === 'no-checkout' && entry.checkOutTime) return false;

        return true;
      })
      .sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
  }, [timeEntries, studentMap, searchTerm, statusFilter]);

  // Calculate summary stats
  const stats = useMemo(() => {
    return {
      total: timeEntries.length,
      pending: timeEntries.filter(e => e.reviewStatus === 'pending').length,
      flagged: timeEntries.filter(e => e.reviewStatus === 'flagged').length,
      approved: timeEntries.filter(e => e.reviewStatus === 'approved').length,
      noCheckout: timeEntries.filter(e => !e.checkOutTime).length,
      goodToApprove: timeEntries.filter(e =>
        e.reviewStatus === 'pending' &&
        e.checkOutTime &&
        (!e.flags || e.flags.length === 0)
      ).length
    };
  }, [timeEntries]);

  // Bulk approve handler
  const handleBulkApprove = async () => {
    if (!currentEvent?.id) return;

    setBulkApproving(true);
    try {
      const bulkApproveFunc = httpsCallable(functions, 'bulkApprove');
      const result = await bulkApproveFunc({
        eventId: currentEvent.id,
        date: selectedDate,
        excludeFlagged: true
      });

      if (result.data.success) {
        alert(`Successfully approved ${result.data.approvedCount} entries`);
      }
    } catch (error) {
      console.error('Bulk approve error:', error);
      alert('Error approving entries: ' + error.message);
    } finally {
      setBulkApproving(false);
    }
  };

  // Individual approve handler
  const handleApproveEntry = async (entryId) => {
    try {
      const entryRef = doc(db, 'timeEntries', entryId);
      await updateDoc(entryRef, {
        reviewStatus: 'approved'
      });
    } catch (error) {
      console.error('Error approving entry:', error);
      alert('Error approving entry: ' + error.message);
    }
  };

  // Open force checkout modal
  const openForceCheckoutModal = (entry) => {
    // Default to typical end time or current time
    const defaultTime = currentEvent?.typicalEndTime || '15:00';
    const [hours, minutes] = defaultTime.split(':');
    const date = new Date(selectedDate);
    date.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    setForceCheckoutModal({
      isOpen: true,
      entry,
      checkOutTime: date.toISOString().slice(0, 16), // Format for datetime-local input
      reason: '',
      loading: false,
      error: null
    });
  };

  // Handle force checkout
  const handleForceCheckout = async () => {
    if (!forceCheckoutModal.entry || !forceCheckoutModal.reason) {
      setForceCheckoutModal(prev => ({ ...prev, error: 'Reason is required' }));
      return;
    }

    setForceCheckoutModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      const forceCheckOutFunc = httpsCallable(functions, 'forceCheckOut');
      const result = await forceCheckOutFunc({
        entryId: forceCheckoutModal.entry.id,
        checkOutTime: new Date(forceCheckoutModal.checkOutTime).toISOString(),
        reason: forceCheckoutModal.reason
      });

      if (result.data.success) {
        setForceCheckoutModal({
          isOpen: false,
          entry: null,
          checkOutTime: '',
          reason: '',
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Force checkout error:', error);
      setForceCheckoutModal(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to force checkout'
      }));
    }
  };

  // Open edit modal
  const openEditModal = (entry) => {
    const formatDateTimeLocal = (date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toISOString().slice(0, 16);
    };

    setEditModal({
      isOpen: true,
      entry,
      checkInTime: formatDateTimeLocal(entry.checkInTime),
      checkOutTime: formatDateTimeLocal(entry.checkOutTime),
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

      const entryRef = doc(db, 'timeEntries', editModal.entry.id);
      await updateDoc(entryRef, {
        checkInTime,
        checkOutTime,
        hoursWorked,
        rawMinutes,
        modifiedBy: 'admin', // Would use actual user ID in production
        modificationReason: editModal.reason,
        modifiedAt: new Date(),
        originalCheckInTime: editModal.entry.checkInTime,
        originalCheckOutTime: editModal.entry.checkOutTime,
        originalHours: editModal.entry.hoursWorked
      });

      setEditModal({
        isOpen: false,
        entry: null,
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

  // Export to CSV
  const handleExportCSV = () => {
    setExporting(true);

    try {
      const headers = ['Name', 'Check-In', 'Check-Out', 'Hours', 'Status', 'Flags'];
      const rows = filteredEntries.map(entry => [
        `${entry.student.lastName}, ${entry.student.firstName}`,
        entry.checkInTime ? formatTime(entry.checkInTime) : '--',
        entry.checkOutTime ? formatTime(entry.checkOutTime) : 'Not checked out',
        entry.hoursWorked !== null ? entry.hoursWorked.toString() : '--',
        entry.reviewStatus || 'pending',
        (entry.flags || []).join('; ')
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `daily-review-${selectedDate}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('CSV export error:', error);
      alert('Error exporting CSV: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    setExporting(true);

    try {
      // Create printable HTML
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Daily Review - ${selectedDate}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 10px; }
            h2 { font-size: 14px; margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .status-approved { color: green; }
            .status-flagged { color: orange; }
            .status-pending { color: gray; }
            .status-no-checkout { color: red; }
            .flags { font-size: 10px; color: #666; }
            .summary { margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
            .summary span { margin-right: 20px; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <h1>Daily Review Report</h1>
          <h2>${currentEvent?.name || 'Event'} - ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>

          <div class="summary">
            <span><strong>Total:</strong> ${stats.total}</span>
            <span><strong>Approved:</strong> ${stats.approved}</span>
            <span><strong>Pending:</strong> ${stats.pending}</span>
            <span><strong>Flagged:</strong> ${stats.flagged}</span>
            <span><strong>No Checkout:</strong> ${stats.noCheckout}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEntries.map(entry => `
                <tr>
                  <td>${entry.student.lastName}, ${entry.student.firstName}</td>
                  <td>${entry.checkInTime ? formatTime(entry.checkInTime) : '--'}</td>
                  <td class="${!entry.checkOutTime ? 'status-no-checkout' : ''}">${entry.checkOutTime ? formatTime(entry.checkOutTime) : 'Not checked out'}</td>
                  <td>${entry.hoursWorked !== null ? entry.hoursWorked : '--'}</td>
                  <td class="status-${entry.reviewStatus || 'pending'}">${getStatusDisplay(entry)}</td>
                  <td class="flags">${(entry.flags || []).map(f => formatFlag(f)).join(', ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <p style="margin-top: 20px; font-size: 10px; color: #999;">
            Generated on ${new Date().toLocaleString()}
          </p>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Error generating PDF: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Helper functions for display
  const getStatusDisplay = (entry) => {
    if (!entry.checkOutTime) return '🔴 No Out';
    if (entry.reviewStatus === 'approved') return '✓ Approved';
    if (entry.reviewStatus === 'flagged') return '⚠️ Flagged';
    return '○ Pending';
  };

  const getStatusClass = (entry) => {
    if (!entry.checkOutTime) return 'text-red-600';
    if (entry.reviewStatus === 'approved') return 'text-green-600';
    if (entry.reviewStatus === 'flagged') return 'text-amber-600';
    return 'text-gray-500';
  };

  const formatFlag = (flag) => {
    const flagLabels = {
      early_arrival: 'Early arrival',
      late_stay: 'Late stay',
      forced_checkout: 'Forced checkout'
    };
    return flagLabels[flag] || flag;
  };

  const formatDateForDisplay = (dateStr) => {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!currentEvent) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p className="text-lg">No event selected</p>
          <p className="text-sm mt-2">Please select an event from the Events page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Daily Review
              </h1>
              <p className="text-gray-600 mt-1">{currentEvent.name}</p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          <div className="mt-4 text-lg">
            {formatDateForDisplay(selectedDate)}
          </div>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="text-gray-600">
              <span className="font-bold text-gray-900">{stats.total}</span> total entries
            </div>
            <div className="text-green-600">
              ✓ <span className="font-bold">{stats.approved}</span> approved
            </div>
            <div className="text-amber-600">
              ⚠️ <span className="font-bold">{stats.flagged}</span> flagged
            </div>
            <div className="text-gray-500">
              ○ <span className="font-bold">{stats.pending}</span> pending
            </div>
            {stats.noCheckout > 0 && (
              <div className="text-red-600">
                🔴 <span className="font-bold">{stats.noCheckout}</span> no checkout
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field flex-1 min-w-[200px]"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-48"
            >
              <option value="all">All Entries</option>
              <option value="flagged">Flagged Only</option>
              <option value="approved">Approved Only</option>
              <option value="pending">Pending Only</option>
              <option value="no-checkout">No Checkout</option>
            </select>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'No entries match your filters'
                      : 'No entries for this date'}
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">
                        {entry.student.lastName}, {entry.student.firstName}
                      </div>
                      {entry.flags && entry.flags.length > 0 && (
                        <div className="text-xs text-amber-600 mt-1">
                          {entry.flags.map(f => formatFlag(f)).join(' • ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {entry.checkInTime ? formatTime(entry.checkInTime) : '--'}
                    </td>
                    <td className="px-6 py-4">
                      {entry.checkOutTime ? (
                        <span className="text-gray-600">{formatTime(entry.checkOutTime)}</span>
                      ) : (
                        <span className="text-red-600 font-medium">Not checked out</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {entry.hoursWorked !== null && entry.hoursWorked !== undefined
                        ? formatHours(entry.hoursWorked)
                        : '--'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-medium ${getStatusClass(entry)}`}>
                        {getStatusDisplay(entry)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {!entry.checkOutTime ? (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => openForceCheckoutModal(entry)}
                          >
                            Force Out
                          </Button>
                        ) : entry.reviewStatus !== 'approved' ? (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApproveEntry(entry.id)}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditModal(entry)}
                            >
                              Edit
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEditModal(entry)}
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap justify-between gap-4">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              disabled={exporting || filteredEntries.length === 0}
            >
              📊 Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              disabled={exporting || filteredEntries.length === 0}
            >
              📄 Export PDF
            </Button>
          </div>
          <Button
            variant="success"
            onClick={handleBulkApprove}
            disabled={bulkApproving || stats.goodToApprove === 0}
            loading={bulkApproving}
          >
            ✓ Approve All Good Hours ({stats.goodToApprove})
          </Button>
        </div>
      </div>

      {/* Force Checkout Modal */}
      <Modal
        isOpen={forceCheckoutModal.isOpen}
        onClose={() => setForceCheckoutModal({ ...forceCheckoutModal, isOpen: false })}
        title="Force Check-Out"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setForceCheckoutModal({ ...forceCheckoutModal, isOpen: false })}
              disabled={forceCheckoutModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleForceCheckout}
              loading={forceCheckoutModal.loading}
            >
              Force Check-Out
            </Button>
          </>
        }
      >
        {forceCheckoutModal.entry && (
          <div className="space-y-4">
            <div>
              <p className="text-gray-600">
                Force checkout for:{' '}
                <span className="font-bold text-gray-900">
                  {forceCheckoutModal.entry.student?.firstName} {forceCheckoutModal.entry.student?.lastName}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Checked in at: {formatTime(forceCheckoutModal.entry.checkInTime)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-Out Time
              </label>
              <input
                type="datetime-local"
                value={forceCheckoutModal.checkOutTime}
                onChange={(e) => setForceCheckoutModal(prev => ({
                  ...prev,
                  checkOutTime: e.target.value
                }))}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Force Checkout <span className="text-red-500">*</span>
              </label>
              <textarea
                value={forceCheckoutModal.reason}
                onChange={(e) => setForceCheckoutModal(prev => ({
                  ...prev,
                  reason: e.target.value
                }))}
                placeholder="e.g., Forgot to check out, left with parent at 3pm"
                className="input-field w-full h-24 resize-none"
              />
            </div>

            {forceCheckoutModal.error && (
              <div className="text-red-600 text-sm">
                {forceCheckoutModal.error}
              </div>
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
                  {editModal.entry.student?.firstName} {editModal.entry.student?.lastName}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Check-In Time
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
                  Check-Out Time
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
  );
}
