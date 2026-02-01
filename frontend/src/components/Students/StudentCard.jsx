import React from 'react';

/**
 * StudentCard Component
 * Mobile-friendly card view for students (used on screens < md breakpoint)
 *
 * @param {Object} student - The student object with name, school, grade, and hours data
 * @param {boolean} isSelected - Whether the student is currently selected
 * @param {Function} onToggleSelection - Callback when selection checkbox is toggled
 * @param {Function} onViewDetail - Callback when card is clicked to view details
 */
export default function StudentCard({
  student,
  isSelected,
  onToggleSelection,
  onViewDetail
}) {
  const studentName = `${student.lastName}, ${student.firstName}`;
  const hasHours = student.eventTotal > 0;
  const hasPhone = student.phone && student.phone.trim() !== '';
  const hasEmail = student.email && student.email.trim() !== '';

  const handleCardClick = (e) => {
    // Don't navigate if clicking on checkbox, links, or action buttons
    if (
      e.target.closest('input[type="checkbox"]') ||
      e.target.closest('a') ||
      e.target.closest('button')
    ) {
      return;
    }
    onViewDetail(student.id);
  };

  const handleKeyDown = (e) => {
    // Allow navigation with Enter or Space key
    if (e.key === 'Enter' || e.key === ' ') {
      if (
        e.target.closest('input[type="checkbox"]') ||
        e.target.closest('a') ||
        e.target.closest('button')
      ) {
        return;
      }
      e.preventDefault();
      onViewDetail(student.id);
    }
  };

  return (
    <li className="list-none">
      <article
        className={`bg-white border rounded-xl p-4 shadow-sm transition-all cursor-pointer
          ${isSelected ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200' : 'border-gray-200'}
          active:scale-[0.98] active:bg-gray-50 hover:border-gray-300`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={`View details for ${student.firstName} ${student.lastName}`}
      >
        {/* Header: Checkbox, Name, and Hours Badge */}
        <div className="flex items-start gap-3 mb-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(student.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-5 h-5 mt-0.5 text-primary-600 border-gray-300 rounded focus:ring-primary-500 cursor-pointer flex-shrink-0"
            aria-label={`Select ${student.firstName} ${student.lastName}`}
          />
          <div className="flex-1 min-w-0">
            <h3
              className="font-bold text-gray-900 text-base truncate"
              title={studentName}
            >
              {studentName}
            </h3>
            <span className="text-[10px] text-gray-400 font-medium uppercase tracking-tighter">
              Grad: {student.gradYear || '----'}
            </span>
          </div>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-black flex-shrink-0 ${
              hasHours
                ? 'bg-green-50 text-green-700 border border-green-100'
                : 'bg-gray-50 text-gray-400'
            }`}
            aria-label={`${student.eventTotal.toFixed(2)} event hours`}
          >
            {student.eventTotal.toFixed(2)}
          </span>
        </div>

        {/* School and Grade Info */}
        <div className="mb-3 pl-8">
          <div className="text-sm text-gray-600">{student.schoolName || '---'}</div>
          <div className="text-[10px] font-black text-primary-500 uppercase">
            Grade {student.gradeLevel || '--'}
          </div>
        </div>

        {/* Quick Actions: Phone and Email */}
        {(hasPhone || hasEmail) && (
          <div className="flex gap-2 pl-8 pt-2 border-t border-gray-100">
            {hasPhone && (
              <a
                href={`tel:${student.phone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label={`Call ${student.firstName} ${student.lastName}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
                Call
              </a>
            )}
            {hasEmail && (
              <a
                href={`mailto:${student.email}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                aria-label={`Email ${student.firstName} ${student.lastName}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                Email
              </a>
            )}
          </div>
        )}
      </article>
    </li>
  );
}
