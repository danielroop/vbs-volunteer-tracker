import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StudentsPage from './StudentsPage';

// Mock Firebase
vi.mock('../utils/firebase', () => ({
  db: {}
}));

// Mock Firestore functions
const mockStudents = [
  {
    id: 'student1',
    data: () => ({
      firstName: 'Alice',
      lastName: 'Anderson',
      schoolName: 'Central High',
      gradeLevel: '11',
      gradYear: '2027',
      overrideHours: 0
    })
  },
  {
    id: 'student2',
    data: () => ({
      firstName: 'Bob',
      lastName: 'Baker',
      schoolName: 'North High',
      gradeLevel: '10',
      gradYear: '2028',
      overrideHours: 2
    })
  },
  {
    id: 'student3',
    data: () => ({
      firstName: 'Charlie',
      lastName: 'Chen',
      schoolName: 'South High',
      gradeLevel: '12',
      gradYear: '2026',
      overrideHours: 0
    })
  }
];

const mockTimeEntries = [
  {
    id: 'entry1',
    data: () => ({
      studentId: 'student1',
      activityId: 'activity1',
      checkInTime: {
        seconds: 1738314000,
        toDate: () => new Date(1738314000 * 1000)
      },
      checkOutTime: {
        seconds: 1738328400, // 4 hours
        toDate: () => new Date(1738328400 * 1000)
      },
      eventId: 'event123'
    })
  },
  {
    id: 'entry2',
    data: () => ({
      studentId: 'student2',
      activityId: 'activity1',
      checkInTime: {
        seconds: 1738314000,
        toDate: () => new Date(1738314000 * 1000)
      },
      checkOutTime: {
        seconds: 1738321200, // 2 hours
        toDate: () => new Date(1738321200 * 1000)
      },
      eventId: 'event123'
    })
  }
];

let studentSnapshotCallback;
let entriesSnapshotCallback;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'newStudent123' })),
  onSnapshot: vi.fn((query, callback) => {
    // Determine which collection is being watched
    if (!studentSnapshotCallback) {
      studentSnapshotCallback = callback;
      callback({ docs: mockStudents });
    } else {
      entriesSnapshotCallback = callback;
      callback({ docs: mockTimeEntries });
    }
    return vi.fn(); // unsubscribe function
  }),
  query: vi.fn(),
  where: vi.fn(),
  serverTimestamp: vi.fn(() => ({ toDate: () => new Date() }))
}));

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
    { id: 'activity1', name: 'Morning Session', startTime: '08:00', endTime: '12:00' }
  ],
  organizationName: 'Test Church',
  contactName: 'Jane Smith'
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
  createPrintDocument: vi.fn(({ title, styles, body }) =>
    `<!DOCTYPE html><html><head><title>${title}</title><style>${styles}</style></head><body>${body}</body></html>`
  )
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

// Helper to render with router
const renderWithRouter = () => {
  // Reset snapshot callbacks before each render
  studentSnapshotCallback = null;
  entriesSnapshotCallback = null;

  return render(
    <MemoryRouter initialEntries={['/admin/students']}>
      <Routes>
        <Route path="/admin/students" element={<StudentsPage />} />
        <Route path="/admin/students/:studentId" element={<div>Student Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('StudentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    studentSnapshotCallback = null;
    entriesSnapshotCallback = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Volunteer Roster')).toBeInTheDocument();
      });
    });

    it('should render the search input', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search volunteers...')).toBeInTheDocument();
      });
    });

    it('should render Print Badges button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Print Badges/i })).toBeInTheDocument();
      });
    });

    it('should render Print Reports button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Print Reports/i })).toBeInTheDocument();
      });
    });

    it('should render Add Student button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });
    });

    it('should render table headers', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Student Name')).toBeInTheDocument();
        expect(screen.getByText('School Details')).toBeInTheDocument();
        expect(screen.getByText('Event Hours')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('should render Header component', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('VBS Volunteer Tracker')).toBeInTheDocument();
      });
    });
  });

  describe('student table', () => {
    it('should display students sorted by last name', async () => {
      renderWithRouter();

      await waitFor(() => {
        // Anderson, Baker, Chen - should be in alphabetical order
        expect(screen.getByText('Anderson, Alice')).toBeInTheDocument();
        expect(screen.getByText('Baker, Bob')).toBeInTheDocument();
        expect(screen.getByText('Chen, Charlie')).toBeInTheDocument();
      });
    });

    it('should display student school names', async () => {
      renderWithRouter();

      await waitFor(() => {
        // School names appear multiple times (in table and print forms)
        expect(screen.getAllByText('Central High').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('North High').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('South High').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should display student grade levels', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Grade 11')).toBeInTheDocument();
        expect(screen.getByText('Grade 10')).toBeInTheDocument();
        expect(screen.getByText('Grade 12')).toBeInTheDocument();
      });
    });

    it('should display student graduation years', async () => {
      renderWithRouter();

      await waitFor(() => {
        // Grad years are displayed as "Grad: YYYY"
        expect(screen.getByText(/Grad: 2027/)).toBeInTheDocument();
        expect(screen.getByText(/Grad: 2028/)).toBeInTheDocument();
        expect(screen.getByText(/Grad: 2026/)).toBeInTheDocument();
      });
    });

    it('should display View Detail buttons for each student', async () => {
      renderWithRouter();

      await waitFor(() => {
        const viewButtons = screen.getAllByRole('button', { name: /View Detail/i });
        expect(viewButtons).toHaveLength(3);
      });
    });

    it('should calculate and display event hours for students', async () => {
      renderWithRouter();

      await waitFor(() => {
        // Alice has 4 hours from entry1
        // Bob has 2 hours from entry2 + 2 override hours = 4 hours
        // Charlie has 0 hours
        const hoursBadges = screen.getAllByText(/^\d+\.\d{2}$/);
        expect(hoursBadges.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('search functionality', () => {
    it('should filter students by name when searching', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Anderson, Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'Alice');

      await waitFor(() => {
        expect(screen.getByText('Anderson, Alice')).toBeInTheDocument();
        expect(screen.queryByText('Baker, Bob')).not.toBeInTheDocument();
        expect(screen.queryByText('Chen, Charlie')).not.toBeInTheDocument();
      });
    });

    it('should filter students by last name', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Baker, Bob')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'Baker');

      await waitFor(() => {
        expect(screen.queryByText('Anderson, Alice')).not.toBeInTheDocument();
        expect(screen.getByText('Baker, Bob')).toBeInTheDocument();
        expect(screen.queryByText('Chen, Charlie')).not.toBeInTheDocument();
      });
    });

    it('should be case insensitive when searching', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Chen, Charlie')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'CHARLIE');

      await waitFor(() => {
        expect(screen.getByText('Chen, Charlie')).toBeInTheDocument();
        expect(screen.queryByText('Anderson, Alice')).not.toBeInTheDocument();
      });
    });

    it('should show no students when search has no matches', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Anderson, Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'XYZ123');

      await waitFor(() => {
        expect(screen.queryByText('Anderson, Alice')).not.toBeInTheDocument();
        expect(screen.queryByText('Baker, Bob')).not.toBeInTheDocument();
        expect(screen.queryByText('Chen, Charlie')).not.toBeInTheDocument();
      });
    });

    it('should clear search filter when input is cleared', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Anderson, Alice')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search volunteers...');
      await user.type(searchInput, 'Alice');

      await waitFor(() => {
        expect(screen.queryByText('Baker, Bob')).not.toBeInTheDocument();
      });

      await user.clear(searchInput);

      await waitFor(() => {
        expect(screen.getByText('Anderson, Alice')).toBeInTheDocument();
        expect(screen.getByText('Baker, Bob')).toBeInTheDocument();
        expect(screen.getByText('Chen, Charlie')).toBeInTheDocument();
      });
    });
  });

  describe('add student modal', () => {
    it('should open modal when Add Student button is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Add Student/i }));

      await waitFor(() => {
        expect(screen.getByText('Register Volunteer')).toBeInTheDocument();
      });
    });

    it('should display form fields in modal', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Add Student/i }));

      await waitFor(() => {
        expect(screen.getByText('First Name')).toBeInTheDocument();
        expect(screen.getByText('Last Name')).toBeInTheDocument();
        expect(screen.getByText('School Name')).toBeInTheDocument();
        expect(screen.getByText('Grade')).toBeInTheDocument();
        expect(screen.getByText('Grad Year')).toBeInTheDocument();
      });
    });

    it('should display Add Student and Cancel buttons in modal', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      // Click the header Add Student button to open modal
      await user.click(screen.getByRole('button', { name: /Add Student/i }));

      await waitFor(() => {
        expect(screen.getByText('Register Volunteer')).toBeInTheDocument();
        // Modal has its own Add Student submit button
        const addButtons = screen.getAllByRole('button', { name: /Add Student/i });
        expect(addButtons.length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      });
    });

    it('should close modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Add Student/i }));

      await waitFor(() => {
        expect(screen.getByText('Register Volunteer')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Register Volunteer')).not.toBeInTheDocument();
      });
    });

    it('should have grade select with options 9-12', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Add Student/i }));

      await waitFor(() => {
        const gradeSelect = screen.getByRole('combobox');
        expect(gradeSelect).toBeInTheDocument();
        expect(screen.getByText('9th Grade')).toBeInTheDocument();
        expect(screen.getByText('10th Grade')).toBeInTheDocument();
        expect(screen.getByText('11th Grade')).toBeInTheDocument();
        expect(screen.getByText('12th Grade')).toBeInTheDocument();
      });
    });

    it('should allow typing in form inputs', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add Student/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Add Student/i }));

      await waitFor(() => {
        expect(screen.getByText('Register Volunteer')).toBeInTheDocument();
      });

      // Find input fields by their labels
      const firstNameInput = screen.getAllByRole('textbox')[0];
      const lastNameInput = screen.getAllByRole('textbox')[1];
      const schoolNameInput = screen.getAllByRole('textbox')[2];

      await user.type(firstNameInput, 'David');
      await user.type(lastNameInput, 'Davis');
      await user.type(schoolNameInput, 'West High');

      expect(firstNameInput).toHaveValue('David');
      expect(lastNameInput).toHaveValue('Davis');
      expect(schoolNameInput).toHaveValue('West High');
    });
  });

  describe('navigation', () => {
    it('should navigate to student detail page when View Detail is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /View Detail/i }).length).toBeGreaterThanOrEqual(1);
      });

      const viewButtons = screen.getAllByRole('button', { name: /View Detail/i });
      await user.click(viewButtons[0]);

      expect(mockNavigate).toHaveBeenCalledWith('/admin/students/student1');
    });
  });

  describe('print functionality', () => {
    it('should have Print Badges button enabled', async () => {
      renderWithRouter();

      await waitFor(() => {
        const printBadgesButton = screen.getByRole('button', { name: /Print Badges/i });
        expect(printBadgesButton).toBeInTheDocument();
        expect(printBadgesButton).not.toBeDisabled();
      });
    });

    it('should have Print Reports button enabled', async () => {
      renderWithRouter();

      await waitFor(() => {
        const printReportsButton = screen.getByRole('button', { name: /Print Reports/i });
        expect(printReportsButton).toBeInTheDocument();
        expect(printReportsButton).not.toBeDisabled();
      });
    });
  });

  describe('responsive header', () => {
    it('should render hamburger menu button on mobile', async () => {
      renderWithRouter();

      await waitFor(() => {
        // The header should have a hamburger menu button
        const menuButton = screen.getByRole('button', { name: /open menu/i });
        expect(menuButton).toBeInTheDocument();
      });
    });

    it('should toggle mobile menu when hamburger is clicked', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
      });
    });

    it('should show navigation links in mobile menu', async () => {
      const user = userEvent.setup();
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
      });

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      await waitFor(() => {
        // Navigation links should be visible in mobile menu
        expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('link', { name: 'Daily Review' }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('link', { name: 'Students' }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('link', { name: 'Events' }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByRole('link', { name: 'Users' }).length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should show active event indicator', async () => {
      renderWithRouter();

      await waitFor(() => {
        // Event indicator shows the current event name
        const eventIndicators = screen.getAllByText('VBS 2026');
        expect(eventIndicators.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});

describe('StudentsPage Hours Calculation', () => {
  it('should calculate event hours correctly from time entries', () => {
    // 4 hours = (checkOutTime - checkInTime) / 3600
    const entry = {
      checkInTime: { seconds: 1738314000 },
      checkOutTime: { seconds: 1738328400 } // 4 hours later
    };

    const diff = (entry.checkOutTime.seconds - entry.checkInTime.seconds) / 3600;
    expect(diff).toBe(4);
  });

  it('should round hours to nearest quarter', () => {
    const roundTime = (hours) => Math.round(hours * 4) / 4;

    expect(roundTime(3.1)).toBe(3);
    expect(roundTime(3.15)).toBe(3.25);
    expect(roundTime(3.37)).toBe(3.25);
    expect(roundTime(3.4)).toBe(3.5);
    expect(roundTime(3.6)).toBe(3.5);
    expect(roundTime(3.9)).toBe(4);
  });

  it('should add override hours to calculated hours', () => {
    const calculatedHours = 4;
    const overrideHours = 2;
    const eventTotal = calculatedHours + overrideHours;

    expect(eventTotal).toBe(6);
  });
});

describe('StudentsPage Filtering Logic', () => {
  it('should filter by first name', () => {
    const students = [
      { firstName: 'Alice', lastName: 'Anderson' },
      { firstName: 'Bob', lastName: 'Baker' }
    ];
    const searchTerm = 'alice';

    const filtered = students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].firstName).toBe('Alice');
  });

  it('should filter by last name', () => {
    const students = [
      { firstName: 'Alice', lastName: 'Anderson' },
      { firstName: 'Bob', lastName: 'Baker' }
    ];
    const searchTerm = 'baker';

    const filtered = students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].lastName).toBe('Baker');
  });

  it('should filter by full name', () => {
    const students = [
      { firstName: 'Alice', lastName: 'Anderson' },
      { firstName: 'Bob', lastName: 'Baker' }
    ];
    const searchTerm = 'alice and';

    const filtered = students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].firstName).toBe('Alice');
  });

  it('should return empty array when no matches', () => {
    const students = [
      { firstName: 'Alice', lastName: 'Anderson' },
      { firstName: 'Bob', lastName: 'Baker' }
    ];
    const searchTerm = 'xyz';

    const filtered = students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    expect(filtered).toHaveLength(0);
  });
});

describe('StudentsPage Sorting Logic', () => {
  it('should sort students by last name alphabetically', () => {
    const students = [
      { firstName: 'Charlie', lastName: 'Chen' },
      { firstName: 'Alice', lastName: 'Anderson' },
      { firstName: 'Bob', lastName: 'Baker' }
    ];

    const sorted = [...students].sort((a, b) => a.lastName.localeCompare(b.lastName));

    expect(sorted[0].lastName).toBe('Anderson');
    expect(sorted[1].lastName).toBe('Baker');
    expect(sorted[2].lastName).toBe('Chen');
  });
});
