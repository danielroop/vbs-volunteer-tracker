import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEvent } from '../../contexts/EventContext';
import Button from './Button';

/**
 * Reusable Header Component for Admin Pages
 * Provides consistent navigation and branding across the application
 * Features responsive hamburger menu for mobile devices
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
    <header className="bg-white shadow-sm border-b" ref={menuRef}>
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Row: Title, Event Indicator, User Info */}
        <div className="flex items-center justify-between">
          {/* Left: Hamburger Menu (mobile) + App Title */}
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button - visible on mobile only */}
            {showNavTabs && (
              <button
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? (
                  // X icon when menu is open
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  // Hamburger icon when menu is closed
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
            <Link to="/admin" className="text-xl sm:text-2xl font-bold text-gray-900 hover:text-primary-600 transition-colors">
              {title || 'VBS Volunteer Tracker'}
            </Link>
          </div>

          {/* Center: Active Event Indicator - hidden on mobile */}
          {showEventIndicator && (
            <div className="hidden lg:flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              <span className="text-sm font-medium text-gray-600">
                Active Event: <span className="text-primary-600">{currentEvent?.name || 'No Event Selected'}</span>
              </span>
            </div>
          )}

          {/* Right: User Info & Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            {actions}
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-gray-600 text-sm">{user?.email}</span>
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Logout
              </Button>
            </div>
            {/* Mobile logout - only show if nav tabs are hidden (otherwise in hamburger) */}
            {!showNavTabs && (
              <div className="sm:hidden">
                <Button variant="secondary" size="sm" onClick={handleSignOut}>
                  Logout
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Event Indicator - visible on small/medium screens */}
        {showEventIndicator && (
          <div className="lg:hidden flex items-center gap-2 mt-2">
            <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
            <span className="text-xs font-medium text-gray-600">
              Active: <span className="text-primary-600">{currentEvent?.name || 'None'}</span>
            </span>
          </div>
        )}
      </div>

      {/* Desktop Navigation Tabs - hidden on mobile */}
      {showNavTabs && (
        <div className="hidden md:block max-w-7xl mx-auto px-4">
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

      {/* Mobile Navigation Menu - Dropdown */}
      {showNavTabs && mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="px-4 py-2 space-y-1">
            {navTabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                className={`block px-4 py-3 rounded-lg font-medium text-sm transition-colors ${
                  isTabActive(tab)
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </Link>
            ))}
            {/* Mobile user info and logout */}
            <div className="border-t border-gray-100 mt-2 pt-2">
              <div className="px-4 py-2 text-xs text-gray-500">
                Signed in as: {user?.email}
              </div>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 rounded-lg font-medium text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
