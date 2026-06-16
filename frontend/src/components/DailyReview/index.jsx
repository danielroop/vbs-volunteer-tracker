import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db, functions } from '../../utils/firebase';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useEvent } from '../../contexts/EventContext';
import { calculateHours, formatTime, formatHours, getTodayDateString, formatDate } from '../../utils/hourCalculations';
import { buildEditChangeDescription } from '../../utils/changeDescriptions';
import { printInNewWindow, createPrintDocument } from '../../utils/printUtils';
import Button from '../common/Button';
import Modal from '../common/Modal';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'activity', label: 'Activity' },
  { value: 'checkInTime', label: 'Check-In Time' },
  { value: 'checkOutTime', label: 'Check-Out Time' },
  { value: 'hoursWorked', label: 'Hours' }
];

const getTimeValue = (time) => {
  if (!time) return null;
  const timestamp = new Date(time).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
};

const getStudentSortName = (student = {}) =>
  `${student.lastName || ''}, ${student.firstName || ''}`.trim().toLowerCase();

const getSortValue = (entry, field) => {
  if (!entry) return null;

  switch (field) {
    case 'activity':
      return (entry.activity?.name || '').toLowerCase();
    case 'checkInTime':
      return getTimeValue(entry.checkInTime);
    case 'checkOutTime':
      return getTimeValue(entry.checkOutTime);
    case 'hoursWorked':
      return entry.hoursWorked === null || entry.hoursWorked === undefined ? null : Number(entry.hoursWorked);
    case 'name':
    default:
      return getStudentSortName(entry.student);
  }
};

const compareSortValues = (left, right, direction = 'asc') => {
  const leftMissing = left === null || left === undefined || left === '';
  const rightMissing = right === null || right === undefined || right === '';

  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;

  const result = typeof left === 'string' || typeof right === 'string'
    ? String(left).localeCompare(String(right), undefined, { sensitivity: 'base' })
    : left - right;

  return direction === 'desc' ? -result : result;
};

const compareStudentName = (leftStudent, rightStudent) => {
  const lastNameCompare = (leftStudent?.lastName || '').localeCompare(rightStudent?.lastName || '', undefined, { sensitivity: 'base' });
  if (lastNameCompare !== 0) return lastNameCompare;
  return (leftStudent?.firstName || '').localeCompare(rightStudent?.firstName || '', undefined, { sensitivity: 'base' });
};

const getCreditedHours = (entry) => {
  if (entry?.checkInTime && entry?.checkOutTime) {
    return calculateHours(new Date(entry.checkInTime), new Date(entry.checkOutTime)).rounded;
  }

  return entry?.hoursWorked ?? null;
};

/**
 * Daily Review Component
 * Per PRD Section 3.5.2: Daily Review (Nightly)
 * - Review time entries
 * - Flag early/late times
 * - Checkout students who forgot
 * - Force all checkout for end of event
 * - Export CSV/PDF
 */
export default function DailyReview() {
  const { currentEvent } = useEvent();
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [timeEntries, setTimeEntries] = useState([]);
  const [students, setStudents] = useState([]);
  const [eventStudentIds, setEventStudentIds] = useState(new Set());
  const [allEventCheckedInIds, setAllEventCheckedInIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [exporting, setExporting] = useState(false);

  // Quick check-in modal state
  const [quickCheckInModal, setQuickCheckInModal] = useState({
    isOpen: false,
    entry: null,
    activityId: '',
    checkInTime: '',
    reason: '',
    loading: false,
    error: null
  });

  // Force checkout modal state
  const [forceCheckoutModal, setForceCheckoutModal] = useState({
    isOpen: false,
    entry: null,
    checkOutTime: '',
    reason: '',
    loading: false,
    error: null
  });

  // Force all modal state
  const [forceAllModal, setForceAllModal] = useState({
    isOpen: false,
    activityGroups: [], // [{activityId, activityName, endTime, checkOutTime, entries: []}, ...]
    reason: '',
    loading: false,
    error: null
  });

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

  // Load students
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsData);
    });
    return () => unsubscribe();
  }, []);

  // Load students explicitly associated with the selected event
  useEffect(() => {
    if (!currentEvent?.id) {
      setEventStudentIds(new Set());
      return;
    }

    const q = query(
      collection(db, 'eventStudents'),
      where('eventId', '==', currentEvent.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEventStudentIds(new Set(snapshot.docs.map(doc => doc.data().studentId)));
    }, (error) => {
      console.error('Error loading event students:', error);
      setEventStudentIds(new Set());
    });

    return () => unsubscribe();
  }, [currentEvent?.id]);

  // Load all student IDs who have ever checked in for this event (any date)
  // Needed to show students who attended previous days but not today as "Not Checked In"
  useEffect(() => {
    if (!currentEvent?.id) {
      setAllEventCheckedInIds(new Set());
      return;
    }

    const q = query(
      collection(db, 'timeEntries'),
      where('eventId', '==', currentEvent.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!data.isVoided) ids.add(data.studentId);
      });
      setAllEventCheckedInIds(ids);
    }, (error) => {
      console.error('Error loading all event time entries:', error);
    });

    return () => unsubscribe();
  }, [currentEvent?.id]);

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

  // Full roster: explicitly added students + anyone who has ever checked in for this event
  const fullRosterIds = useMemo(
    () => new Set([...eventStudentIds, ...allEventCheckedInIds]),
    [eventStudentIds, allEventCheckedInIds]
  );

  // Create student lookup map
  const studentMap = useMemo(() => {
    const map = {};
    students.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  // Create activity lookup map
  const activityMap = useMemo(() => {
    const map = {};
    if (currentEvent?.activities) {
      currentEvent.activities.forEach(a => {
        map[a.id] = a;
      });
    }
    return map;
  }, [currentEvent?.activities]);

  const isActivityScheduledForDate = useCallback((activity, date) => {
    if (!activity) return false;
    if (activity.startDate && date < activity.startDate) return false;
    if (activity.endDate && date > activity.endDate) return false;
    return true;
  }, []);

  const activityOptions = useMemo(() => {
    const options = currentEvent?.activities
      ? currentEvent.activities.filter(activity => isActivityScheduledForDate(activity, selectedDate))
      : [];
    const knownIds = new Set(options.map(activity => activity.id));

    timeEntries.forEach(entry => {
      if (entry.activityId && !knownIds.has(entry.activityId)) {
        knownIds.add(entry.activityId);
        options.push({
          id: entry.activityId,
          name: activityMap[entry.activityId]?.name || 'Unknown Activity'
        });
      }
    });

    return options;
  }, [activityMap, currentEvent?.activities, isActivityScheduledForDate, selectedDate, timeEntries]);

  const entryRows = useMemo(() => {
    return timeEntries.map(entry => ({
      ...entry,
      hoursWorked: getCreditedHours(entry),
      student: studentMap[entry.studentId] || { firstName: 'Unknown', lastName: 'Student' },
      activity: activityMap[entry.activityId] || { id: entry.activityId, name: 'Unknown Activity', endTime: '15:00' }
    }));
  }, [timeEntries, studentMap, activityMap]);

  const matchesStatusFilter = useCallback((entry) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'flagged') return !entry.isNoCheckIn && !entry.isVoided && entry.flags && entry.flags.length > 0;
    if (statusFilter === 'no-checkout') return !entry.isNoCheckIn && !entry.isVoided && !entry.checkOutTime;
    if (statusFilter === 'checked-out') return !entry.isNoCheckIn && !entry.isVoided && !!entry.checkOutTime;
    if (statusFilter === 'not-checked-in') return entry.isNoCheckIn;
    if (statusFilter === 'modified') return !entry.isNoCheckIn && !entry.isVoided && (entry.modificationReason || entry.forcedCheckoutReason);
    if (statusFilter === 'voided') return entry.isVoided;
    if (statusFilter === 'active') return !entry.isVoided && !entry.isNoCheckIn;
    return true;
  }, [statusFilter]);

  const activitySummary = useMemo(() => {
    return activityOptions.map(activity => {
      const activeEntries = entryRows.filter(entry => entry.activityId === activity.id && !entry.isVoided);
      const checkedOutIds = new Set(activeEntries.filter(entry => entry.checkOutTime).map(entry => entry.studentId));
      const checkedInIds = new Set(activeEntries.filter(entry => !entry.checkOutTime).map(entry => entry.studentId));
      const checkedInAnyIds = new Set(activeEntries.map(entry => entry.studentId));
      const rosterIds = isActivityScheduledForDate(activity, selectedDate) && fullRosterIds.size > 0
        ? fullRosterIds
        : new Set([...checkedInAnyIds]);

      return {
        activity,
        notCheckedIn: [...rosterIds].filter(studentId => !checkedInAnyIds.has(studentId)).length,
        checkedIn: checkedInIds.size,
        checkedOut: checkedOutIds.size
      };
    });
  }, [activityOptions, entryRows, fullRosterIds, isActivityScheduledForDate, selectedDate]);

  const studentRows = useMemo(() => {
    const studentIds = new Set([...fullRosterIds]);
    entryRows.forEach(entry => studentIds.add(entry.studentId));

    return [...studentIds].map(studentId => {
      const student = studentMap[studentId] || entryRows.find(entry => entry.studentId === studentId)?.student;
      if (!student) return null;

      const entriesForStudent = entryRows.filter(entry => entry.studentId === studentId);
      const relevantActivities = activityFilter === 'all'
        ? activityOptions
        : activityOptions.filter(activity => activity.id === activityFilter);

      const activityDetails = relevantActivities.flatMap(activity => {
        const entriesForActivity = entriesForStudent.filter(entry => entry.activityId === activity.id);
        const activeEntriesForActivity = entriesForActivity.filter(entry => !entry.isVoided);

        if (
          activeEntriesForActivity.length === 0 &&
          fullRosterIds.has(studentId) &&
          isActivityScheduledForDate(activity, selectedDate)
        ) {
          return [{
            id: `no-checkin-${studentId}-${activity.id}`,
            studentId,
            activityId: activity.id,
            date: selectedDate,
            checkInTime: null,
            checkOutTime: null,
            hoursWorked: null,
            flags: [],
            isNoCheckIn: true,
            student,
            activity
          }];
        }

        return entriesForActivity;
      });

      const visibleDetails = activityDetails.filter(matchesStatusFilter);
      const sortedDetails = [...visibleDetails].sort((a, b) => {
        const primaryCompare = compareSortValues(
          getSortValue(a, sortField),
          getSortValue(b, sortField),
          sortDirection
        );
        if (primaryCompare !== 0) return primaryCompare;

        const activityCompare = compareSortValues(getSortValue(a, 'activity'), getSortValue(b, 'activity'), 'asc');
        if (activityCompare !== 0) return activityCompare;

        return compareSortValues(getSortValue(a, 'checkInTime'), getSortValue(b, 'checkInTime'), 'asc');
      });

      return {
        id: studentId,
        student,
        details: sortedDetails
      };
    })
      .filter(Boolean)
      .filter(row => {
        const fullName = `${row.student.firstName} ${row.student.lastName}`.toLowerCase();
        if (searchTerm && !fullName.includes(searchTerm.toLowerCase())) {
          return false;
        }

        return row.details.length > 0;
      })
      .sort((a, b) => {
        if (sortField === 'name') {
          const nameCompare = compareStudentName(a.student, b.student);
          return sortDirection === 'desc' ? -nameCompare : nameCompare;
        }

        const primaryCompare = compareSortValues(
          getSortValue(a.details[0], sortField),
          getSortValue(b.details[0], sortField),
          sortDirection
        );
        if (primaryCompare !== 0) return primaryCompare;

        return compareStudentName(a.student, b.student);
      });
  }, [activityFilter, activityOptions, entryRows, fullRosterIds, isActivityScheduledForDate, matchesStatusFilter, searchTerm, selectedDate, sortDirection, sortField, studentMap]);

  const filteredEntries = useMemo(() => {
    return studentRows.flatMap(row => row.details);
  }, [studentRows]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const activeEntries = timeEntries.filter(e => !e.isVoided);
    const checkedInStudentIds = new Set(activeEntries.map(e => e.studentId));
    const noCheckIn = [...fullRosterIds].filter(studentId => !checkedInStudentIds.has(studentId)).length;
    return {
      total: timeEntries.length,
      flagged: new Set(activeEntries.filter(e => e.flags && e.flags.length > 0).map(e => e.studentId)).size,
      noCheckout: new Set(activeEntries.filter(e => !e.checkOutTime).map(e => e.studentId)).size,
      noCheckoutEntries: activeEntries.filter(e => !e.checkOutTime).length,
      noCheckIn,
      modified: new Set(activeEntries.filter(e => e.modificationReason || e.forcedCheckoutReason).map(e => e.studentId)).size,
      voided: timeEntries.filter(e => e.isVoided).length
    };
  }, [timeEntries, fullRosterIds]);

  // Get activity end time for a given entry
  const getActivityEndTime = (entry) => {
    const activity = activityMap[entry.activityId];
    return activity?.endTime || currentEvent?.typicalEndTime || '15:00';
  };

  const getLocalDateTimeValue = (dateString, timeString) => {
    const [hours = '09', mins = '00'] = (timeString || '09:00').split(':');
    const [yr, mo, dy] = dateString.split('-').map(Number);
    const date = new Date(yr, mo - 1, dy);
    date.setHours(parseInt(hours), parseInt(mins), 0, 0);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hh}:${mm}`;
  };

  const getDefaultActivity = () => currentEvent?.activities?.[0] || null;

  // Open quick check-in modal
  const openQuickCheckInModal = (entry) => {
    const defaultActivity = getDefaultActivity();
    const startTime = defaultActivity?.startTime || currentEvent?.typicalStartTime || '09:00';

    setQuickCheckInModal({
      isOpen: true,
      entry,
      activityId: defaultActivity?.id || '',
      checkInTime: getLocalDateTimeValue(selectedDate, startTime),
      reason: '',
      loading: false,
      error: null
    });
  };

  // Open force checkout modal
  const openForceCheckoutModal = (entry) => {
    // Default to activity end time
    const endTime = getActivityEndTime(entry);
    const [hours, mins] = endTime.split(':');
    // Parse date string as local time (not UTC) by using components
    const [yr, mo, dy] = selectedDate.split('-').map(Number);
    const date = new Date(yr, mo - 1, dy); // month is 0-indexed
    date.setHours(parseInt(hours), parseInt(mins), 0, 0);

    // Format for datetime-local using LOCAL time (not UTC)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const localDateTime = `${year}-${month}-${day}T${hh}:${mm}`;

    setForceCheckoutModal({
      isOpen: true,
      entry,
      checkOutTime: localDateTime,
      reason: '',
      loading: false,
      error: null
    });
  };

  // Open force all checkout modal
  const openForceAllCheckoutModal = () => {
    // Get all entries without checkout
    const entriesNeedingCheckout = timeEntries.filter(e => !e.checkOutTime);
    
    // Group entries by activity
    const groupedByActivity = {};
    entriesNeedingCheckout.forEach(entry => {
      if (!groupedByActivity[entry.activityId]) {
        groupedByActivity[entry.activityId] = [];
      }
      groupedByActivity[entry.activityId].push(entry);
    });

    // Create activity groups with default checkout times
    const activityGroups = Object.entries(groupedByActivity).map(([activityId, entries]) => {
      const activity = activityMap[activityId];
      const activityEndTime = activity?.endTime || currentEvent?.typicalEndTime || '15:00';
      
      // Create datetime for the activity end time
      const [hours, mins] = activityEndTime.split(':');
      const [yr, mo, dy] = selectedDate.split('-').map(Number);
      const date = new Date(yr, mo - 1, dy);
      date.setHours(parseInt(hours), parseInt(mins), 0, 0);

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const localDateTime = `${year}-${month}-${day}T${hh}:${mm}`;

      return {
        activityId,
        activityName: activity?.name || 'Unknown',
        endTime: activityEndTime,
        checkOutTime: localDateTime,
        entries: entries.map(e => {
          const student = studentMap[e.studentId] || { firstName: 'Unknown', lastName: 'Student' };
          return {
            id: e.id,
            studentName: `${student.lastName}, ${student.firstName}`
          };
        })
      };
    });

    setForceAllModal({
      isOpen: true,
      activityGroups: activityGroups.sort((a, b) => a.activityName.localeCompare(b.activityName)),
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

  // Handle quick check-in
  const handleQuickCheckIn = async () => {
    if (!quickCheckInModal.entry || !quickCheckInModal.activityId || !quickCheckInModal.checkInTime) {
      setQuickCheckInModal(prev => ({ ...prev, error: 'Activity and check-in time are required' }));
      return;
    }

    setQuickCheckInModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      const quickCheckInFunc = httpsCallable(functions, 'quickCheckIn');
      const result = await quickCheckInFunc({
        studentId: quickCheckInModal.entry.studentId,
        eventId: currentEvent.id,
        activityId: quickCheckInModal.activityId,
        date: selectedDate,
        checkInTime: new Date(quickCheckInModal.checkInTime).toISOString(),
        reason: quickCheckInModal.reason
      });

      if (result.data.success) {
        setQuickCheckInModal({
          isOpen: false,
          entry: null,
          activityId: '',
          checkInTime: '',
          reason: '',
          loading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Quick check-in error:', error);
      setQuickCheckInModal(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to check in student'
      }));
    }
  };

  // Handle force all checkout
  const handleForceAllCheckout = async () => {
    if (!forceAllModal.reason) {
      setForceAllModal(prev => ({ ...prev, error: 'Reason is required' }));
      return;
    }

    setForceAllModal(prev => ({ ...prev, loading: true, error: null }));

    try {
      const forceAllCheckOutFunc = httpsCallable(functions, 'forceAllCheckOut');
      
      // Create activity checkout times map
      const activityCheckOutTimes = {};
      forceAllModal.activityGroups.forEach(group => {
        activityCheckOutTimes[group.activityId] = new Date(group.checkOutTime).toISOString();
      });

      const result = await forceAllCheckOutFunc({
        eventId: currentEvent.id,
        date: selectedDate,
        activityCheckOutTimes, // Now sending per-activity times
        reason: forceAllModal.reason
      });

      if (result.data.success) {
        setForceAllModal({
          isOpen: false,
          activityGroups: [],
          reason: '',
          loading: false,
          error: null
        });
        alert(`Successfully checked out ${result.data.checkedOutCount} students`);
      }
    } catch (error) {
      console.error('Force all checkout error:', error);
      setForceAllModal(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to force checkout all'
      }));
    }
  };

  // Open edit modal
  const openEditModal = (entry) => {
    // Format date for datetime-local input using LOCAL time (not UTC)
    const formatDateTimeLocal = (date) => {
      if (!date) return '';
      const d = new Date(date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const originalIn = formatDateTimeLocal(entry.checkInTime);
    const originalOut = formatDateTimeLocal(entry.checkOutTime);

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
        hoursWorked = calculateHours(checkInTime, checkOutTime).rounded;
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
    if (!confirm(`Are you sure you want to restore this voided entry for ${entry.student?.firstName} ${entry.student?.lastName}?`)) {
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

  // Export to CSV
  const handleExportCSV = () => {
    setExporting(true);

    try {
      const headers = ['Date', 'Name', 'Activity', 'Check-In', 'Check-Out', 'Hours', 'Flags', 'Override Reason'];
      const rows = filteredEntries.map(entry => [
        entry.date,
        `${entry.student.lastName}, ${entry.student.firstName}`,
        entry.activity?.name || '--',
        entry.checkInTime ? formatTime(entry.checkInTime) : '--',
        entry.checkOutTime ? formatTime(entry.checkOutTime) : 'Not checked out',
        entry.hoursWorked !== null ? entry.hoursWorked.toString() : '--',
        (entry.flags || []).join('; '),
        entry.forcedCheckoutReason || entry.modificationReason || ''
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

    const styles = `
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { font-size: 18px; margin-bottom: 10px; }
      h2 { font-size: 14px; margin-bottom: 20px; color: #666; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
      th { background-color: #f5f5f5; font-weight: bold; }
      .status-no-checkout { color: red; font-weight: bold; }
      .flags { font-size: 10px; color: #666; }
      .override { font-size: 9px; color: #0066cc; font-style: italic; }
      .summary { margin-bottom: 20px; padding: 10px; background: #f9f9f9; border-radius: 4px; }
      .summary span { margin-right: 20px; }
      @media print { body { padding: 0; } }
    `;

    const body = `
      <h1>Daily Review Report</h1>
      <h2>${currentEvent?.name || 'Event'} - ${formatDate(selectedDate)}</h2>

      <div class="summary">
        <span><strong>Total:</strong> ${stats.total}</span>
        <span><strong>Flagged:</strong> ${stats.flagged}</span>
        <span><strong>No Checkout:</strong> ${stats.noCheckout}</span>
        <span><strong>Modified:</strong> ${stats.modified}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Activity</th>
            <th>Check-In</th>
            <th>Check-Out</th>
            <th>Hours</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${filteredEntries.map(entry => `
            <tr>
              <td>${entry.date}</td>
              <td>${entry.student.lastName}, ${entry.student.firstName}</td>
              <td>${entry.activity?.name || '--'}</td>
              <td>${entry.checkInTime ? formatTime(entry.checkInTime) : '--'}</td>
              <td class="${!entry.checkOutTime ? 'status-no-checkout' : ''}">${entry.checkOutTime ? formatTime(entry.checkOutTime) : 'Not checked out'}</td>
              <td>${entry.hoursWorked !== null ? entry.hoursWorked : '--'}</td>
              <td>
                <span class="flags">${(entry.flags || []).map(f => formatFlag(f)).join(', ')}</span>
                ${entry.forcedCheckoutReason || entry.modificationReason ? `<div class="override">Override: ${entry.forcedCheckoutReason || entry.modificationReason}</div>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="margin-top: 20px; font-size: 10px; color: #999;">
        Generated on ${new Date().toLocaleString()}
      </p>
    `;

    const printContent = createPrintDocument({
      title: `Daily Review - ${selectedDate}`,
      styles,
      body
    });

    printInNewWindow(printContent, {
      onComplete: () => setExporting(false),
      onError: (error) => {
        console.error('PDF export error:', error);
        alert('Error generating PDF: ' + error.message);
        setExporting(false);
      }
    });
  };

  // Helper functions for display
  const getStatusDisplay = (entry) => {
    if (entry.isNoCheckIn) return 'Not Checked In';
    if (entry.isVoided) return 'VOIDED';
    if (!entry.checkOutTime) return '🔴 No Checkout';
    if (entry.forcedCheckoutReason) return '⚡ Forced';
    if (entry.modificationReason) return '✏️ Modified';
    if (entry.flags && entry.flags.length > 0) return '⚠️ Flagged';
    return '✓ Complete';
  };

  const getStatusClass = (entry) => {
    if (entry.isNoCheckIn) return 'text-gray-500';
    if (entry.isVoided) return 'text-gray-400';
    if (!entry.checkOutTime) return 'text-red-600';
    if (entry.forcedCheckoutReason || entry.modificationReason) return 'text-blue-600';
    if (entry.flags && entry.flags.length > 0) return 'text-amber-600';
    return 'text-green-600';
  };

  const formatFlag = (flag) => {
    const flagLabels = {
      early_arrival: 'Early arrival',
      late_stay: 'Late stay',
      forced_checkout: 'Forced checkout'
    };
    return flagLabels[flag] || flag;
  };

  if (!currentEvent) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-4 flex items-center justify-center min-h-[60vh]">
          <div className="text-center text-gray-500">
            <p className="text-lg">No event selected</p>
            <p className="text-sm mt-2">Please select an event from the Events page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Content Header */}
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

          <div className="mt-4 text-lg font-semibold text-gray-800">
            {formatDate(selectedDate)}
          </div>

          {/* Stats */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="text-gray-600">
              <span className="font-bold text-gray-900">{stats.total}</span> total entries
            </div>
            {stats.flagged > 0 && (
              <div className="text-amber-600">
                ⚠️ <span className="font-bold">{stats.flagged}</span> flagged
              </div>
            )}
            {stats.noCheckout > 0 && (
              <div className="text-red-600">
                🔴 <span className="font-bold">{stats.noCheckout}</span> no checkout
              </div>
            )}
            {stats.noCheckIn > 0 && (
              <div className="text-gray-600">
                <span className="font-bold">{stats.noCheckIn}</span> not checked in
              </div>
            )}
            {stats.modified > 0 && (
              <div className="text-blue-600">
                ✏️ <span className="font-bold">{stats.modified}</span> modified
              </div>
            )}
            {stats.voided > 0 && (
              <div className="text-gray-400">
                <span className="font-bold">{stats.voided}</span> voided
              </div>
            )}
          </div>

          {activitySummary.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activitySummary.map(({ activity, notCheckedIn, checkedIn, checkedOut }) => (
                <div key={activity.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="font-semibold text-gray-900 truncate" title={activity.name}>
                    {activity.name}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="font-bold text-gray-900">{notCheckedIn}</div>
                      <div className="text-xs text-gray-500">Not Checked In</div>
                    </div>
                    <div>
                      <div className="font-bold text-red-600">{checkedIn}</div>
                      <div className="text-xs text-gray-500">Checked In</div>
                    </div>
                    <div>
                      <div className="font-bold text-green-600">{checkedOut}</div>
                      <div className="text-xs text-gray-500">Checked Out</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

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
              aria-label="Activity filter"
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="input-field w-56"
            >
              <option value="all">All Activities</option>
              {activityOptions.map(activity => (
                <option key={activity.id} value={activity.id}>
                  {activity.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-48"
            >
              <option value="all">All Entries</option>
              <option value="active">Active Only</option>
              <option value="flagged">Flagged Only</option>
              <option value="no-checkout">No Checkout</option>
              <option value="checked-out">Checked Out</option>
              <option value="not-checked-in">Not Checked In</option>
              <option value="modified">Modified Only</option>
              <option value="voided">Voided Only</option>
            </select>
            <select
              aria-label="Sort by"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              className="input-field w-48"
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  Sort by {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Sort direction"
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
              className="input-field w-40"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
        </div>

        {/* Desktop Table View (md and up) */}
        <div className="hidden md:block bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full" role="table" aria-label="Daily student activity review">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Activity Details</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : studentRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    {searchTerm || statusFilter !== 'all' || activityFilter !== 'all'
                      ? 'No entries match your filters'
                      : 'No entries for this date'}
                  </td>
                </tr>
              ) : (
                studentRows.map(row => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 align-top"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {selectedDate}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/admin/settings/students/${row.id}`}
                        className="block font-medium text-primary-700 hover:text-primary-900 hover:underline truncate max-w-[200px]"
                        title={`${row.student.lastName}, ${row.student.firstName}`}
                      >
                        {row.student.lastName}, {row.student.firstName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-3">
                        {row.details.map(entry => (
                          <div key={entry.id} className={entry.isVoided ? 'opacity-50' : ''}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className={`uppercase font-bold text-[10px] text-blue-600 ${entry.isVoided ? 'line-through' : ''}`}>
                                {entry.activity?.name || '--'}
                              </span>
                              <span className={`text-sm font-medium ${getStatusClass(entry)}`}>
                                {getStatusDisplay(entry)}
                              </span>
                              <span className={`text-sm text-gray-600 ${entry.isVoided ? 'line-through' : ''}`}>
                                In: {entry.checkInTime ? formatTime(entry.checkInTime) : '--'}
                              </span>
                              <span className={`text-sm ${entry.isVoided ? 'line-through text-gray-400' : 'text-gray-600'}`}>
                                Out: {entry.isNoCheckIn ? '--' : entry.checkOutTime ? formatTime(entry.checkOutTime) : 'Not checked out'}
                              </span>
                              <span className={`text-sm text-gray-600 ${entry.isVoided ? 'line-through' : ''}`}>
                                Hours: {entry.hoursWorked !== null && entry.hoursWorked !== undefined ? formatHours(entry.hoursWorked) : '--'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-2">
                        {row.details.map(entry => (
                          <div key={`${entry.id}-actions`} className="flex flex-wrap gap-2">
                            {entry.isNoCheckIn ? (
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => openQuickCheckInModal(entry)}
                                aria-label={`Check in ${entry.student.firstName} ${entry.student.lastName} for ${entry.activity?.name || 'activity'}`}
                              >
                                Check In
                              </Button>
                            ) : entry.isVoided ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleRestoreEntry(entry)}
                                aria-label={`Restore voided entry for ${entry.student.firstName} ${entry.student.lastName}`}
                              >
                                Restore
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => openEditModal(entry)}
                                  aria-label={`Edit time entry for ${entry.student.firstName} ${entry.student.lastName}`}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openVoidModal(entry)}
                                  aria-label={`Void time entry for ${entry.student.firstName} ${entry.student.lastName}`}
                                >
                                  Void
                                </Button>
                                {!entry.checkOutTime && (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => openForceCheckoutModal(entry)}
                                    aria-label={`Checkout for ${entry.student.firstName} ${entry.student.lastName}`}
                                  >
                                    Checkout
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View (below md breakpoint) */}
        <div className="block md:hidden" role="list" aria-label="Daily student activity review">
          {loading ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              Loading...
            </div>
          ) : studentRows.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
              {searchTerm || statusFilter !== 'all' || activityFilter !== 'all'
                ? 'No entries match your filters'
                : 'No entries for this date'}
            </div>
          ) : (
            <div className="space-y-3">
              {studentRows.map(row => (
                <article key={row.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                  <Link
                    to={`/admin/settings/students/${row.id}`}
                    className="block font-medium text-primary-700 hover:text-primary-900 hover:underline"
                  >
                    {row.student.lastName}, {row.student.firstName}
                  </Link>
                  <div className="mt-3 space-y-3">
                    {row.details.map(entry => (
                      <div key={entry.id} className={entry.isVoided ? 'opacity-50' : ''}>
                        <div className="flex items-start justify-between gap-3">
                          <span className={`uppercase font-bold text-[10px] text-blue-600 ${entry.isVoided ? 'line-through' : ''}`}>
                            {entry.activity?.name || '--'}
                          </span>
                          <span className={`text-sm font-medium text-right ${getStatusClass(entry)}`}>
                            {getStatusDisplay(entry)}
                          </span>
                        </div>
                        <div className={`grid grid-cols-3 gap-2 text-sm mt-2 ${entry.isVoided ? 'line-through' : ''}`}>
                          <div>
                            <span className="block text-xs text-gray-500 uppercase">Check-In</span>
                            <span className="text-gray-900">{entry.checkInTime ? formatTime(entry.checkInTime) : '--'}</span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500 uppercase">Check-Out</span>
                            <span className={entry.checkOutTime || entry.isNoCheckIn ? 'text-gray-900' : 'text-red-600 font-medium'}>
                              {entry.isNoCheckIn ? '--' : entry.checkOutTime ? formatTime(entry.checkOutTime) : 'Not checked out'}
                            </span>
                          </div>
                          <div>
                            <span className="block text-xs text-gray-500 uppercase">Hours</span>
                            <span className="text-gray-900">
                              {entry.hoursWorked !== null && entry.hoursWorked !== undefined ? formatHours(entry.hoursWorked) : '--'}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 mt-2 border-t border-gray-100">
                          {entry.isNoCheckIn ? (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => openQuickCheckInModal(entry)}
                              aria-label={`Check in ${entry.student.firstName} ${entry.student.lastName}`}
                            >
                              Check In
                            </Button>
                          ) : entry.isVoided ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRestoreEntry(entry)}
                              aria-label={`Restore voided entry for ${entry.student.firstName} ${entry.student.lastName}`}
                            >
                              Restore
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditModal(entry)}
                                aria-label={`Edit time entry for ${entry.student.firstName} ${entry.student.lastName}`}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => openVoidModal(entry)}
                                aria-label={`Void time entry for ${entry.student.firstName} ${entry.student.lastName}`}
                              >
                                Void
                              </Button>
                              {!entry.checkOutTime && (
                                <Button
                                  size="sm"
                                  variant="danger"
                                  onClick={() => openForceCheckoutModal(entry)}
                                  aria-label={`Checkout for ${entry.student.firstName} ${entry.student.lastName}`}
                                >
                                  Checkout
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap justify-between gap-4">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={handleExportCSV}
              disabled={exporting || filteredEntries.length === 0}
            >
              Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={handleExportPDF}
              disabled={exporting || filteredEntries.length === 0}
            >
              Export PDF
            </Button>
          </div>
          {stats.noCheckoutEntries > 0 && (
            <Button
              variant="danger"
              onClick={openForceAllCheckoutModal}
            >
              Force All Checkout ({stats.noCheckoutEntries})
            </Button>
          )}
        </div>
      </div>

      {/* Quick Check-In Modal */}
      <Modal
        isOpen={quickCheckInModal.isOpen}
        onClose={() => setQuickCheckInModal({ ...quickCheckInModal, isOpen: false })}
        title="Check In"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setQuickCheckInModal({ ...quickCheckInModal, isOpen: false })}
              disabled={quickCheckInModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={handleQuickCheckIn}
              loading={quickCheckInModal.loading}
            >
              Check In
            </Button>
          </>
        }
      >
        {quickCheckInModal.entry && (
          <div className="space-y-4">
            <div>
              <p className="text-gray-600">
                Check in:{' '}
                <span className="font-bold text-gray-900">
                  {quickCheckInModal.entry.student?.firstName} {quickCheckInModal.entry.student?.lastName}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Date: {formatDate(selectedDate)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activity <span className="text-red-500">*</span>
              </label>
              <select
                value={quickCheckInModal.activityId}
                onChange={(e) => {
                  const activity = activityMap[e.target.value];
                  setQuickCheckInModal(prev => ({
                    ...prev,
                    activityId: e.target.value,
                    checkInTime: getLocalDateTimeValue(
                      selectedDate,
                      activity?.startTime || currentEvent?.typicalStartTime || '09:00'
                    )
                  }));
                }}
                className="input-field w-full"
              >
                <option value="">Select activity</option>
                {(currentEvent?.activities || []).map(activity => (
                  <option key={activity.id} value={activity.id}>
                    {activity.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check-In Time <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={quickCheckInModal.checkInTime}
                onChange={(e) => setQuickCheckInModal(prev => ({
                  ...prev,
                  checkInTime: e.target.value
                }))}
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason or Note
              </label>
              <textarea
                value={quickCheckInModal.reason}
                onChange={(e) => setQuickCheckInModal(prev => ({
                  ...prev,
                  reason: e.target.value
                }))}
                placeholder="e.g., Missed scan-in, entered from roster review"
                className="input-field w-full h-24 resize-none"
              />
            </div>

            {quickCheckInModal.error && (
              <div className="text-red-600 text-sm">
                {quickCheckInModal.error}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Force Checkout Modal */}
      <Modal
        isOpen={forceCheckoutModal.isOpen}
        onClose={() => setForceCheckoutModal({ ...forceCheckoutModal, isOpen: false })}
        title="Checkout"
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
              Checkout
            </Button>
          </>
        }
      >
        {forceCheckoutModal.entry && (
          <div className="space-y-4">
            <div>
              <p className="text-gray-600">
                Checkout:{' '}
                <span className="font-bold text-gray-900">
                  {forceCheckoutModal.entry.student?.firstName} {forceCheckoutModal.entry.student?.lastName}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Activity: {forceCheckoutModal.entry.activity?.name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500">
                Checked in at: {formatTime(forceCheckoutModal.entry.checkInTime)}
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Default checkout time is set to activity end time ({getActivityEndTime(forceCheckoutModal.entry)})
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
                Reason for Checkout <span className="text-red-500">*</span>
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

      {/* Force All Checkout Modal */}
      <Modal
        isOpen={forceAllModal.isOpen}
        onClose={() => setForceAllModal({ isOpen: false, activityGroups: [], reason: '', loading: false, error: null })}
        title="Force All Checkout"
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setForceAllModal({ isOpen: false, activityGroups: [], reason: '', loading: false, error: null })}
              disabled={forceAllModal.loading}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleForceAllCheckout}
              loading={forceAllModal.loading}
            >
              Force All Checkout
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            This will force checkout <span className="font-bold text-red-600">{forceAllModal.activityGroups.reduce((sum, g) => sum + g.entries.length, 0)}</span> students
            who haven't checked out yet.
          </p>

          {/* Activity Groups */}
          <div className="space-y-4 max-h-96 overflow-y-auto border rounded-lg p-4 bg-gray-50">
            {forceAllModal.activityGroups.map(group => (
              <div key={group.activityId} className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{group.activityName}</h3>
                    <p className="text-sm text-gray-600">{group.entries.length} student{group.entries.length !== 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-medium text-blue-600">Ends: {group.endTime}</span>
                </div>

                <div className="mb-3 space-y-1">
                  {group.entries.map(entry => (
                    <p key={entry.id} className="text-sm text-gray-600">• {entry.studentName}</p>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-Out Time
                  </label>
                  <input
                    type="datetime-local"
                    value={group.checkOutTime}
                    onChange={(e) => setForceAllModal(prev => ({
                      ...prev,
                      activityGroups: prev.activityGroups.map(g =>
                        g.activityId === group.activityId
                          ? { ...g, checkOutTime: e.target.value }
                          : g
                      )
                    }))}
                    className="input-field w-full"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Force Checkout <span className="text-red-500">*</span>
            </label>
            <textarea
              value={forceAllModal.reason}
              onChange={(e) => setForceAllModal(prev => ({
                ...prev,
                reason: e.target.value
              }))}
              placeholder="e.g., End of day, activity completed, event concluded"
              className="input-field w-full h-24 resize-none"
            />
          </div>

          <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded">
            This action is typically used at the end of the event day or week to generate reports.
          </p>

          {forceAllModal.error && (
            <div className="text-red-600 text-sm">
              {forceAllModal.error}
            </div>
          )}
        </div>
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
              <p className="text-sm text-gray-500 mt-1">
                Date: {editModal.entry.checkInTime ? new Date(editModal.entry.checkInTime).toLocaleDateString() : editModal.entry.date} | Activity: {editModal.entry.activity?.name || 'Unknown'}
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
                      return formatHours(calculateHours(checkIn, checkOut).rounded);
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
                  {voidModal.entry.student?.firstName} {voidModal.entry.student?.lastName}
                </span>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Activity: {voidModal.entry.activity?.name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-500">
                Check-in: {voidModal.entry.checkInTime ? formatTime(voidModal.entry.checkInTime) : '--'}
                {' | '}
                Check-out: {voidModal.entry.checkOutTime ? formatTime(voidModal.entry.checkOutTime) : 'Not checked out'}
              </p>
              {voidModal.entry.hoursWorked != null && (
                <p className="text-sm text-gray-500">
                  Hours: {formatHours(voidModal.entry.hoursWorked)}
                </p>
              )}
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
    </div>
  );
}
