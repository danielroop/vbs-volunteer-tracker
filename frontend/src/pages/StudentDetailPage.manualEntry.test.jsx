import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StudentDetailPage from './StudentDetailPage';
import { act } from 'react-dom/test-utils';

// Mock Firebase
vi.mock('../utils/firebase', () => ({
    db: {}
}));

// Mock Firestore functions
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((db, path) => ({ _collectionPath: path })),
    doc: vi.fn((dbOrRef, pathOrId, ...rest) => {
        if (pathOrId === 'students') {
            return { _isDocRef: true, _collection: 'students', _docId: rest[0] || 'student123', id: rest[0] || 'student123' };
        }
        return { _isDocRef: true, _collection: pathOrId, id: 'entry123' };
    }),
    onSnapshot: vi.fn((queryOrRef, callback) => {
        // Student document snapshot
        if (queryOrRef?._isDocRef && queryOrRef._collection === 'students') {
            queueMicrotask(() => {
                callback({
                    exists: () => true,
                    id: 'student123',
                    data: () => ({
                        firstName: 'John',
                        lastName: 'Doe',
                        schoolName: 'Test High School',
                        gradeLevel: '10',
                        gradYear: '2028'
                    })
                });
            });
            return vi.fn();
        }
        // All other collections return empty docs
        queueMicrotask(() => {
            callback({ docs: [] });
        });
        return vi.fn();
    }),
    query: vi.fn((ref) => ({ ...ref, _query: ref })),
    where: vi.fn(),
    orderBy: vi.fn(),
    Timestamp: {
        fromDate: (date) => ({ toDate: () => date, seconds: Math.floor(date.getTime() / 1000) })
    },
    addDoc: vi.fn(),
    updateDoc: vi.fn()
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
        { id: 'activity1', name: 'Morning Session', startTime: '09:00', endTime: '11:00' },
        { id: 'activity2', name: 'Afternoon Session', startTime: '13:00', endTime: '15:00' }
    ],
    typicalEndTime: '17:00',
    organizationName: 'Test Church',
    contactName: 'Jane Smith'
};

vi.mock('../contexts/EventContext', () => ({
    useEvent: () => ({
        currentEvent: mockCurrentEvent
    })
}));

// Mock hourCalculations
vi.mock('../utils/hourCalculations', () => ({
    formatTime: (date) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    formatHours: (hours) => `${hours.toFixed(1)} hours`
}));

// Mock printUtils
vi.mock('../utils/printUtils', () => ({
    printInNewWindow: vi.fn(),
    createPrintDocument: vi.fn()
}));

// Helper to render with router
const renderWithRouter = (studentId = 'student123') => {
    return render(
        <MemoryRouter initialEntries={[`/admin/students/${studentId}`]}>
            <Routes>
                <Route path="/admin/students/:studentId" element={<StudentDetailPage />} />
            </Routes>
        </MemoryRouter>
    );
};

describe('StudentDetailPage Manual Entry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should open manual entry modal with correct default times for the first activity', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        // Find and click the "+ Add Time Entry" button
        const addButton = await screen.findByRole('button', { name: /\+ Add Time Entry/i });
        await user.click(addButton);

        // Verify modal title
        await waitFor(() => {
            expect(screen.getByText('Log Manual Hours')).toBeInTheDocument();
        });

        // Verify default activity is the first one (Morning Session)
        const activitySelect = screen.getByRole('combobox');
        expect(activitySelect).toHaveValue('activity1'); // ID of Morning Session

        // Verify default times match Morning Session (09:00 - 11:00)
        // We need to check the input values. type="time" inputs accept HH:mm format
        const timeInputs = screen.getAllByDisplayValue(/:/); // Crude selector, better to use labels/ids if available

        // Let's refine selectors based on likely structure
        // Check-In Time
        const startInput = screen.getByLabelText(/Start Time/i);
        expect(startInput).toHaveValue('09:00');

        // Check-Out Time
        const endInput = screen.getByLabelText(/End Time/i);
        expect(endInput).toHaveValue('11:00');
    });

    it('should update default times when activity is changed', async () => {
        const user = userEvent.setup();
        renderWithRouter();

        // Open modal
        const addButton = await screen.findByRole('button', { name: /\+ Add Time Entry/i });
        await user.click(addButton);

        await waitFor(() => {
            expect(screen.getByText('Log Manual Hours')).toBeInTheDocument();
        });

        // Change activity to Afternoon Session
        const activitySelect = screen.getByRole('combobox');
        await user.selectOptions(activitySelect, 'activity2'); // ID of Afternoon Session

        // Verify times updated to Afternoon Session (13:00 - 15:00)
        const startInput = screen.getByLabelText(/Start Time/i);
        expect(startInput).toHaveValue('13:00');

        const endInput = screen.getByLabelText(/End Time/i);
        expect(endInput).toHaveValue('15:00');
    });
});
