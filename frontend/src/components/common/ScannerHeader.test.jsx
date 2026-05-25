import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScannerHeader from './ScannerHeader';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSignOut = vi.fn().mockResolvedValue(undefined);
let mockCanAccessAdmin = vi.fn(() => true);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'fallback@test.com', displayName: 'Fallback User' },
    userProfile: { name: 'Scanner Person', email: 'scanner@test.com', role: 'adult_volunteer' },
    signOut: mockSignOut,
    canAccessAdmin: mockCanAccessAdmin,
  }),
}));

const renderWithRouter = (ui, { route = '/scan' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};

describe('ScannerHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanAccessAdmin = vi.fn(() => true);
  });

  it('renders kiosk scan mode chrome', () => {
    renderWithRouter(<ScannerHeader />);

    expect(screen.getByText('Scan Mode')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'VBS Volunteer Tracker' })).toBeInTheDocument();
    expect(screen.getByText('Signed in as Scanner Person')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Exit Scan Mode' })).toBeInTheDocument();
  });

  it('does not render admin navigation links or logout controls', () => {
    renderWithRouter(<ScannerHeader />);

    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('returns admins to the admin workspace', async () => {
    const user = userEvent.setup();
    mockCanAccessAdmin = vi.fn(() => true);
    renderWithRouter(<ScannerHeader />);

    await user.click(screen.getByRole('button', { name: 'Exit Scan Mode' }));

    expect(mockNavigate).toHaveBeenCalledWith('/admin');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs non-admin scanner users out on exit', async () => {
    const user = userEvent.setup();
    mockCanAccessAdmin = vi.fn(() => false);
    renderWithRouter(<ScannerHeader />);

    await user.click(screen.getByRole('button', { name: 'Exit Scan Mode' }));

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('keeps the compact scanner wrapper styling', () => {
    const { container } = renderWithRouter(<ScannerHeader />);

    const header = container.firstChild;
    expect(header).toHaveClass('bg-white');
    expect(header).toHaveClass('shadow-sm');
    expect(header).toHaveClass('border-b');
    expect(header).toHaveClass('mb-6');
    expect(container.querySelector('.max-w-2xl')).toBeInTheDocument();
  });
});
