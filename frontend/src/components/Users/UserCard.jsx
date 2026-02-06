import React from 'react';

/**
 * UserCard Component
 * Mobile-friendly card view for users (used on screens < md breakpoint)
 *
 * @param {Object} userItem - The user object with name, email, role, isActive
 * @param {boolean} isSelf - Whether this user is the currently logged-in user
 * @param {Function} onEdit - Callback when Edit button is clicked
 * @param {Function} onResetPassword - Callback when Reset Password button is clicked
 * @param {Function} onDelete - Callback when Delete button is clicked
 * @param {Function} getRoleBadge - Helper function to render role badge
 * @param {Function} getStatusBadge - Helper function to render status badge
 */
export default function UserCard({
  userItem,
  isSelf,
  onEdit,
  onResetPassword,
  onDelete,
  getRoleBadge,
  getStatusBadge
}) {
  return (
    <li className="list-none">
      <article
        className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm transition-all hover:border-gray-300"
        aria-label={`User card for ${userItem.name || 'Unnamed User'}`}
      >
        {/* Header: Name and Email */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 text-base truncate">
              {userItem.name || 'Unnamed User'}
            </h3>
            <p className="text-xs text-gray-500 truncate">{userItem.email}</p>
          </div>
        </div>

        {/* Role and Status Badges */}
        <div className="flex items-center gap-2 mb-3">
          {getRoleBadge(userItem.role)}
          {getStatusBadge(userItem.isActive)}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => onEdit(userItem)}
            className="text-primary-600 font-bold text-xs bg-white border border-primary-200 px-3 py-1.5 rounded-lg hover:bg-primary-600 hover:text-white transition-all shadow-sm flex-1"
          >
            Edit
          </button>
          <button
            onClick={() => onResetPassword(userItem)}
            className="text-orange-600 font-bold text-xs bg-white border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-600 hover:text-white transition-all shadow-sm flex-1"
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
      </article>
    </li>
  );
}
