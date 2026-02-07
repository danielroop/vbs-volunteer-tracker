import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FIELD_KEY_OPTIONS,
  resolveFieldValue,
  generateFilledPdf,
  downloadPdf,
  getPdfPageDimensions,
} from './pdfTemplateUtils';
import { PDFDocument } from 'pdf-lib';

describe('pdfTemplateUtils', () => {
  describe('FIELD_KEY_OPTIONS', () => {
    it('should export an array of field key options', () => {
      expect(Array.isArray(FIELD_KEY_OPTIONS)).toBe(true);
      expect(FIELD_KEY_OPTIONS.length).toBeGreaterThan(0);
    });

    it('should have key and label for each option', () => {
      FIELD_KEY_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('key');
        expect(option).toHaveProperty('label');
        expect(typeof option.key).toBe('string');
        expect(typeof option.label).toBe('string');
      });
    });

    it('should include essential field keys', () => {
      const keys = FIELD_KEY_OPTIONS.map(o => o.key);
      expect(keys).toContain('studentName');
      expect(keys).toContain('firstName');
      expect(keys).toContain('lastName');
      expect(keys).toContain('totalHours');
      expect(keys).toContain('schoolName');
      expect(keys).toContain('gradYear');
      expect(keys).toContain('date');
      expect(keys).toContain('eventName');
    });
  });

  describe('resolveFieldValue', () => {
    const mockData = {
      student: {
        firstName: 'John',
        lastName: 'Doe',
        schoolName: 'Test High School',
        gradeLevel: '10',
        gradYear: 2028,
      },
      totalHours: 25.5,
      eventName: 'VBS 2026',
    };

    it('should resolve studentName', () => {
      expect(resolveFieldValue('studentName', mockData)).toBe('John Doe');
    });

    it('should resolve firstName', () => {
      expect(resolveFieldValue('firstName', mockData)).toBe('John');
    });

    it('should resolve lastName', () => {
      expect(resolveFieldValue('lastName', mockData)).toBe('Doe');
    });

    it('should resolve schoolName', () => {
      expect(resolveFieldValue('schoolName', mockData)).toBe('Test High School');
    });

    it('should resolve gradeLevel', () => {
      expect(resolveFieldValue('gradeLevel', mockData)).toBe('10');
    });

    it('should resolve gradYear', () => {
      expect(resolveFieldValue('gradYear', mockData)).toBe('2028');
    });

    it('should resolve totalHours with 2 decimal places', () => {
      expect(resolveFieldValue('totalHours', mockData)).toBe('25.50');
    });

    it('should resolve date to a valid date string', () => {
      const result = resolveFieldValue('date', mockData);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should resolve eventName', () => {
      expect(resolveFieldValue('eventName', mockData)).toBe('VBS 2026');
    });

    it('should return empty string for unknown field keys', () => {
      expect(resolveFieldValue('unknownKey', mockData)).toBe('');
    });

    it('should handle missing student data gracefully', () => {
      const emptyData = { student: {}, totalHours: 0, eventName: '' };
      expect(resolveFieldValue('studentName', emptyData)).toBe('');
      expect(resolveFieldValue('firstName', emptyData)).toBe('');
      expect(resolveFieldValue('schoolName', emptyData)).toBe('');
      expect(resolveFieldValue('totalHours', emptyData)).toBe('0.00');
    });

    it('should handle totalHours as string', () => {
      const data = { student: {}, totalHours: '10', eventName: '' };
      expect(resolveFieldValue('totalHours', data)).toBe('10');
    });

    it('should handle missing totalHours', () => {
      const data = { student: {}, totalHours: null, eventName: '' };
      expect(resolveFieldValue('totalHours', data)).toBe('0');
    });
  });

  describe('generateFilledPdf', () => {
    let templatePdfBytes;

    beforeEach(async () => {
      // Create a minimal PDF for testing
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([612, 792]);
      templatePdfBytes = await pdfDoc.save();
    });

    it('should generate a PDF with text overlaid at field positions', async () => {
      const fields = [
        { fieldKey: 'studentName', xPercent: 50, yPercent: 10, fontSize: 14, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 15,
        eventName: 'VBS 2026',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);

      // Verify it's a valid PDF
      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    });

    it('should handle multiple fields', async () => {
      const fields = [
        { fieldKey: 'studentName', xPercent: 10, yPercent: 10, fontSize: 12, page: 0 },
        { fieldKey: 'totalHours', xPercent: 50, yPercent: 50, fontSize: 12, page: 0 },
        { fieldKey: 'date', xPercent: 80, yPercent: 90, fontSize: 10, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 15,
        eventName: 'VBS 2026',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should skip fields with invalid page indices', async () => {
      const fields = [
        { fieldKey: 'studentName', xPercent: 50, yPercent: 10, fontSize: 14, page: 5 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 15,
        eventName: 'VBS 2026',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should use default font size of 12 when not specified', async () => {
      const fields = [
        { fieldKey: 'studentName', xPercent: 50, yPercent: 10, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle empty fields array', async () => {
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
      };

      const result = await generateFilledPdf(templatePdfBytes, [], data);
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  describe('downloadPdf', () => {
    it('should create a download link and trigger click', () => {
      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
      const mockCreateObjectURL = vi.fn(() => 'blob:test-url');
      const mockRevokeObjectURL = vi.fn();

      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockLink = {
        href: '',
        download: '',
        click: mockClick,
      };

      vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

      const pdfBytes = new Uint8Array([1, 2, 3]);
      downloadPdf(pdfBytes, 'test.pdf');

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockLink.download).toBe('test.pdf');
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url');

      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
      document.createElement.mockRestore?.();
    });
  });

  describe('getPdfPageDimensions', () => {
    it('should return dimensions for a valid PDF', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([612, 792]);
      const bytes = await pdfDoc.save();

      const result = await getPdfPageDimensions(bytes);
      expect(result).not.toBeNull();
      expect(result.width).toBe(612);
      expect(result.height).toBe(792);
      expect(result.pageCount).toBe(1);
    });

    it('should return correct page count for multi-page PDFs', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([612, 792]);
      pdfDoc.addPage([612, 792]);
      pdfDoc.addPage([612, 792]);
      const bytes = await pdfDoc.save();

      const result = await getPdfPageDimensions(bytes);
      expect(result.pageCount).toBe(3);
    });

    it('should handle PDFs with different page sizes', async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([841, 595]); // A4 landscape
      const bytes = await pdfDoc.save();

      const result = await getPdfPageDimensions(bytes);
      expect(result.width).toBe(841);
      expect(result.height).toBe(595);
    });
  });
});
