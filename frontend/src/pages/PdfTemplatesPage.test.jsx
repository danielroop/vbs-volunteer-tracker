import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PdfTemplatesPage from './PdfTemplatesPage';

// Mock Firebase
vi.mock('../utils/firebase', () => ({
  db: {},
  storage: {},
}));

// Track onSnapshot callbacks for programmatic updates
let onSnapshotCallback = null;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-template-id' })),
  onSnapshot: vi.fn((query, callback) => {
    onSnapshotCallback = callback;
    callback({ docs: [] });
    return vi.fn();
  }),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(() => ({ id: 'template1' })),
  updateDoc: vi.fn(() => Promise.resolve()),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(() => Promise.resolve()),
  getDownloadURL: vi.fn(() => Promise.resolve('https://storage.example.com/template.pdf')),
  deleteObject: vi.fn(() => Promise.resolve()),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'admin@test.com', uid: 'admin123' },
    signOut: vi.fn(),
  }),
}));

vi.mock('../contexts/EventContext', () => ({
  useEvent: () => ({
    currentEvent: { id: 'event1', name: 'VBS 2026' },
  }),
}));

vi.mock('../utils/pdfTemplateUtils', () => ({
  FIELD_KEY_OPTIONS: [
    { key: 'studentName', label: 'Student Full Name' },
    { key: 'totalHours', label: 'Total Hours' },
    { key: 'date', label: 'Current Date' },
  ],
  getPdfPageDimensions: vi.fn(() => Promise.resolve({ width: 612, height: 792, pageCount: 1 })),
}));

const renderPage = () => {
  return render(
    <MemoryRouter>
      <PdfTemplatesPage />
    </MemoryRouter>
  );
};

const simulateTemplates = async (docs) => {
  await act(async () => {
    onSnapshotCallback({ docs });
  });
};

const makeTemplateDoc = (id, data) => ({
  id,
  data: () => data,
});

describe('PdfTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotCallback = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the page title', async () => {
      renderPage();
      await waitFor(() => {
        // Title appears in the page heading and nav tab
        expect(screen.getAllByText('PDF Templates').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('heading', { name: 'PDF Templates' })).toBeInTheDocument();
      });
    });

    it('should render the upload button', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Upload Template/i })).toBeInTheDocument();
      });
    });

    it('should show empty state when no templates exist', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText('No templates yet')).toBeInTheDocument();
      });
    });

    it('should display description text', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/Upload PDF forms and map data fields/i)).toBeInTheDocument();
      });
    });
  });

  describe('template list', () => {
    it('should display templates when they exist', async () => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [{ id: 'f1' }], pageCount: 1 }),
        makeTemplateDoc('tmpl2', { name: 'NJHS Form', fileName: 'njhs.pdf', fields: [], pageCount: 2 }),
      ]);

      expect(screen.getByText('OCPS Form')).toBeInTheDocument();
      expect(screen.getByText('NJHS Form')).toBeInTheDocument();
    });

    it('should display field count for each template', async () => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }], pageCount: 1 }),
      ]);

      expect(screen.getByText('3 fields')).toBeInTheDocument();
    });

    it('should display Map Fields and Delete buttons for each template', async () => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'Test Template', fileName: 'test.pdf', fields: [], pageCount: 1 }),
      ]);

      expect(screen.getByRole('button', { name: /Map Fields/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Delete/i })).toBeInTheDocument();
    });
  });

  describe('upload modal', () => {
    it('should open upload modal when Upload Template button is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Upload Template/i }));

      await waitFor(() => {
        expect(screen.getByText('Upload PDF Template')).toBeInTheDocument();
      });
    });

    it('should show template name input and file input in upload modal', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Upload Template/i }));

      await waitFor(() => {
        expect(screen.getByText('Template Name')).toBeInTheDocument();
        expect(screen.getByText('PDF File')).toBeInTheDocument();
      });
    });

    it('should show Upload and Cancel buttons in modal', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Upload Template/i }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });
    });

    it('should show error when trying to upload without a name', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Upload Template/i }));
      await user.click(screen.getByRole('button', { name: 'Upload' }));

      await waitFor(() => {
        expect(screen.getByText('Template name is required')).toBeInTheDocument();
      });
    });

    it('should close upload modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Upload Template/i }));
      await waitFor(() => {
        expect(screen.getByText('Upload PDF Template')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByText('Upload PDF Template')).not.toBeInTheDocument();
      });
    });
  });

  describe('field mapper modal', () => {
    const openFieldMapper = async (user, templateData = {}) => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', {
          name: 'Test Form',
          fileName: 'test.pdf',
          fields: [],
          pageCount: 1,
          pageWidth: 612,
          pageHeight: 792,
          ...templateData,
        }),
      ]);

      await user.click(screen.getByRole('button', { name: /Map Fields/i }));
    };

    it('should open field mapper when Map Fields is clicked', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user, { name: 'OCPS Form' });

      await waitFor(() => {
        expect(screen.getByText(/Map Fields: OCPS Form/)).toBeInTheDocument();
      });
    });

    it('should show Data Field selector and Place Field button', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByText('Data Field')).toBeInTheDocument();
        expect(screen.getByText('Font Size')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Place Field/i })).toBeInTheDocument();
      });
    });

    it('should show PDF preview area', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByTestId('pdf-preview-area')).toBeInTheDocument();
      });
    });

    it('should display existing mapped fields', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user, {
        name: 'Mapped Template',
        fields: [
          { id: 'f1', fieldKey: 'studentName', label: 'Student Name Field', xPercent: 25, yPercent: 15, fontSize: 14, page: 0 },
          { id: 'f2', fieldKey: 'totalHours', label: 'Hours Field', xPercent: 70, yPercent: 50, fontSize: 12, page: 0 },
        ],
      });

      await waitFor(() => {
        expect(screen.getByText(/Mapped Fields \(2\)/)).toBeInTheDocument();
        // Labels appear in both field markers and the list
        expect(screen.getAllByText('Student Name Field').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Hours Field').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('should have Save Mappings button', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Save Mappings/i })).toBeInTheDocument();
      });
    });
  });

  describe('delete template', () => {
    it('should prompt for confirmation before deleting', async () => {
      const user = userEvent.setup();
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'Delete Me', fileName: 'delete.pdf', fields: [], pageCount: 1, storagePath: 'pdfTemplates/delete.pdf' }),
      ]);

      await user.click(screen.getByRole('button', { name: /Delete/i }));

      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Delete Me'));
      confirmSpy.mockRestore();
    });
  });
});
