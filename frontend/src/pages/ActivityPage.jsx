import React, { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import ActivityFeedList from '../components/ActivityFeed/ActivityFeedList';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import { useEvent } from '../contexts/EventContext';
import { useTimeEntries } from '../hooks/useTimeEntries';
import { db } from '../utils/firebase';
import { buildActivityItems } from '../utils/activityFeed';

const PAGE_SIZE = 25;

export default function ActivityPage() {
  const { currentEvent } = useEvent();
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { timeEntries, loading } = useTimeEntries({
    eventId: currentEvent?.id,
    date: null,
    realtime: true
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const studentNameMap = useMemo(() => {
    const map = {};
    students.forEach(student => {
      map[student.id] = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.firstName || 'Student';
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

  const activityItems = useMemo(() => (
    buildActivityItems(timeEntries, studentNameMap, activityNameMap)
  ), [timeEntries, studentNameMap, activityNameMap]);

  const actionOptions = useMemo(() => (
    [...new Set(activityItems.map(item => item.actionLabel))].sort()
  ), [activityItems]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return activityItems.filter(item => {
      const matchesSearch = !normalizedSearch || [
        item.studentName,
        item.actionLabel,
        item.detail
      ].some(value => value.toLowerCase().includes(normalizedSearch));
      const matchesActivity = activityFilter === 'all' || item.activityId === activityFilter;
      const matchesAction = actionFilter === 'all' || item.actionLabel === actionFilter;

      return matchesSearch && matchesActivity && matchesAction;
    });
  }, [activityItems, searchTerm, activityFilter, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const normalizedPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (normalizedPage - 1) * PAGE_SIZE;
  const pageItems = filteredItems.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const pageStart = filteredItems.length === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = Math.min(pageStartIndex + PAGE_SIZE, filteredItems.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activityFilter, actionFilter]);

  useEffect(() => {
    setCurrentPage(page => Math.min(page, totalPages));
  }, [totalPages]);

  const clearFilters = () => {
    setSearchTerm('');
    setActivityFilter('all');
    setActionFilter('all');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Activity</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            {currentEvent?.name ? `All activity for ${currentEvent.name}` : 'All activity for the selected event'}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          {loading ? (
            <p className="text-sm text-gray-500">Loading activity...</p>
          ) : (
            <>
              <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
                <Input
                  label="Search"
                  aria-label="Search activity"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Student, action, or detail"
                />

                <div>
                  <label htmlFor="activity-filter" className="mb-1 block text-sm font-medium text-gray-700">
                    Activity
                  </label>
                  <select
                    id="activity-filter"
                    value={activityFilter}
                    onChange={(event) => setActivityFilter(event.target.value)}
                    className="input-field"
                  >
                    <option value="all">All activities</option>
                    {(currentEvent?.activities || []).map(activity => (
                      <option key={activity.id} value={activity.id}>
                        {activity.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="action-filter" className="mb-1 block text-sm font-medium text-gray-700">
                    Action
                  </label>
                  <select
                    id="action-filter"
                    value={actionFilter}
                    onChange={(event) => setActionFilter(event.target.value)}
                    className="input-field"
                  >
                    <option value="all">All actions</option>
                    {actionOptions.map(action => (
                      <option key={action} value={action}>
                        {action}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <Button type="button" variant="secondary" onClick={clearFilters} className="w-full">
                    Clear
                  </Button>
                </div>
              </div>

              <div className="mb-3 flex flex-col gap-2 border-b border-gray-100 pb-3 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {pageStart}-{pageEnd} of {filteredItems.length} activity items
                </span>
                <span>
                  Page {normalizedPage} of {totalPages}
                </span>
              </div>

              <ActivityFeedList
                items={pageItems}
                emptyMessage="No activity matches these filters"
                timestampFormat="datetime"
              />

              {filteredItems.length > PAGE_SIZE && (
                <div className="mt-5 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={normalizedPage === 1}
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-medium text-gray-500">
                    {pageStart}-{pageEnd} of {filteredItems.length}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={normalizedPage === totalPages}
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
