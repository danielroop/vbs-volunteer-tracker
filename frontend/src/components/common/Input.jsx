import React from 'react';

/**
 * Reusable Input component
 * @param {Object} props
 * @param {string} props.label - Input label
 * @param {string} props.type - Input type
 * @param {string} props.error - Error message
 * @param {string} props.helperText - Helper text
 * @param {string} props.className - Additional CSS classes
 */
export default function Input({
  label,
  type = 'text',
  error,
  helperText,
  className = '',
  ...props
}) {
  const inputClasses = `
    input-field
    ${error ? 'border-red-500 focus:ring-red-500' : ''}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}
