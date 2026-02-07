import React from 'react';
import Button from '../common/Button';

/**
 * TimeEntryCard Component
 * Mobile-friendly card view for time entries (used on screens < md breakpoint)
 *
 * @param {Object} entry - The time entry object with student, activity, and time data
 * @param {Function} formatTime - Function to format time values
 * @param {Function} formatHours - Function to format hours values
 * @param {Function} getStatusDisplay - Function to get status display text
 * @param {Function} getStatusClass - Function to get status CSS class
 * @param {Function} onEdit - Callback when edit button is clicked
 * @param {Function} onForceCheckout - Callback when force checkout button is clicked
 * @param {Function} onVoid - Callback when void button is clicked
 * @param {Function} onRestore - Callback when restore button is clicked
 */
export default function TimeEntryCard({
  entry,
  formatTime,
  formatHours,
  getStatusDisplay,
  getStatusClass,
  onEdit,
  onForceCheckout,
  onVoid,
  onRestore
}) {
  const studentName = `${entry.student.lastName}, ${entry.student.firstName}`;
  const activityName = entry.activity?.name || '--';
  const checkInTimeDisplay = entry.checkInTime ? formatTime(entry.checkInTime) : '--';
  const checkOutTimeDisplay = entry.checkOutTime
    ? formatTime(entry.checkOutTime)
    : 'Not checked out';
  const hoursDisplay = entry.hoursWorked !== null && entry.hoursWorked !== undefined
    ? formatHours(entry.hoursWorked)
    : '--';
  const dateDisplay = entry.checkInTime
    ? new Date(entry.checkInTime).toLocaleDateString()
    : entry.date;

  const isVoided = entry.isVoided;

  return (
    <article
      className={`border rounded-lg p-4 shadow-sm ${
        isVoided
          ? 'bg-gray-100 border-gray-300 opacity-50'
          : 'bg-white border-gray-200'
      }`}
      aria-label={`Time entry for ${entry.student.firstName} ${entry.student.lastName}${isVoided ? ' (voided)' : ''}`}
      title={isVoided ? `Voided: ${entry.voidReason}` : undefined}
    >
      {/* Header: Name and Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium text-gray-900 truncate ${isVoided ? 'line-through' : ''}`}
            title={studentName}
          >
            {studentName}
          </h3>
          <span
            className={`inline-block uppercase font-bold text-[10px] text-blue-600 mt-1 ${isVoided ? 'line-through' : ''}`}
            title={activityName}
          >
            {activityName}
          </span>
        </div>
        <span
          className={`text-sm font-medium whitespace-nowrap ml-2 ${getStatusClass(entry)}`}
          aria-label={`Status: ${getStatusDisplay(entry).replace(/[^\w\s]/g, '')}`}
        >
          {getStatusDisplay(entry)}
        </span>
      </div>

      {/* Date Row */}
      <div className={`text-xs text-gray-500 mb-3 ${isVoided ? 'line-through' : ''}`}>
        {dateDisplay}
      </div>

      {/* Void Reason if voided */}
      {isVoided && entry.voidReason && (
        <div className="text-xs text-gray-500 italic bg-gray-200 p-2 rounded mb-3 truncate" title={entry.voidReason}>
          Void reason: {entry.voidReason}
        </div>
      )}

      {/* Time Details Grid */}
      <div className={`grid grid-cols-3 gap-2 text-sm mb-3 ${isVoided ? 'line-through' : ''}`}>
        <div>
          <span className="block text-xs text-gray-500 uppercase" aria-hidden="true">Check-In</span>
          <span className="text-gray-900" aria-label={`Check-in time: ${checkInTimeDisplay}`}>
            {checkInTimeDisplay}
          </span>
        </div>
        <div>
          <span className="block text-xs text-gray-500 uppercase" aria-hidden="true">Check-Out</span>
          <span
            className={entry.checkOutTime ? 'text-gray-900' : (isVoided ? 'text-gray-400' : 'text-red-600 font-medium')}
            aria-label={`Check-out time: ${checkOutTimeDisplay}`}
          >
            {checkOutTimeDisplay}
          </span>
        </div>
        <div>
          <span className="block text-xs text-gray-500 uppercase" aria-hidden="true">Hours</span>
          <span className="text-gray-900" aria-label={`Hours worked: ${hoursDisplay}`}>
            {hoursDisplay}
          </span>
        </div>
      </div>

      {/* Override/Modification Reason if present */}
      {!isVoided && (entry.forcedCheckoutReason || entry.modificationReason) && (
        <div
          className="text-xs text-blue-600 italic bg-blue-50 p-2 rounded mb-3 truncate"
          title={entry.forcedCheckoutReason || entry.modificationReason}
        >
          Override: {entry.forcedCheckoutReason || entry.modificationReason}
        </div>
      )}

      {/* Flags if present */}
      {!isVoided && entry.flags && entry.flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {entry.flags.map((flag, index) => (
            <span
              key={index}
              className="inline-block text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full"
            >
              {formatFlag(flag)}
            </span>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-gray-100">
        {isVoided ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onRestore(entry)}
            aria-label={`Restore voided entry for ${entry.student.firstName} ${entry.student.lastName}`}
          >
            Restore
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(entry)}
              aria-label={`Edit time entry for ${entry.student.firstName} ${entry.student.lastName}`}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => onVoid(entry)}
              aria-label={`Void time entry for ${entry.student.firstName} ${entry.student.lastName}`}
            >
              Void
            </Button>
            {!entry.checkOutTime && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => onForceCheckout(entry)}
                aria-label={`Force checkout for ${entry.student.firstName} ${entry.student.lastName}`}
              >
                Force Out
              </Button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

/**
 * Format flag values to human-readable labels
 */
function formatFlag(flag) {
  const flagLabels = {
    early_arrival: 'Early arrival',
    late_stay: 'Late stay',
    forced_checkout: 'Forced checkout'
  };
  return flagLabels[flag] || flag;
}
