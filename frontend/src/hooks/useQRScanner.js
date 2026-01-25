import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseQRData } from '../utils/qrCodeGenerator';

/**
 * Hook for managing QR code scanning
 * @param {Object} options - Scanner options
 * @param {Function} options.onSuccess - Callback when QR code successfully scanned
 * @param {Function} options.onError - Callback when scan error occurs
 * @param {number} options.fps - Frames per second (default: 10)
 * @param {Object} options.qrbox - QR box dimensions
 */
export function useQRScanner(options = {}) {
  const {
    onSuccess,
    onError,
    fps = 10,
    qrbox = { width: 250, height: 250 }
  } = options;

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const scannerRef = useRef(null);
  // Track if scanner is in the process of starting or stopping to prevent race conditions
  const isTransitioning = useRef(false);

  /**
   * Get available cameras
   */
  const getCameras = useCallback(async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      setCameras(devices);
      if (devices.length > 0) {
        // Prefer back camera on mobile
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back'));
        setSelectedCamera(backCamera?.id || devices[0].id);
      }
      return devices;
    } catch (err) {
      console.error('Error getting cameras:', err);
      setError('Failed to access camera. Please check permissions.');
      return [];
    }
  }, []);

  /**
   * Start scanning
   */
  const startScanning = useCallback(async (elementId) => {
    // Prevent starting if already scanning or in the middle of a transition
    if (isScanning || isTransitioning.current) {
      console.warn('Scanner already running or transitioning');
      return;
    }

    isTransitioning.current = true;

    try {
      // Get cameras if not already fetched
      if (cameras.length === 0) {
        await getCameras();
      }

      // Clean up any existing scanner instance before creating a new one
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (cleanupErr) {
          // Ignore cleanup errors - scanner might already be stopped
          console.warn('Cleanup before start:', cleanupErr);
        }
        scannerRef.current = null;
      }

      // Initialize scanner
      const scanner = new Html5Qrcode(elementId);
      scannerRef.current = scanner;

      const config = {
        fps,
        qrbox,
        aspectRatio: 1.0,
      };

      // Start scanning
      await scanner.start(
        selectedCamera || { facingMode: 'environment' },
        config,
        (decodedText) => {
          // Parse and validate QR code
          const parsed = parseQRData(decodedText);

          if (parsed.isValid) {
            onSuccess?.({
              studentId: parsed.studentId,
              eventId: parsed.eventId,
              rawData: decodedText
            });
          } else {
            onError?.({ message: parsed.error || 'Invalid QR code' });
          }
        },
        (errorMessage) => {
          // Don't spam console with "NotFoundException" errors (normal when no QR in view)
          if (!errorMessage.includes('NotFoundException')) {
            console.warn('QR Scan error:', errorMessage);
          }
        }
      );

      setIsScanning(true);
      setError(null);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start scanner. Please check camera permissions.');
      setIsScanning(false);
      scannerRef.current = null;
    } finally {
      isTransitioning.current = false;
    }
  }, [isScanning, cameras, selectedCamera, fps, qrbox, onSuccess, onError, getCameras]);

  /**
   * Stop scanning
   */
  const stopScanning = useCallback(async () => {
    // If transitioning, wait a bit and try again
    if (isTransitioning.current) {
      console.warn('Scanner is transitioning, waiting to stop...');
      return;
    }

    // Stop even if isScanning state hasn't updated yet (handles race conditions)
    if (!scannerRef.current) {
      setIsScanning(false);
      return;
    }

    isTransitioning.current = true;

    try {
      const scanner = scannerRef.current;
      scannerRef.current = null;

      // Check if scanner is actually running before stopping
      const state = scanner.getState();
      if (state === 2) { // Html5QrcodeScannerState.SCANNING = 2
        await scanner.stop();
      }
      scanner.clear();
      setIsScanning(false);
    } catch (err) {
      console.error('Error stopping scanner:', err);
      // Ensure state is reset even on error
      setIsScanning(false);
    } finally {
      isTransitioning.current = false;
    }
  }, []);

  /**
   * Switch camera
   */
  const switchCamera = useCallback(async (cameraId) => {
    if (isScanning) {
      await stopScanning();
    }
    setSelectedCamera(cameraId);
  }, [isScanning, stopScanning]);

  /**
   * Force reset scanner state (useful when switching modes)
   */
  const resetScanner = useCallback(async () => {
    isTransitioning.current = true;

    try {
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2) { // SCANNING state
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (err) {
          console.warn('Error during scanner reset:', err);
        }
        scannerRef.current = null;
      }
      setIsScanning(false);
      setError(null);
    } finally {
      isTransitioning.current = false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Force cleanup without waiting for state
      if (scannerRef.current) {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        try {
          scanner.stop().catch(() => {});
          scanner.clear();
        } catch (err) {
          // Ignore cleanup errors on unmount
        }
      }
      isTransitioning.current = false;
    };
  }, []);

  return {
    isScanning,
    error,
    cameras,
    selectedCamera,
    startScanning,
    stopScanning,
    switchCamera,
    getCameras,
    resetScanner,
  };
}

export default useQRScanner;
