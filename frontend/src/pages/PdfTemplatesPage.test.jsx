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
let onSnapshotTemplatesCallback = null;

vi.mock('firebase/firestore', () => ({
  collection: vi.fn((db, path) => ({ _collPath: path })),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-template-id' })),
  onSnapshot: vi.fn((queryOrRef, callback) => {
    if (queryOrRef?._isDoc) {
      // Document snapshot (settings/pdfDefaults)
      callback({ exists: () => false, data: () => null });
    } else {
      // Collection snapshot (pdfTemplates)
      onSnapshotTemplatesCallback = callback;
      callback({ docs: [] });
    }
    return vi.fn();
  }),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(() => ({ _isDoc: true, id: 'template1' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  setDoc: vi.fn(() => Promise.resolve()),
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
    { key: 'studentName', label: 'Student Full Name', preview: 'Jane Smith' },
    { key: 'totalHours', label: 'Total Hours', preview: '25.50' },
    { key: 'date', label: 'Current Date', preview: '2/7/2026' },
    { key: 'contactPerson', label: 'Contact Person', preview: 'John Smith' },
    { key: 'contactPhone', label: 'Contact Phone', preview: '(555) 123-4567' },
    { key: 'eventDescription', label: 'Event Description', preview: 'Vacation Bible School' },
    { key: 'nonprofitName', label: 'Non-Profit Organization', preview: 'First Baptist Church' },
  ],
  ACTIVITY_COLUMN_OPTIONS: [
    { key: 'activityOrg', label: 'Organization + Activity', preview: 'First Baptist VBS AM' },
    { key: 'activityDates', label: 'Date(s) of Service', preview: '6/9/26 - 6/13/26' },
    { key: 'activityContact', label: 'Contact Name', preview: 'Jane Smith' },
    { key: 'activityHours', label: 'Hours Completed', preview: '12.50' },
  ],
  DETAIL_COLUMN_OPTIONS: [
    { key: 'detailDate', label: 'Date', preview: '6/9/2026' },
    { key: 'detailStartTime', label: 'Start Time', preview: '8:00 AM' },
    { key: 'detailEndTime', label: 'End Time', preview: '12:00 PM' },
    { key: 'detailHours', label: 'Hours', preview: '4.00' },
    { key: 'detailActivity', label: 'Activity Name', preview: 'VBS Morning Session' },
    { key: 'detailContact', label: 'Contact Name', preview: 'Jane Smith' },
  ],
  getPdfPageDimensions: vi.fn(() => Promise.resolve({ width: 612, height: 792, pageCount: 1 })),
  renderPdfPageToImage: vi.fn(() => Promise.resolve({ dataUrl: 'data:image/png;base64,test', width: 1224, height: 1584, pageCount: 1 })),
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
    onSnapshotTemplatesCallback({ docs });
  });
};

const makeTemplateDoc = (id, data) => ({
  id,
  data: () => data,
});

describe('PdfTemplatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSnapshotTemplatesCallback = null;
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

    it('should show static field selector and Place Field button', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByText('Static Field')).toBeInTheDocument();
        expect(screen.getByText('Size')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Place Field/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Place Activity Table/i })).toBeInTheDocument();
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

    it('should show Place Detail Table button', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Place Detail Table/i })).toBeInTheDocument();
      });
    });

    it('should show Place Custom Field button', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Place Custom Field/i })).toBeInTheDocument();
      });
    });

    it('should show detail table configuration when Place Detail Table is clicked', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Place Detail Table/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Place Detail Table/i }));

      await waitFor(() => {
        expect(screen.getByText('Detail Table Configuration')).toBeInTheDocument();
      });
    });

    it('should show custom static field configuration when Place Custom Field is clicked', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Place Custom Field/i })).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Place Custom Field/i }));

      await waitFor(() => {
        expect(screen.getByText('Custom Static Field')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g., Supervisor Title')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g., Program Director')).toBeInTheDocument();
      });
    });

    it('should show new field options in static field dropdown', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user);

      await waitFor(() => {
        const select = screen.getAllByRole('combobox')[0];
        expect(select).toBeInTheDocument();
      });

      const options = screen.getAllByRole('option');
      const optionLabels = options.map(o => o.textContent);
      expect(optionLabels).toContain('Contact Person');
      expect(optionLabels).toContain('Contact Phone');
      expect(optionLabels).toContain('Event Description');
      expect(optionLabels).toContain('Non-Profit Organization');
    });

    it('should display custom static fields in mapped fields list', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user, {
        name: 'Custom Test',
        fields: [
          { id: 'cf1', type: 'customStatic', label: 'Supervisor', customValue: 'Dr. Smith', xPercent: 10, yPercent: 50, fontSize: 12, page: 0 },
        ],
      });

      await waitFor(() => {
        expect(screen.getByText(/Mapped Fields \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Custom: Supervisor/)).toBeInTheDocument();
      });
    });

    it('should display detail table fields in mapped fields list', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user, {
        name: 'Detail Test',
        fields: [
          {
            id: 'dt1',
            type: 'detailTable',
            label: 'Detail Table',
            xPercent: 5,
            yPercent: 30,
            rowHeight: 3,
            maxRows: 10,
            columns: [{ key: 'detailDate', label: 'Date', xPercent: 5, fontSize: 10 }],
            page: 0,
          },
        ],
      });

      await waitFor(() => {
        expect(screen.getByText(/Mapped Fields \(1\)/)).toBeInTheDocument();
        expect(screen.getByText('Detail Table')).toBeInTheDocument();
      });
    });

    it('should position the detail table handle above column markers', async () => {
      const user = userEvent.setup();
      await openFieldMapper(user, {
        name: 'Detail Handle Test',
        fields: [
          {
            id: 'dt1',
            type: 'detailTable',
            label: 'Detail Table',
            xPercent: 5,
            yPercent: 30,
            rowHeight: 3,
            maxRows: 10,
            columns: [
              { key: 'detailDate', label: 'Date', xPercent: 5, fontSize: 10 },
            ],
            page: 0,
          },
        ],
      });

      await waitFor(() => {
        expect(screen.getByTestId('dt1-table-anchor-label')).toHaveStyle({
          transform: 'translateY(calc(-100% - 32px))',
        });
        expect(screen.getByTestId('dt1-detailDate-column-marker')).toHaveStyle({
          transform: 'translateY(-100%)',
        });
      });
    });

    it('should turn off a column from an already placed detail table', async () => {
      const { updateDoc } = await import('firebase/firestore');
      const user = userEvent.setup();
      await openFieldMapper(user, {
        name: 'Detail Column Remove Test',
        fields: [
          {
            id: 'dt1',
            type: 'detailTable',
            label: 'Detail Table',
            xPercent: 5,
            yPercent: 30,
            rowHeight: 3,
            maxRows: 10,
            columns: [
              { key: 'detailDate', label: 'Date', xPercent: 5, fontSize: 10 },
              { key: 'detailHours', label: 'Hours', xPercent: 40, fontSize: 10 },
            ],
            page: 0,
          },
        ],
      });

      await user.click(screen.getByText(/10 rows, 2 cols/));
      await user.click(screen.getByRole('checkbox', { name: 'Date' }));
      await user.click(screen.getByRole('button', { name: /Save Mappings/i }));

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            fields: [
              expect.objectContaining({
                columns: [
                  expect.objectContaining({ key: 'detailHours' }),
                ],
              }),
            ],
          })
        );
      });
    });

    it('should turn on a missing column for an already placed detail table', async () => {
      const { updateDoc } = await import('firebase/firestore');
      const user = userEvent.setup();
      await openFieldMapper(user, {
        name: 'Detail Column Add Test',
        fields: [
          {
            id: 'dt1',
            type: 'detailTable',
            label: 'Detail Table',
            xPercent: 5,
            yPercent: 30,
            rowHeight: 3,
            maxRows: 10,
            columns: [
              { key: 'detailDate', label: 'Date', xPercent: 5, fontSize: 10 },
            ],
            page: 0,
          },
        ],
      });

      await user.click(screen.getByText(/10 rows, 1 cols/));
      await user.click(screen.getByRole('checkbox', { name: 'Start Time' }));
      await user.click(screen.getByRole('button', { name: /Save Mappings/i }));

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            fields: [
              expect.objectContaining({
                columns: [
                  expect.objectContaining({ key: 'detailDate' }),
                  expect.objectContaining({ key: 'detailStartTime', label: 'Start Time' }),
                ],
              }),
            ],
          })
        );
      });
    });
  });

  describe('default template', () => {
    it('should show Set as Default button for non-default templates', async () => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      expect(screen.getByRole('button', { name: /Set as Default/i })).toBeInTheDocument();
    });

    it('should show Default badge for the default template', async () => {
      const { setDoc } = await import('firebase/firestore');
      const user = userEvent.setup();
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      await user.click(screen.getByRole('button', { name: /Set as Default/i }));

      expect(setDoc).toHaveBeenCalled();
    });

    it('should not show Set as Default button when template is already default', async () => {
      const { onSnapshot } = await import('firebase/firestore');
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      // Simulate the defaults snapshot returning tmpl1 as default
      const { vi: viTest } = await import('vitest');
      const calls = onSnapshot.mock.calls;
      const docCallback = calls.find(([ref]) => ref?._isDoc)?.[1];
      if (docCallback) {
        await act(async () => {
          docCallback({ exists: () => true, data: () => ({ defaultTemplateId: 'tmpl1' }) });
        });
        expect(screen.queryByRole('button', { name: /Set as Default/i })).not.toBeInTheDocument();
        expect(screen.getByText('Default')).toBeInTheDocument();
      }
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

  describe('export mapping', () => {
    let capturedAnchor;
    let createElementSpy;
    const originalCreateElement = document.createElement.bind(document);

    const readBlob = (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(blob);
    });

    beforeEach(() => {
      capturedAnchor = null;
      createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          capturedAnchor = { href: '', download: '', click: vi.fn() };
          return capturedAnchor;
        }
        return originalCreateElement(tag);
      });
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it('should show Export button for each template', async () => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      expect(screen.getByRole('button', { name: /^Export$/i })).toBeInTheDocument();
    });

    it('should show Export All button when templates exist', async () => {
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      expect(screen.getByRole('button', { name: /Export All/i })).toBeInTheDocument();
    });

    it('should not show Export All button when no templates', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Export All/i })).not.toBeInTheDocument();
      });
    });

    it('should trigger download with correct filename when Export is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [{ id: 'f1', type: 'static', fieldKey: 'studentName' }], pageCount: 1 }),
      ]);

      await user.click(screen.getByRole('button', { name: /^Export$/i }));

      expect(capturedAnchor).not.toBeNull();
      expect(capturedAnchor.click).toHaveBeenCalled();
      expect(capturedAnchor.download).toMatch(/ocps_form.*\.json/);
    });

    it('should trigger download of a zip when Export All is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Form', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
        makeTemplateDoc('tmpl2', { name: 'NJHS Form', fileName: 'njhs.pdf', fields: [], pageCount: 1 }),
      ]);

      await user.click(screen.getByRole('button', { name: /Export All/i }));

      await waitFor(() => {
        expect(capturedAnchor).not.toBeNull();
        expect(capturedAnchor.click).toHaveBeenCalled();
        expect(capturedAnchor.download).toBe('vbs_pdf_templates_export.zip');
      });
    });

    it('should include fields in exported JSON', async () => {
      const user = userEvent.setup();
      let capturedBlob = null;
      URL.createObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      renderPage();

      const fields = [{ id: 'f1', type: 'static', fieldKey: 'studentName', xPercent: 10, yPercent: 20 }];
      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'Test Form', fileName: 'test.pdf', fields, pageCount: 1, pageWidth: 612, pageHeight: 792 }),
      ]);

      await user.click(screen.getByRole('button', { name: /^Export$/i }));

      expect(capturedBlob).not.toBeNull();
      const text = await readBlob(capturedBlob);
      const data = JSON.parse(text);
      expect(data.version).toBe('1');
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].name).toBe('Test Form');
      expect(data.templates[0].fields).toEqual(fields);
    });

    it('should not include storagePath or downloadURL in export', async () => {
      const user = userEvent.setup();
      let capturedBlob = null;
      URL.createObjectURL.mockImplementation((blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', {
          name: 'Test Form',
          fileName: 'test.pdf',
          fields: [],
          pageCount: 1,
          storagePath: 'pdfTemplates/secret.pdf',
          downloadURL: 'https://storage.example.com/secret.pdf',
        }),
      ]);

      await user.click(screen.getByRole('button', { name: /^Export$/i }));

      expect(capturedBlob).not.toBeNull();
      const text = await readBlob(capturedBlob);
      const data = JSON.parse(text);
      expect(data.templates[0].storagePath).toBeUndefined();
      expect(data.templates[0].downloadURL).toBeUndefined();
    });
  });

  describe('import mapping modal', () => {
    it('should show Import Mapping button', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Import Mapping/i })).toBeInTheDocument();
      });
    });

    it('should open import modal when Import Mapping is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));

      await waitFor(() => {
        expect(screen.getByText('Import PDF Mapping')).toBeInTheDocument();
      });
    });

    it('should show JSON file input in import modal', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));

      await waitFor(() => {
        expect(screen.getByTestId('import-json-input')).toBeInTheDocument();
      });
    });

    it('should show error for invalid JSON file', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));

      await waitFor(() => expect(screen.getByTestId('import-json-input')).toBeInTheDocument());

      const invalidJson = new File(['not valid json'], 'bad.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-json-input'), invalidJson);

      await waitFor(() => {
        expect(screen.getByText(/Invalid export file/i)).toBeInTheDocument();
      });
    });

    it('should show error for JSON missing templates array', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));
      await waitFor(() => expect(screen.getByTestId('import-json-input')).toBeInTheDocument());

      const badFile = new File([JSON.stringify({ version: '1', templates: [] })], 'bad.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-json-input'), badFile);

      await waitFor(() => {
        expect(screen.getByText(/No templates found/i)).toBeInTheDocument();
      });
    });

    it('should show template preview after valid JSON is loaded', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));
      await waitFor(() => expect(screen.getByTestId('import-json-input')).toBeInTheDocument());

      const exportData = {
        version: '1',
        exportedAt: new Date().toISOString(),
        templates: [{
          name: 'OCPS Service Log',
          fileName: 'ocps.pdf',
          pageWidth: 612,
          pageHeight: 792,
          pageCount: 2,
          fields: [{ id: 'f1', type: 'static', fieldKey: 'studentName' }],
        }],
      };
      const goodFile = new File([JSON.stringify(exportData)], 'export.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-json-input'), goodFile);

      await waitFor(() => {
        expect(screen.getByText('OCPS Service Log')).toBeInTheDocument();
        expect(screen.getByText(/1 field\(s\)/)).toBeInTheDocument();
      });
    });

    it('should auto-select existing template mode when name matches', async () => {
      const user = userEvent.setup();
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Service Log', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));
      await waitFor(() => expect(screen.getByTestId('import-json-input')).toBeInTheDocument());

      const exportData = {
        version: '1',
        exportedAt: new Date().toISOString(),
        templates: [{
          name: 'OCPS Service Log',
          fileName: 'ocps.pdf',
          pageWidth: 612,
          pageHeight: 792,
          pageCount: 1,
          fields: [],
        }],
      };
      const file = new File([JSON.stringify(exportData)], 'export.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-json-input'), file);

      await waitFor(() => {
        const existingRadio = screen.getByRole('radio', { name: /existing template/i });
        expect(existingRadio).toBeChecked();
      });
    });

    it('should call updateDoc when importing to existing template', async () => {
      const { updateDoc } = await import('firebase/firestore');
      const user = userEvent.setup();
      renderPage();

      await simulateTemplates([
        makeTemplateDoc('tmpl1', { name: 'OCPS Service Log', fileName: 'ocps.pdf', fields: [], pageCount: 1 }),
      ]);

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));
      await waitFor(() => expect(screen.getByTestId('import-json-input')).toBeInTheDocument());

      const exportFields = [{ id: 'f1', type: 'static', fieldKey: 'studentName', xPercent: 10, yPercent: 10, fontSize: 12, page: 0 }];
      const exportData = {
        version: '1',
        exportedAt: new Date().toISOString(),
        templates: [{ name: 'OCPS Service Log', fileName: 'ocps.pdf', pageWidth: 612, pageHeight: 792, pageCount: 1, fields: exportFields }],
      };
      const file = new File([JSON.stringify(exportData)], 'export.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-json-input'), file);

      await waitFor(() => expect(screen.getByTestId('existing-template-select')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /^Import$/i }));

      await waitFor(() => {
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          { fields: exportFields }
        );
      });
    });

    it('should call addDoc when creating new template entry', async () => {
      const { addDoc } = await import('firebase/firestore');
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));
      await waitFor(() => expect(screen.getByTestId('import-json-input')).toBeInTheDocument());

      const exportData = {
        version: '1',
        exportedAt: new Date().toISOString(),
        templates: [{ name: 'New Template', fileName: 'new.pdf', pageWidth: 612, pageHeight: 792, pageCount: 1, fields: [] }],
      };
      const file = new File([JSON.stringify(exportData)], 'export.json', { type: 'application/json' });
      await user.upload(screen.getByTestId('import-json-input'), file);

      // Should default to "new" since no matching template
      await waitFor(() => {
        const newRadio = screen.getByRole('radio', { name: /new template entry/i });
        expect(newRadio).toBeChecked();
      });

      await user.click(screen.getByRole('button', { name: /^Import$/i }));

      await waitFor(() => {
        expect(addDoc).toHaveBeenCalled();
      });
    });

    it('should close import modal when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: /Import Mapping/i }));
      await waitFor(() => expect(screen.getByText('Import PDF Mapping')).toBeInTheDocument());

      await user.click(screen.getByRole('button', { name: /Cancel/i }));

      await waitFor(() => {
        expect(screen.queryByText('Import PDF Mapping')).not.toBeInTheDocument();
      });
    });
  });
});
