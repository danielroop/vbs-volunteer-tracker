import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivityPage from './ActivityPage';

const mockStudents = [
  { id: 'student1', firstName: 'Alice', lastName: 'Adams' },
  { id: 'student2', firstName: 'Bob', lastName: 'Brown' },
];

let mockTimeEntries = [];
let lastTimeEntryOptions;

vi.mock('../utils/firebase', () => ({ db: {} }));

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

vi.mock('../contexts/EventContext', () => ({
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

vi.mock('../hooks/useTimeEntries', () => ({
  useTimeEntries: (options) => {
    lastTimeEntryOptions = options;
    return {
      timeEntries: mockTimeEntries,
      loading: false
    };
  }
}));

describe('ActivityPage', () => {
  beforeEach(() => {
    mockTimeEntries = [];
    lastTimeEntryOptions = undefined;
  });

  it('loads all activity for the selected event', async () => {
    mockTimeEntries = [
      {
        id: 'entry1',
        studentId: 'student1',
        activityId: 'activity1',
        checkInTime: new Date('2026-06-13T09:00:00'),
        checkInMethod: 'av_scan',
      },
      {
        id: 'entry2',
        studentId: 'student2',
        activityId: 'activity2',
        checkInTime: new Date('2026-06-14T09:00:00'),
        checkOutTime: new Date('2026-06-14T12:00:00'),
        checkInMethod: 'self_scan',
        checkOutMethod: 'manual',
      }
    ];

    render(<ActivityPage />);

    expect(lastTimeEntryOptions).toMatchObject({
      eventId: 'event1',
      date: null,
      realtime: true
    });

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByText('All activity for VBS 2026')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Alice Adams')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Bob Brown')).toHaveLength(2);
    expect(screen.getByText('Morning Session via AV scan')).toBeInTheDocument();
    expect(screen.getByText('Afternoon Session via manual')).toBeInTheDocument();
  });

  it('filters activity by search, activity, and action', async () => {
    const user = userEvent.setup();
    mockTimeEntries = [
      {
        id: 'entry1',
        studentId: 'student1',
        activityId: 'activity1',
        checkInTime: new Date('2026-06-13T09:00:00'),
        checkInMethod: 'av_scan',
      },
      {
        id: 'entry2',
        studentId: 'student2',
        activityId: 'activity2',
        checkInTime: new Date('2026-06-14T09:00:00'),
        checkOutTime: new Date('2026-06-14T12:00:00'),
        checkInMethod: 'self_scan',
        checkOutMethod: 'manual',
      }
    ];

    render(<ActivityPage />);

    await screen.findByText('Alice Adams');
    expect(screen.getByText('Showing 1-3 of 3 activity items')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search activity'), 'Alice');
    expect(screen.getByText('Showing 1-1 of 1 activity items')).toBeInTheDocument();
    expect(screen.getByText('Alice Adams')).toBeInTheDocument();
    expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.selectOptions(screen.getByLabelText('Activity'), 'activity2');
    expect(screen.getByText('Showing 1-2 of 2 activity items')).toBeInTheDocument();
    expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument();
    expect(screen.getAllByText('Bob Brown')).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText('Action'), 'Check-Out');
    expect(screen.getByText('Showing 1-1 of 1 activity items')).toBeInTheDocument();
    const feed = screen.getByRole('list', { name: 'Activity feed' });
    expect(within(feed).getByText('Check-Out')).toBeInTheDocument();
    expect(within(feed).queryByText('Check-In')).not.toBeInTheDocument();
  });

  it('paginates long activity lists', async () => {
    const user = userEvent.setup();
    mockTimeEntries = Array.from({ length: 30 }, (_, index) => ({
      id: `entry-${index}`,
      studentId: 'student1',
      activityId: 'activity1',
      checkInTime: new Date(`2026-06-14T09:${String(index).padStart(2, '0')}:00`),
      checkInMethod: 'av_scan',
    }));

    render(<ActivityPage />);

    await screen.findByText('Showing 1-25 of 30 activity items');
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Showing 26-30 of 30 activity items')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
