import React from 'react';
import { formatActivityDateTime, formatActivityTime } from '../../utils/activityFeed';

export default function ActivityFeedList({
  items,
  emptyMessage = 'No recent activity',
  timestampFormat = 'time',
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{emptyMessage}</p>;
  }

  const formatTimestamp = timestampFormat === 'datetime'
    ? formatActivityDateTime
    : formatActivityTime;

  return (
    <div className="divide-y divide-gray-100" role="list" aria-label="Activity feed">
      {items.map(item => (
        <div key={item.id} className="py-3" role="listitem">
          <div className="flex justify-between gap-3">
            <span className="font-bold text-gray-800">{item.studentName}</span>
            <span className="whitespace-nowrap text-sm text-gray-500">
              {formatTimestamp(item.actionTime)}
            </span>
          </div>
          <div className="mt-1 flex justify-between gap-3 text-xs">
            <span className="font-semibold text-gray-700">{item.actionLabel}</span>
            <span className="text-right text-gray-500">{item.detail}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
