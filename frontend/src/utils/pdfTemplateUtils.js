import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Available field keys that can be mapped to PDF coordinates.
 * Each key corresponds to a data source from student/event data.
 */
export const FIELD_KEY_OPTIONS = [
  { key: 'studentName', label: 'Student Full Name' },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'schoolName', label: 'School Name' },
  { key: 'gradeLevel', label: 'Grade Level' },
  { key: 'gradYear', label: 'Graduation Year' },
  { key: 'totalHours', label: 'Total Hours' },
  { key: 'date', label: 'Current Date' },
  { key: 'eventName', label: 'Event Name' },
];

/**
 * Resolves a field key to its actual value from student/event data.
 */
export function resolveFieldValue(fieldKey, { student, totalHours, eventName }) {
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
      return student.gradeLevel || '';
    case 'gradYear':
      return String(student.gradYear || '');
    case 'totalHours':
      return typeof totalHours === 'number' ? totalHours.toFixed(2) : String(totalHours || '0');
    case 'date':
      return new Date().toLocaleDateString();
    case 'eventName':
      return eventName || '';
    default:
      return '';
  }
}

/**
 * Generates a filled PDF by overlaying text at mapped field coordinates
 * on top of a template PDF.
 *
 * @param {ArrayBuffer} templatePdfBytes - The raw bytes of the template PDF
 * @param {Array} fields - Array of field mappings: { fieldKey, xPercent, yPercent, fontSize, page }
 * @param {Object} data - { student, totalHours, eventName }
 * @returns {Promise<Uint8Array>} - The generated PDF bytes
 */
export async function generateFilledPdf(templatePdfBytes, fields, data) {
  const pdfDoc = await PDFDocument.load(templatePdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    const pageIndex = field.page || 0;
    if (pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    const x = (field.xPercent / 100) * width;
    // PDF coordinates are bottom-up, but we store yPercent as top-down
    const y = height - (field.yPercent / 100) * height;
    const fontSize = field.fontSize || 12;

    const value = resolveFieldValue(field.fieldKey, data);

    page.drawText(value, {
      x,
      y: y - fontSize, // offset down by font size so text baseline aligns
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
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
 *
 * @param {string} pdfUrl - URL of the PDF to render (e.g. Firebase Storage download URL)
 * @param {number} pageNumber - 1-indexed page number
 * @param {number} scale - Render scale (default 2 for crisp display)
 * @returns {Promise<{dataUrl: string, width: number, height: number}>}
 */
export async function renderPdfPageToImage(pdfUrl, pageNumber = 1, scale = 2) {
  const pdfjsLib = await import('pdfjs-dist');

  // Set the worker source to the bundled worker
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
