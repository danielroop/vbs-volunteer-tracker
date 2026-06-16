import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CheckHoursPage from './CheckHoursPage';

const mockCheckHoursLogged = vi.fn();

vi.mock('../utils/firebase', () => ({
  functions: {},
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCheckHoursLogged),
}));

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    static getCameras = vi.fn().mockResolvedValue([]);
    start = vi.fn().mockResolvedValue(undefined);
    stop = vi.fn().mockResolvedValue(undefined);
    clear = vi.fn();
  },
}));

describe('CheckHoursPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckHoursLogged.mockResolvedValue({
      data: {
        success: true,
        scannedEventId: 'event2',
        student: {
          id: 'student1',
          firstName: 'Jane',
          lastName: 'Smith',
          fullName: 'Jane Smith',
          schoolName: 'Central High',
          gradeLevel: '10',
        },
        schoolForm: { id: 'central-template', name: 'Central High School Form' },
        totalHours: 5,
        events: [
          {
            id: 'event1',
            name: 'Setup Day',
            totalHours: 2,
            entries: [
              {
                id: 'entry1',
                activityName: 'Decorating',
                date: '2026-06-13',
                checkInTime: '2026-06-13T14:00:00.000Z',
                checkOutTime: '2026-06-13T16:00:00.000Z',
                hours: 2,
              },
            ],
          },
          {
            id: 'event2',
            name: 'VBS 2026',
            totalHours: 3,
            entries: [
              {
                id: 'entry2',
                activityName: 'Work Hours',
                date: '2026-06-15',
                checkInTime: '2026-06-15T13:00:00.000Z',
                checkOutTime: '2026-06-15T16:00:00.000Z',
                hours: 3,
              },
            ],
          },
        ],
      },
    });
  });

  it('looks up badge data and shows the scanned student profile', async () => {
    render(<CheckHoursPage />);

    act(() => {
      fireEvent.change(screen.getByLabelText(/QR code text/i), {
        target: { value: 'student1' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    expect(mockCheckHoursLogged).toHaveBeenCalledWith({ qrData: 'student1' });
    expect(screen.getByText('Central High')).toBeInTheDocument();
    expect(screen.getByText('All Credited Hours')).toBeInTheDocument();
    expect(screen.getByText('5.00 hours')).toBeInTheDocument();
    expect(screen.getByText('School Form')).toBeInTheDocument();
    expect(screen.getByText('Central High School Form')).toBeInTheDocument();
  });

  it('shows a fallback when no school form is configured', async () => {
    mockCheckHoursLogged.mockResolvedValueOnce({
      data: {
        success: true,
        scannedEventId: null,
        student: {
          id: 'student1',
          firstName: 'Jane',
          lastName: 'Smith',
          fullName: 'Jane Smith',
          schoolName: 'Central High',
          gradeLevel: '10',
        },
        schoolForm: null,
        totalHours: 0,
        events: [],
      },
    });

    render(<CheckHoursPage />);

    act(() => {
      fireEvent.change(screen.getByLabelText(/QR code text/i), {
        target: { value: 'student1' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('No form configured')).toBeInTheDocument();
    });
  });

  it('asks which event to inspect before showing event details', async () => {
    render(<CheckHoursPage />);

    act(() => {
      fireEvent.change(screen.getByLabelText(/QR code text/i), {
        target: { value: 'student1' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Continue/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Which event are you interested in/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Choose an event to see the credited hours/i)).toBeInTheDocument();
    expect(screen.queryByText('Work Hours')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /VBS 2026/i }));
    });

    expect(screen.getByRole('heading', { name: 'VBS 2026' })).toBeInTheDocument();
    expect(screen.getByText('Work Hours')).toBeInTheDocument();
  });
});
