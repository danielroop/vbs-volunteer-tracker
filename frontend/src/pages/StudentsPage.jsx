import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useEvent } from '../contexts/EventContext';

export default function StudentsPage() {
  const { currentEvent } = useEvent();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If no event is selected, we can't filter the students
    if (!currentEvent?.id) {
      setLoading(false);
      return;
    }

    // Query students specifically for the active event
    const q = query(
      collection(db, 'students'),
      where('eventId', '==', currentEvent.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching students:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentEvent?.id]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Registered Volunteers</h1>
        <div className="bg-primary-50 text-primary-700 px-3 py-1 rounded-full text-sm font-medium">
          Event: {currentEvent?.name || 'All Events'}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading volunteers...</div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Volunteer Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registered Event</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Grade</th>
              </tr>
            </thead>
            <ul className="divide-y divide-gray-200">
              {students.map((student) => (
                <li key={student.id} className="px-6 py-4 flex justify-between items-center hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {student.firstName} {student.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{student.schoolName}</p>
                  </div>
                  <div className="text-center">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {currentEvent?.name}
                    </span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    {student.gradeLevel}
                  </div>
                </li>
              ))}
            </ul>
          </table>
          {students.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              No students are currently registered for this event.
            </div>
          )}
        </div>
      )}
    </div>
  );
}