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
  const isScanningRef = useRef(false);

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
    if (isScanningRef.current) {
      console.warn('Scanner already running');
      return;
    }

    try {
      // Stop any existing scanner instance before starting a new one
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch (e) {
          // Ignore errors from stopping a scanner that's already stopped
        }
        scannerRef.current = null;
      }

      // Get cameras if not already fetched
      if (cameras.length === 0) {
        await getCameras();
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

      isScanningRef.current = true;
      setIsScanning(true);
      setError(null);
    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Failed to start scanner. Please check camera permissions.');
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, [cameras, selectedCamera, fps, qrbox, onSuccess, onError, getCameras]);

  /**
   * Stop scanning
   */
  const stopScanning = useCallback(async () => {
    if (!scannerRef.current || !isScanningRef.current) {
      scannerRef.current = null;
      isScanningRef.current = false;
      setIsScanning(false);
      return;
    }

    try {
      await scannerRef.current.stop();
      scannerRef.current.clear();
    } catch (err) {
      console.error('Error stopping scanner:', err);
    } finally {
      scannerRef.current = null;
      isScanningRef.current = false;
      setIsScanning(false);
    }
  }, []);

  /**
   * Switch camera
   */
  const switchCamera = useCallback(async (cameraId) => {
    if (isScanningRef.current) {
      await stopScanning();
    }
    setSelectedCamera(cameraId);
  }, [stopScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
        scannerRef.current = null;
        isScanningRef.current = false;
      }
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
  };
}

export default useQRScanner;
