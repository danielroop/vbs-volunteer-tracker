import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useEvent } from '../../contexts/EventContext';

/**
 * Admin workspace chrome.
 *
 * The selected event anchors the operational navigation, while system-wide
 * configuration lives in a secondary settings group.
 */
export default function Header({
  title,
  showNavTabs = true,
  showEventIndicator = true,
  actions,
}) {
  const { user, signOut } = useAuth();
  const {
    currentEvent,
    events = [],
    switchActiveEvent,
  } = useEvent();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
  };

  const handleEventChange = async (eventId) => {
    if (!eventId || eventId === currentEvent?.id) return;
    await switchActiveEvent(eventId);
  };

  const closeMenus = () => {
    setMobileMenuOpen(false);
  };

  const operationsNav = [
    { path: '/admin', label: 'Dashboard', exact: true },
    { path: '/admin/daily-review', label: 'Daily Review' },
  ];

  const settingsLink = { path: '/admin/settings', label: 'Settings' };

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.path;
    return location.pathname.startsWith(item.path);
  };

  const isSettingsActive = location.pathname.startsWith('/admin/settings');
  const eventLabel = currentEvent?.name || 'No Event Selected';
  const switcherEvents = currentEvent && !events.some(event => event.id === currentEvent.id)
    ? [currentEvent, ...events]
    : events;

  const EventSwitcher = ({ compact = false }) => (
    <div>
      <label
        htmlFor={compact ? 'mobile-event-switcher' : 'desktop-event-switcher'}
        className="block text-[10px] font-black uppercase tracking-widest text-gray-400"
      >
        Active Event
      </label>
      <select
        id={compact ? 'mobile-event-switcher' : 'desktop-event-switcher'}
        value={currentEvent?.id || ''}
        onChange={(event) => handleEventChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
        aria-label="Active Event"
      >
        {!currentEvent && <option value="">No Event Selected</option>}
        {switcherEvents.map((event) => (
          <option key={event.id} value={event.id}>
            {event.name}
          </option>
        ))}
      </select>
    </div>
  );

  const NavLink = ({ item, mobile = false }) => (
    <Link
      to={item.path}
      onClick={closeMenus}
      className={`flex items-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
        isActive(item)
          ? 'bg-primary-50 text-primary-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
      } ${mobile ? 'text-base' : ''}`}
    >
      {item.label}
    </Link>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white lg:hidden">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            <Link to="/admin" className="min-w-0 flex-1 truncate text-lg font-black text-gray-950">
              {title || 'VBS Volunteer Tracker'}
            </Link>

            {actions}
            <Link
              to="/scan"
              onClick={closeMenus}
              className="rounded-lg bg-primary-600 px-3 py-2 text-center text-xs font-black text-white shadow-sm transition-colors hover:bg-primary-700"
            >
              Scan
            </Link>
          </div>

          {showEventIndicator && (
            <div className="mt-2 flex items-center gap-2 text-xs font-medium text-gray-600">
              <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
              Active Event: <span className="font-bold text-primary-700">{eventLabel}</span>
            </div>
          )}
        </div>

        {showNavTabs && mobileMenuOpen && (
          <div id="mobile-menu" className="border-t border-gray-100 px-4 py-4">
            <EventSwitcher compact />

            <nav className="mt-4 space-y-1" aria-label="Operations">
              {operationsNav.map((item) => (
                <NavLink key={item.path} item={item} mobile />
              ))}
            </nav>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <NavLink item={settingsLink} mobile />
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="px-3 pb-2 text-sm text-gray-500">{user?.email}</p>
              <button
                onClick={handleSignOut}
                className="w-full rounded-lg bg-gray-100 px-3 py-2 text-center text-base font-bold text-gray-700 transition-colors hover:bg-gray-200"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-gray-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-gray-100 p-5">
          <Link to="/admin" className="block text-xl font-black text-gray-950 hover:text-primary-700">
            {title || 'VBS Volunteer Tracker'}
          </Link>
          {showEventIndicator && (
            <p className="mt-1 text-xs text-gray-500">{user?.email}</p>
          )}

          <div className="mt-5">
            <EventSwitcher />
          </div>
        </div>

        {showNavTabs && (
          <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Operations">
            <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
              Operations
            </p>
            {operationsNav.map((item) => (
              <NavLink key={item.path} item={item} />
            ))}
          </nav>
        )}

        <div className="border-t border-gray-100 p-4">
          <Link
            to="/admin/settings"
            onClick={closeMenus}
            className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              isSettingsActive
                ? 'bg-gray-100 text-gray-950'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
            }`}
          >
            ⚙️ Settings
          </Link>

          <Link
            to="/scan"
            onClick={closeMenus}
            className="mt-3 flex w-full items-center justify-center rounded-lg bg-primary-600 px-3 py-2 text-sm font-black text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            Scan
          </Link>

          <button
            onClick={handleSignOut}
            className="mt-3 w-full rounded-lg bg-gray-100 px-3 py-2 text-center text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
