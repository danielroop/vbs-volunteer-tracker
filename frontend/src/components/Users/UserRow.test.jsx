import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserRow from './UserRow';

const mockUser = {
  id: 'user1',
  name: 'Jane Smith',
  email: 'jane@example.com',
  role: 'admin',
  isActive: true
};

const mockVolunteer = {
  id: 'user2',
  name: 'Bob Jones',
  email: 'bob@example.com',
  role: 'adult_volunteer',
  isActive: true
};

const mockInactiveUser = {
  id: 'user3',
  name: 'Inactive User',
  email: 'inactive@example.com',
  role: 'adult_volunteer',
  isActive: false
};

const mockUnnamedUser = {
  id: 'user4',
  name: '',
  email: 'noname@example.com',
  role: 'admin',
  isActive: true
};

const getRoleBadge = (role) => (
  <span data-testid="role-badge">{role === 'admin' ? 'Admin' : 'Adult Volunteer'}</span>
);

const getStatusBadge = (isActive) => (
  <span data-testid="status-badge">{isActive !== false ? 'Active' : 'Inactive'}</span>
);

// Helper to render UserRow inside a table
const renderInTable = (ui) => {
  return render(
    <table>
      <tbody>
        {ui}
      </tbody>
    </table>
  );
};

describe('UserRow', () => {
  const defaultProps = {
    userItem: mockUser,
    isSelf: false,
    onEdit: vi.fn(),
    onResetPassword: vi.fn(),
    onDelete: vi.fn(),
    getRoleBadge,
    getStatusBadge
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render user name', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should render user email', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should render role badge', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Admin');
    });

    it('should render status badge', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Active');
    });

    it('should render Unnamed User when name is empty', () => {
      renderInTable(<UserRow {...defaultProps} userItem={mockUnnamedUser} />);
      expect(screen.getByText('Unnamed User')).toBeInTheDocument();
    });

    it('should render volunteer role badge for adult_volunteer', () => {
      renderInTable(<UserRow {...defaultProps} userItem={mockVolunteer} />);
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Adult Volunteer');
    });

    it('should render inactive status badge', () => {
      renderInTable(<UserRow {...defaultProps} userItem={mockInactiveUser} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Inactive');
    });

    it('should render as a table row element', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByRole('row')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('should render Edit button', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should render Reset Password button', () => {
      renderInTable(<UserRow {...defaultProps} />);
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('should render Delete button when not self', () => {
      renderInTable(<UserRow {...defaultProps} isSelf={false} />);
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should not render Delete button when isSelf is true', () => {
      renderInTable(<UserRow {...defaultProps} isSelf={true} />);
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onEdit with user when Edit is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      renderInTable(<UserRow {...defaultProps} onEdit={onEdit} />);

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(onEdit).toHaveBeenCalledWith(mockUser);
    });

    it('should call onResetPassword with user when Reset Password is clicked', async () => {
      const user = userEvent.setup();
      const onResetPassword = vi.fn();
      renderInTable(<UserRow {...defaultProps} onResetPassword={onResetPassword} />);

      await user.click(screen.getByRole('button', { name: /reset password/i }));
      expect(onResetPassword).toHaveBeenCalledWith(mockUser);
    });

    it('should call onDelete with user when Delete is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      renderInTable(<UserRow {...defaultProps} onDelete={onDelete} />);

      await user.click(screen.getByRole('button', { name: /delete/i }));
      expect(onDelete).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('styling', () => {
    it('should have hover transition styling on the row', () => {
      renderInTable(<UserRow {...defaultProps} />);
      const row = screen.getByRole('row');
      expect(row).toHaveClass('hover:bg-primary-50', 'transition-colors');
    });
  });
});
