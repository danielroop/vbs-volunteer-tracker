import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentCard from './StudentCard';

// Mock student data
const mockStudent = {
  id: 'student1',
  firstName: 'John',
  lastName: 'Doe',
  schoolName: 'Central High',
  gradeLevel: '10',
  gradYear: '2027',
  eventTotal: 12.50,
  phone: '',
  email: ''
};

const mockStudentWithContact = {
  ...mockStudent,
  id: 'student2',
  phone: '555-123-4567',
  email: 'john@example.com'
};

const mockStudentNoHours = {
  ...mockStudent,
  id: 'student3',
  eventTotal: 0
};

describe('StudentCard', () => {
  const defaultProps = {
    student: mockStudent,
    isSelected: false,
    onToggleSelection: vi.fn(),
    onViewDetail: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render student name in Last, First format', () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should render graduation year', () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText(/Grad: 2027/i)).toBeInTheDocument();
    });

    it('should render school name', () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText('Central High')).toBeInTheDocument();
    });

    it('should render grade level', () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.getByText(/Grade 10/i)).toBeInTheDocument();
    });

    it('should render event hours with green style when > 0', () => {
      render(<StudentCard {...defaultProps} />);

      const hoursElement = screen.getByText('12.50');
      expect(hoursElement).toHaveClass('bg-green-50', 'text-green-700');
    });

    it('should render event hours with gray style when 0', () => {
      render(<StudentCard {...defaultProps} student={mockStudentNoHours} />);

      const hoursElement = screen.getByText('0.00');
      expect(hoursElement).toHaveClass('bg-gray-50', 'text-gray-400');
    });

    it('should render selection checkbox', () => {
      render(<StudentCard {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(checkbox).toBeInTheDocument();
    });

    it('should show checkbox as checked when isSelected is true', () => {
      render(<StudentCard {...defaultProps} isSelected={true} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(checkbox).toBeChecked();
    });

    it('should apply selected styling when isSelected is true', () => {
      render(<StudentCard {...defaultProps} isSelected={true} />);

      const article = screen.getByRole('button');
      expect(article).toHaveClass('border-primary-400', 'bg-primary-50');
    });
  });

  describe('contact actions', () => {
    it('should not render phone/email buttons when no contact info', () => {
      render(<StudentCard {...defaultProps} />);

      expect(screen.queryByRole('link', { name: /Call/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Email/i })).not.toBeInTheDocument();
    });

    it('should render call button when phone is provided', () => {
      render(<StudentCard {...defaultProps} student={mockStudentWithContact} />);

      const callLink = screen.getByRole('link', { name: /Call John Doe/i });
      expect(callLink).toBeInTheDocument();
      expect(callLink).toHaveAttribute('href', 'tel:555-123-4567');
    });

    it('should render email button when email is provided', () => {
      render(<StudentCard {...defaultProps} student={mockStudentWithContact} />);

      const emailLink = screen.getByRole('link', { name: /Email John Doe/i });
      expect(emailLink).toBeInTheDocument();
      expect(emailLink).toHaveAttribute('href', 'mailto:john@example.com');
    });

    it('should not trigger card click when clicking call link', async () => {
      const user = userEvent.setup();
      const onViewDetail = vi.fn();
      render(
        <StudentCard
          {...defaultProps}
          student={mockStudentWithContact}
          onViewDetail={onViewDetail}
        />
      );

      const callLink = screen.getByRole('link', { name: /Call John Doe/i });
      await user.click(callLink);

      expect(onViewDetail).not.toHaveBeenCalled();
    });
  });

  describe('interactions', () => {
    it('should call onToggleSelection when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onToggleSelection = vi.fn();
      render(<StudentCard {...defaultProps} onToggleSelection={onToggleSelection} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(checkbox);

      expect(onToggleSelection).toHaveBeenCalledWith('student1');
    });

    it('should call onViewDetail when card is clicked', async () => {
      const user = userEvent.setup();
      const onViewDetail = vi.fn();
      render(<StudentCard {...defaultProps} onViewDetail={onViewDetail} />);

      const card = screen.getByRole('button');
      await user.click(card);

      expect(onViewDetail).toHaveBeenCalledWith('student1');
    });

    it('should not call onViewDetail when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onViewDetail = vi.fn();
      render(<StudentCard {...defaultProps} onViewDetail={onViewDetail} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(checkbox);

      expect(onViewDetail).not.toHaveBeenCalled();
    });

    it('should call onViewDetail when Enter key is pressed on card', () => {
      const onViewDetail = vi.fn();
      render(<StudentCard {...defaultProps} onViewDetail={onViewDetail} />);

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: 'Enter' });

      expect(onViewDetail).toHaveBeenCalledWith('student1');
    });

    it('should call onViewDetail when Space key is pressed on card', () => {
      const onViewDetail = vi.fn();
      render(<StudentCard {...defaultProps} onViewDetail={onViewDetail} />);

      const card = screen.getByRole('button');
      fireEvent.keyDown(card, { key: ' ' });

      expect(onViewDetail).toHaveBeenCalledWith('student1');
    });
  });

  describe('accessibility', () => {
    it('should have proper article structure', () => {
      render(<StudentCard {...defaultProps} />);

      const article = screen.getByRole('button');
      expect(article.tagName).toBe('ARTICLE');
    });

    it('should have accessible aria-label for the card', () => {
      render(<StudentCard {...defaultProps} />);

      const card = screen.getByRole('button', { name: /View details for John Doe/i });
      expect(card).toBeInTheDocument();
    });

    it('should have accessible checkbox label', () => {
      render(<StudentCard {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(checkbox).toHaveAttribute('aria-label');
    });

    it('should be keyboard focusable', () => {
      render(<StudentCard {...defaultProps} />);

      const card = screen.getByRole('button');
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    it('should be wrapped in a list item', () => {
      render(<StudentCard {...defaultProps} />);

      const listItem = screen.getByRole('listitem');
      expect(listItem).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing gradYear gracefully', () => {
      const studentNoGrad = { ...mockStudent, gradYear: '' };
      render(<StudentCard {...defaultProps} student={studentNoGrad} />);

      expect(screen.getByText(/Grad: ----/i)).toBeInTheDocument();
    });

    it('should handle missing schoolName gracefully', () => {
      const studentNoSchool = { ...mockStudent, schoolName: '' };
      render(<StudentCard {...defaultProps} student={studentNoSchool} />);

      expect(screen.getByText('---')).toBeInTheDocument();
    });

    it('should handle missing gradeLevel gracefully', () => {
      const studentNoGrade = { ...mockStudent, gradeLevel: '' };
      render(<StudentCard {...defaultProps} student={studentNoGrade} />);

      expect(screen.getByText(/Grade --/i)).toBeInTheDocument();
    });

    it('should handle whitespace-only phone number', () => {
      const studentWhitespacePhone = { ...mockStudent, phone: '   ' };
      render(<StudentCard {...defaultProps} student={studentWhitespacePhone} />);

      expect(screen.queryByRole('link', { name: /Call/i })).not.toBeInTheDocument();
    });

    it('should handle whitespace-only email', () => {
      const studentWhitespaceEmail = { ...mockStudent, email: '   ' };
      render(<StudentCard {...defaultProps} student={studentWhitespaceEmail} />);

      expect(screen.queryByRole('link', { name: /Email/i })).not.toBeInTheDocument();
    });
  });
});
