import React from 'react';

/**
 * UserRow Component
 * Desktop table row view for users (used on screens >= md breakpoint)
 *
 * @param {Object} userItem - The user object with name, email, role, isActive
 * @param {boolean} isSelf - Whether this user is the currently logged-in user
 * @param {Function} onEdit - Callback when Edit button is clicked
 * @param {Function} onResetPassword - Callback when Reset Password button is clicked
 * @param {Function} onDelete - Callback when Delete button is clicked
 * @param {Function} getRoleBadge - Helper function to render role badge
 * @param {Function} getStatusBadge - Helper function to render status badge
 */
export default function UserRow({
  userItem,
  isSelf,
  onEdit,
  onResetPassword,
  onDelete,
  getRoleBadge,
  getStatusBadge
}) {
  return (
    <tr className="group hover:bg-primary-50 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-bold text-gray-900">{userItem.name || 'Unnamed User'}</div>
        <div className="text-xs text-gray-500">{userItem.email}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getRoleBadge(userItem.role)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {getStatusBadge(userItem.isActive)}
      </td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onEdit(userItem)}
            className="text-primary-600 font-bold text-xs bg-white border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-600 hover:text-white transition-all shadow-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onResetPassword(userItem)}
            className="text-orange-600 font-bold text-xs bg-white border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-600 hover:text-white transition-all shadow-sm"
          >
            Reset Password
          </button>
          {!isSelf && (
            <button
              onClick={() => onDelete(userItem)}
              className="text-red-600 font-bold text-xs bg-white border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
            >
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
