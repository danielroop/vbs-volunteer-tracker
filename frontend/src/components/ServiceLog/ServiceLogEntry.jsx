import React from 'react';
import Button from '../common/Button';

/**
 * ServiceLogEntry Component
 * Displays a service log entry as either a table row (desktop) or a card (mobile)
 *
 * @param {Object} entry - The enriched time entry with actualHours
 * @param {Object} activity - The activity object (name, etc.)
 * @param {string} mode - 'row' for table row, 'card' for mobile card
 * @param {Function} onEdit - Callback when edit button is clicked
 * @param {Function} onViewHistory - Callback when view history is clicked
 */
export default function ServiceLogEntry({
  entry,
  activity,
  mode = 'row',
  onEdit,
  onViewHistory
}) {
  const dateDisplay = entry.checkInTime?.toDate?.()?.toLocaleDateString() || 'N/A';
  const activityName = activity?.name || '--';
  const checkInTimeDisplay = entry.checkInTime
    ? entry.checkInTime.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '--';
  const checkOutTimeDisplay = entry.checkOutTime
    ? entry.checkOutTime.toDate().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const hoursDisplay = entry.checkOutTime && entry.actualHours !== null
    ? entry.actualHours.toFixed(2)
    : '--';

  const hasHistory = (entry.changeLog && entry.changeLog.length > 0) ||
                     entry.forcedCheckoutReason ||
                     entry.modificationReason;

  const isVoided = entry.isVoided;

  // Render table row for desktop view
  if (mode === 'row') {
    return (
      <tr
        className={`text-sm ${
          isVoided ? 'opacity-50 bg-gray-100' :
          !entry.checkOutTime ? 'bg-red-50' :
          (entry.forcedCheckoutReason || entry.modificationReason) ? 'bg-blue-50' : ''
        }`}
        data-testid="service-log-row"
        title={isVoided ? `Voided: ${entry.voidReason}` : undefined}
      >
        <td className={`px-6 py-4 ${isVoided ? 'line-through' : ''}`}>{dateDisplay}</td>
        <td className={`px-6 py-4 uppercase font-bold text-[10px] text-blue-600 ${isVoided ? 'line-through' : ''}`}>{activityName}</td>
        <td className={`px-6 py-4 text-center text-gray-600 ${isVoided ? 'line-through' : ''}`}>
          {checkInTimeDisplay}
        </td>
        <td className={`px-6 py-4 text-center ${isVoided ? 'line-through text-gray-400' : !entry.checkOutTime ? 'text-red-600' : 'text-gray-600'}`}>
          {checkOutTimeDisplay ? (
            checkOutTimeDisplay
          ) : (
            <span className={`text-[10px] font-medium ${isVoided ? 'text-gray-400' : 'text-red-500'}`}>Not checked out</span>
          )}
        </td>
        <td className={`px-6 py-4 text-right font-black ${isVoided ? 'line-through text-gray-400' : !entry.checkOutTime ? 'text-red-600' : ''}`}>
          {hoursDisplay}
        </td>
        <td className="px-6 py-4 text-center">
          <div className="flex items-center justify-center gap-2">
            {isVoided ? (
              <span className="text-xs text-gray-400 font-medium" title={entry.voidReason}>VOIDED</span>
            ) : (
              <>
                {entry.forcedCheckoutReason && (
                  <span title="Forced checkout" className="text-lg">⚡</span>
                )}
                {entry.modificationReason && (
                  <span title="Modified" className="text-lg">✏️</span>
                )}
                {entry.flags && entry.flags.includes('early_arrival') && (
                  <span title="Early arrival" className="text-lg">🌅</span>
                )}
                {entry.flags && entry.flags.includes('late_stay') && (
                  <span title="Late stay" className="text-lg">🌙</span>
                )}
                {hasHistory && (
                  <button
                    onClick={() => onViewHistory(entry)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline ml-1"
                  >
                    View
                  </button>
                )}
              </>
            )}
          </div>
        </td>
        <td className="px-6 py-4 text-center">
          {!isVoided && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onEdit(entry)}
            >
              Edit
            </Button>
          )}
        </td>
      </tr>
    );
  }

  // Render card for mobile view
  return (
    <article
      className={`border rounded-xl p-4 shadow-sm ${
        isVoided ? 'bg-gray-100 border-gray-300 opacity-50' :
        !entry.checkOutTime ? 'border-red-200 bg-red-50' :
        (entry.forcedCheckoutReason || entry.modificationReason) ? 'border-blue-200 bg-blue-50' :
        'border-gray-200 bg-white'
      }`}
      data-testid="service-log-card"
      aria-label={`Service log entry for ${dateDisplay}${isVoided ? ' (voided)' : ''}`}
    >
      {/* Header: Date and Activity Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-gray-900 ${isVoided ? 'line-through' : ''}`}>
            {dateDisplay}
          </div>
          <span className={`inline-block uppercase font-bold text-[10px] text-blue-600 mt-1 bg-blue-50 px-2 py-0.5 rounded ${isVoided ? 'line-through' : ''}`}>
            {activityName}
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isVoided ? (
            <span className="text-xs text-gray-400 font-medium">VOIDED</span>
          ) : (
            <>
              {entry.forcedCheckoutReason && (
                <span title="Forced checkout" className="text-lg" aria-label="Forced checkout">⚡</span>
              )}
              {entry.modificationReason && (
                <span title="Modified" className="text-lg" aria-label="Modified">✏️</span>
              )}
              {entry.flags && entry.flags.includes('early_arrival') && (
                <span title="Early arrival" className="text-lg" aria-label="Early arrival">🌅</span>
              )}
              {entry.flags && entry.flags.includes('late_stay') && (
                <span title="Late stay" className="text-lg" aria-label="Late stay">🌙</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Void Reason if voided */}
      {isVoided && entry.voidReason && (
        <div className="text-xs text-gray-500 italic bg-gray-200 p-2 rounded mb-3 truncate" title={entry.voidReason}>
          Void reason: {entry.voidReason}
        </div>
      )}

      {/* Time Details Grid */}
      <div className={`grid grid-cols-3 gap-3 text-sm mb-4 ${isVoided ? 'line-through' : ''}`}>
        <div>
          <span className="block text-xs text-gray-500 uppercase font-medium mb-1">Check-In</span>
          <span className="text-gray-900 font-medium">{checkInTimeDisplay}</span>
        </div>
        <div>
          <span className="block text-xs text-gray-500 uppercase font-medium mb-1">Check-Out</span>
          <span className={checkOutTimeDisplay ? 'text-gray-900 font-medium' : (isVoided ? 'text-gray-400 font-medium text-xs' : 'text-red-600 font-medium text-xs')}>
            {checkOutTimeDisplay || 'Not checked out'}
          </span>
        </div>
        <div>
          <span className="block text-xs text-gray-500 uppercase font-medium mb-1">Hours</span>
          <span className={`font-black ${isVoided ? 'text-gray-400' : !entry.checkOutTime ? 'text-red-600' : 'text-gray-900'}`}>
            {hoursDisplay}
          </span>
        </div>
      </div>

      {/* Actions */}
      {!isVoided && (
        <div className="flex gap-2 pt-3 border-t border-gray-200">
          {hasHistory && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onViewHistory(entry)}
              aria-label="View change history"
              className="min-h-[44px]"
            >
              View History
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onEdit(entry)}
            aria-label="Edit this entry"
            className="min-h-[44px]"
          >
            Edit
          </Button>
        </div>
      )}
    </article>
  );
}
