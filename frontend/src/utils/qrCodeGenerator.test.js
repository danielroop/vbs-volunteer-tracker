import { describe, it, expect, vi } from 'vitest';
import {
  validateChecksum,
  generateQRData,
  parseQRData,
  generateQRCodeImage,
  generateQRCodeSVG,
} from './qrCodeGenerator';

// Mock qrcode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockImageData'),
    toString: vi.fn().mockResolvedValue('<svg>mock svg</svg>'),
  },
}));

describe('qrCodeGenerator', () => {
  describe('generateQRData', () => {
    it('should generate QR data in correct format', () => {
      const result = generateQRData('student123', 'event456');
      const parts = result.split('|');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('student123');
      expect(parts[1]).toBe('event456');
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // Checksum is alphanumeric
    });

    it('should generate consistent checksum for same input', () => {
      const result1 = generateQRData('student123', 'event456');
      const result2 = generateQRData('student123', 'event456');

      expect(result1).toBe(result2);
    });

    it('should generate different checksum for different students', () => {
      const result1 = generateQRData('studentA', 'event456');
      const result2 = generateQRData('studentB', 'event456');

      const checksum1 = result1.split('|')[2];
      const checksum2 = result2.split('|')[2];

      expect(checksum1).not.toBe(checksum2);
    });

    it('should generate different checksum for different events', () => {
      const result1 = generateQRData('student123', 'eventA');
      const result2 = generateQRData('student123', 'eventB');

      const checksum1 = result1.split('|')[2];
      const checksum2 = result2.split('|')[2];

      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('validateChecksum', () => {
    it('should return true for valid checksum', () => {
      const qrData = generateQRData('student123', 'event456');
      const [studentId, eventId, checksum] = qrData.split('|');

      expect(validateChecksum(studentId, eventId, checksum)).toBe(true);
    });

    it('should return false for invalid checksum', () => {
      expect(validateChecksum('student123', 'event456', 'invalid')).toBe(false);
    });

    it('should return false for tampered studentId', () => {
      const qrData = generateQRData('student123', 'event456');
      const [, eventId, checksum] = qrData.split('|');

      expect(validateChecksum('tamperedStudent', eventId, checksum)).toBe(false);
    });

    it('should return false for tampered eventId', () => {
      const qrData = generateQRData('student123', 'event456');
      const [studentId, , checksum] = qrData.split('|');

      expect(validateChecksum(studentId, 'tamperedEvent', checksum)).toBe(false);
    });
  });

  describe('parseQRData', () => {
    it('should parse valid QR data correctly', () => {
      const qrData = generateQRData('student123', 'event456');
      const result = parseQRData(qrData);

      expect(result.studentId).toBe('student123');
      expect(result.eventId).toBe('event456');
      expect(result.isValid).toBe(true);
    });

    it('should return isValid: false for invalid format (too few parts)', () => {
      const result = parseQRData('student123|event456');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid QR code format');
    });

    it('should return isValid: false for invalid format (too many parts)', () => {
      const result = parseQRData('student123|event456|checksum|extra');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid QR code format');
    });

    it('should return isValid: false for tampered checksum', () => {
      const result = parseQRData('student123|event456|wrongchecksum');

      expect(result.studentId).toBe('student123');
      expect(result.eventId).toBe('event456');
      expect(result.isValid).toBe(false);
    });

    it('should handle empty string', () => {
      const result = parseQRData('');

      expect(result.isValid).toBe(false);
    });

    it('should handle string with only delimiters', () => {
      const result = parseQRData('||');

      expect(result.isValid).toBe(false);
    });
  });

  describe('generateQRCodeImage', () => {
    it('should return a data URL', async () => {
      const result = await generateQRCodeImage('student123', 'event456');

      expect(result).toMatch(/^data:image/);
    });

    it('should pass correct QR data to library', async () => {
      const QRCode = await import('qrcode');

      await generateQRCodeImage('student123', 'event456');

      expect(QRCode.default.toDataURL).toHaveBeenCalled();
      const calledWith = QRCode.default.toDataURL.mock.calls[0][0];
      expect(calledWith).toContain('student123');
      expect(calledWith).toContain('event456');
    });

    it('should accept custom options', async () => {
      const QRCode = await import('qrcode');

      await generateQRCodeImage('student123', 'event456', { width: 500 });

      expect(QRCode.default.toDataURL).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ width: 500 })
      );
    });
  });

  describe('generateQRCodeSVG', () => {
    it('should return an SVG string', async () => {
      const result = await generateQRCodeSVG('student123', 'event456');

      expect(result).toContain('svg');
    });

    it('should pass correct QR data to library', async () => {
      const QRCode = await import('qrcode');

      await generateQRCodeSVG('student123', 'event456');

      expect(QRCode.default.toString).toHaveBeenCalled();
      const calledWith = QRCode.default.toString.mock.calls[0][0];
      expect(calledWith).toContain('student123');
      expect(calledWith).toContain('event456');
    });
  });

  describe('QR Code security', () => {
    it('should generate unique checksums for all unique student-event combinations', () => {
      const combinations = [
        ['student1', 'event1'],
        ['student1', 'event2'],
        ['student2', 'event1'],
        ['student2', 'event2'],
      ];

      const checksums = combinations.map(([s, e]) => {
        const data = generateQRData(s, e);
        return data.split('|')[2];
      });

      const uniqueChecksums = new Set(checksums);
      expect(uniqueChecksums.size).toBe(combinations.length);
    });

    it('checksum should be at most 6 characters', () => {
      const qrData = generateQRData('verylongstudentid123456789', 'verylongeventid987654321');
      const checksum = qrData.split('|')[2];

      expect(checksum.length).toBeLessThanOrEqual(6);
    });
  });
});
