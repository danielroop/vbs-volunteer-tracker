import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Scanner-specific Header Component
 * Minimal header design optimized for mobile scanning use
 *
 * This is intentionally different from the main admin Header
 * to provide a streamlined experience during check-in/check-out operations.
 */
export default function ScannerHeader() {
  const { signOut, canAccessAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleExit = async () => {
    if (canAccessAdmin()) {
      navigate('/admin');
      return;
    }

    await handleSignOut();
  };

  return (
    <div className="bg-white shadow-sm border-b mb-6">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary-600">Scan Mode</p>
          <h1 className="text-sm font-black text-gray-950">VBS Volunteer Tracker</h1>
        </div>

        <button
          onClick={handleExit}
          className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200"
        >
          Exit Scan Mode
        </button>
      </div>
    </div>
  );
}
