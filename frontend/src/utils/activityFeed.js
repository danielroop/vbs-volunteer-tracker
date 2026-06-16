export const convertToDate = (timeValue) => {
  if (!timeValue) return null;
  if (timeValue instanceof Date) return timeValue;
  if (typeof timeValue.toDate === 'function') return timeValue.toDate();
  return new Date(timeValue);
};

export const formatActivityTime = (timeValue) => {
  const date = convertToDate(timeValue);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString() : '--';
};

export const formatActivityDateTime = (timeValue) => {
  const date = convertToDate(timeValue);
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '--';
};

const getMethodLabel = (method) => {
  if (method === 'manual') return 'manual';
  if (method === 'self_scan') return 'self-scan';
  if (method === 'av_scan') return 'AV scan';
  return 'scan';
};

const getChangeTypeLabel = (type) => {
  switch (type) {
    case 'void':
      return 'Voided';
    case 'restore':
      return 'Restored';
    case 'force_checkout':
    case 'bulk_force_checkout':
      return 'Forced Check-Out';
    case 'edit':
    default:
      return 'Modified';
  }
};

export const buildActivityItems = (timeEntries, studentNameMap, activityNameMap, limit) => {
  const items = timeEntries
    .flatMap(entry => {
      const studentName = studentNameMap[entry.studentId] || 'Student';
      const activityName = activityNameMap[entry.activityId] || 'Activity';
      const entryItems = [];
      const isManualEntry = entry.entry_source === 'manual' || (
        entry.checkInMethod === 'manual' && entry.checkOutMethod === 'manual'
      );

      if (isManualEntry) {
        const actionTime = convertToDate(entry.modifiedAt || entry.createdAt || entry.checkInTime);
        entryItems.push({
          id: `${entry.id}-manual-entry`,
          studentName,
          activityId: entry.activityId,
          actionLabel: 'Manual Entry',
          detail: `${activityName} logged`,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      } else if (entry.checkInTime) {
        const actionTime = convertToDate(entry.checkInTime);
        entryItems.push({
          id: `${entry.id}-check-in`,
          studentName,
          activityId: entry.activityId,
          actionLabel: 'Check-In',
          detail: `${activityName} via ${getMethodLabel(entry.checkInMethod)}`,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      }

      if (!isManualEntry && entry.checkOutTime) {
        const actionTime = convertToDate(entry.checkOutTime);
        entryItems.push({
          id: `${entry.id}-check-out`,
          studentName,
          activityId: entry.activityId,
          actionLabel: 'Check-Out',
          detail: `${activityName} via ${getMethodLabel(entry.checkOutMethod)}`,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      }

      (entry.changeLog || []).forEach((change, index) => {
        const actionTime = convertToDate(change.timestamp);
        entryItems.push({
          id: `${entry.id}-change-${index}`,
          studentName,
          activityId: entry.activityId,
          actionLabel: getChangeTypeLabel(change.type),
          detail: change.description || activityName,
          actionTime,
          sortTime: actionTime?.getTime() || 0
        });
      });

      return entryItems;
    })
    .sort((a, b) => b.sortTime - a.sortTime);

  return typeof limit === 'number' ? items.slice(0, limit) : items;
};
