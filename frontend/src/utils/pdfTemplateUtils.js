import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Available field keys for STATIC fields (placed individually on the PDF).
 */
export const FIELD_KEY_OPTIONS = [
  { key: 'studentName', label: 'Student Full Name', preview: 'Jane Smith' },
  { key: 'firstName', label: 'First Name', preview: 'Jane' },
  { key: 'lastName', label: 'Last Name', preview: 'Smith' },
  { key: 'schoolName', label: 'School Name', preview: 'West Orange HS' },
  { key: 'gradeLevel', label: 'Grade Level', preview: '10' },
  { key: 'gradYear', label: 'Graduation Year', preview: '2028' },
  { key: 'totalHours', label: 'Total Hours', preview: '25.50' },
  { key: 'date', label: 'Current Date', preview: '2/7/2026' },
  { key: 'eventName', label: 'Event Name', preview: 'VBS 2026' },
  { key: 'contactPerson', label: 'Contact Person', preview: 'John Smith' },
  { key: 'contactPhone', label: 'Contact Phone', preview: '(555) 123-4567' },
  { key: 'eventDescription', label: 'Event Description', preview: 'Vacation Bible School volunteer service' },
  { key: 'nonprofitName', label: 'Non-Profit Organization', preview: 'First Baptist Church' },
];

/**
 * Available column keys for ACTIVITY TABLE rows (summary mode).
 * Each row represents one activity from the event's activity log.
 */
export const ACTIVITY_COLUMN_OPTIONS = [
  { key: 'activityOrg', label: 'Organization + Activity', preview: 'First Baptist VBS AM' },
  { key: 'activityDates', label: 'Date(s) of Service', preview: '6/9/26 - 6/13/26' },
  { key: 'activityContact', label: 'Contact Name', preview: 'Jane Smith' },
  { key: 'activityHours', label: 'Hours Completed', preview: '12.50' },
];

/**
 * Available column keys for DETAIL TABLE rows.
 * Each row represents an individual time entry with date, start time, and end time.
 */
export const DETAIL_COLUMN_OPTIONS = [
  { key: 'detailDate', label: 'Date', preview: '6/9/2026' },
  { key: 'detailStartTime', label: 'Start Time', preview: '8:00 AM' },
  { key: 'detailEndTime', label: 'End Time', preview: '12:00 PM' },
  { key: 'detailHours', label: 'Hours', preview: '4.00' },
  { key: 'detailActivity', label: 'Activity Name', preview: 'VBS Morning Session' },
  { key: 'detailContact', label: 'Contact Name', preview: 'Jane Smith' },
];

/**
 * Resolves a static field key to its value.
 */
export function resolveFieldValue(fieldKey, { student, totalHours, eventName, event, customStaticFields }) {
  switch (fieldKey) {
    case 'studentName':
      return `${student.firstName || ''} ${student.lastName || ''}`.trim();
    case 'firstName':
      return student.firstName || '';
    case 'lastName':
      return student.lastName || '';
    case 'schoolName':
      return student.schoolName || '';
    case 'gradeLevel':
      return String(student.gradeLevel ?? '');
    case 'gradYear':
      return String(student.gradYear || '');
    case 'totalHours':
      return typeof totalHours === 'number' ? totalHours.toFixed(2) : String(totalHours || '0');
    case 'date':
      return new Date().toLocaleDateString();
    case 'eventName':
      return eventName || '';
    case 'contactPerson':
      return event?.contactName || '';
    case 'contactPhone':
      return event?.contactPhone || '';
    case 'eventDescription':
      return event?.description || '';
    case 'nonprofitName':
      return event?.organizationName || '';
    default:
      return '';
  }
}

/**
 * Resolves an activity column key to its value for a single activity row.
 */
export function resolveActivityColumnValue(columnKey, activity, event) {
  switch (columnKey) {
    case 'activityOrg':
      return `${event?.organizationName || ''} ${activity.name || ''}`.trim();
    case 'activityDates':
      return activity.dateDisplay || '';
    case 'activityContact':
      return event?.contactName || '';
    case 'activityHours':
      return String(activity.totalHours || '0');
    default:
      return '';
  }
}

/**
 * Resolves a detail column key to its value for a single time entry row.
 */
export function resolveDetailColumnValue(columnKey, entry, event) {
  switch (columnKey) {
    case 'detailDate': {
      // Support Firestore Timestamps (with toDate()) and regular Date/string values
      const raw = entry.checkInTime || entry.date;
      if (!raw) return '';
      const d = raw.toDate ? raw.toDate() : (raw instanceof Date ? raw : new Date(raw));
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    }
    case 'detailStartTime': {
      if (!entry.checkInTime) return '';
      const d = entry.checkInTime.toDate ? entry.checkInTime.toDate() : (entry.checkInTime instanceof Date ? entry.checkInTime : new Date(entry.checkInTime));
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    case 'detailEndTime': {
      if (!entry.checkOutTime) return '';
      const d = entry.checkOutTime.toDate ? entry.checkOutTime.toDate() : (entry.checkOutTime instanceof Date ? entry.checkOutTime : new Date(entry.checkOutTime));
      return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    case 'detailHours': {
      // Use stored hoursWorked if available, otherwise calculate from timestamps
      if (typeof entry.hoursWorked === 'number' && entry.hoursWorked > 0) {
        return entry.hoursWorked.toFixed(2);
      }
      // Fallback: calculate from checkIn/checkOut timestamps (supports Firestore Timestamps with .seconds)
      if (entry.checkInTime && entry.checkOutTime) {
        const inSec = entry.checkInTime.seconds != null ? entry.checkInTime.seconds
          : (entry.checkInTime.toDate ? entry.checkInTime.toDate().getTime() / 1000
          : new Date(entry.checkInTime).getTime() / 1000);
        const outSec = entry.checkOutTime.seconds != null ? entry.checkOutTime.seconds
          : (entry.checkOutTime.toDate ? entry.checkOutTime.toDate().getTime() / 1000
          : new Date(entry.checkOutTime).getTime() / 1000);
        if (!isNaN(inSec) && !isNaN(outSec) && outSec > inSec) {
          const hours = Math.round(((outSec - inSec) / 3600) * 4) / 4; // Round to nearest 0.25
          return hours.toFixed(2);
        }
      }
      return '0';
    }
    case 'detailActivity':
      return entry.activityName || '';
    case 'detailContact':
      return event?.contactName || '';
    default:
      return '';
  }
}

/**
 * Generates a filled PDF by overlaying text at mapped field coordinates.
 * Supports both static fields and activity tables with repeating rows.
 *
 * @param {ArrayBuffer} templatePdfBytes - The raw bytes of the template PDF
 * @param {Array} fields - Array of field mappings (static fields, activity tables, detail tables, custom static)
 * @param {Object} data - { student, totalHours, eventName, activityLog, event, timeEntries }
 * @returns {Promise<Uint8Array>} - The generated PDF bytes
 */
export async function generateFilledPdf(templatePdfBytes, fields, data) {
  const pdfDoc = await PDFDocument.load(templatePdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // Helvetica ascent ratio: the distance from baseline to top of capital letters
  // as a fraction of font size. This aligns PDF baseline positioning with CSS top positioning.
  const ASCENT_RATIO = 0.72;

  for (const field of fields) {
    const pageIndex = field.page || 0;
    if (pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    if (field.type === 'activityTable') {
      // Render repeating activity rows (summary)
      const activities = data.activityLog || [];
      const maxRows = field.maxRows || 10;
      const rowHeightPct = field.rowHeight || 3;
      const startYPct = field.yPercent;

      activities.slice(0, maxRows).forEach((activity, rowIndex) => {
        const rowYPct = startYPct + (rowIndex * rowHeightPct);

        (field.columns || []).forEach((col) => {
          const x = (col.xPercent / 100) * width;
          const colFontSize = col.fontSize || 10;
          // Shift baseline down by ascent so top of text aligns with yPercent
          const y = height - (rowYPct / 100) * height - (colFontSize * ASCENT_RATIO);
          const value = String(resolveActivityColumnValue(col.key, activity, data.event));

          page.drawText(value, {
            x,
            y,
            size: colFontSize,
            font,
            color: rgb(0, 0, 0),
            maxWidth: col.maxWidth ? (col.maxWidth / 100) * width : undefined,
          });
        });
      });
    } else if (field.type === 'detailTable') {
      // Render repeating detail rows (individual time entries)
      const entries = data.timeEntries || [];
      const maxRows = field.maxRows || 10;
      const rowHeightPct = field.rowHeight || 3;
      const startYPct = field.yPercent;

      entries.slice(0, maxRows).forEach((entry, rowIndex) => {
        const rowYPct = startYPct + (rowIndex * rowHeightPct);

        (field.columns || []).forEach((col) => {
          const x = (col.xPercent / 100) * width;
          const colFontSize = col.fontSize || 10;
          const y = height - (rowYPct / 100) * height - (colFontSize * ASCENT_RATIO);
          const value = String(resolveDetailColumnValue(col.key, entry, data.event));

          page.drawText(value, {
            x,
            y,
            size: colFontSize,
            font,
            color: rgb(0, 0, 0),
            maxWidth: col.maxWidth ? (col.maxWidth / 100) * width : undefined,
          });
        });
      });
    } else if (field.type === 'customStatic') {
      // Custom static field with admin-defined value
      const x = (field.xPercent / 100) * width;
      const fontSize = field.fontSize || 12;
      const y = height - (field.yPercent / 100) * height - (fontSize * ASCENT_RATIO);
      const value = String(field.customValue || '');

      page.drawText(value, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    } else {
      // Static field
      const x = (field.xPercent / 100) * width;
      const fontSize = field.fontSize || 12;
      // Shift baseline down by ascent so top of text aligns with yPercent
      const y = height - (field.yPercent / 100) * height - (fontSize * ASCENT_RATIO);
      const value = String(resolveFieldValue(field.fieldKey, data));

      page.drawText(value, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  return pdfDoc.save();
}

/**
 * Triggers a browser download of a PDF from bytes.
 */
export function downloadPdf(pdfBytes, filename) {
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Returns { width, height, pageCount } of the first page using pdf-lib.
 */
export async function getPdfPageDimensions(pdfBytes) {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) return null;

  const firstPage = pages[0];
  const { width, height } = firstPage.getSize();
  return { width, height, pageCount: pages.length };
}

/**
 * Renders a specific page of a PDF to a data URL image using pdfjs-dist.
 */
export async function renderPdfPageToImage(pdfUrl, pageNumber = 1, scale = 2) {
  const pdfjsLib = await import('pdfjs-dist');

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const loadingTask = pdfjsLib.getDocument(pdfUrl);
  const pdf = await loadingTask.promise;
  const page = await pdf.getPage(pageNumber);

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL('image/png');
  return {
    dataUrl,
    width: viewport.width,
    height: viewport.height,
    pageCount: pdf.numPages,
  };
}
