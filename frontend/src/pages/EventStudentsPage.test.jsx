import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventStudentsPage from './EventStudentsPage';

vi.mock('../utils/firebase', () => ({ db: {} }));

const mockStudents = [
    { id: 'student1', firstName: 'Alice', lastName: 'Adams', schoolName: 'Central High', gradeLevel: '10', gradYear: '2027' },
    { id: 'student2', firstName: 'Bob', lastName: 'Brown', schoolName: 'West High', gradeLevel: '11', gradYear: '2026' },
    { id: 'student3', firstName: 'Charlie', lastName: 'Clark', schoolName: 'East High', gradeLevel: '12', gradYear: '2025' },
];

const mockEvents = [
    { id: 'event123', name: 'VBS 2026', organizationName: 'Church' },
];

let onSnapshotCalls = [];
let addDocMock;

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((db, path) => ({ _collPath: path })),
    query: vi.fn((ref) => ref),
    where: vi.fn(() => ({})),
    onSnapshot: vi.fn((queryOrRef, callback) => {
        const path = queryOrRef?._collPath;

        if (path === 'events') {
            queueMicrotask(() => callback({ docs: mockEvents.map(e => ({ id: e.id, data: () => e })) }));
        } else if (path === 'students') {
            queueMicrotask(() => callback({ docs: mockStudents.map(s => ({ id: s.id, data: () => s })) }));
        } else if (path === 'eventStudents') {
            // Only student1 explicitly added to event
            queueMicrotask(() => callback({ docs: [{ id: 'es1', data: () => ({ eventId: 'event123', studentId: 'student1' }) }] }));
        } else if (path === 'timeEntries') {
            // student2 checked in via time entries
            queueMicrotask(() => callback({ docs: [
                { id: 'te1', data: () => ({ eventId: 'event123', studentId: 'student2', isVoided: false }) }
            ] }));
        } else {
            queueMicrotask(() => callback({ docs: [] }));
        }

        const unsub = vi.fn();
        onSnapshotCalls.push(unsub);
        return unsub;
    }),
    addDoc: vi.fn().mockResolvedValue({ id: 'newDoc' }),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    serverTimestamp: vi.fn(() => ({})),
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { uid: 'admin123' } }),
}));

vi.mock('../contexts/EventContext', () => ({
    useEvent: () => ({ currentEvent: { id: 'event123', name: 'VBS 2026' } }),
}));

const renderPage = () => render(
    <MemoryRouter initialEntries={['/admin/settings/events/event123/students']}>
        <Routes>
            <Route path="/admin/settings/events/:eventId/students" element={<EventStudentsPage />} />
            <Route path="/admin/settings/events" element={<div>Events</div>} />
        </Routes>
    </MemoryRouter>
);

describe('EventStudentsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        onSnapshotCalls = [];
    });

    it('renders page heading with event name', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText(/VBS 2026 — Students/i)).toBeInTheDocument();
        });
    });

    it('shows students who are explicitly added to event', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Alice Adams')).toBeInTheDocument();
        });
    });

    it('shows students who have checked in at least once', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Bob Brown')).toBeInTheDocument();
        });
    });

    it('does not show students not associated with the event', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.queryByText('Charlie Clark')).not.toBeInTheDocument();
        });
    });

    it('shows status badge "Checked In" for checked-in students', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Checked In')).toBeInTheDocument();
        });
    });

    it('shows status badge "Added" for explicitly added students without check-in', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Added')).toBeInTheDocument();
        });
    });

    it('shows Import from System button when importable students exist', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Import from System/i })).toBeInTheDocument();
        });
    });

    it('shows event-scoped print buttons', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Print Badges/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Print Reports/i })).toBeInTheDocument();
        });
    });

    it('opens Add Student modal on button click', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /\+ Add Student/i }));
        await user.click(screen.getByRole('button', { name: /\+ Add Student/i }));
        expect(screen.getByText('Add New Student')).toBeInTheDocument();
    });

    it('opens Import modal on button click', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /Import from System/i }));
        await user.click(screen.getByRole('button', { name: /Import from System/i }));
        expect(screen.getByText('Import Students')).toBeInTheDocument();
    });

    it('import modal shows only students not yet in event', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /Import from System/i }));
        await user.click(screen.getByRole('button', { name: /Import from System/i }));
        // Wait for the modal heading to appear
        await waitFor(() => screen.getByText('Import Students'));
        // The modal's student list — scope search to the list element
        const list = await waitFor(() => screen.getByRole('list'));
        const { queryByText, getByText } = within(list);
        expect(queryByText('Alice Adams')).not.toBeInTheDocument();
        expect(queryByText('Bob Brown')).not.toBeInTheDocument();
        expect(getByText('Charlie Clark')).toBeInTheDocument();
    });

    it('import modal filters students by search input', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /Import from System/i }));
        await user.click(screen.getByRole('button', { name: /Import from System/i }));
        await waitFor(() => screen.getByPlaceholderText(/Search by name/i));
        await user.type(screen.getByPlaceholderText(/Search by name/i), 'xxx');
        await waitFor(() => {
            expect(screen.queryByText('Charlie Clark')).not.toBeInTheDocument();
        });
    });

    it('renders a search input', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByRole('searchbox', { name: /Search students/i })).toBeInTheDocument();
        });
    });

    it('filters students by search term', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        const searchInput = screen.getByRole('searchbox', { name: /Search students/i });
        act(() => { fireEvent.change(searchInput, { target: { value: 'Alice' } }); });

        expect(screen.getByText('Alice Adams')).toBeInTheDocument();
        expect(screen.queryByText('Bob Brown')).not.toBeInTheDocument();
    });

    it('shows no-results message when search matches nothing', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        const searchInput = screen.getByRole('searchbox', { name: /Search students/i });
        act(() => { fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } }); });

        expect(screen.getByText(/No students match your search/i)).toBeInTheDocument();
        expect(screen.queryByText('Alice Adams')).not.toBeInTheDocument();
    });

    it('shows filtered count in subtitle when searching', async () => {
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        const searchInput = screen.getByRole('searchbox', { name: /Search students/i });
        act(() => { fireEvent.change(searchInput, { target: { value: 'Alice' } }); });

        expect(screen.getByText(/1 of 2 students/i)).toBeInTheDocument();
    });

    it('submitting Add Student form calls addDoc twice (student + eventStudents)', async () => {
        const { addDoc } = await import('firebase/firestore');
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /\+ Add Student/i }));
        await user.click(screen.getByRole('button', { name: /\+ Add Student/i }));

        await waitFor(() => screen.getByText('Add New Student'));
        const textboxes = screen.getAllByRole('textbox');
        await user.type(textboxes[0], 'Dan');
        await user.type(textboxes[1], 'Smith');

        // The modal's submit button is inside a form — use type="submit"
        const submitBtn = screen.getByRole('button', { name: /^Add Student$/i });
        await user.click(submitBtn);

        await waitFor(() => {
            expect(addDoc).toHaveBeenCalledTimes(2);
        });
    });
});
