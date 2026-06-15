import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeEntryCard from './TimeEntryCard';

// Mock Button component
vi.mock('../common/Button', () => ({
  default: ({ children, onClick, variant, size, 'aria-label': ariaLabel }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}));

describe('TimeEntryCard', () => {
  const mockEntry = {
    id: 'entry1',
    date: '2026-01-31',
    student: {
      firstName: 'John',
      lastName: 'Doe'
    },
    activity: {
      name: 'Morning Session'
    },
    checkInTime: new Date('2026-01-31T08:00:00'),
    checkOutTime: new Date('2026-01-31T12:00:00'),
    hoursWorked: 4,
    flags: [],
    forcedCheckoutReason: null,
    modificationReason: null
  };

  const mockFormatTime = (date) => {
    if (!date) return '--';
    return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const mockFormatHours = (hours) => `${hours.toFixed(1)} hours`;

  const mockGetStatusDisplay = (entry) => {
    if (!entry.checkOutTime) return '🔴 No Checkout';
    if (entry.forcedCheckoutReason) return '⚡ Forced';
    if (entry.modificationReason) return '✏️ Modified';
    if (entry.flags && entry.flags.length > 0) return '⚠️ Flagged';
    return '✓ Complete';
  };

  const mockGetStatusClass = (entry) => {
    if (!entry.checkOutTime) return 'text-red-600';
    if (entry.forcedCheckoutReason || entry.modificationReason) return 'text-blue-600';
    if (entry.flags && entry.flags.length > 0) return 'text-amber-600';
    return 'text-green-600';
  };

  const defaultProps = {
    entry: mockEntry,
    formatTime: mockFormatTime,
    formatHours: mockFormatHours,
    getStatusDisplay: mockGetStatusDisplay,
    getStatusClass: mockGetStatusClass,
    onEdit: vi.fn(),
    onQuickCheckIn: vi.fn(),
    onForceCheckout: vi.fn()
  };

  describe('rendering', () => {
    it('should render student name', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should render activity name', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByText('Morning Session')).toBeInTheDocument();
    });

    it('should render check-in time', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByText('Check-In')).toBeInTheDocument();
    });

    it('should render check-out time', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByText('Check-Out')).toBeInTheDocument();
    });

    it('should render hours worked', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByText('4.0 hours')).toBeInTheDocument();
    });

    it('should render status', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByText('✓ Complete')).toBeInTheDocument();
    });

    it('should render Edit button', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should not render Checkout button when checked out', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /^checkout/i })).not.toBeInTheDocument();
    });
  });

  describe('entry without checkout', () => {
    const entryNoCheckout = {
      ...mockEntry,
      checkOutTime: null,
      hoursWorked: null
    };

    it('should display "Not checked out" when no checkout time', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckout} />);

      expect(screen.getByText('Not checked out')).toBeInTheDocument();
    });

    it('should render Checkout button when not checked out', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckout} />);

      expect(screen.getByRole('button', { name: /^checkout/i })).toBeInTheDocument();
    });

    it('should display No Checkout status', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckout} />);

      expect(screen.getByText('🔴 No Checkout')).toBeInTheDocument();
    });

    it('should display -- for hours when null', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckout} />);

      expect(screen.getByText('--')).toBeInTheDocument();
    });
  });

  describe('entry with forced checkout', () => {
    const entryForced = {
      ...mockEntry,
      forcedCheckoutReason: 'End of day'
    };

    it('should display override reason', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryForced} />);

      expect(screen.getByText(/Override: End of day/)).toBeInTheDocument();
    });

    it('should display Forced status', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryForced} />);

      expect(screen.getByText('⚡ Forced')).toBeInTheDocument();
    });
  });

  describe('entry with modification', () => {
    const entryModified = {
      ...mockEntry,
      modificationReason: 'Time adjusted by supervisor'
    };

    it('should display modification reason', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryModified} />);

      expect(screen.getByText(/Override: Time adjusted by supervisor/)).toBeInTheDocument();
    });

    it('should display Modified status', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryModified} />);

      expect(screen.getByText('✏️ Modified')).toBeInTheDocument();
    });
  });

  describe('entry with flags', () => {
    const entryFlagged = {
      ...mockEntry,
      flags: ['early_arrival', 'late_stay']
    };

    it('should display flag badges', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryFlagged} />);

      expect(screen.getByText('Early arrival')).toBeInTheDocument();
      expect(screen.getByText('Late stay')).toBeInTheDocument();
    });

    it('should display Flagged status', () => {
      render(<TimeEntryCard {...defaultProps} entry={entryFlagged} />);

      expect(screen.getByText('⚠️ Flagged')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onEdit when Edit button is clicked', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(<TimeEntryCard {...defaultProps} onEdit={onEdit} />);

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(onEdit).toHaveBeenCalledWith(mockEntry);
    });

    it('should call onForceCheckout when Checkout button is clicked', async () => {
      const user = userEvent.setup();
      const onForceCheckout = vi.fn();
      const entryNoCheckout = { ...mockEntry, checkOutTime: null };

      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckout} onForceCheckout={onForceCheckout} />);

      await user.click(screen.getByRole('button', { name: /^checkout/i }));

      expect(onForceCheckout).toHaveBeenCalledWith(entryNoCheckout);
    });

    it('should call onQuickCheckIn when Check In button is clicked', async () => {
      const user = userEvent.setup();
      const onQuickCheckIn = vi.fn();
      const entryNoCheckIn = { ...mockEntry, checkInTime: null, checkOutTime: null, isNoCheckIn: true };

      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckIn} onQuickCheckIn={onQuickCheckIn} />);

      await user.click(screen.getByRole('button', { name: /check in john doe/i }));

      expect(onQuickCheckIn).toHaveBeenCalledWith(entryNoCheckIn);
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on the card article', () => {
      render(<TimeEntryCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', 'Time entry for John Doe');
    });

    it('should have title attributes for truncation', () => {
      render(<TimeEntryCard {...defaultProps} />);

      const nameElement = screen.getByText('Doe, John');
      expect(nameElement).toHaveAttribute('title', 'Doe, John');

      const activityElement = screen.getByText('Morning Session');
      expect(activityElement).toHaveAttribute('title', 'Morning Session');
    });

    it('should have aria-label on Edit button', () => {
      render(<TimeEntryCard {...defaultProps} />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveAttribute('aria-label', 'Edit time entry for John Doe');
    });

    it('should have aria-label on Checkout button when visible', () => {
      const entryNoCheckout = { ...mockEntry, checkOutTime: null };
      render(<TimeEntryCard {...defaultProps} entry={entryNoCheckout} />);

      const checkoutButton = screen.getByRole('button', { name: /^checkout/i });
      expect(checkoutButton).toHaveAttribute('aria-label', 'Checkout for John Doe');
    });
  });

  describe('edge cases', () => {
    it('should handle missing activity gracefully', () => {
      const entryNoActivity = {
        ...mockEntry,
        activity: null
      };

      render(<TimeEntryCard {...defaultProps} entry={entryNoActivity} />);

      // Should render -- for missing activity
      expect(screen.getByTitle('--')).toBeInTheDocument();
    });

    it('should handle unknown student gracefully', () => {
      const entryUnknown = {
        ...mockEntry,
        student: { firstName: 'Unknown', lastName: 'Student' }
      };

      render(<TimeEntryCard {...defaultProps} entry={entryUnknown} />);

      expect(screen.getByText('Student, Unknown')).toBeInTheDocument();
    });

    it('should handle zero hours worked', () => {
      const entryZeroHours = {
        ...mockEntry,
        hoursWorked: 0
      };

      render(<TimeEntryCard {...defaultProps} entry={entryZeroHours} />);

      expect(screen.getByText('0.0 hours')).toBeInTheDocument();
    });
  });
});
