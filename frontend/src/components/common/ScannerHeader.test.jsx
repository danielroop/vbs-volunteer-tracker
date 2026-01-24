import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ScannerHeader from './ScannerHeader';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext - default to admin user
const mockSignOut = vi.fn().mockResolvedValue(undefined);
let mockUserProfile = { name: 'Admin User', email: 'admin@test.com', role: 'admin' };
let mockCanAccessAdmin = vi.fn(() => true);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: mockUserProfile,
    signOut: mockSignOut,
    canAccessAdmin: mockCanAccessAdmin,
  }),
}));

// Helper to render with router
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
    mockUserProfile = { name: 'Admin User', email: 'admin@test.com', role: 'admin' };
    mockCanAccessAdmin = vi.fn(() => true);
  });

  describe('rendering', () => {
    it('should render user name when available', () => {
      renderWithRouter(<ScannerHeader />);
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    it('should render user email when name is not available', () => {
      mockUserProfile = { email: 'user@test.com', role: 'admin' };
      renderWithRouter(<ScannerHeader />);
      expect(screen.getByText('user@test.com')).toBeInTheDocument();
    });

    it('should render admin role badge for admin users', () => {
      mockUserProfile = { name: 'Test User', email: 'admin@test.com', role: 'admin' };
      renderWithRouter(<ScannerHeader />);
      // Get the badge by its styling class
      const badges = screen.getAllByText('Admin');
      expect(badges.length).toBeGreaterThanOrEqual(1);
      // Find the one with the badge styling
      const badge = badges.find(el => el.classList.contains('uppercase'));
      expect(badge).toBeInTheDocument();
    });

    it('should render volunteer role badge for volunteer users', () => {
      mockUserProfile = { name: 'Test User', email: 'volunteer@test.com', role: 'adult_volunteer' };
      renderWithRouter(<ScannerHeader />);
      // Get the badge by its styling class
      const badges = screen.getAllByText('Volunteer');
      expect(badges.length).toBeGreaterThanOrEqual(1);
      // Find the one with the badge styling
      const badge = badges.find(el => el.classList.contains('uppercase'));
      expect(badge).toBeInTheDocument();
    });

    it('should render logout button', () => {
      renderWithRouter(<ScannerHeader />);
      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    });
  });

  describe('admin access', () => {
    it('should show Dashboard link for admin users', () => {
      mockCanAccessAdmin = vi.fn(() => true);
      renderWithRouter(<ScannerHeader />);
      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    });

    it('should hide Dashboard link for non-admin users', () => {
      mockCanAccessAdmin = vi.fn(() => false);
      renderWithRouter(<ScannerHeader />);
      expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    });

    it('should link Dashboard to /admin route', () => {
      mockCanAccessAdmin = vi.fn(() => true);
      renderWithRouter(<ScannerHeader />);

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute('href', '/admin');
    });
  });

  describe('logout functionality', () => {
    it('should call signOut when logout button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<ScannerHeader />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it('should navigate to /login after signOut', async () => {
      const user = userEvent.setup();
      renderWithRouter(<ScannerHeader />);

      const logoutButton = screen.getByRole('button', { name: /logout/i });
      await user.click(logoutButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/login');
      });
    });
  });

  describe('styling', () => {
    it('should have the scanner header wrapper class', () => {
      const { container } = renderWithRouter(<ScannerHeader />);

      const header = container.firstChild;
      expect(header).toHaveClass('bg-white');
      expect(header).toHaveClass('shadow-sm');
      expect(header).toHaveClass('border-b');
      expect(header).toHaveClass('mb-6');
    });

    it('should have role badge styling', () => {
      renderWithRouter(<ScannerHeader />);

      const badge = screen.getByText('Admin');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-700');
      expect(badge).toHaveClass('uppercase');
    });
  });

  describe('mobile optimization', () => {
    it('should have max-width constraint for mobile', () => {
      const { container } = renderWithRouter(<ScannerHeader />);

      const innerContainer = container.querySelector('.max-w-md');
      expect(innerContainer).toBeInTheDocument();
    });
  });
});
