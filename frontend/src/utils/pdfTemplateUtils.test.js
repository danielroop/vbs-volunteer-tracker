import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  FIELD_KEY_OPTIONS,
  ACTIVITY_COLUMN_OPTIONS,
  DETAIL_COLUMN_OPTIONS,
  resolveFieldValue,
  resolveActivityColumnValue,
  resolveDetailColumnValue,
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

    it('should have key, label, and preview for each option', () => {
      FIELD_KEY_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('key');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('preview');
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

    it('should include new placeable field keys', () => {
      const keys = FIELD_KEY_OPTIONS.map(o => o.key);
      expect(keys).toContain('contactPerson');
      expect(keys).toContain('contactPhone');
      expect(keys).toContain('eventDescription');
      expect(keys).toContain('nonprofitName');
    });
  });

  describe('ACTIVITY_COLUMN_OPTIONS', () => {
    it('should export an array of column options', () => {
      expect(Array.isArray(ACTIVITY_COLUMN_OPTIONS)).toBe(true);
      expect(ACTIVITY_COLUMN_OPTIONS.length).toBeGreaterThan(0);
    });

    it('should have key, label, and preview for each option', () => {
      ACTIVITY_COLUMN_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('key');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('preview');
      });
    });

    it('should include activity column keys', () => {
      const keys = ACTIVITY_COLUMN_OPTIONS.map(o => o.key);
      expect(keys).toContain('activityOrg');
      expect(keys).toContain('activityDates');
      expect(keys).toContain('activityContact');
      expect(keys).toContain('activityHours');
    });
  });

  describe('DETAIL_COLUMN_OPTIONS', () => {
    it('should export an array of detail column options', () => {
      expect(Array.isArray(DETAIL_COLUMN_OPTIONS)).toBe(true);
      expect(DETAIL_COLUMN_OPTIONS.length).toBeGreaterThan(0);
    });

    it('should have key, label, and preview for each option', () => {
      DETAIL_COLUMN_OPTIONS.forEach(option => {
        expect(option).toHaveProperty('key');
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('preview');
      });
    });

    it('should include detail column keys', () => {
      const keys = DETAIL_COLUMN_OPTIONS.map(o => o.key);
      expect(keys).toContain('detailDate');
      expect(keys).toContain('detailStartTime');
      expect(keys).toContain('detailEndTime');
      expect(keys).toContain('detailHours');
      expect(keys).toContain('detailActivity');
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
      event: {
        contactName: 'Jane Smith',
        contactPhone: '(555) 123-4567',
        description: 'Summer volunteer program',
        organizationName: 'First Baptist Church',
      },
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

    it('should resolve contactPerson from event data', () => {
      expect(resolveFieldValue('contactPerson', mockData)).toBe('Jane Smith');
    });

    it('should resolve contactPhone from event data', () => {
      expect(resolveFieldValue('contactPhone', mockData)).toBe('(555) 123-4567');
    });

    it('should resolve eventDescription from event data', () => {
      expect(resolveFieldValue('eventDescription', mockData)).toBe('Summer volunteer program');
    });

    it('should resolve nonprofitName from event data', () => {
      expect(resolveFieldValue('nonprofitName', mockData)).toBe('First Baptist Church');
    });

    it('should handle missing event data for new fields gracefully', () => {
      const dataNoEvent = { student: {}, totalHours: 0, eventName: '' };
      expect(resolveFieldValue('contactPerson', dataNoEvent)).toBe('');
      expect(resolveFieldValue('contactPhone', dataNoEvent)).toBe('');
      expect(resolveFieldValue('eventDescription', dataNoEvent)).toBe('');
      expect(resolveFieldValue('nonprofitName', dataNoEvent)).toBe('');
    });

    it('should return empty string for unknown field keys', () => {
      expect(resolveFieldValue('unknownKey', mockData)).toBe('');
    });

    it('should handle missing student data gracefully', () => {
      const emptyData = { student: {}, totalHours: 0, eventName: '' };
      expect(resolveFieldValue('studentName', emptyData)).toBe('');
      expect(resolveFieldValue('firstName', emptyData)).toBe('');
      expect(resolveFieldValue('totalHours', emptyData)).toBe('0.00');
    });
  });

  describe('resolveActivityColumnValue', () => {
    const mockActivity = {
      name: 'Morning Session',
      dateDisplay: '6/9/26 - 6/13/26',
      totalHours: '12.50',
    };
    const mockEvent = {
      organizationName: 'First Baptist Church',
      contactName: 'Jane Smith',
    };

    it('should resolve activityOrg', () => {
      expect(resolveActivityColumnValue('activityOrg', mockActivity, mockEvent)).toBe('First Baptist Church Morning Session');
    });

    it('should resolve activityDates', () => {
      expect(resolveActivityColumnValue('activityDates', mockActivity, mockEvent)).toBe('6/9/26 - 6/13/26');
    });

    it('should resolve activityContact', () => {
      expect(resolveActivityColumnValue('activityContact', mockActivity, mockEvent)).toBe('Jane Smith');
    });

    it('should resolve activityHours', () => {
      expect(resolveActivityColumnValue('activityHours', mockActivity, mockEvent)).toBe('12.50');
    });

    it('should return empty string for unknown column keys', () => {
      expect(resolveActivityColumnValue('unknown', mockActivity, mockEvent)).toBe('');
    });

    it('should handle missing event data', () => {
      expect(resolveActivityColumnValue('activityOrg', mockActivity, null)).toBe('Morning Session');
      expect(resolveActivityColumnValue('activityContact', mockActivity, null)).toBe('');
    });

    it('should handle missing activity data', () => {
      expect(resolveActivityColumnValue('activityDates', {}, mockEvent)).toBe('');
      expect(resolveActivityColumnValue('activityHours', {}, mockEvent)).toBe('0');
    });
  });

  describe('resolveDetailColumnValue', () => {
    const mockEntry = {
      date: '2026-06-09',
      checkInTime: '2026-06-09T08:00:00',
      checkOutTime: '2026-06-09T12:00:00',
      hoursWorked: 4,
      activityName: 'VBS Morning Session',
    };

    it('should resolve detailDate', () => {
      const result = resolveDetailColumnValue('detailDate', mockEntry);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should resolve detailStartTime', () => {
      const result = resolveDetailColumnValue('detailStartTime', mockEntry);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should resolve detailEndTime', () => {
      const result = resolveDetailColumnValue('detailEndTime', mockEntry);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should resolve detailHours with 2 decimal places', () => {
      expect(resolveDetailColumnValue('detailHours', mockEntry)).toBe('4.00');
    });

    it('should resolve detailActivity', () => {
      expect(resolveDetailColumnValue('detailActivity', mockEntry)).toBe('VBS Morning Session');
    });

    it('should return empty string for unknown column keys', () => {
      expect(resolveDetailColumnValue('unknown', mockEntry)).toBe('');
    });

    it('should handle missing entry data gracefully', () => {
      expect(resolveDetailColumnValue('detailDate', {})).toBe('');
      expect(resolveDetailColumnValue('detailStartTime', {})).toBe('');
      expect(resolveDetailColumnValue('detailEndTime', {})).toBe('');
      expect(resolveDetailColumnValue('detailHours', {})).toBe('0');
      expect(resolveDetailColumnValue('detailActivity', {})).toBe('');
    });

    it('should handle Date objects for timestamps', () => {
      const entryWithDates = {
        date: new Date('2026-06-09'),
        checkInTime: new Date('2026-06-09T08:00:00'),
        checkOutTime: new Date('2026-06-09T12:00:00'),
        hoursWorked: 4,
      };
      expect(resolveDetailColumnValue('detailDate', entryWithDates)).toBeTruthy();
      expect(resolveDetailColumnValue('detailStartTime', entryWithDates)).toBeTruthy();
      expect(resolveDetailColumnValue('detailEndTime', entryWithDates)).toBeTruthy();
    });
  });

  describe('generateFilledPdf', () => {
    let templatePdfBytes;

    beforeEach(async () => {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.addPage([612, 792]);
      templatePdfBytes = await pdfDoc.save();
    });

    it('should generate a PDF with static fields', async () => {
      const fields = [
        { type: 'static', fieldKey: 'studentName', xPercent: 50, yPercent: 10, fontSize: 14, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 15,
        eventName: 'VBS 2026',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate a PDF with activity table fields', async () => {
      const fields = [
        {
          type: 'activityTable',
          yPercent: 30,
          rowHeight: 3,
          maxRows: 5,
          page: 0,
          columns: [
            { key: 'activityOrg', xPercent: 5, fontSize: 10 },
            { key: 'activityHours', xPercent: 80, fontSize: 10 },
          ],
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 25,
        eventName: 'VBS 2026',
        activityLog: [
          { name: 'Morning Session', dateDisplay: '6/9 - 6/13', totalHours: '12.50' },
          { name: 'Afternoon Session', dateDisplay: '6/9 - 6/12', totalHours: '10.00' },
        ],
        event: { organizationName: 'Test Church', contactName: 'Admin' },
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);

      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    });

    it('should handle mixed static and activity table fields', async () => {
      const fields = [
        { type: 'static', fieldKey: 'studentName', xPercent: 10, yPercent: 5, fontSize: 14, page: 0 },
        {
          type: 'activityTable',
          yPercent: 30,
          rowHeight: 3,
          maxRows: 5,
          page: 0,
          columns: [
            { key: 'activityOrg', xPercent: 5, fontSize: 10 },
          ],
        },
        { type: 'static', fieldKey: 'totalHours', xPercent: 80, yPercent: 90, fontSize: 12, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 25.5,
        eventName: 'VBS 2026',
        activityLog: [{ name: 'Session', dateDisplay: '6/9', totalHours: '25.50' }],
        event: { organizationName: 'Church', contactName: 'Admin' },
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should respect maxRows limit for activity tables', async () => {
      const fields = [
        {
          type: 'activityTable',
          yPercent: 20,
          rowHeight: 5,
          maxRows: 2,
          page: 0,
          columns: [{ key: 'activityHours', xPercent: 10, fontSize: 10 }],
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
        activityLog: [
          { name: 'A', totalHours: '1' },
          { name: 'B', totalHours: '2' },
          { name: 'C', totalHours: '3' }, // Should be skipped (maxRows=2)
        ],
        event: {},
      };

      // Should not throw
      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle empty activity log gracefully', async () => {
      const fields = [
        {
          type: 'activityTable',
          yPercent: 30,
          rowHeight: 3,
          maxRows: 5,
          page: 0,
          columns: [{ key: 'activityOrg', xPercent: 5, fontSize: 10 }],
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
        activityLog: [],
        event: {},
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle fields without explicit type as static', async () => {
      const fields = [
        { fieldKey: 'studentName', xPercent: 50, yPercent: 10, fontSize: 14, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should skip fields with invalid page indices', async () => {
      const fields = [
        { type: 'static', fieldKey: 'studentName', xPercent: 50, yPercent: 10, fontSize: 14, page: 5 },
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

    it('should generate a PDF with detail table fields', async () => {
      const fields = [
        {
          type: 'detailTable',
          yPercent: 30,
          rowHeight: 3,
          maxRows: 10,
          page: 0,
          columns: [
            { key: 'detailDate', xPercent: 5, fontSize: 10 },
            { key: 'detailStartTime', xPercent: 25, fontSize: 10 },
            { key: 'detailEndTime', xPercent: 45, fontSize: 10 },
            { key: 'detailHours', xPercent: 65, fontSize: 10 },
          ],
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 8,
        eventName: 'VBS 2026',
        timeEntries: [
          { date: '2026-06-09', checkInTime: '2026-06-09T08:00:00', checkOutTime: '2026-06-09T12:00:00', hoursWorked: 4 },
          { date: '2026-06-10', checkInTime: '2026-06-10T08:00:00', checkOutTime: '2026-06-10T12:00:00', hoursWorked: 4 },
        ],
        event: { organizationName: 'Test Church', contactName: 'Admin' },
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);

      const doc = await PDFDocument.load(result);
      expect(doc.getPageCount()).toBe(1);
    });

    it('should respect maxRows limit for detail tables', async () => {
      const fields = [
        {
          type: 'detailTable',
          yPercent: 20,
          rowHeight: 5,
          maxRows: 1,
          page: 0,
          columns: [{ key: 'detailHours', xPercent: 10, fontSize: 10 }],
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
        timeEntries: [
          { hoursWorked: 4 },
          { hoursWorked: 3 }, // Should be skipped (maxRows=1)
        ],
        event: {},
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle empty timeEntries for detail table gracefully', async () => {
      const fields = [
        {
          type: 'detailTable',
          yPercent: 30,
          rowHeight: 3,
          maxRows: 10,
          page: 0,
          columns: [{ key: 'detailDate', xPercent: 5, fontSize: 10 }],
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
        timeEntries: [],
        event: {},
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should generate a PDF with custom static fields', async () => {
      const fields = [
        {
          type: 'customStatic',
          label: 'Supervisor Title',
          customValue: 'Program Director',
          xPercent: 50,
          yPercent: 80,
          fontSize: 12,
          page: 0,
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle custom static field with empty value', async () => {
      const fields = [
        {
          type: 'customStatic',
          label: 'Notes',
          customValue: '',
          xPercent: 10,
          yPercent: 50,
          fontSize: 10,
          page: 0,
        },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 0,
        eventName: '',
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('should handle mixed static, activity, detail, and custom fields', async () => {
      const fields = [
        { type: 'static', fieldKey: 'studentName', xPercent: 10, yPercent: 5, fontSize: 14, page: 0 },
        {
          type: 'activityTable',
          yPercent: 20,
          rowHeight: 3,
          maxRows: 5,
          page: 0,
          columns: [{ key: 'activityOrg', xPercent: 5, fontSize: 10 }],
        },
        {
          type: 'detailTable',
          yPercent: 50,
          rowHeight: 3,
          maxRows: 5,
          page: 0,
          columns: [{ key: 'detailDate', xPercent: 5, fontSize: 10 }],
        },
        {
          type: 'customStatic',
          label: 'Org Name',
          customValue: 'My Organization',
          xPercent: 10,
          yPercent: 90,
          fontSize: 12,
          page: 0,
        },
        { type: 'static', fieldKey: 'totalHours', xPercent: 80, yPercent: 95, fontSize: 12, page: 0 },
      ];
      const data = {
        student: { firstName: 'Jane', lastName: 'Smith' },
        totalHours: 25.5,
        eventName: 'VBS 2026',
        activityLog: [{ name: 'Session', dateDisplay: '6/9', totalHours: '25.50' }],
        timeEntries: [{ date: '2026-06-09', checkInTime: '2026-06-09T08:00:00', checkOutTime: '2026-06-09T12:00:00', hoursWorked: 4 }],
        event: { organizationName: 'Church', contactName: 'Admin' },
      };

      const result = await generateFilledPdf(templatePdfBytes, fields, data);
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

      const mockLink = { href: '', download: '', click: mockClick };
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
  });
});
