import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeEntryCard from './TimeEntryCard';

// Mock Button component
vi.mock('../common/Button', () => ({
  default: ({ children, onClick, variant, size, disabled, 'aria-label': ariaLabel }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}));

describe('TimeEntryCard - Void/Restore functionality', () => {
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
    modificationReason: null,
    isVoided: false,
    voidReason: null
  };

  const mockFormatTime = (date) => {
    if (!date) return '--';
    return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const mockFormatHours = (hours) => `${hours.toFixed(1)} hours`;

  const mockGetStatusDisplay = (entry) => {
    if (entry.isVoided) return 'VOIDED';
    if (!entry.checkOutTime) return '🔴 No Checkout';
    return '✓ Complete';
  };

  const mockGetStatusClass = (entry) => {
    if (entry.isVoided) return 'text-gray-400';
    if (!entry.checkOutTime) return 'text-red-600';
    return 'text-green-600';
  };

  const defaultProps = {
    entry: mockEntry,
    formatTime: mockFormatTime,
    formatHours: mockFormatHours,
    getStatusDisplay: mockGetStatusDisplay,
    getStatusClass: mockGetStatusClass,
    onEdit: vi.fn(),
    onForceCheckout: vi.fn(),
    onVoid: vi.fn(),
    onRestore: vi.fn()
  };

  describe('active (non-voided) entry', () => {
    it('should render Void button for active entries', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /void time entry/i })).toBeInTheDocument();
    });

    it('should render Edit button for active entries', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should NOT render Restore button for active entries', () => {
      render(<TimeEntryCard {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /restore/i })).not.toBeInTheDocument();
    });

    it('should call onVoid when Void button is clicked', async () => {
      const user = userEvent.setup();
      const onVoid = vi.fn();

      render(<TimeEntryCard {...defaultProps} onVoid={onVoid} />);

      await user.click(screen.getByRole('button', { name: /void time entry/i }));

      expect(onVoid).toHaveBeenCalledWith(mockEntry);
    });

    it('should not have reduced opacity', () => {
      render(<TimeEntryCard {...defaultProps} />);

      const article = screen.getByRole('article');
      expect(article).not.toHaveClass('opacity-50');
    });

    it('should not have strikethrough on student name', () => {
      render(<TimeEntryCard {...defaultProps} />);

      const nameElement = screen.getByText('Doe, John');
      expect(nameElement).not.toHaveClass('line-through');
    });
  });

  describe('voided entry', () => {
    const voidedEntry = {
      ...mockEntry,
      isVoided: true,
      voidReason: 'Duplicate entry created by accident'
    };

    it('should render Restore button for voided entries', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      expect(screen.getByRole('button', { name: /restore/i })).toBeInTheDocument();
    });

    it('should NOT render Edit button for voided entries', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should NOT render Void button for voided entries', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      expect(screen.queryByRole('button', { name: /void time entry/i })).not.toBeInTheDocument();
    });

    it('should call onRestore when Restore button is clicked', async () => {
      const user = userEvent.setup();
      const onRestore = vi.fn();

      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} onRestore={onRestore} />);

      await user.click(screen.getByRole('button', { name: /restore/i }));

      expect(onRestore).toHaveBeenCalledWith(voidedEntry);
    });

    it('should have reduced opacity on the card', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('opacity-50');
    });

    it('should have gray background on the card', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      const article = screen.getByRole('article');
      expect(article).toHaveClass('bg-gray-100');
    });

    it('should have strikethrough on student name', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      const nameElement = screen.getByText('Doe, John');
      expect(nameElement).toHaveClass('line-through');
    });

    it('should display VOIDED status', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      expect(screen.getByText('VOIDED')).toBeInTheDocument();
    });

    it('should display void reason', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      expect(screen.getByText(/Duplicate entry created by accident/)).toBeInTheDocument();
    });

    it('should have tooltip with voided reason on the card', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('title', 'Voided: Duplicate entry created by accident');
    });

    it('should include (voided) in aria-label', () => {
      render(<TimeEntryCard {...defaultProps} entry={voidedEntry} />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('(voided)'));
    });

    it('should not show override reasons when voided', () => {
      const voidedWithOverride = {
        ...voidedEntry,
        forcedCheckoutReason: 'End of day'
      };

      render(<TimeEntryCard {...defaultProps} entry={voidedWithOverride} />);

      expect(screen.queryByText(/Override:/)).not.toBeInTheDocument();
    });

    it('should not show flag badges when voided', () => {
      const voidedWithFlags = {
        ...voidedEntry,
        flags: ['early_arrival', 'late_stay']
      };

      render(<TimeEntryCard {...defaultProps} entry={voidedWithFlags} />);

      expect(screen.queryByText('Early arrival')).not.toBeInTheDocument();
      expect(screen.queryByText('Late stay')).not.toBeInTheDocument();
    });
  });
});
