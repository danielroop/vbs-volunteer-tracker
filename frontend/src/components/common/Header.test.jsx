import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Header from './Header';

const mockSignOut = vi.fn();
const mockSwitchActiveEvent = vi.fn();
const mockUser = { email: 'admin@test.com', uid: 'admin123' };
const mockCurrentEvent = { id: 'event123', name: 'VBS 2026' };
const mockEvents = [
  mockCurrentEvent,
  { id: 'event2025', name: 'VBS 2025' },
];

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    signOut: mockSignOut,
  }),
}));

vi.mock('../../contexts/EventContext', () => ({
  useEvent: () => ({
    currentEvent: mockCurrentEvent,
    events: mockEvents,
    switchActiveEvent: mockSwitchActiveEvent,
  }),
}));

const renderWithRouter = (ui, { route = '/admin' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the admin workspace shell', () => {
    renderWithRouter(<Header />);

    expect(screen.getAllByRole('link', { name: 'VBS Volunteer Tracker' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('combobox', { name: 'Active Event' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('VBS 2026').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/admin/settings');
  });

  it('renders custom title when provided', () => {
    renderWithRouter(<Header title="Custom Title" />);
    expect(screen.getAllByRole('link', { name: 'Custom Title' }).length).toBeGreaterThanOrEqual(1);
  });

  it('keeps operational links separate from settings pages', () => {
    renderWithRouter(<Header />);

    expect(screen.getAllByRole('link', { name: 'Dashboard' }).some(link => link.getAttribute('href') === '/admin')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Daily Review' }).some(link => link.getAttribute('href') === '/admin/daily-review')).toBe(true);
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/admin/settings');
    expect(screen.queryByRole('link', { name: 'Events' })).not.toBeInTheDocument();
    // Students is now under Settings, not in the Operations nav
    expect(screen.queryByRole('link', { name: 'Students' })).not.toBeInTheDocument();
  });

  it('highlights settings when a settings route is active', () => {
    renderWithRouter(<Header />, { route: '/admin/settings/users' });

    expect(screen.getByRole('link', { name: /settings/i })).toHaveClass('bg-gray-100');
  });

  it('highlights active operational links', () => {
    renderWithRouter(<Header />, { route: '/admin/daily-review' });

    const dailyReviewLinks = screen.getAllByRole('link', { name: 'Daily Review' });
    expect(dailyReviewLinks.some(link => link.classList.contains('bg-primary-50'))).toBe(true);
  });

  it('switches the active event from the context switcher', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Header />);

    await user.selectOptions(screen.getAllByRole('combobox', { name: 'Active Event' })[0], 'event2025');

    expect(mockSwitchActiveEvent).toHaveBeenCalledWith('event2025');
  });

  it('renders the Scan action as the prominent app switcher', () => {
    renderWithRouter(<Header />);

    const scanLinks = screen.getAllByRole('link', { name: 'Scan' });
    expect(scanLinks.some(link => link.getAttribute('href') === '/scan')).toBe(true);
    expect(scanLinks.some(link => link.classList.contains('bg-primary-600'))).toBe(true);
  });

  it('hides nav groups when showNavTabs is false', () => {
    renderWithRouter(<Header showNavTabs={false} />);

    expect(screen.queryByRole('link', { name: 'Daily Review' })).not.toBeInTheDocument();
  });

  it('hides event indicator text when showEventIndicator is false', () => {
    renderWithRouter(<Header showEventIndicator={false} />);

    expect(screen.queryByText(/Active Event:/)).not.toBeInTheDocument();
    expect(screen.queryByText('admin@test.com')).not.toBeInTheDocument();
  });

  it('renders custom actions', () => {
    renderWithRouter(<Header actions={<button>Custom Action</button>} />);

    expect(screen.getByRole('button', { name: 'Custom Action' })).toBeInTheDocument();
  });

  it('signs out from the desktop shell', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Header />);

    await user.click(screen.getAllByRole('button', { name: /logout/i })[0]);

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('toggles and closes the mobile menu', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Header />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    expect(screen.getByRole('button', { name: /close menu/i })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getAllByRole('link', { name: 'Daily Review' })[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });
  });

  it('closes the mobile menu when Scan is clicked', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Header />);

    await user.click(screen.getByRole('button', { name: /open menu/i }));
    const mobileScan = screen.getAllByRole('link', { name: 'Scan' }).find(link => link.classList.contains('text-center'));
    await user.click(mobileScan);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
    });
  });

  it('wires mobile menu accessibility attributes', () => {
    renderWithRouter(<Header />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu');
  });
});
