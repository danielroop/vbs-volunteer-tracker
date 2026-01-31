import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PrintableBadge from './PrintableBadge';

// Mock qrcode.react
vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value, size }) => (
    <svg data-testid="qr-code" data-value={value} data-size={size}>
      QR Code Mock
    </svg>
  )
}));

// Mock qrCodeGenerator
vi.mock('../../utils/qrCodeGenerator', () => ({
  generateQRData: (studentId, eventId) => `${studentId}:${eventId}`
}));

describe('PrintableBadge', () => {
  const mockStudent = {
    id: 'student123',
    firstName: 'John',
    lastName: 'Doe'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render student name', () => {
      render(<PrintableBadge student={mockStudent} />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should render student ID', () => {
      render(<PrintableBadge student={mockStudent} />);

      expect(screen.getByText('ID: student123')).toBeInTheDocument();
    });

    it('should render QR code', () => {
      render(<PrintableBadge student={mockStudent} />);

      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toBeInTheDocument();
    });

    it('should have correct badge container class', () => {
      const { container } = render(<PrintableBadge student={mockStudent} />);

      expect(container.querySelector('.student-badge')).toBeInTheDocument();
    });
  });

  describe('QR code data', () => {
    it('should generate QR data with eventId when provided', () => {
      render(<PrintableBadge student={mockStudent} eventId="event456" />);

      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toHaveAttribute('data-value', 'student123:event456');
    });

    it('should use student ID as QR data when no eventId provided', () => {
      render(<PrintableBadge student={mockStudent} />);

      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toHaveAttribute('data-value', 'student123');
    });
  });

  describe('size prop', () => {
    it('should render normal size QR code by default (120px)', () => {
      render(<PrintableBadge student={mockStudent} />);

      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toHaveAttribute('data-size', '120');
    });

    it('should render normal size QR code when size is "normal"', () => {
      render(<PrintableBadge student={mockStudent} size="normal" />);

      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toHaveAttribute('data-size', '120');
    });

    it('should render large size QR code when size is "large" (150px)', () => {
      render(<PrintableBadge student={mockStudent} size="large" />);

      const qrCode = screen.getByTestId('qr-code');
      expect(qrCode).toHaveAttribute('data-size', '150');
    });
  });

  describe('event name', () => {
    it('should render event name when provided', () => {
      render(
        <PrintableBadge
          student={mockStudent}
          eventId="event456"
          eventName="VBS 2026"
        />
      );

      expect(screen.getByText('VBS 2026')).toBeInTheDocument();
    });

    it('should not render event name when not provided', () => {
      render(<PrintableBadge student={mockStudent} eventId="event456" />);

      // The badge-event div should not be present
      const { container } = render(<PrintableBadge student={mockStudent} />);
      expect(container.querySelector('.badge-event')).not.toBeInTheDocument();
    });

    it('should have badge-event class on event name element', () => {
      const { container } = render(
        <PrintableBadge
          student={mockStudent}
          eventId="event456"
          eventName="Summer Camp"
        />
      );

      const eventElement = container.querySelector('.badge-event');
      expect(eventElement).toBeInTheDocument();
      expect(eventElement).toHaveTextContent('Summer Camp');
    });
  });

  describe('CSS classes', () => {
    it('should have badge-name class on name element', () => {
      const { container } = render(<PrintableBadge student={mockStudent} />);

      const nameElement = container.querySelector('.badge-name');
      expect(nameElement).toBeInTheDocument();
      expect(nameElement).toHaveTextContent('John Doe');
    });

    it('should have badge-id class on ID element', () => {
      const { container } = render(<PrintableBadge student={mockStudent} />);

      const idElement = container.querySelector('.badge-id');
      expect(idElement).toBeInTheDocument();
      expect(idElement).toHaveTextContent('ID: student123');
    });

    it('should have badge-qr class on QR container', () => {
      const { container } = render(<PrintableBadge student={mockStudent} />);

      const qrContainer = container.querySelector('.badge-qr');
      expect(qrContainer).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle student with only first name', () => {
      const studentWithOnlyFirst = {
        id: 'student789',
        firstName: 'Jane',
        lastName: ''
      };

      render(<PrintableBadge student={studentWithOnlyFirst} />);

      expect(screen.getByText('Jane')).toBeInTheDocument();
    });

    it('should handle student with spaces in name', () => {
      const studentWithMiddleName = {
        id: 'student101',
        firstName: 'Mary Jane',
        lastName: 'Watson Parker'
      };

      render(<PrintableBadge student={studentWithMiddleName} />);

      expect(screen.getByText('Mary Jane Watson Parker')).toBeInTheDocument();
    });

    it('should handle special characters in event name', () => {
      render(
        <PrintableBadge
          student={mockStudent}
          eventId="event123"
          eventName="VBS 2026 - Summer Edition"
        />
      );

      expect(screen.getByText('VBS 2026 - Summer Edition')).toBeInTheDocument();
    });
  });
});
