import React from 'react';

/**
 * StudentRow Component
 * Desktop table row view for students (used on screens >= md breakpoint)
 *
 * @param {Object} student - The student object with name, school, grade, and hours data
 * @param {boolean} isSelected - Whether the student is currently selected
 * @param {Function} onToggleSelection - Callback when selection checkbox is toggled
 * @param {Function} onViewDetail - Callback when View Detail button is clicked
 */
export default function StudentRow({
  student,
  isSelected,
  onToggleSelection,
  onViewDetail
}) {
  const hasHours = student.eventTotal > 0;

  return (
    <tr
      className={`group hover:bg-gray-50 transition-colors ${
        isSelected ? 'bg-primary-50' : ''
      }`}
    >
      <td className="px-4 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection(student.id)}
          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
          aria-label={`Select ${student.firstName} ${student.lastName}`}
        />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-bold text-gray-900">
          {student.lastName}, {student.firstName}
        </div>
        <div className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
          Grad: {student.gradYear || '----'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-600">{student.schoolName || '---'}</div>
        <div className="text-[10px] font-black text-primary-500 uppercase">
          Grade {student.gradeLevel || '--'}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <span
          className={`inline-block px-3 py-1 rounded-full text-sm font-black ${
            hasHours
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-gray-50 text-gray-400'
          }`}
        >
          {student.eventTotal.toFixed(2)}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <button
          onClick={() => onViewDetail(student.id)}
          className="text-primary-600 font-bold text-xs bg-white border border-primary-200 px-4 py-1.5 rounded-lg hover:bg-primary-600 hover:text-white transition-all shadow-sm"
        >
          View Detail →
        </button>
      </td>
    </tr>
  );
}
