import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('ServiceLogEntry - Voided Entry', () => {
  const mockActivity = {
    id: 'activity1',
    name: 'Morning Session'
  };

  const baseEntry = {
    id: 'entry1',
    checkInTime: createTimestamp('2026-01-31T08:00:00'),
    checkOutTime: createTimestamp('2026-01-31T12:00:00'),
    actualHours: 4.0,
    flags: [],
    forcedCheckoutReason: null,
    modificationReason: null,
    changeLog: [],
    isVoided: false,
    voidReason: null
  };

  const voidedEntry = {
    ...baseEntry,
    isVoided: true,
    voidReason: 'Duplicate scan - student was scanned twice'
  };

  const defaultProps = {
    activity: mockActivity,
    onEdit: vi.fn(),
    onViewHistory: vi.fn()
  };

  describe('row mode - voided entry', () => {
    it('should have reduced opacity on voided row', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="row" />
          </tbody>
        </table>
      );

      const row = screen.getByTestId('service-log-row');
      expect(row).toHaveClass('opacity-50');
    });

    it('should have gray background on voided row', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="row" />
          </tbody>
        </table>
      );

      const row = screen.getByTestId('service-log-row');
      expect(row).toHaveClass('bg-gray-100');
    });

    it('should display VOIDED text in status column', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByText('VOIDED')).toBeInTheDocument();
    });

    it('should NOT render Edit button for voided row', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    });

    it('should have title with void reason on voided row', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="row" />
          </tbody>
        </table>
      );

      const row = screen.getByTestId('service-log-row');
      expect(row).toHaveAttribute('title', 'Voided: Duplicate scan - student was scanned twice');
    });

    it('should NOT show forced checkout indicator when voided', () => {
      const voidedWithForce = {
        ...voidedEntry,
        forcedCheckoutReason: 'End of day'
      };

      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={voidedWithForce} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.queryByTitle('Forced checkout')).not.toBeInTheDocument();
    });

    it('should still render Edit button for non-voided entry', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={baseEntry} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  describe('card mode - voided entry', () => {
    it('should have reduced opacity on voided card', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      const card = screen.getByTestId('service-log-card');
      expect(card).toHaveClass('opacity-50');
    });

    it('should have gray background on voided card', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      const card = screen.getByTestId('service-log-card');
      expect(card).toHaveClass('bg-gray-100');
    });

    it('should display VOIDED text in status', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      expect(screen.getByText('VOIDED')).toBeInTheDocument();
    });

    it('should display void reason', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      expect(screen.getByText(/Duplicate scan - student was scanned twice/)).toBeInTheDocument();
    });

    it('should NOT render action buttons for voided card', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /view.*history/i })).not.toBeInTheDocument();
    });

    it('should include (voided) in aria-label', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      const card = screen.getByTestId('service-log-card');
      expect(card).toHaveAttribute('aria-label', expect.stringContaining('(voided)'));
    });

    it('should have strikethrough on date for voided card', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={voidedEntry} mode="card" />
      );

      const dateElement = screen.getByText(/1\/31\/2026/);
      expect(dateElement).toHaveClass('line-through');
    });
  });

  describe('non-voided entry behavior unchanged', () => {
    it('should NOT have reduced opacity for non-voided row', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={baseEntry} mode="row" />
          </tbody>
        </table>
      );

      const row = screen.getByTestId('service-log-row');
      expect(row).not.toHaveClass('opacity-50');
    });

    it('should NOT display VOIDED text for non-voided entry', () => {
      render(
        <table>
          <tbody>
            <ServiceLogEntry {...defaultProps} entry={baseEntry} mode="row" />
          </tbody>
        </table>
      );

      expect(screen.queryByText('VOIDED')).not.toBeInTheDocument();
    });

    it('should render Edit button for non-voided card', () => {
      render(
        <ServiceLogEntry {...defaultProps} entry={baseEntry} mode="card" />
      );

      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });
});
