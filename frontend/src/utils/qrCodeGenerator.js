import QRCode from 'qrcode';

/**
 * Generate a simple checksum for QR code validation
 * @param {string} studentId
 * @param {string} eventId
 * @returns {string}
 */
function generateChecksum(studentId, eventId) {
  const combined = `${studentId}${eventId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36).substring(0, 6);
}

/**
 * Validate a QR code checksum
 * @param {string} studentId
 * @param {string} eventId
 * @param {string} checksum
 * @returns {boolean}
 */
export function validateChecksum(studentId, eventId, checksum) {
  const expected = generateChecksum(studentId, eventId);
  return expected === checksum;
}

/**
 * Generate QR code data string
 * Format: studentId|eventId|checksum
 * @param {string} studentId
 * @param {string} eventId
 * @returns {string}
 */
export function generateQRData(studentId, eventId) {
  const checksum = generateChecksum(studentId, eventId);
  return `${studentId}|${eventId}|${checksum}`;
}

/**
 * Parse QR code data string
 * @param {string} qrData
 * @returns {Object} { studentId, eventId, checksum, isValid }
 */
export function parseQRData(qrData) {
  const parts = qrData.split('|');
  if (parts.length !== 3) {
    return { isValid: false, error: 'Invalid QR code format' };
  }

  const [studentId, eventId, checksum] = parts;
  const isValid = validateChecksum(studentId, eventId, checksum);

  return {
    studentId,
    eventId,
    checksum,
    isValid,
  };
}

/**
 * Generate QR code as Data URL (base64 image)
 * @param {string} studentId
 * @param {string} eventId
 * @param {Object} options - QR code options
 * @returns {Promise<string>} Data URL of QR code image
 */
export async function generateQRCodeImage(studentId, eventId, options = {}) {
  const qrData = generateQRData(studentId, eventId);

  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    ...options,
  };

  try {
    return await QRCode.toDataURL(qrData, defaultOptions);
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
}

/**
 * Generate QR code as SVG string
 * @param {string} studentId
 * @param {string} eventId
 * @param {Object} options - QR code options
 * @returns {Promise<string>} SVG string
 */
export async function generateQRCodeSVG(studentId, eventId, options = {}) {
  const qrData = generateQRData(studentId, eventId);

  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
    ...options,
  };

  try {
    return await QRCode.toString(qrData, { type: 'svg', ...defaultOptions });
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
    throw error;
  }
}
