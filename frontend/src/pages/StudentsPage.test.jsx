import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import StudentsPage from './StudentsPage';

// Mock Firebase
vi.mock('../utils/firebase', () => ({
  db: {},
  functions: {}
}));

// Mock data
const mockStudents = [
  { id: 'student1', firstName: 'John', lastName: 'Doe', schoolName: 'Central High', gradeLevel: '10', gradYear: '2027', overrideHours: 0 },
  { id: 'student2', firstName: 'Jane', lastName: 'Smith', schoolName: 'West High', gradeLevel: '11', gradYear: '2026', overrideHours: 0 },
  { id: 'student3', firstName: 'Bob', lastName: 'Johnson', schoolName: 'East High', gradeLevel: '12', gradYear: '2025', overrideHours: 0 },
];

const mockTimeEntries = [
  { studentId: 'student1', eventId: 'event123', activityId: 'activity1', checkInTime: { seconds: 1704096000, toDate: () => new Date('2024-01-01T08:00:00') }, checkOutTime: { seconds: 1704110400, toDate: () => new Date('2024-01-01T12:00:00') } },
  { studentId: 'student2', eventId: 'event123', activityId: 'activity1', checkInTime: { seconds: 1704096000, toDate: () => new Date('2024-01-01T08:00:00') }, checkOutTime: { seconds: 1704110400, toDate: () => new Date('2024-01-01T12:00:00') } },
];

// Track which collection is being queried
let studentsUnsubscribe = vi.fn();
let entriesUnsubscribe = vi.fn();

vi.mock('firebase/firestore', () => {
  // Helper to determine which collection this is
  const getCollectionPath = (queryOrRef) => {
    if (queryOrRef?.path) return queryOrRef.path;
    if (queryOrRef?._query?.path) return queryOrRef._query.path;
    if (queryOrRef?._collectionPath) return queryOrRef._collectionPath;
    return 'unknown';
  };

  return {
    collection: vi.fn((db, path) => ({ path, _collectionPath: path })),
    onSnapshot: vi.fn((queryOrRef, callback) => {
      const path = getCollectionPath(queryOrRef);

      if (path === 'students') {
        // Simulate students data - use queueMicrotask for immediate async execution
        queueMicrotask(() => {
          callback({
            docs: [
              { id: 'student1', data: () => ({ id: 'student1', firstName: 'John', lastName: 'Doe', schoolName: 'Central High', gradeLevel: '10', gradYear: '2027', overrideHours: 0 }) },
              { id: 'student2', data: () => ({ id: 'student2', firstName: 'Jane', lastName: 'Smith', schoolName: 'West High', gradeLevel: '11', gradYear: '2026', overrideHours: 0 }) },
              { id: 'student3', data: () => ({ id: 'student3', firstName: 'Bob', lastName: 'Johnson', schoolName: 'East High', gradeLevel: '12', gradYear: '2025', overrideHours: 0 }) },
            ]
          });
        });
        return vi.fn();
      } else {
        // Simulate time entries data
        queueMicrotask(() => {
          callback({
            docs: [
              { id: 'entry0', data: () => ({ studentId: 'student1', eventId: 'event123', activityId: 'activity1', checkInTime: { seconds: 1704096000, toDate: () => new Date('2024-01-01T08:00:00') }, checkOutTime: { seconds: 1704110400, toDate: () => new Date('2024-01-01T12:00:00') } }) },
              { id: 'entry1', data: () => ({ studentId: 'student2', eventId: 'event123', activityId: 'activity1', checkInTime: { seconds: 1704096000, toDate: () => new Date('2024-01-01T08:00:00') }, checkOutTime: { seconds: 1704110400, toDate: () => new Date('2024-01-01T12:00:00') } }) },
            ]
          });
        });
        return vi.fn();
      }
    }),
    query: vi.fn((ref) => ({ ...ref, _query: ref, _collectionPath: ref.path || ref._collectionPath })),
    where: vi.fn(),
    addDoc: vi.fn().mockResolvedValue({ id: 'newStudent' }),
    serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 }))
  };
});

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'admin@test.com', uid: 'admin123' },
    signOut: vi.fn()
  })
}));

// Mock EventContext
const mockCurrentEvent = {
  id: 'event123',
  name: 'VBS 2026',
  activities: [
    { id: 'activity1', name: 'Morning Session', startTime: '08:00', endTime: '12:00' },
  ],
  organizationName: 'Test Organization',
  contactName: 'Test Contact'
};

vi.mock('../contexts/EventContext', () => ({
  useEvent: () => ({
    currentEvent: mockCurrentEvent
  })
}));

// Mock printUtils
vi.mock('../utils/printUtils', () => ({
  printInNewWindow: vi.fn((content, { onComplete }) => {
    if (onComplete) setTimeout(onComplete, 0);
  }),
  createPrintDocument: vi.fn(({ title, styles, body }) => `<!DOCTYPE html><html><head><title>${title}</title></head><body>${body}</body></html>`)
}));

// Mock react-router-dom useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to render with router
const renderWithRouter = (ui, { route = '/admin/students' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentsUnsubscribe = vi.fn();
    entriesUnsubscribe = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Volunteer Roster')).toBeInTheDocument();
      });
    });

    it('should render the search input', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search volunteers...')).toBeInTheDocument();
      });
    });

    it('should render print buttons', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Print Badges/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Print Reports/i })).toBeInTheDocument();
      });
    });

    it('should render Add Student button', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });
    });

    it('should render student data in table', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
        expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
        expect(screen.getByText('Johnson, Bob')).toBeInTheDocument();
      });
    });
  });

  describe('bulk selection', () => {
    it('should render checkbox column in table header', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Header checkbox should exist
      const headerCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      expect(headerCheckbox).toBeInTheDocument();
    });

    it('should render checkbox for each student row', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Should have header checkbox + one for each student (3 students)
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBe(4); // 1 header + 3 students
    });

    it('should toggle individual student selection when checkbox is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Find the checkbox for the first student
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(studentCheckbox).not.toBeChecked();

      // Click to select
      await user.click(studentCheckbox);

      // Should now be checked
      expect(studentCheckbox).toBeChecked();

      // Selection bar should appear
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText(/student selected/i)).toBeInTheDocument();
      });
    });

    it('should show selection bar when students are selected', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Select a student
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(studentCheckbox);

      // Selection bar should appear with count
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText(/student selected/i)).toBeInTheDocument();
      });
    });

    it('should show plural text when multiple students selected', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Select two students
      const checkbox1 = screen.getByRole('checkbox', { name: /Select John Doe/i });
      const checkbox2 = screen.getByRole('checkbox', { name: /Select Jane Smith/i });
      await user.click(checkbox1);
      await user.click(checkbox2);

      // Selection bar should show plural text
      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText(/students selected/i)).toBeInTheDocument();
      });
    });

    it('should clear selection when Clear Selection button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Select a student
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(studentCheckbox);

      // Verify selection bar appears
      await waitFor(() => {
        expect(screen.getByText(/student selected/i)).toBeInTheDocument();
      });

      // Click Clear Selection
      const clearButton = screen.getByRole('button', { name: /Clear Selection/i });
      await user.click(clearButton);

      // Selection bar should disappear
      await waitFor(() => {
        expect(screen.queryByText(/student selected/i)).not.toBeInTheDocument();
      });

      // Checkbox should be unchecked
      expect(studentCheckbox).not.toBeChecked();
    });

    it('should select all filtered students when Select All Visible is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Select one student first to make selection bar appear
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(studentCheckbox);

      // Click Select All Visible
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Select All Visible/i })).toBeInTheDocument();
      });
      const selectAllButton = screen.getByRole('button', { name: /Select All Visible/i });
      await user.click(selectAllButton);

      // All checkboxes should be checked
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked();
      });
    });

    it('should update print button text when students are selected', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Initially buttons show default text
      expect(screen.getByRole('button', { name: 'Print Badges' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Print Reports' })).toBeInTheDocument();

      // Select a student
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(studentCheckbox);

      // Button text should update to show count
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Print Badges \(1\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Print Reports \(1\)/i })).toBeInTheDocument();
      });
    });

    it('should preserve selections when search is applied', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Select a student
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(studentCheckbox);

      // Verify selection
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument();
      });

      // Apply search filter
      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'Jane');

      // Selection count should still show (John is selected but filtered out)
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should highlight selected rows with background color', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Find the row containing John Doe
      const row = screen.getByText('Doe, John').closest('tr');

      // Initially should not have selected class
      expect(row).not.toHaveClass('bg-primary-50');

      // Select the student
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      await user.click(studentCheckbox);

      // Row should have the selected background class
      await waitFor(() => {
        expect(row).toHaveClass('bg-primary-50');
      });
    });

    it('should toggle header checkbox to select/deselect all filtered students', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Get header checkbox
      const headerCheckbox = screen.getByRole('checkbox', { name: /select all/i });

      // Click to select all
      await user.click(headerCheckbox);

      // All students should be selected
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument();
      });

      // Click again to deselect all
      await user.click(headerCheckbox);

      // Selection bar should disappear
      await waitFor(() => {
        expect(screen.queryByText(/students selected/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('search functionality', () => {
    it('should filter students based on search term', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
        expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
      });

      // Search for John
      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'John');

      // Only John should be visible
      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
        expect(screen.queryByText('Smith, Jane')).not.toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to student detail page when View Detail is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Find and click the View Detail button for the first student
      const viewDetailButtons = screen.getAllByRole('button', { name: /View Detail/i });
      await user.click(viewDetailButtons[0]);

      // Should navigate to student detail page
      expect(mockNavigate).toHaveBeenCalledWith('/admin/students/student1');
    });
  });

  describe('add student modal', () => {
    it('should open modal when Add Student button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      // Click Add Student button
      const addButton = screen.getByRole('button', { name: /Add Student/i });
      await user.click(addButton);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText('Register Volunteer')).toBeInTheDocument();
      });
    });

    it('should close modal when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter(<StudentsPage />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Open modal
      const addButton = screen.getByRole('button', { name: /Add Student/i });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('Register Volunteer')).toBeInTheDocument();
      });

      // Click Cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText('Register Volunteer')).not.toBeInTheDocument();
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible checkbox labels', async () => {
      renderWithRouter(<StudentsPage />);

      await waitFor(() => {
        expect(screen.getByText('Doe, John')).toBeInTheDocument();
      });

      // Header checkbox should have aria-label
      const headerCheckbox = screen.getByRole('checkbox', { name: /select all/i });
      expect(headerCheckbox).toHaveAttribute('aria-label');

      // Row checkboxes should have aria-labels with student names
      const studentCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(studentCheckbox).toHaveAttribute('aria-label');
    });
  });
});

describe('StudentsPage Selection Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentsUnsubscribe = vi.fn();
    entriesUnsubscribe = vi.fn();
  });

  it('should maintain selection state across filter changes', async () => {
    const user = userEvent.setup();
    renderWithRouter(<StudentsPage />);

    await waitFor(() => {
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    // Select John Doe
    const johnCheckbox = screen.getByRole('checkbox', { name: /Select John Doe/i });
    await user.click(johnCheckbox);

    // Verify selection
    expect(johnCheckbox).toBeChecked();
    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Filter to show only Jane
    const searchInput = screen.getByPlaceholderText('Search volunteers...');
    await user.type(searchInput, 'Jane');

    // John should no longer be visible but selection count should remain
    await waitFor(() => {
      expect(screen.queryByText('Doe, John')).not.toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    // Clear search
    await user.clear(searchInput);

    // John should be visible again and still selected
    await waitFor(() => {
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
      const johnCheckboxAfter = screen.getByRole('checkbox', { name: /Select John Doe/i });
      expect(johnCheckboxAfter).toBeChecked();
    });
  });
});
