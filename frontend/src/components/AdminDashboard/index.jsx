import React, { useState, useEffect, useMemo } from 'react'; //
import { db } from '../../utils/firebase'; //
import { collection, onSnapshot } from 'firebase/firestore'; //
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEvent } from '../../contexts/EventContext'; // Add this
import { useTimeEntries } from '../../hooks/useTimeEntries'; // Add this
import Button from '../common/Button';

/**
 * Admin Dashboard Component
 * Per PRD Section 3.5: Volunteer Admin (VA) Dashboard
 * - Real-time monitoring
 * - Recent activity feed
 * - Quick actions
 */
export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const { currentEvent } = useEvent();
  const [students, setStudents] = useState([]); // State to store student records
  const { timeEntries, loading } = useTimeEntries({
    eventId: currentEvent?.id,
    realtime: true
  });

  // Helper to handle both Firestore Timestamps and JS Dates
  const convertToDate = (timeValue) => {
    if (!timeValue) return null;
    return typeof timeValue.toDate === 'function' ? timeValue.toDate() : new Date(timeValue);
  };

  // This creates an object where the key is the ID and the value is the First Name
  const studentNameMap = useMemo(() => {
    const map = {};

    students.forEach(s => {
      map[s.id] = s.firstName;
    });
    return map;
  }, [students]);


  // 1. Fetch the collection of students
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);


  // Calculate stats from real-time data
  const attendanceStats = useMemo(() => {
    // Helper to handle both Firestore Timestamps and JS Dates
    const convertToDate = (timeValue) => {
      if (!timeValue) return null;
      return typeof timeValue.toDate === 'function' ? timeValue.toDate() : new Date(timeValue);
    };

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



  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">VBS Volunteer Tracker</h1>
          {/* Current Event Indicator */}
          <div className="flex items-center gap-2 mt-1">
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            <span className="text-sm font-medium text-gray-600">
              Active Event: <span className="text-primary-600">{currentEvent?.name || 'No Event Selected'}</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">👤 {user?.email}</span>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <Link to="/admin" className="px-4 py-2 border-b-2 border-primary-600 font-medium text-primary-600">
            Dashboard
          </Link>
          <Link to="/admin/daily-review" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Daily Review
          </Link>
          <Link to="/admin/forms" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Forms
          </Link>
          <Link to="/admin/students" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Students
          </Link>
          <Link to="/admin/reports" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Reports
          </Link>
          <Link to="/admin/events" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Events
          </Link>
        </div>

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
            {timeEntries.slice(0, 5).map(entry => {
              // Lookup name from the map or fallback to "Student" if not found
              const firstName = studentNameMap[entry.studentId] || 'Student';

              // Safely handle the checkInTime
              const timeString = entry.checkInTime?.toDate
                ? entry.checkInTime.toDate().toLocaleTimeString()
                : new Date(entry.checkInTime).toLocaleTimeString();

              return (
                <div key={entry.id} className="text-sm border-b py-2 flex justify-between">
                  <span className="font-bold text-gray-800">{firstName}</span>
                  <span className="text-gray-500">
                     scanned at {timeString}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Needs Attention</h3>
            <p className="text-gray-500 text-sm">All clear</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="primary" as="link" to="/admin/daily-review">
              Review Today
            </Button>
            <Button variant="primary" as="link" to="/admin/forms">
              Generate Forms
            </Button>
            <Button variant="secondary">
              Export Report
            </Button>
            <Button variant="secondary">
              Search Student
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
