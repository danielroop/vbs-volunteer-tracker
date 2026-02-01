import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceLogEntry from './ServiceLogEntry';

// Mock Button component
vi.mock('../common/Button', () => ({
  default: ({ children, onClick, variant, size, className, 'aria-label': ariaLabel }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}));

// Helper to create Firestore-like timestamp object
const createTimestamp = (dateString) => ({
  toDate: () => new Date(dateString),
  seconds: Math.floor(new Date(dateString).getTime() / 1000)
});

describe('ServiceLogEntry', () => {
  const mockEntry = {
    id: 'entry1',
    checkInTime: createTimestamp('2026-01-31T08:00:00'),
    checkOutTime: createTimestamp('2026-01-31T12:00:00'),
    actualHours: 4.0,
    flags: [],
    forcedCheckoutReason: null,
    modificationReason: null,
    changeLog: []
  };

  const mockActivity = {
    id: 'activity1',
    name: 'Morning Session'
  };

  const defaultProps = {
    entry: mockEntry,
    activity: mockActivity,
    mode: 'card',
    onEdit: vi.fn(),
    onViewHistory: vi.fn()
  };

  describe('card mode rendering', () => {
    it('should render as a card when mode is "card"', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByTestId('service-log-card')).toBeInTheDocument();
      expect(screen.queryByTestId('service-log-row')).not.toBeInTheDocument();
    });

    it('should render date in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      // The date should be rendered
      expect(screen.getByText(/1\/31\/2026/)).toBeInTheDocument();
    });

    it('should render activity name badge in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByText('Morning Session')).toBeInTheDocument();
    });

    it('should render check-in time label in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByText('Check-In')).toBeInTheDocument();
    });

    it('should render check-out time label in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByText('Check-Out')).toBeInTheDocument();
    });

    it('should render hours label in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByText('Hours')).toBeInTheDocument();
    });

    it('should render hours value in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByText('4.00')).toBeInTheDocument();
    });

    it('should render Edit button in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });

    it('should have aria-label on card article', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      const article = screen.getByRole('article');
      expect(article).toHaveAttribute('aria-label', expect.stringContaining('Service log entry'));
    });
  });

  describe('row mode rendering', () => {
    it('should render as a table row when mode is "row"', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByTestId('service-log-row')).toBeInTheDocument();
      expect(screen.queryByTestId('service-log-card')).not.toBeInTheDocument();
    });

    it('should render activity name in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByText('Morning Session')).toBeInTheDocument();
    });

    it('should render hours value in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByText('4.00')).toBeInTheDocument();
    });

    it('should render Edit button in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe('entry without checkout', () => {
    const entryNoCheckout = {
      ...mockEntry,
      checkOutTime: null,
      actualHours: null
    };

    it('should display "Not checked out" when no checkout time in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryNoCheckout} mode="card" />);

      expect(screen.getByText('Not checked out')).toBeInTheDocument();
    });

    it('should display "Not checked out" when no checkout time in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={entryNoCheckout} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByText('Not checked out')).toBeInTheDocument();
    });

    it('should display "--" for hours when no checkout in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryNoCheckout} mode="card" />);

      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('should apply red background styling in card mode for unchecked entries', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryNoCheckout} mode="card" />);

      const card = screen.getByTestId('service-log-card');
      expect(card).toHaveClass('border-red-200', 'bg-red-50');
    });

    it('should apply red background styling in row mode for unchecked entries', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={entryNoCheckout} mode="row" />
          </tbody>
        </table>
      );

      const row = screen.getByTestId('service-log-row');
      expect(row).toHaveClass('bg-red-50');
    });
  });

  describe('entry with forced checkout', () => {
    const entryForced = {
      ...mockEntry,
      forcedCheckoutReason: 'End of day'
    };

    it('should display forced checkout indicator in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryForced} mode="card" />);

      expect(screen.getByTitle('Forced checkout')).toBeInTheDocument();
    });

    it('should display forced checkout indicator in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={entryForced} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByTitle('Forced checkout')).toBeInTheDocument();
    });

    it('should apply blue background styling in card mode for forced entries', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryForced} mode="card" />);

      const card = screen.getByTestId('service-log-card');
      expect(card).toHaveClass('border-blue-200', 'bg-blue-50');
    });
  });

  describe('entry with modification', () => {
    const entryModified = {
      ...mockEntry,
      modificationReason: 'Time adjusted by supervisor'
    };

    it('should display modification indicator in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryModified} mode="card" />);

      expect(screen.getByTitle('Modified')).toBeInTheDocument();
    });

    it('should display modification indicator in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={entryModified} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByTitle('Modified')).toBeInTheDocument();
    });
  });

  describe('entry with flags', () => {
    const entryFlagged = {
      ...mockEntry,
      flags: ['early_arrival', 'late_stay']
    };

    it('should display early arrival flag in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryFlagged} mode="card" />);

      expect(screen.getByTitle('Early arrival')).toBeInTheDocument();
    });

    it('should display late stay flag in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryFlagged} mode="card" />);

      expect(screen.getByTitle('Late stay')).toBeInTheDocument();
    });

    it('should display flags in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={entryFlagged} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByTitle('Early arrival')).toBeInTheDocument();
      expect(screen.getByTitle('Late stay')).toBeInTheDocument();
    });
  });

  describe('entry with change history', () => {
    const entryWithHistory = {
      ...mockEntry,
      changeLog: [{ timestamp: '2026-01-31T14:00:00', description: 'Changed time' }]
    };

    it('should show View History button when change log exists in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={entryWithHistory} mode="card" />);

      expect(screen.getByRole('button', { name: /view.*history/i })).toBeInTheDocument();
    });

    it('should show View link when change log exists in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={entryWithHistory} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
    });

    it('should not show View History button when no history exists in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} entry={mockEntry} mode="card" />);

      expect(screen.queryByRole('button', { name: /view.*history/i })).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('should call onEdit when Edit button is clicked in card mode', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(<ServiceLogEntry {...defaultProps} onEdit={onEdit} mode="card" />);

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(onEdit).toHaveBeenCalledWith(mockEntry);
    });

    it('should call onEdit when Edit button is clicked in row mode', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();

      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} onEdit={onEdit} mode="row" />
          </tbody>
        </table>
      );

      await user.click(screen.getByRole('button', { name: /edit/i }));

      expect(onEdit).toHaveBeenCalledWith(mockEntry);
    });

    it('should call onViewHistory when View History button is clicked in card mode', async () => {
      const user = userEvent.setup();
      const onViewHistory = vi.fn();
      const entryWithHistory = {
        ...mockEntry,
        changeLog: [{ timestamp: '2026-01-31T14:00:00' }]
      };

      render(
        <ServiceLogEntry
          {...defaultProps}
          entry={entryWithHistory}
          onViewHistory={onViewHistory}
          mode="card"
        />
      );

      await user.click(screen.getByRole('button', { name: /view.*history/i }));

      expect(onViewHistory).toHaveBeenCalledWith(entryWithHistory);
    });

    it('should call onViewHistory when View link is clicked in row mode', async () => {
      const user = userEvent.setup();
      const onViewHistory = vi.fn();
      const entryWithHistory = {
        ...mockEntry,
        changeLog: [{ timestamp: '2026-01-31T14:00:00' }]
      };

      render(
        <table>
          <tbody>
            <ServiceLogEntry
              {...defaultProps}
              entry={entryWithHistory}
              onViewHistory={onViewHistory}
              mode="row"
            />
          </tbody>
        </table>
      );

      await user.click(screen.getByRole('button', { name: /view/i }));

      expect(onViewHistory).toHaveBeenCalledWith(entryWithHistory);
    });
  });

  describe('edge cases', () => {
    it('should handle missing activity gracefully in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} activity={null} mode="card" />);

      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('should handle missing activity gracefully in row mode', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} activity={null} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByText('--')).toBeInTheDocument();
    });

    it('should default to row mode when mode prop is not provided', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry entry={mockEntry} activity={mockActivity} onEdit={vi.fn()} onViewHistory={vi.fn()} />
          </tbody>
        </table>
      );

      // Default mode is 'row'
      expect(screen.getByTestId('service-log-row')).toBeInTheDocument();
    });

    it('should handle zero hours worked', () => {
      const entryZeroHours = {
        ...mockEntry,
        actualHours: 0
      };

      render(<ServiceLogEntry {...defaultProps} entry={entryZeroHours} mode="card" />);

      expect(screen.getByText('0.00')).toBeInTheDocument();
    });

    it('should handle entry with both forced checkout and modification', () => {
      const entryBothReasons = {
        ...mockEntry,
        forcedCheckoutReason: 'End of day',
        modificationReason: 'Time adjusted'
      };

      render(<ServiceLogEntry {...defaultProps} entry={entryBothReasons} mode="card" />);

      expect(screen.getByTitle('Forced checkout')).toBeInTheDocument();
      expect(screen.getByTitle('Modified')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have appropriate role for card view', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      expect(screen.getByRole('article')).toBeInTheDocument();
    });

    it('should have appropriate role for row view', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByRole('row')).toBeInTheDocument();
    });

    it('should have accessible Edit button', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveAttribute('aria-label', 'Edit this entry');
    });

    it('should have min-height for touch targets on buttons in card mode', () => {
      render(<ServiceLogEntry {...defaultProps} mode="card" />);

      const editButton = screen.getByRole('button', { name: /edit/i });
      expect(editButton).toHaveClass('min-h-[44px]');
    });
  });
});
