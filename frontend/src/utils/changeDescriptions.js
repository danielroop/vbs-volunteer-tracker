import { formatTime } from './hourCalculations';

/**
 * Build a smart edit change description that only includes fields that actually changed.
 * Uses ". Reason:" instead of "for" connector.
 *
 * @param {Object} params
 * @param {string} params.originalCheckInTime - Original check-in datetime-local string
 * @param {string} params.newCheckInTime - New check-in datetime-local string
 * @param {string} params.originalCheckOutTime - Original check-out datetime-local string
 * @param {string} params.newCheckOutTime - New check-out datetime-local string
 * @param {string} params.reason - User-provided reason for the change
 * @returns {string} The formatted change description, or empty string if nothing changed
 */
export function buildEditChangeDescription({ originalCheckInTime, newCheckInTime, originalCheckOutTime, newCheckOutTime, reason }) {
  const changes = [];

  const checkInChanged = originalCheckInTime !== newCheckInTime;
  const checkOutChanged = originalCheckOutTime !== newCheckOutTime;

  if (checkInChanged) {
    const oldIn = originalCheckInTime ? formatTime(new Date(originalCheckInTime)) : 'none';
    const newIn = formatTime(new Date(newCheckInTime));
    changes.push(`Changed Check-In from ${oldIn} to ${newIn}`);
  }

  if (checkOutChanged) {
    const oldOut = originalCheckOutTime ? formatTime(new Date(originalCheckOutTime)) : 'none';
    const newOut = newCheckOutTime ? formatTime(new Date(newCheckOutTime)) : 'none';
    changes.push(`Changed Check-Out from ${oldOut} to ${newOut}`);
  }

  if (changes.length === 0) {
    return '';
  }

  const description = changes.join(' and ');
  return reason ? `${description}. Reason: ${reason}` : description;
}

/**
 * Build a force checkout change description.
 *
 * @param {Object} params
 * @param {string} params.checkOutTimeStr - Formatted check-out time string
 * @param {string} params.checkInTimeStr - Formatted check-in time string
 * @param {string} params.reason - User-provided reason
 * @returns {string} The formatted description
 */
export function buildForceCheckoutDescription({ checkOutTimeStr, checkInTimeStr, reason }) {
  return `Forced Check-Out at ${checkOutTimeStr} (Checked in: ${checkInTimeStr}). Reason: ${reason}`;
}

/**
 * Build a bulk force checkout change description.
 *
 * @param {Object} params
 * @param {string} params.checkOutTimeStr - Formatted check-out time string
 * @param {string} params.checkInTimeStr - Formatted check-in time string
 * @param {string} params.reason - User-provided reason
 * @returns {string} The formatted description
 */
export function buildBulkForceCheckoutDescription({ checkOutTimeStr, checkInTimeStr, reason }) {
  return `Bulk Forced Check-Out at ${checkOutTimeStr} (Checked in: ${checkInTimeStr}). Reason: ${reason}`;
}
