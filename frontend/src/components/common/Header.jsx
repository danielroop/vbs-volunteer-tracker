import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEvent } from '../../contexts/EventContext';
import Button from './Button';

/**
 * Reusable Header Component for Admin Pages
 * Provides consistent navigation and branding across the application
 * Features responsive design with hamburger menu on mobile
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

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
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

  // Check if scan page is active
  const isScanActive = location.pathname.startsWith('/scan');

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Top Row: Title, Event Indicator, User Info */}
        <div className="flex items-center justify-between">
          {/* Left: Mobile Hamburger Menu Button + App Title */}
          <div className="flex items-center gap-3">
            {/* Hamburger Menu Button - Mobile Only */}
            {showNavTabs && (
              <button
                type="button"
                className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                onClick={toggleMobileMenu}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? (
                  // X icon for close
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  // Hamburger icon
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            )}
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

          {/* Right: Scan Button, User Info & Actions */}
          <div className="flex items-center gap-3">
            {actions}
            {/* Scan Button - styled as app switcher */}
            <Link
              to="/scan"
              className={`hidden sm:inline-flex text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                isScanActive
                  ? 'text-white bg-primary-600 hover:bg-primary-700'
                  : 'text-primary-600 bg-primary-50 hover:bg-primary-100'
              }`}
            >
              Scan
            </Link>
            <div className="hidden sm:flex items-center gap-3">
              <span className="text-gray-600 text-sm">{user?.email}</span>
              <Button variant="secondary" size="sm" onClick={handleSignOut}>
                Logout
              </Button>
            </div>
            {/* Mobile logout - only when hamburger menu is not shown */}
            <div className="sm:hidden">
              {!showNavTabs && (
                <Button variant="secondary" size="sm" onClick={handleSignOut}>
                  Logout
                </Button>
              )}
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

      {/* Mobile Menu */}
      {showNavTabs && mobileMenuOpen && (
        <div
          id="mobile-menu"
          className="md:hidden bg-white border-t border-gray-100"
        >
          <div className="px-4 py-3 space-y-1">
            {/* User info in mobile menu */}
            <div className="px-3 py-2 border-b border-gray-100 mb-2">
              <span className="text-sm text-gray-600">{user?.email}</span>
            </div>

            {/* Navigation Links */}
            {navTabs.map((tab) => (
              <Link
                key={tab.path}
                to={tab.path}
                onClick={closeMobileMenu}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isTabActive(tab)
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </Link>
            ))}

            {/* Divider before app switcher */}
            <div className="border-t border-gray-100 my-2"></div>

            {/* Scan Button in Mobile Menu - styled as app switcher */}
            <Link
              to="/scan"
              onClick={closeMobileMenu}
              className={`block mx-3 px-3 py-2 rounded-lg text-center text-base font-bold transition-colors ${
                isScanActive
                  ? 'text-white bg-primary-600'
                  : 'text-primary-600 bg-primary-50 hover:bg-primary-100'
              }`}
            >
              Scan
            </Link>

            {/* Divider before logout */}
            <div className="border-t border-gray-100 my-2"></div>

            {/* Logout in Mobile Menu */}
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Desktop Navigation Tabs */}
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
    </header>
  );
}
