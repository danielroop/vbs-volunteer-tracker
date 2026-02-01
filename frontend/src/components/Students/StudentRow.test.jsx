import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StudentRow from './StudentRow';

// Mock student data
const mockStudent = {
  id: 'student1',
  firstName: 'John',
  lastName: 'Doe',
  schoolName: 'Central High',
  gradeLevel: '10',
  gradYear: '2027',
  eventTotal: 12.50
};

const mockStudentNoHours = {
  ...mockStudent,
  id: 'student2',
  eventTotal: 0
};

// Helper to render row inside a table
const renderInTable = (ui) => {
  return render(
    <table>
      <tbody>
        {ui}
      </tbody>
    </table>
  );
};

describe('StudentRow', () => {
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
      renderInTable(<StudentRow {...defaultProps} />);

      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should render graduation year', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      expect(screen.getByText(/Grad: 2027/i)).toBeInTheDocument();
    });

    it('should render school name', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      expect(screen.getByText('Central High')).toBeInTheDocument();
    });

    it('should render grade level', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      expect(screen.getByText(/Grade 10/i)).toBeInTheDocument();
    });

    it('should render event hours with green style when > 0', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      const hoursElement = screen.getByText('12.50');
      expect(hoursElement).toHaveClass('bg-green-50', 'text-green-700');
    });

    it('should render event hours with gray style when 0', () => {
      renderInTable(<StudentRow {...defaultProps} student={mockStudentNoHours} />);

      const hoursElement = screen.getByText('0.00');
      expect(hoursElement).toHaveClass('bg-gray-50', 'text-gray-400');
    });

    it('should render selection checkbox', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(checkbox).toBeInTheDocument();
    });

    it('should render View Detail button', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      const button = screen.getByRole('button', { name: /View Detail/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('should show checkbox as unchecked when isSelected is false', () => {
      renderInTable(<StudentRow {...defaultProps} isSelected={false} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(checkbox).not.toBeChecked();
    });

    it('should show checkbox as checked when isSelected is true', () => {
      renderInTable(<StudentRow {...defaultProps} isSelected={true} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(checkbox).toBeChecked();
    });

    it('should apply selected background styling when isSelected is true', () => {
      renderInTable(<StudentRow {...defaultProps} isSelected={true} />);

      const row = screen.getByRole('row');
      expect(row).toHaveClass('bg-primary-50');
    });

    it('should not apply selected styling when isSelected is false', () => {
      renderInTable(<StudentRow {...defaultProps} isSelected={false} />);

      const row = screen.getByRole('row');
      expect(row).not.toHaveClass('bg-primary-50');
    });
  });

  describe('interactions', () => {
    it('should call onToggleSelection when checkbox is clicked', async () => {
      const user = userEvent.setup();
      const onToggleSelection = vi.fn();
      renderInTable(<StudentRow {...defaultProps} onToggleSelection={onToggleSelection} />);

      const checkbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(checkbox);

      expect(onToggleSelection).toHaveBeenCalledWith('student1');
    });

    it('should call onViewDetail when View Detail button is clicked', async () => {
      const user = userEvent.setup();
      const onViewDetail = vi.fn();
      renderInTable(<StudentRow {...defaultProps} onViewDetail={onViewDetail} />);

      const button = screen.getByRole('button', { name: /View Detail/i });
      await user.click(button);

      expect(onViewDetail).toHaveBeenCalledWith('student1');
    });
  });

  describe('accessibility', () => {
    it('should render as a table row', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      const row = screen.getByRole('row');
      expect(row).toBeInTheDocument();
    });

    it('should have accessible checkbox label with student name', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-label', 'Select John Doe');
    });

    it('should have hover state class', () => {
      renderInTable(<StudentRow {...defaultProps} />);

      const row = screen.getByRole('row');
      expect(row).toHaveClass('hover:bg-gray-50');
    });
  });

  describe('edge cases', () => {
    it('should handle missing gradYear gracefully', () => {
      const studentNoGrad = { ...mockStudent, gradYear: '' };
      renderInTable(<StudentRow {...defaultProps} student={studentNoGrad} />);

      expect(screen.getByText(/Grad: ----/i)).toBeInTheDocument();
    });

    it('should handle missing schoolName gracefully', () => {
      const studentNoSchool = { ...mockStudent, schoolName: '' };
      renderInTable(<StudentRow {...defaultProps} student={studentNoSchool} />);

      expect(screen.getByText('---')).toBeInTheDocument();
    });

    it('should handle missing gradeLevel gracefully', () => {
      const studentNoGrade = { ...mockStudent, gradeLevel: '' };
      renderInTable(<StudentRow {...defaultProps} student={studentNoGrade} />);

      expect(screen.getByText(/Grade --/i)).toBeInTheDocument();
    });

    it('should handle undefined gradYear gracefully', () => {
      const studentUndefinedGrad = { ...mockStudent, gradYear: undefined };
      renderInTable(<StudentRow {...defaultProps} student={studentUndefinedGrad} />);

      expect(screen.getByText(/Grad: ----/i)).toBeInTheDocument();
    });

    it('should render correct hours for floating point values', () => {
      const studentDecimalHours = { ...mockStudent, eventTotal: 3.75 };
      renderInTable(<StudentRow {...defaultProps} student={studentDecimalHours} />);

      expect(screen.getByText('3.75')).toBeInTheDocument();
    });
  });
});
