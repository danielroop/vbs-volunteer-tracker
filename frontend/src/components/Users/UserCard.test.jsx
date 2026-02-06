import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserCard from './UserCard';

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

describe('UserCard', () => {
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
      render(<UserCard {...defaultProps} />);
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });

    it('should render user email', () => {
      render(<UserCard {...defaultProps} />);
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    it('should render role badge', () => {
      render(<UserCard {...defaultProps} />);
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Admin');
    });

    it('should render status badge', () => {
      render(<UserCard {...defaultProps} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Active');
    });

    it('should render Unnamed User when name is empty', () => {
      render(<UserCard {...defaultProps} userItem={mockUnnamedUser} />);
      expect(screen.getByText('Unnamed User')).toBeInTheDocument();
    });

    it('should render volunteer role badge for adult_volunteer', () => {
      render(<UserCard {...defaultProps} userItem={mockVolunteer} />);
      expect(screen.getByTestId('role-badge')).toHaveTextContent('Adult Volunteer');
    });

    it('should render inactive status badge', () => {
      render(<UserCard {...defaultProps} userItem={mockInactiveUser} />);
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Inactive');
    });
  });

  describe('action buttons', () => {
    it('should render Edit button', () => {
      render(<UserCard {...defaultProps} />);
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should render Reset Password button', () => {
      render(<UserCard {...defaultProps} />);
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('should render Delete button when not self', () => {
      render(<UserCard {...defaultProps} isSelf={false} />);
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should not render Delete button when isSelf is true', () => {
      render(<UserCard {...defaultProps} isSelf={true} />);
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onEdit with user when Edit is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      render(<UserCard {...defaultProps} onEdit={onEdit} />);

      await user.click(screen.getByRole('button', { name: /edit/i }));
      expect(onEdit).toHaveBeenCalledWith(mockUser);
    });

    it('should call onResetPassword with user when Reset Password is clicked', async () => {
      const user = userEvent.setup();
      const onResetPassword = vi.fn();
      render(<UserCard {...defaultProps} onResetPassword={onResetPassword} />);

      await user.click(screen.getByRole('button', { name: /reset password/i }));
      expect(onResetPassword).toHaveBeenCalledWith(mockUser);
    });

    it('should call onDelete with user when Delete is clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      render(<UserCard {...defaultProps} onDelete={onDelete} />);

      await user.click(screen.getByRole('button', { name: /delete/i }));
      expect(onDelete).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('accessibility', () => {
    it('should have proper article structure with aria-label', () => {
      render(<UserCard {...defaultProps} />);
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', 'User card for Jane Smith');
    });

    it('should be wrapped in a list item', () => {
      render(<UserCard {...defaultProps} />);
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    it('should use Unnamed User in aria-label when name is empty', () => {
      render(<UserCard {...defaultProps} userItem={mockUnnamedUser} />);
      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', 'User card for Unnamed User');
    });
  });

  describe('styling', () => {
    it('should have card styling with border and shadow', () => {
      render(<UserCard {...defaultProps} />);
      const article = screen.getByRole('article');
      expect(article).toHaveClass('bg-white', 'border', 'rounded-xl', 'shadow-sm');
    });

    it('should have a divider between badges and action buttons', () => {
      render(<UserCard {...defaultProps} />);
      const actionRow = screen.getByRole('button', { name: /edit/i }).closest('div');
      expect(actionRow).toHaveClass('border-t', 'border-gray-100');
    });
  });
});
