import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Scanner from './index';

// Mock useQRScanner hook
const mockStartScanning = vi.fn().mockResolvedValue(undefined);
const mockStopScanning = vi.fn().mockResolvedValue(undefined);
const mockScanCallable = vi.hoisted(() => vi.fn());
const mockEvents = vi.hoisted(() => ([
  {
    id: 'event1',
    name: 'VBS 2026',
    typicalStartTime: '09:00',
    typicalEndTime: '15:00',
    activities: [
      { id: 'general', name: 'General' },
      { id: 'crafts', name: 'Crafts Station' },
    ],
  },
]));

vi.mock('../../hooks/useQRScanner', () => ({
  __esModule: true,
  default: vi.fn((options) => {
    // Store the options so tests can access onSuccess
    mockUseQRScannerOptions = options;
    return {
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      isScanning: false,
      error: null,
      cameras: [],
      selectedCamera: null,
      switchCamera: vi.fn(),
      getCameras: vi.fn(),
    };
  }),
  useQRScanner: vi.fn((options) => {
    mockUseQRScannerOptions = options;
    return {
      startScanning: mockStartScanning,
      stopScanning: mockStopScanning,
      isScanning: false,
      error: null,
      cameras: [],
      selectedCamera: null,
      switchCamera: vi.fn(),
      getCameras: vi.fn(),
    };
  }),
}));

let mockUseQRScannerOptions = null;

// Mock Firebase
vi.mock('../../utils/firebase', () => ({
  db: {},
  functions: {},
}));

// Mock Firestore
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn(),
    doc: vi.fn(),
    getDoc: vi.fn(() => Promise.resolve({
      exists: () => true,
      data: () => mockEvents[0],
      id: 'event1',
    })),
    getDocs: vi.fn(() => Promise.resolve({
      docs: mockEvents.map(e => ({
        id: e.id,
        data: () => e,
      })),
    })),
  };
});

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockScanCallable),
}));

// Mock parseQRData
vi.mock('../../utils/qrCodeGenerator', () => ({
  parseQRData: vi.fn(() => ({
    isValid: true,
    studentId: 'student1',
    eventId: 'event1',
  })),
}));

// Mock useOfflineSync
vi.mock('../../hooks/useOfflineSync', () => ({
  useOfflineSync: vi.fn(() => ({
    pendingItems: [],
    addToQueue: vi.fn(),
    processQueue: vi.fn(),
  })),
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin123', email: 'test@test.com', displayName: 'Auth Test User' },
    userProfile: { name: 'Test User', email: 'test@test.com', role: 'admin' },
    signOut: vi.fn(),
    canAccessAdmin: () => true,
  }),
}));

const renderScanner = (route = '/scan/event1/general/checkin') => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/scan" element={<Scanner />} />
        <Route path="/scan/:eventId" element={<Scanner />} />
        <Route path="/scan/:eventId/:activityId" element={<Scanner />} />
        <Route path="/scan/:eventId/:activityId/:action" element={<Scanner />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-01-31T12:00:00'));
    mockEvents[0] = {
      id: 'event1',
      name: 'VBS 2026',
      typicalStartTime: '09:00',
      typicalEndTime: '15:00',
      activities: [
        { id: 'general', name: 'General' },
        { id: 'crafts', name: 'Crafts Station' },
      ],
    };
    mockUseQRScannerOptions = null;
    mockScanCallable.mockResolvedValue({
      data: { success: true, studentName: 'Test Student' },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial scanner startup', () => {
    it('should start scanning when all params are valid', async () => {
      renderScanner('/scan/event1/general/checkin');

      // Advance past loading and the 500ms setTimeout
      await vi.advanceTimersByTimeAsync(600);

      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalledWith('qr-reader');
      });
    });

    it('should display correct mode label for check-in', async () => {
      renderScanner('/scan/event1/general/checkin');

      await waitFor(() => {
        expect(screen.getByText('Check-In Mode')).toBeInTheDocument();
      });
    });

    it('should display correct mode label for check-out', async () => {
      renderScanner('/scan/event1/general/checkout');

      await waitFor(() => {
        expect(screen.getByText('Check-Out Mode')).toBeInTheDocument();
      });
    });
  });

  describe('event selection', () => {
    it('should show event list when no event is selected', async () => {
      renderScanner('/scan');

      await waitFor(() => {
        expect(screen.getByText('Select Event')).toBeInTheDocument();
        expect(screen.getByText('VBS 2026')).toBeInTheDocument();
      });
    });
  });

  describe('activity selection', () => {
    it('should show active activities first and dated backup activities separately', async () => {
      mockEvents[0].activities = [
        {
          id: 'training',
          name: 'Training',
          startDate: '2026-01-30',
          endDate: '2026-01-30',
        },
        {
          id: 'work-hours',
          name: 'Work Hours',
          startDate: '2026-01-31',
          endDate: '2026-02-02',
        },
      ];

      renderScanner('/scan/event1');

      await waitFor(() => {
        expect(screen.getByText('Active Today')).toBeInTheDocument();
        expect(screen.getByText('Other Activities')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Work Hours/i })).toHaveAttribute('href', '/scan/event1/work-hours');
        expect(screen.getByRole('link', { name: /Training/i })).toHaveAttribute('href', '/scan/event1/training');
      });
    });

    it('should return to event selection when clicking the back button', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

      renderScanner('/scan/event1');

      await waitFor(() => {
        expect(screen.getByText('Select Activity Type')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Back to Event Selection/i }));

      await waitFor(() => {
        expect(screen.getByText('Select Event')).toBeInTheDocument();
      });
    });

    it('should allow direct scanner access to a backup activity', async () => {
      mockEvents[0].activities = [
        {
          id: 'training',
          name: 'Training',
          startDate: '2026-01-30',
          endDate: '2026-01-30',
        },
        {
          id: 'work-hours',
          name: 'Work Hours',
          startDate: '2026-01-31',
          endDate: '2026-02-02',
        },
      ];

      renderScanner('/scan/event1/training/checkin');

      await waitFor(() => {
        expect(screen.getByText('Training')).toBeInTheDocument();
        expect(screen.getByText('Check-In Mode')).toBeInTheDocument();
      });
    });
  });

  describe('action selection', () => {
    it('should show action selection when event and activity are set but no action', async () => {
      renderScanner('/scan/event1/general');

      await waitFor(() => {
        expect(screen.getByText('Select Action')).toBeInTheDocument();
        expect(screen.getByText('Check In')).toBeInTheDocument();
        expect(screen.getByText('Check Out')).toBeInTheDocument();
      });
    });
  });

  describe('mode change - camera reinitialization', () => {
    it('should call stopScanning when action becomes invalid (navigating to mode selection)', async () => {
      const { unmount } = renderScanner('/scan/event1/general/checkin');

      // Advance past setTimeout to start scanning
      await vi.advanceTimersByTimeAsync(600);

      await waitFor(() => {
        expect(mockStartScanning).toHaveBeenCalledWith('qr-reader');
      });

      // Unmount simulates navigation away (mode change)
      unmount();

      expect(mockStopScanning).toHaveBeenCalled();
    });

    it('should have a Change Action link that navigates to action selection', async () => {
      renderScanner('/scan/event1/general/checkin');

      await waitFor(() => {
        const changeLink = screen.getByText('Change Action');
        expect(changeLink).toBeInTheDocument();
        expect(changeLink.closest('a')).toHaveAttribute('href', '/scan/event1/general');
      });
    });

    it('should clear the startScanning timeout on cleanup to prevent stale calls', async () => {
      const { unmount } = renderScanner('/scan/event1/general/checkin');

      // Unmount before the 500ms timeout fires
      unmount();

      // Advance past the original timeout
      await vi.advanceTimersByTimeAsync(600);

      // startScanning should NOT have been called because the timeout was cleared
      expect(mockStartScanning).not.toHaveBeenCalled();
    });
  });

  describe('scanner view rendering', () => {
    it('should render the qr-reader element for the scanner', async () => {
      const { container } = renderScanner('/scan/event1/general/checkin');

      await waitFor(() => {
        const qrReader = container.querySelector('#qr-reader');
        expect(qrReader).toBeInTheDocument();
      });
    });

    it('should show event name and activity in scanner view', async () => {
      renderScanner('/scan/event1/general/checkin');

      await waitFor(() => {
        expect(screen.getByText('VBS 2026')).toBeInTheDocument();
        expect(screen.getByText('General')).toBeInTheDocument();
      });
    });

    it('should display the signed-in scanner name', async () => {
      renderScanner('/scan/event1/general/checkin');

      await waitFor(() => {
        expect(screen.getByText('Signed in as Test User')).toBeInTheDocument();
      });
    });
  });

  describe('scan logging identity', () => {
    it('should send signed-in scanner identity on check-in', async () => {
      renderScanner('/scan/event1/general/checkin');

      await waitFor(() => {
        expect(mockUseQRScannerOptions).not.toBeNull();
      });

      await mockUseQRScannerOptions.onSuccess('valid-qr');

      expect(mockScanCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student1',
          eventId: 'event1',
          activityId: 'general',
          scannedBy: 'admin123',
          scannedByName: 'Test User',
          method: 'av_scan',
        })
      );
    });

    it('should send av_scan method and signed-in scanner identity on check-out', async () => {
      renderScanner('/scan/event1/general/checkout');

      await waitFor(() => {
        expect(mockUseQRScannerOptions).not.toBeNull();
      });

      await mockUseQRScannerOptions.onSuccess('valid-qr');

      expect(mockScanCallable).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: 'student1',
          eventId: 'event1',
          activityId: 'general',
          scannedBy: 'admin123',
          scannedByName: 'Test User',
          method: 'av_scan',
        })
      );
    });
  });
});
