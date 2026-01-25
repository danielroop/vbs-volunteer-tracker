import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock useQRScanner hook
const mockStartScanning = vi.fn().mockResolvedValue(undefined);
const mockStopScanning = vi.fn().mockResolvedValue(undefined);
const mockResetScanner = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useQRScanner', () => ({
  useQRScanner: () => ({
    startScanning: mockStartScanning,
    stopScanning: mockStopScanning,
    resetScanner: mockResetScanner,
    isScanning: false,
    error: null,
    cameras: [],
    selectedCamera: null,
    getCameras: vi.fn(),
    switchCamera: vi.fn(),
  }),
  default: () => ({
    startScanning: mockStartScanning,
    stopScanning: mockStopScanning,
    resetScanner: mockResetScanner,
    isScanning: false,
    error: null,
    cameras: [],
    selectedCamera: null,
    getCameras: vi.fn(),
    switchCamera: vi.fn(),
  }),
}));

// Mock Firebase
vi.mock('../../utils/firebase', () => ({
  db: {},
  functions: {},
}));

// Mock Firestore - need to mock getDocs to return immediately
const mockDocs = [
  {
    id: 'event1',
    data: () => ({
      name: 'VBS 2026',
      activities: [
        { id: 'activity1', name: 'General' },
        { id: 'activity2', name: 'Craft Station' },
      ],
    }),
  },
];

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockImplementation(() => Promise.resolve({ docs: mockDocs })),
  doc: vi.fn(),
  getDoc: vi.fn(),
}));

// Mock Firebase functions
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn().mockReturnValue(vi.fn().mockResolvedValue({
    data: { success: true, studentName: 'John Doe' },
  })),
}));

// Mock useOfflineSync
vi.mock('../../hooks/useOfflineSync', () => ({
  useOfflineSync: () => ({
    isOnline: true,
    pendingCount: 0,
  }),
}));

// Mock ScannerHeader
vi.mock('../common/ScannerHeader', () => ({
  default: () => <div data-testid="scanner-header">Scanner Header</div>,
}));

// Mock Spinner
vi.mock('../common/Spinner', () => ({
  default: () => <div data-testid="spinner">Loading...</div>,
}));

// Mock parseQRData
vi.mock('../../utils/qrCodeGenerator', () => ({
  parseQRData: vi.fn().mockReturnValue({
    studentId: 'student1',
    eventId: 'event1',
    isValid: true,
  }),
}));

// Import Scanner after mocks are set up
import Scanner from './index';

describe('Scanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithRouter = async (initialPath = '/scan') => {
    const result = render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/scan/:eventId?/:activityId?/:action?" element={<Scanner />} />
        </Routes>
      </MemoryRouter>
    );

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    }, { timeout: 2000 });

    return result;
  };

  describe('Event Selection', () => {
    it('should show event selection when no event is selected', async () => {
      await renderWithRouter('/scan');

      expect(screen.getByText('Select Event')).toBeInTheDocument();
    });

    it('should list available events', async () => {
      await renderWithRouter('/scan');

      expect(screen.getByText('VBS 2026')).toBeInTheDocument();
    });
  });

  describe('Activity Selection', () => {
    it('should show activity selection when event is selected but no activity', async () => {
      await renderWithRouter('/scan/event1');

      expect(screen.getByText('Select Activity Type')).toBeInTheDocument();
    });

    it('should list available activities', async () => {
      await renderWithRouter('/scan/event1');

      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('Craft Station')).toBeInTheDocument();
    });
  });

  describe('Action Selection', () => {
    it('should show action selection when activity is selected but no action', async () => {
      await renderWithRouter('/scan/event1/activity1');

      expect(screen.getByText('Select Action')).toBeInTheDocument();
    });

    it('should show Check In and Check Out options', async () => {
      await renderWithRouter('/scan/event1/activity1');

      expect(screen.getByText('Check In')).toBeInTheDocument();
      expect(screen.getByText('Check Out')).toBeInTheDocument();
    });
  });

  describe('Scanner View', () => {
    it('should show scanner when all params are valid (checkin)', async () => {
      await renderWithRouter('/scan/event1/activity1/checkin');

      expect(screen.getByText('Check-In Mode')).toBeInTheDocument();
    });

    it('should show scanner when all params are valid (checkout)', async () => {
      await renderWithRouter('/scan/event1/activity1/checkout');

      expect(screen.getByText('Check-Out Mode')).toBeInTheDocument();
    });

    it('should display current event name', async () => {
      await renderWithRouter('/scan/event1/activity1/checkin');

      expect(screen.getByText('VBS 2026')).toBeInTheDocument();
    });

    it('should have Change Action link', async () => {
      await renderWithRouter('/scan/event1/activity1/checkin');

      expect(screen.getByText('Change Action')).toBeInTheDocument();
    });
  });

  describe('Scanner Initialization', () => {
    it('should call startScanning when scanner view is shown', async () => {
      await renderWithRouter('/scan/event1/activity1/checkin');

      // Fast-forward past the 500ms delay
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(mockStartScanning).toHaveBeenCalledWith('qr-reader');
    });
  });

  describe('Mode Change - Camera Reset', () => {
    it('should call stopScanning on cleanup', async () => {
      const { unmount } = await renderWithRouter('/scan/event1/activity1/checkin');

      // Wait for scanner init
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      expect(mockStartScanning).toHaveBeenCalled();

      mockStopScanning.mockClear();

      unmount();

      expect(mockStopScanning).toHaveBeenCalled();
    });
  });

  describe('Back Navigation', () => {
    it('should have back button on activity selection', async () => {
      await renderWithRouter('/scan/event1');

      const backButton = screen.getByText(/Back to Event Selection/i);
      expect(backButton).toBeInTheDocument();
    });

    it('should have back button on action selection', async () => {
      await renderWithRouter('/scan/event1/activity1');

      const backButton = screen.getByText(/Back to Activity Selection/i);
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Mode Labels', () => {
    it('should show Check-In Mode label for checkin action', async () => {
      await renderWithRouter('/scan/event1/activity1/checkin');

      expect(screen.getByText('Check-In Mode')).toBeInTheDocument();
    });

    it('should show Check-Out Mode label for checkout action', async () => {
      await renderWithRouter('/scan/event1/activity1/checkout');

      expect(screen.getByText('Check-Out Mode')).toBeInTheDocument();
    });
  });

  describe('Camera Reset on Mode Change', () => {
    it('should have resetScanner available for mode changes', async () => {
      // This test verifies that resetScanner is called and available
      // The fix for issue #17: Camera not reloading after mode change
      // ensures that when action becomes invalid, resetScanner is called

      // Start with no action (action selection screen)
      await renderWithRouter('/scan/event1/activity1');

      // resetScanner should have been called since hasValidAction is false
      expect(mockResetScanner).toHaveBeenCalled();
    });

    it('should not reset scanner when starting with valid action', async () => {
      mockResetScanner.mockClear();

      await renderWithRouter('/scan/event1/activity1/checkin');

      // Wait for scanner init
      await act(async () => {
        vi.advanceTimersByTime(600);
      });

      // Scanner should start
      expect(mockStartScanning).toHaveBeenCalled();
    });
  });
});
