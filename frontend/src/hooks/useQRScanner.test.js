import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Define mock functions at module scope
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockClear = vi.fn();
const mockGetState = vi.fn().mockReturnValue(2);

// Mock html5-qrcode before importing the hook
vi.mock('html5-qrcode', () => {
  const MockHtml5Qrcode = vi.fn().mockImplementation(() => ({
    start: mockStart,
    stop: mockStop,
    clear: mockClear,
    getState: mockGetState,
  }));

  MockHtml5Qrcode.getCameras = vi.fn().mockResolvedValue([
    { id: 'camera1', label: 'Front Camera' },
    { id: 'camera2', label: 'Back Camera' },
  ]);

  return { Html5Qrcode: MockHtml5Qrcode };
});

vi.mock('../utils/qrCodeGenerator', () => ({
  parseQRData: vi.fn().mockImplementation((data) => {
    if (data === 'valid|event123|checksum') {
      return {
        studentId: 'valid',
        eventId: 'event123',
        isValid: true,
      };
    }
    return {
      isValid: false,
      error: 'Invalid QR code',
    };
  }),
}));

// Import after mocks are set up
import { useQRScanner } from './useQRScanner';
import { Html5Qrcode } from 'html5-qrcode';

describe('useQRScanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetState.mockReturnValue(2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useQRScanner());

      expect(result.current.isScanning).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.cameras).toEqual([]);
      expect(result.current.selectedCamera).toBe(null);
    });

    it('should provide all required functions', () => {
      const { result } = renderHook(() => useQRScanner());

      expect(typeof result.current.startScanning).toBe('function');
      expect(typeof result.current.stopScanning).toBe('function');
      expect(typeof result.current.switchCamera).toBe('function');
      expect(typeof result.current.getCameras).toBe('function');
      expect(typeof result.current.resetScanner).toBe('function');
    });
  });

  describe('getCameras', () => {
    it('should fetch available cameras', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.getCameras();
      });

      expect(result.current.cameras).toHaveLength(2);
      expect(result.current.cameras[0].id).toBe('camera1');
    });

    it('should prefer back camera on mobile', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.getCameras();
      });

      expect(result.current.selectedCamera).toBe('camera2');
    });

    it('should handle camera access errors', async () => {
      Html5Qrcode.getCameras.mockRejectedValueOnce(new Error('Camera access denied'));

      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.getCameras();
      });

      expect(result.current.error).toBe('Failed to access camera. Please check permissions.');
    });
  });

  describe('startScanning', () => {
    it('should start scanning successfully', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(Html5Qrcode).toHaveBeenCalledWith('qr-reader');
      expect(mockStart).toHaveBeenCalled();
      expect(result.current.isScanning).toBe(true);
    });

    it('should not start if already scanning', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      Html5Qrcode.mockClear();
      mockStart.mockClear();

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(Html5Qrcode).not.toHaveBeenCalled();
    });

    it('should handle start errors', async () => {
      mockStart.mockRejectedValueOnce(new Error('Start failed'));

      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(false);
      expect(result.current.error).toBe('Failed to start scanner. Please check camera permissions.');
    });
  });

  describe('stopScanning', () => {
    it('should stop scanning successfully', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);

      await act(async () => {
        await result.current.stopScanning();
      });

      expect(mockStop).toHaveBeenCalled();
      expect(mockClear).toHaveBeenCalled();
      expect(result.current.isScanning).toBe(false);
    });

    it('should handle stop errors gracefully', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      mockStop.mockRejectedValueOnce(new Error('Stop failed'));

      await act(async () => {
        await result.current.stopScanning();
      });

      expect(result.current.isScanning).toBe(false);
    });

    it('should be safe to call when not scanning', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.stopScanning();
      });

      expect(result.current.isScanning).toBe(false);
    });
  });

  describe('resetScanner', () => {
    it('should reset scanner state', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(result.current.isScanning).toBe(true);

      await act(async () => {
        await result.current.resetScanner();
      });

      expect(result.current.isScanning).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it('should allow restart after reset', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      await act(async () => {
        await result.current.resetScanner();
      });

      Html5Qrcode.mockClear();
      mockStart.mockClear();

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      expect(Html5Qrcode).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalled();
      expect(result.current.isScanning).toBe(true);
    });
  });

  describe('switchCamera', () => {
    it('should update selected camera', async () => {
      const { result } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.switchCamera('newCameraId');
      });

      expect(result.current.selectedCamera).toBe('newCameraId');
    });
  });

  describe('callbacks', () => {
    it('should call onSuccess with parsed data on valid QR scan', async () => {
      const onSuccess = vi.fn();

      let scanSuccessCallback;
      mockStart.mockImplementation((_, __, onScanSuccess) => {
        scanSuccessCallback = onScanSuccess;
        return Promise.resolve();
      });

      const { result } = renderHook(() => useQRScanner({ onSuccess }));

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      act(() => {
        scanSuccessCallback('valid|event123|checksum');
      });

      expect(onSuccess).toHaveBeenCalledWith({
        studentId: 'valid',
        eventId: 'event123',
        rawData: 'valid|event123|checksum',
      });
    });

    it('should call onError for invalid QR code', async () => {
      const onError = vi.fn();

      let scanSuccessCallback;
      mockStart.mockImplementation((_, __, onScanSuccess) => {
        scanSuccessCallback = onScanSuccess;
        return Promise.resolve();
      });

      const { result } = renderHook(() => useQRScanner({ onError }));

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      act(() => {
        scanSuccessCallback('invalid-qr-data');
      });

      expect(onError).toHaveBeenCalledWith({
        message: 'Invalid QR code',
      });
    });
  });

  describe('cleanup on unmount', () => {
    it('should cleanup scanner on unmount', async () => {
      const { result, unmount } = renderHook(() => useQRScanner());

      await act(async () => {
        await result.current.startScanning('qr-reader');
      });

      unmount();

      expect(mockStop).toHaveBeenCalled();
    });
  });
});
