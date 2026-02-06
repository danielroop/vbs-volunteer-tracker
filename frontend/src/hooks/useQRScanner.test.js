import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQRScanner } from './useQRScanner';

// Mock html5-qrcode
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockClear = vi.fn();
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockGetCameras = vi.fn().mockResolvedValue([
  { id: 'camera1', label: 'Front Camera' },
  { id: 'camera2', label: 'Back Camera' },
]);

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    clear: mockClear,
  })),
}));

// Access Html5Qrcode to set static method
import { Html5Qrcode } from 'html5-qrcode';
Html5Qrcode.getCameras = mockGetCameras;

// Mock parseQRData
vi.mock('../utils/qrCodeGenerator', () => ({
  parseQRData: vi.fn((text) => ({
    isValid: true,
    studentId: 'student1',
    eventId: 'event1',
  })),
}));

describe('useQRScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStop.mockResolvedValue(undefined);
    mockStart.mockResolvedValue(undefined);
    mockGetCameras.mockResolvedValue([
      { id: 'camera1', label: 'Front Camera' },
      { id: 'camera2', label: 'Back Camera' },
    ]);
  });

  describe('startScanning', () => {
    it('should start the scanner and set isScanning to true', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);
      expect(Html5Qrcode).toHaveBeenCalledWith('qr-reader');
      expect(mockStart).toHaveBeenCalled();
    });

    it('should not start if already scanning', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      const callCount = Html5Qrcode.mock.calls.length;

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      // Should not have created a new instance
      expect(Html5Qrcode.mock.calls.length).toBe(callCount);
    });

    it('should fetch cameras if none are available', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(mockGetCameras).toHaveBeenCalled();
    });

    it('should prefer back camera', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.getCameras();
      });

      expect(result.current.selectedCamera).toBe('camera2');
    });

    it('should set error on start failure', async () => {
      mockStart.mockRejectedValueOnce(new Error('Camera permission denied'));

      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(false);
      expect(result.current.error).toBe('Failed to start scanner. Please check camera permissions.');
    });

    it('should clean up existing scanner instance before starting a new one', async () => {
      const { result } = renderHook(() => useQRScanner());

      // Start scanning
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      // Stop scanning
      await act(async () => {
        await result.current.stopScanning();
      });

      // Reset mocks to track new calls
      mockStop.mockClear();
      mockClear.mockClear();

      // Start scanning again
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);
      expect(mockStart).toHaveBeenCalled();
    });
  });

  describe('stopScanning', () => {
    it('should stop the scanner and set isScanning to false', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);

      await act(async () => {
        await result.current.stopScanning();
      });

      expect(result.current.isScanning).toBe(false);
      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
    });

    it('should handle stop errors gracefully and still reset state', async () => {
      mockStop.mockRejectedValueOnce(new Error('Scanner already stopped'));

      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);

      await act(async () => {
        await result.current.stopScanning();
      });

      // isScanning should be false even after error (finally block)
      expect(result.current.isScanning).toBe(false);
    });

    it('should handle being called when no scanner exists', async () => {
      const { result } = renderHook(() => useQRScanner());

      // Should not throw
      await act(async () => {
        await result.current.stopScanning();
      });

      expect(result.current.isScanning).toBe(false);
    });

    it('should not call scanner.stop() if scanner was never started (avoids "not running" error)', async () => {
      // This simulates the case where stopScanning is called during cleanup
      // before startScanning has completed (e.g., effect re-triggered by
      // getCameras updating state)
      const { result } = renderHook(() => useQRScanner());

      // stopScanning called without ever starting - should not call .stop()
      await act(async () => {
        await result.current.stopScanning();
      });

      expect(mockStop).not.toHaveBeenCalled();
      expect(result.current.isScanning).toBe(false);
    });
  });

  describe('restart after stop (mode change scenario)', () => {
    it('should allow restarting scanner after stop', async () => {
      const { result } = renderHook(() => useQRScanner());

      // First start
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });
      expect(result.current.isScanning).toBe(true);

      // Stop (simulates mode change cleanup)
      await act(async () => {
        await result.current.stopScanning();
      });
      expect(result.current.isScanning).toBe(false);

      // Restart (simulates new mode start)
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });
      expect(result.current.isScanning).toBe(true);
    });

    it('should allow restarting after stop error (DOM removed scenario)', async () => {
      const { result } = renderHook(() => useQRScanner());

      // Start
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });
      expect(result.current.isScanning).toBe(true);

      // Stop fails (e.g., DOM element was already removed during navigation)
      mockStop.mockRejectedValueOnce(new Error('Element not found'));

      await act(async () => {
        await result.current.stopScanning();
      });

      // Must be false despite error - this is the critical fix
      expect(result.current.isScanning).toBe(false);

      // Should be able to start again
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });
      expect(result.current.isScanning).toBe(true);
    });

    it('should handle rapid stop-start cycles', async () => {
      const { result } = renderHook(() => useQRScanner());

      // Cycle 1
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });
      await act(async () => {
        await result.current.stopScanning();
      });

      // Cycle 2
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });
      await act(async () => {
        await result.current.stopScanning();
      });

      // Cycle 3
      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);
    });
  });

  describe('switchCamera', () => {
    it('should stop scanning before switching camera', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      await act(async () => {
        await result.current.switchCamera('camera1');
      });

      expect(mockStop).toHaveBeenCalled();
      expect(result.current.selectedCamera).toBe('camera1');
    });

    it('should switch camera without stopping if not scanning', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.switchCamera('camera1');
      });

      expect(mockStop).not.toHaveBeenCalled();
      expect(result.current.selectedCamera).toBe('camera1');
    });
  });

  describe('cleanup on unmount', () => {
    it('should stop scanner on unmount', async () => {
      const { result, unmount } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      unmount();

      expect(mockStop).toHaveBeenCalled();
    });
  });
});
