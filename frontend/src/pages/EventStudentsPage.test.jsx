import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EventStudentsPage from './EventStudentsPage';

vi.mock('../utils/firebase', () => ({ db: {}, storage: {} }));

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    getDownloadURL: vi.fn(() => Promise.resolve('https://storage.example.com/template.pdf')),
}));

vi.mock('../utils/pdfTemplateUtils', () => ({
    generateFilledPdf: vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3]))),
    getEffectivePdfTemplate: vi.fn((student = {}, templates = [], defaultTemplateId = null) => {
        if (student.pdfTemplateId) {
            return templates.find(template => template.id === student.pdfTemplateId) || null;
        }

        const normalizedSchool = (student.schoolName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const schoolTemplate = templates.find(template => {
            const normalizedTemplate = `${template.name || ''} ${template.fileName || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalizedTemplate &&
                (normalizedTemplate.includes(normalizedSchool) || normalizedSchool.includes(normalizedTemplate));
        });
        if (schoolTemplate) return schoolTemplate;

        const ocpsTemplate = templates.find(template =>
            `${template.name || ''} ${template.fileName || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '').includes('ocps')
        );
        if (ocpsTemplate) return ocpsTemplate;

        return defaultTemplateId ? templates.find(template => template.id === defaultTemplateId) || null : null;
    }),
    mergePdfs: vi.fn((arr) => Promise.resolve(arr[0] || new Uint8Array([1, 2, 3]))),
    openPdfForPrinting: vi.fn(),
}));

vi.mock('../utils/printUtils', () => ({
    printInNewWindow: vi.fn(),
    createPrintDocument: vi.fn(({ title, styles, body }) =>
        `<!DOCTYPE html><html><head><title>${title}</title><style>${styles}</style></head><body>${body}</body></html>`
    ),
}));

const mockStudents = [
    { id: 'student1', firstName: 'Alice', lastName: 'Adams', schoolName: 'Central High', gradeLevel: '10', gradYear: '2027', pdfTemplateId: 'template1' },
    { id: 'student2', firstName: 'Bob', lastName: 'Brown', schoolName: 'West High', gradeLevel: '11', gradYear: '2026' },
    { id: 'student3', firstName: 'Charlie', lastName: 'Clark', schoolName: 'East High', gradeLevel: '12', gradYear: '2025' },
];

const mockEvents = [
    {
        id: 'event123',
        name: 'VBS 2026',
        organizationName: 'Church',
        contactName: 'Coordinator',
        activities: [{ id: 'activity1', name: 'Setup' }],
    },
];

const mockCurrentEvent = { id: 'event123', name: 'VBS 2026' };
const defaultPdfTemplates = [
    { id: 'template1', name: 'Central High Form', storagePath: 'templates/central.pdf', fields: [] },
    { id: 'template2', name: 'OCPS', fileName: 'ocps.pdf', storagePath: 'templates/ocps.pdf', fields: [] },
];

let onSnapshotCalls = [];
let addDocMock;
let mockPdfTemplates = [...defaultPdfTemplates];
let mockBatchDelete;
let mockBatchCommit;

vi.mock('firebase/firestore', () => ({
    collection: vi.fn((db, path) => ({ _collPath: path })),
    doc: vi.fn((db, col, id) => ({ _isDoc: true, _docPath: `${col}/${id}` })),
    query: vi.fn((ref, ...constraints) => ({ ...ref, _constraints: constraints })),
    where: vi.fn((field, operator, value) => ({ field, operator, value })),
    deleteDoc: vi.fn().mockResolvedValue(undefined),
    onSnapshot: vi.fn((queryOrRef, callback) => {
        if (queryOrRef?._isDoc) {
            queueMicrotask(() => callback({ exists: () => false, data: () => null }));
            const unsub = vi.fn();
            onSnapshotCalls.push(unsub);
            return unsub;
        }

        const path = queryOrRef?._collPath;

        if (path === 'events') {
            queueMicrotask(() => callback({ docs: mockEvents.map(e => ({ id: e.id, data: () => e })) }));
        } else if (path === 'pdfTemplates') {
            queueMicrotask(() => callback({ docs: mockPdfTemplates.map(template => ({ id: template.id, data: () => template })) }));
        } else if (path === 'students') {
            queueMicrotask(() => callback({ docs: mockStudents.map(s => ({ id: s.id, data: () => s })) }));
        } else if (path === 'eventStudents') {
            // student1 explicitly added to event; student2 only has time entries
            queueMicrotask(() => callback({ docs: [{ id: 'es1', data: () => ({ eventId: 'event123', studentId: 'student1' }) }] }));
        } else if (path === 'timeEntries') {
            // student2 checked in via time entries
            queueMicrotask(() => callback({ docs: [
                {
                    id: 'te1',
                    data: () => ({
                        eventId: 'event123',
                        studentId: 'student2',
                        activityId: 'activity1',
                        isVoided: false,
                        checkInTime: { seconds: 1704096000, toDate: () => new Date('2024-01-01T08:00:00') },
                        checkOutTime: { seconds: 1704110400, toDate: () => new Date('2024-01-01T12:00:00') },
                    })
                }
            ] }));
        } else {
            queueMicrotask(() => callback({ docs: [] }));
        }

        const unsub = vi.fn();
        onSnapshotCalls.push(unsub);
        return unsub;
    }),
    addDoc: vi.fn().mockResolvedValue({ id: 'newDoc' }),
    getDocs: vi.fn((queryRef) => {
        const studentConstraint = queryRef?._constraints?.find(c => c.field === 'studentId');
        if (queryRef?._collPath === 'timeEntries' && studentConstraint?.value === 'student2') {
            return Promise.resolve({
                docs: [
                    { id: 'te1', ref: { _docPath: 'timeEntries/te1' } },
                ],
            });
        }
        return Promise.resolve({ docs: [] });
    }),
    serverTimestamp: vi.fn(() => ({})),
    writeBatch: vi.fn(() => {
        mockBatchDelete = vi.fn();
        mockBatchCommit = vi.fn().mockResolvedValue(undefined);
        return {
            delete: mockBatchDelete,
            commit: mockBatchCommit,
        };
    }),
}));

vi.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({ user: { uid: 'admin123' } }),
}));

vi.mock('../contexts/EventContext', () => ({
    useEvent: () => ({ currentEvent: mockCurrentEvent }),
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
        mockPdfTemplates = [...defaultPdfTemplates];
        mockBatchDelete = vi.fn();
        mockBatchCommit = vi.fn().mockResolvedValue(undefined);
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
        global.fetch = vi.fn(() => Promise.resolve({
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
        }));
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

    it('supports selecting visible event students for targeted printing', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        await user.click(screen.getByRole('checkbox', { name: /Select Alice Adams/i }));

        expect(screen.getByText(/student selected/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Print Badges \(1\)/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Print Reports \(1\)/i })).toBeInTheDocument();
    });

    it('prints only selected badges when students are selected', async () => {
        const { printInNewWindow } = await import('../utils/printUtils');
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        await user.click(screen.getByRole('checkbox', { name: /Select Alice Adams/i }));
        await user.click(screen.getByRole('button', { name: /Print Badges \(1\)/i }));

        expect(printInNewWindow).toHaveBeenCalledTimes(1);
        const printedHtml = printInNewWindow.mock.calls[0][0];
        expect(printedHtml).toContain('Alice Adams');
        expect(printedHtml).not.toContain('Bob Brown');
    });

    it('uses the selected student PDF template for event report printing', async () => {
        const { generateFilledPdf, openPdfForPrinting } = await import('../utils/pdfTemplateUtils');
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        await user.click(screen.getByRole('checkbox', { name: /Select Alice Adams/i }));
        await user.click(screen.getByRole('button', { name: /Print Reports \(1\)/i }));

        await waitFor(() => {
            expect(generateFilledPdf).toHaveBeenCalledTimes(1);
            expect(openPdfForPrinting).toHaveBeenCalledTimes(1);
        });
        expect(generateFilledPdf.mock.calls[0][2].student.id).toBe('student1');
    });

    it('uses a school-matched PDF template for students without an explicit template', async () => {
        const { generateFilledPdf, openPdfForPrinting } = await import('../utils/pdfTemplateUtils');
        const { printInNewWindow } = await import('../utils/printUtils');
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => expect(screen.getByText('Bob Brown')).toBeInTheDocument());

        await user.click(screen.getByRole('checkbox', { name: /Select Bob Brown/i }));
        await user.click(screen.getByRole('button', { name: /Print Reports \(1\)/i }));

        await waitFor(() => {
            expect(generateFilledPdf).toHaveBeenCalledTimes(1);
            expect(openPdfForPrinting).toHaveBeenCalledTimes(1);
        });
        expect(generateFilledPdf.mock.calls[0][2].student.id).toBe('student2');
        expect(printInNewWindow).not.toHaveBeenCalled();
    });

    it('does not fall back to the old HTML report when a PDF template is missing', async () => {
        mockPdfTemplates = [];
        const { generateFilledPdf, openPdfForPrinting } = await import('../utils/pdfTemplateUtils');
        const { printInNewWindow } = await import('../utils/printUtils');
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        await user.click(screen.getByRole('checkbox', { name: /Select Alice Adams/i }));
        await user.click(screen.getByRole('button', { name: /Print Reports \(1\)/i }));

        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Missing template for: Alice Adams'));
        expect(generateFilledPdf).not.toHaveBeenCalled();
        expect(openPdfForPrinting).not.toHaveBeenCalled();
        expect(printInNewWindow).not.toHaveBeenCalled();
    });

    it('opens Add Student modal on button click', async () => {
        const user = userEvent.setup();
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /\+ Add Student/i }));
        await user.click(screen.getByRole('button', { name: /\+ Add Student/i }));
        expect(screen.getByText('Add New Student')).toBeInTheDocument();
    });

    it('allows selecting grades from Kindergarten through College in Add Student modal', async () => {
        renderPage();
        await waitFor(() => screen.getByRole('button', { name: /\+ Add Student/i }));
        fireEvent.click(screen.getByRole('button', { name: /\+ Add Student/i }));

        const gradeSelect = screen.getAllByRole('combobox')[0];
        expect(within(gradeSelect).getByRole('option', { name: 'Kindergarten' })).toHaveValue('K');
        expect(within(gradeSelect).getByRole('option', { name: '12th Grade' })).toHaveValue('12');
        expect(within(gradeSelect).getByRole('option', { name: 'College' })).toHaveValue('College');
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

    it('shows a Remove button for explicitly added students with no time entries', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Alice Adams')).toBeInTheDocument();
        });

        const aliceRow = screen.getByText('Alice Adams').closest('tr');
        const removeButton = within(aliceRow).getByRole('button', { name: /^Remove$/ });
        expect(removeButton).toBeInTheDocument();
        expect(removeButton).not.toBeDisabled();
    });

    it('shows an active Remove button for students with time entries', async () => {
        renderPage();
        await waitFor(() => {
            expect(screen.getByText('Bob Brown')).toBeInTheDocument();
        });

        expect(screen.getAllByRole('button', { name: /^Remove$/ })).toHaveLength(2);
        expect(screen.getByTitle('Removes this student and deletes their event activity records')).toBeInTheDocument();
    });

    it('deletes the eventStudents association when Remove is clicked', async () => {
        const { deleteDoc, doc } = await import('firebase/firestore');

        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        const aliceRow = screen.getByText('Alice Adams').closest('tr');
        fireEvent.click(within(aliceRow).getByRole('button', { name: /^Remove$/ }));

        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalledWith(
                'Remove Alice Adams from this event? Their student record will remain in the system.'
            );
            expect(doc).toHaveBeenCalledWith({}, 'eventStudents', 'es1');
            expect(deleteDoc).toHaveBeenCalledTimes(1);
        });
    });

    it('does not remove a roster-only student when confirmation is cancelled', async () => {
        const { deleteDoc } = await import('firebase/firestore');
        window.confirm = vi.fn(() => false);

        renderPage();
        await waitFor(() => expect(screen.getByText('Alice Adams')).toBeInTheDocument());

        const aliceRow = screen.getByText('Alice Adams').closest('tr');
        fireEvent.click(within(aliceRow).getByRole('button', { name: /^Remove$/ }));

        expect(window.confirm).toHaveBeenCalledWith(
            'Remove Alice Adams from this event? Their student record will remain in the system.'
        );
        expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('asks before removing a student with activity records', async () => {
        const { getDocs } = await import('firebase/firestore');
        window.confirm = vi.fn(() => false);

        renderPage();
        await waitFor(() => expect(screen.getByText('Bob Brown')).toBeInTheDocument());

        const bobRow = screen.getByText('Bob Brown').closest('tr');
        fireEvent.click(within(bobRow).getByRole('button', { name: /^Remove$/ }));

        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Bob Brown has 1 activity record'));
        expect(getDocs).not.toHaveBeenCalled();
    });

    it('deletes event-scoped time entries when confirmed', async () => {
        const { getDocs, writeBatch } = await import('firebase/firestore');

        renderPage();
        await waitFor(() => expect(screen.getByText('Bob Brown')).toBeInTheDocument());

        const bobRow = screen.getByText('Bob Brown').closest('tr');
        fireEvent.click(within(bobRow).getByRole('button', { name: /^Remove$/ }));

        await waitFor(() => {
            expect(getDocs).toHaveBeenCalledTimes(1);
            expect(writeBatch).toHaveBeenCalledWith({});
            expect(mockBatchDelete).toHaveBeenCalledWith({ _docPath: 'timeEntries/te1' });
            expect(mockBatchCommit).toHaveBeenCalledTimes(1);
        });
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
