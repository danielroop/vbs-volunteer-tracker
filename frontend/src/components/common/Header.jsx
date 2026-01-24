import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEvent } from '../../contexts/EventContext';
import Button from './Button';

/**
 * Reusable Header Component for Admin Pages
 * Provides consistent navigation and branding across the application
 *
 * @param {Object} props
 * @param {string} props.title - Optional page title to display (overrides default)
 * @param {boolean} props.showNavTabs - Whether to show navigation tabs (default: true)
 * @param {boolean} props.showEventIndicator - Whether to show active event (default: true)
 * @param {React.ReactNode} props.actions - Optional action buttons to display in header
 */
export default function Header({
  title,
  showNavTabs = true,
  showEventIndicator = true,
  actions,
}) {
  const { user, signOut } = useAuth();
  const { currentEvent } = useEvent();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  // Navigation tabs configuration
  const navTabs = [
    { path: '/admin', label: 'Dashboard', exact: true },
    { path: '/admin/daily-review', label: 'Daily Review' },
    { path: '/admin/students', label: 'Students' },
    { path: '/admin/events', label: 'Events' },
    { path: '/admin/users', label: 'Users' },
  ];

  // Check if a tab is active
  const isTabActive = (tab) => {
    if (tab.exact) {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Row: Title, Event Indicator, User Info */}
        <div className="flex items-center justify-between">
          {/* Left: App Title */}
          <div className="flex items-center gap-4">
            <Link to="/admin" className="text-2xl font-bold text-gray-900 hover:text-primary-600 transition-colors">
              {title || 'VBS Volunteer Tracker'}
            </Link>
          </div>

          {/* Center: Active Event Indicator */}
          {showEventIndicator && (
            <div className="hidden md:flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-sm font-medium text-gray-600">
                Active Event: <span className="text-primary-600">{currentEvent?.name || 'No Event Selected'}</span>
              </span>
            </div>
          )}

          {/* Right: User Info & Actions */}
          <div className="flex items-center gap-4">
            {actions}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-gray-600 text-sm">{user?.email}</span>
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Logout
              </Button>
            </div>
            {/* Mobile logout */}
            <div className="sm:hidden">
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Logout
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile Event Indicator */}
        {showEventIndicator && (
          <div className="md:hidden flex items-center gap-2 mt-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            <span className="text-xs font-medium text-gray-600">
              Active: <span className="text-primary-600">{currentEvent?.name || 'None'}</span>
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      {showNavTabs && (
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto border-t border-gray-100 pt-2 pb-0 -mb-px">
            {navTabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  isTabActive(tab)
                    ? 'text-primary-600 border-b-2 border-primary-600'
                    : 'text-gray-600 hover:text-gray-900 border-b-2 border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
