import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Scanner-specific Header Component
 * Minimal header design optimized for mobile scanning use
 *
 * This is intentionally different from the main admin Header
 * to provide a streamlined experience during check-in/check-out operations.
 */
export default function ScannerHeader() {
  const { userProfile, signOut, canAccessAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="bg-white shadow-sm border-b mb-6">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: User Info & Role Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{userProfile?.name || userProfile?.email}</span>
          <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-blue-100 text-blue-700">
            {userProfile?.role === 'admin' ? 'Admin' : 'Volunteer'}
          </span>
        </div>

        {/* Right: Navigation & Actions */}
        <div className="flex items-center gap-2">
          {canAccessAdmin() && (
            <Link
              to="/admin"
              className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
            >
              Dashboard
            </Link>
          )}
          <button
            onClick={handleSignOut}
            className="text-xs font-bold text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
