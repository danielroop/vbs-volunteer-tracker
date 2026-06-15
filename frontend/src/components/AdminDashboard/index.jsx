import React, { useState, useEffect, useMemo } from 'react'; //
import { db } from '../../utils/firebase'; //
import { collection, onSnapshot } from 'firebase/firestore'; //
import { useEvent } from '../../contexts/EventContext'; // Add this
import { useTimeEntries } from '../../hooks/useTimeEntries'; // Add this

const convertToDate = (timeValue) => {
  if (!timeValue) return null;
  if (timeValue instanceof Date) return timeValue;
  if (typeof timeValue.toDate === 'function') return timeValue.toDate();
  return new Date(timeValue);
};

const formatActivityTime = (timeValue) => {
  const date = convertToDate(timeValue);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString() : '--';
};

const getMethodLabel = (method) => {
  if (method === 'manual') return 'manual';
  if (method === 'self_scan') return 'self-scan';
  if (method === 'av_scan') return 'AV scan';
  return 'scan';
};

const getChangeTypeLabel = (type) => {
  switch (type) {
    case 'void':
      return 'Voided';
    case 'restore':
      return 'Restored';
    case 'force_checkout':
    case 'bulk_force_checkout':
      return 'Forced Check-Out';
    case 'edit':
    default:
      return 'Modified';
  }
};

const buildRecentActivityItems = (timeEntries, studentNameMap, activityNameMap) => {
  return timeEntries
    .flatMap(entry => {
      const studentName = studentNameMap[entry.studentId] || 'Student';
      const activityName = activityNameMap[entry.activityId] || 'Activity';
      const items = [];
      const isManualEntry = entry.entry_source === 'manual' || (
        entry.checkInMethod === 'manual' && entry.checkOutMethod === 'manual'
      );

      if (isManualEntry) {
        const actionTime = convertToDate(entry.modifiedAt || entry.createdAt || entry.checkInTime);
        items.push({
          id: `${entry.id}-manual-entry`,
          studentName,
          actionLabel: 'Manual Entry',
          detail: `${activityName} logged`,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      } else if (entry.checkInTime) {
        const actionTime = convertToDate(entry.checkInTime);
        items.push({
          id: `${entry.id}-check-in`,
          studentName,
          actionLabel: 'Check-In',
          detail: `${activityName} via ${getMethodLabel(entry.checkInMethod)}`,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      }

      if (!isManualEntry && entry.checkOutTime) {
        const actionTime = convertToDate(entry.checkOutTime);
        items.push({
          id: `${entry.id}-check-out`,
          studentName,
          actionLabel: 'Check-Out',
          detail: `${activityName} via ${getMethodLabel(entry.checkOutMethod)}`,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      }

      (entry.changeLog || []).forEach((change, index) => {
        const actionTime = convertToDate(change.timestamp);
        items.push({
          id: `${entry.id}-change-${index}`,
          studentName,
          actionLabel: getChangeTypeLabel(change.type),
          detail: change.description || activityName,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      });

      return items;
    })
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 5);
};

/**
 * Admin Dashboard Component
 * Per PRD Section 3.5: Volunteer Admin (VA) Dashboard
 * - Real-time monitoring
 * - Recent activity feed
 * - Quick actions
 */
export default function AdminDashboard() {
  const { currentEvent } = useEvent();
  const [students, setStudents] = useState([]); // State to store student records
  const { timeEntries, loading } = useTimeEntries({
    eventId: currentEvent?.id,
    realtime: true
  });

  // This creates an object where the key is the ID and the value is the full name
  const studentNameMap = useMemo(() => {
    const map = {};

    students.forEach(s => {
      map[s.id] = [s.firstName, s.lastName].filter(Boolean).join(' ') || s.firstName || 'Student';
    });
    return map;
  }, [students]);

  const activityNameMap = useMemo(() => {
    const map = {};
    (currentEvent?.activities || []).forEach(activity => {
      map[activity.id] = activity.name;
    });
    return map;
  }, [currentEvent?.activities]);

  const recentActivityItems = useMemo(() => (
    buildRecentActivityItems(timeEntries, studentNameMap, activityNameMap)
  ), [timeEntries, studentNameMap, activityNameMap]);


  // 1. Fetch the collection of students
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);


  // Calculate stats from real-time data
  const attendanceStats = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    const todaysEntries = timeEntries.filter(e => {
      const checkInDate = convertToDate(e.checkInTime);
      return checkInDate && checkInDate >= startOfToday;
    });

    


    const currentlyCheckedInIds = new Set(
      todaysEntries
        .filter(e => !e.checkOutTime)
        .map(e => e.studentId)
    );



    const checkedOutIds = new Set(
      todaysEntries
        .filter(e => e.checkOutTime)
        .map(e => e.studentId)
    );

    const finalCheckedInCount = currentlyCheckedInIds.size;

    // Only count as "Checked Out" if they aren't currently checked back in elsewhere
    const finalCheckedOutCount = [...checkedOutIds].filter(
      id => !currentlyCheckedInIds.has(id)
    ).length;

    return {
      onSite: finalCheckedInCount,
      completed: finalCheckedOutCount,
      totalUnique: new Set(todaysEntries.map(e => e.studentId)).size
    };
  }, [timeEntries]);



  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Today's Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Overview: {currentEvent?.name} - {new Date().toLocaleDateString()}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>🟢 Checked In:</span>
                <span className="font-bold">{loading ? '...' : attendanceStats.onSite || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>✓ Checked Out:</span>
                <span className="font-bold">{loading ? '...' : attendanceStats.completed || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-bold">{loading ? '...' : attendanceStats.totalUnique || 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-2">🔔 Recent Activity</h3>
            {recentActivityItems.length > 0 ? (
              recentActivityItems.map(item => (
                <div key={item.id} className="text-sm border-b py-2">
                  <div className="flex justify-between gap-3">
                    <span className="font-bold text-gray-800">{item.studentName}</span>
                    <span className="text-gray-500 whitespace-nowrap">
                      {formatActivityTime(item.actionTime)}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between gap-3 text-xs">
                    <span className="font-semibold text-gray-700">{item.actionLabel}</span>
                    <span className="text-gray-500 text-right">{item.detail}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Needs Attention</h3>
            <p className="text-gray-500 text-sm">All clear</p>
          </div>
        </div>

      </div>
    </div>
  );
}
