import { format, parse } from 'date-fns';

/**
 * Calculate hours worked and round to nearest 0.5 hour
 * Per PRD Section 3.4.1:
 * - 0-14 minutes = round down
 * - 15-44 minutes = round to 0.5
 * - 45-59 minutes = round up to next hour
 *
 * @param {Date} checkIn - Check-in timestamp
 * @param {Date} checkOut - Check-out timestamp
 * @returns {Object} { rounded, raw, minutes }
 */
export function calculateHours(checkIn, checkOut) {
  const minutes = Math.floor((checkOut - checkIn) / 1000 / 60);
  const hours = minutes / 60;

  // Round to nearest 0.5
  const rounded = Math.round(hours * 2) / 2;

  return {
    rounded,          // 6.5
    raw: hours,       // 6.216666...
    minutes           // 373
  };
}

/**
 * Check if check-in time should be flagged
 * Per PRD Section 3.4.2: Flag if >15 min before typical start
 *
 * @param {Date} checkInTime - Check-in timestamp
 * @param {string} typicalStart - Typical start time (e.g., "09:00")
 * @returns {boolean}
 */
export function isEarlyArrival(checkInTime, typicalStart) {
  const [hour, min] = typicalStart.split(':');
  const typical = new Date(checkInTime);
  typical.setHours(parseInt(hour), parseInt(min), 0, 0);

  // Flag if >15 min early
  const fifteenMinutes = 15 * 60 * 1000;
  return checkInTime < (typical - fifteenMinutes);
}

/**
 * Check if check-out time should be flagged
 * Per PRD Section 3.4.2: Flag if >15 min after typical end
 *
 * @param {Date} checkOutTime - Check-out timestamp
 * @param {string} typicalEnd - Typical end time (e.g., "15:00")
 * @returns {boolean}
 */
export function isLateStay(checkOutTime, typicalEnd) {
  const [hour, min] = typicalEnd.split(':');
  const typical = new Date(checkOutTime);
  typical.setHours(parseInt(hour), parseInt(min), 0, 0);

  // Flag if >15 min late
  const fifteenMinutes = 15 * 60 * 1000;
  return checkOutTime > (typical + fifteenMinutes);
}

/**
 * Get flags for a time entry
 * @param {Date} checkInTime - Check-in timestamp
 * @param {Date|null} checkOutTime - Check-out timestamp
 * @param {string} typicalStart - Typical start time (e.g., "09:00")
 * @param {string} typicalEnd - Typical end time (e.g., "15:00")
 * @returns {string[]} Array of flags
 */
export function getTimeEntryFlags(checkInTime, checkOutTime, typicalStart, typicalEnd) {
  const flags = [];

  if (isEarlyArrival(checkInTime, typicalStart)) {
    flags.push('early_arrival');
  }

  if (checkOutTime && isLateStay(checkOutTime, typicalEnd)) {
    flags.push('late_stay');
  }

  return flags;
}

/**
 * Format hours for display (e.g., "6.5 hours")
 * @param {number} hours - Hours worked
 * @returns {string}
 */
export function formatHours(hours) {
  if (hours === null || hours === undefined) {
    return '--';
  }
  return `${hours.toFixed(1)} ${hours === 1 ? 'hour' : 'hours'}`;
}

/**
 * Format time for display (e.g., "9:02 AM")
 * @param {Date|null} time - Timestamp
 * @returns {string}
 */
export function formatTime(time) {
  if (!time) return '--';
  return format(time, 'h:mm a');
}

/**
 * Format date for display (e.g., "Monday, June 15, 2026")
 * @param {Date|string} date - Date
 * @returns {string}
 */
export function formatDate(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'EEEE, MMMM d, yyyy');
}

/**
 * Get today's date string in YYYY-MM-DD format
 * @returns {string}
 */
export function getTodayDateString() {
  return format(new Date(), 'yyyy-MM-dd');
}
