import React, { useState, useEffect, useMemo } from 'react'; //
import { db } from '../../utils/firebase'; //
import { collection, onSnapshot } from 'firebase/firestore'; //
import { Link } from 'react-router-dom';
import ActivityFeedList from '../ActivityFeed/ActivityFeedList';
import { useEvent } from '../../contexts/EventContext'; // Add this
import { useTimeEntries } from '../../hooks/useTimeEntries'; // Add this
import { buildActivityItems, convertToDate } from '../../utils/activityFeed';

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
    buildActivityItems(timeEntries, studentNameMap, activityNameMap, 5)
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
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">🔔 Recent Activity</h3>
              <Link to="/admin/activity" className="text-xs font-black text-primary-700 hover:text-primary-800">
                View all
              </Link>
            </div>
            <ActivityFeedList items={recentActivityItems} />
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
