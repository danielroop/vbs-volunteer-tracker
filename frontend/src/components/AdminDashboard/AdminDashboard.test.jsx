import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminDashboard from './index';

const mockStudents = [
  { id: 'student1', firstName: 'Alice', lastName: 'Adams' },
  { id: 'student2', firstName: 'Bob', lastName: 'Brown' },
];

let mockTimeEntries = [];

const renderDashboard = () => render(
  <MemoryRouter>
    <AdminDashboard />
  </MemoryRouter>
);

vi.mock('../../utils/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ _collPath: path })),
  onSnapshot: vi.fn((ref, callback) => {
    if (ref?._collPath === 'students') {
      queueMicrotask(() => callback({
        docs: mockStudents.map(student => ({
          id: student.id,
          data: () => student
        }))
      }));
    }

    return vi.fn();
  })
}));

vi.mock('../../contexts/EventContext', () => ({
  useEvent: () => ({
    currentEvent: {
      id: 'event1',
      name: 'VBS 2026',
      activities: [
        { id: 'activity1', name: 'Morning Session' },
        { id: 'activity2', name: 'Afternoon Session' },
      ]
    }
  })
}));

vi.mock('../../hooks/useTimeEntries', () => ({
  useTimeEntries: () => ({
    timeEntries: mockTimeEntries,
    loading: false
  })
}));

describe('AdminDashboard recent activity', () => {
  beforeEach(() => {
    mockTimeEntries = [];
  });

  it('shows the full student name and the activity type', async () => {
    mockTimeEntries = [
      {
        id: 'entry1',
        studentId: 'student1',
        activityId: 'activity1',
        checkInTime: new Date('2026-06-15T09:00:00'),
        checkInMethod: 'av_scan',
        checkOutTime: null
      }
    ];

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Alice Adams')).toBeInTheDocument();
    });

    expect(screen.getByText('Check-In')).toBeInTheDocument();
    expect(screen.getByText('Morning Session via AV scan')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('sorts manual changes by the time the change was made', async () => {
    mockTimeEntries = [
      {
        id: 'manual-entry',
        studentId: 'student2',
        activityId: 'activity2',
        entry_source: 'manual',
        checkInMethod: 'manual',
        checkOutMethod: 'manual',
        checkInTime: new Date('2026-06-15T08:00:00'),
        checkOutTime: new Date('2026-06-15T10:00:00'),
        modifiedAt: new Date('2026-06-15T11:30:00')
      },
      {
        id: 'edited-entry',
        studentId: 'student1',
        activityId: 'activity1',
        checkInTime: new Date('2026-06-15T09:00:00'),
        checkInMethod: 'av_scan',
        changeLog: [
          {
            timestamp: '2026-06-15T12:15:00',
            type: 'edit',
            description: 'Changed Check-Out from none to 12:00 PM'
          }
        ]
      }
    ];

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Modified')).toBeInTheDocument();
    });

    const activityPanel = screen.getByText('🔔 Recent Activity').closest('.bg-white');
    const rows = within(activityPanel).getAllByText(/Alice Adams|Bob Brown/);

    expect(rows[0]).toHaveTextContent('Alice Adams');
    expect(rows[1]).toHaveTextContent('Bob Brown');
    expect(screen.getByText('Manual Entry')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Session logged')).toBeInTheDocument();
  });

  it('links to the full activity page', async () => {
    renderDashboard();

    expect(await screen.findByRole('link', { name: 'View all' })).toHaveAttribute('href', '/admin/activity');
  });
});
