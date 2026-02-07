import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../utils/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FIELD_KEY_OPTIONS, getPdfPageDimensions, renderPdfPageToImage } from '../utils/pdfTemplateUtils';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';

export default function PdfTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState({ isOpen: false });
  const [mapperModal, setMapperModal] = useState({ isOpen: false, template: null });

  // Listen to templates collection
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'pdfTemplates'), (snapshot) => {
      setTemplates(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleDeleteTemplate = async (template) => {
    if (!window.confirm(`Delete template "${template.name}"? This cannot be undone.`)) return;
    try {
      if (template.storagePath) {
        const storageRef = ref(storage, template.storagePath);
        await deleteObject(storageRef).catch(() => {});
      }
      await deleteDoc(doc(db, 'pdfTemplates', template.id));
    } catch (err) {
      alert('Failed to delete template: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-20 text-center"><Spinner size="lg" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black text-gray-900">PDF Templates</h1>
            <p className="text-sm text-gray-500 mt-1">Upload PDF forms and map data fields for volunteer hour printing</p>
          </div>
          <Button onClick={() => setUploadModal({ isOpen: true })} variant="primary">
            Upload Template
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">No templates yet</p>
            <p className="text-gray-400 text-sm">Upload a blank PDF form to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(template => (
              <div key={template.id} className="bg-white rounded-2xl shadow-sm border p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">{template.name}</h3>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                    {(template.fields || []).length} fields
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-1">{template.fileName}</p>
                <p className="text-xs text-gray-400 mb-4">
                  {template.pageCount || 1} page{(template.pageCount || 1) > 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setMapperModal({ isOpen: true, template })}
                  >
                    Map Fields
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDeleteTemplate(template)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <UploadModal
          isOpen={uploadModal.isOpen}
          onClose={() => setUploadModal({ isOpen: false })}
        />

        {mapperModal.isOpen && mapperModal.template && (
          <FieldMapperModal
            isOpen={mapperModal.isOpen}
            template={mapperModal.template}
            onClose={() => setMapperModal({ isOpen: false, template: null })}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Modal for uploading a new PDF template
 */
function UploadModal({ isOpen, onClose }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }
    if (!file) {
      setError('Please select a PDF file');
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const storagePath = `pdfTemplates/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Get page dimensions
      const arrayBuffer = await file.arrayBuffer();
      const dims = await getPdfPageDimensions(arrayBuffer);

      await addDoc(collection(db, 'pdfTemplates'), {
        name: name.trim(),
        fileName: file.name,
        storagePath,
        downloadURL,
        pageWidth: dims?.width || 612,
        pageHeight: dims?.height || 792,
        pageCount: dims?.pageCount || 1,
        fields: [],
        createdAt: new Date(),
      });

      setName('');
      setFile(null);
      onClose();
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Upload PDF Template"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button variant="primary" onClick={handleUpload} loading={uploading}>Upload</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., OCPS Service Log, NJHS Form"
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
      </div>
    </Modal>
  );
}

/**
 * Modal for interactively mapping fields onto the PDF template.
 * Renders the actual PDF page as a background image so users can see
 * exactly where they're placing fields.
 */
function FieldMapperModal({ isOpen, template, onClose }) {
  const [fields, setFields] = useState(template.fields || []);
  const [selectedFieldKey, setSelectedFieldKey] = useState(FIELD_KEY_OPTIONS[0].key);
  const [fontSize, setFontSize] = useState(12);
  const [saving, setSaving] = useState(false);
  const [placingField, setPlacingField] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfImage, setPdfImage] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [totalPages, setTotalPages] = useState(template.pageCount || 1);
  const previewRef = useRef(null);

  // Load the PDF page as an image whenever the modal opens or page changes
  useEffect(() => {
    if (!template.downloadURL) {
      setPdfLoading(false);
      setPdfError('No PDF URL available');
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);

    renderPdfPageToImage(template.downloadURL, currentPage, 2)
      .then((result) => {
        if (cancelled) return;
        setPdfImage(result.dataUrl);
        setTotalPages(result.pageCount);
        setPdfLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to render PDF page:', err);
        setPdfError('Failed to load PDF preview');
        setPdfLoading(false);
      });

    return () => { cancelled = true; };
  }, [template.downloadURL, currentPage]);

  const handlePreviewClick = useCallback((e) => {
    if (!placingField) return;

    const rect = previewRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;

    const label = FIELD_KEY_OPTIONS.find(o => o.key === selectedFieldKey)?.label || selectedFieldKey;

    setFields(prev => [
      ...prev,
      {
        id: `field_${Date.now()}`,
        fieldKey: selectedFieldKey,
        label,
        xPercent: Math.round(xPercent * 100) / 100,
        yPercent: Math.round(yPercent * 100) / 100,
        fontSize,
        page: currentPage - 1, // Store 0-indexed
      }
    ]);
    setPlacingField(false);
  }, [placingField, selectedFieldKey, fontSize, currentPage]);

  const removeField = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'pdfTemplates', template.id), { fields });
      onClose();
    } catch (err) {
      alert('Failed to save fields: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Fields for the currently displayed page
  const fieldsOnCurrentPage = fields.filter(f => (f.page || 0) === currentPage - 1);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Map Fields: ${template.name}`}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>Save Mappings</Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Field placement controls */}
        <div className="flex flex-wrap items-end gap-3 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Field</label>
            <select
              value={selectedFieldKey}
              onChange={(e) => setSelectedFieldKey(e.target.value)}
              className="input-field text-sm"
            >
              {FIELD_KEY_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Font Size</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              min={6}
              max={36}
              className="input-field text-sm w-20"
            />
          </div>
          <Button
            size="sm"
            variant={placingField ? 'danger' : 'primary'}
            onClick={() => setPlacingField(!placingField)}
          >
            {placingField ? 'Cancel Placement' : 'Place Field'}
          </Button>
        </div>

        {placingField && (
          <p className="text-sm text-primary-600 font-medium">Click on the PDF below to place the field</p>
        )}

        {/* Page navigation for multi-page PDFs */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm font-medium text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}

        {/* PDF Preview Area with rendered PDF as background */}
        <div
          ref={previewRef}
          className={`relative border-2 rounded-lg bg-white overflow-hidden ${
            placingField ? 'border-primary-400 cursor-crosshair' : 'border-gray-200'
          }`}
          style={{
            width: '100%',
            aspectRatio: `${template.pageWidth || 612} / ${template.pageHeight || 792}`,
          }}
          onClick={handlePreviewClick}
          data-testid="pdf-preview-area"
        >
          {/* Rendered PDF image */}
          {pdfLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}

          {pdfError && !pdfLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              {pdfError}
            </div>
          )}

          {pdfImage && !pdfLoading && (
            <img
              src={pdfImage}
              alt={`PDF page ${currentPage}`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          )}

          {/* Placed field markers (only for current page) */}
          {fieldsOnCurrentPage.map(field => (
            <div
              key={field.id}
              className="absolute flex items-center gap-1 group"
              style={{
                left: `${field.xPercent}%`,
                top: `${field.yPercent}%`,
                transform: 'translate(0, -50%)',
                zIndex: 10,
              }}
            >
              <span
                className="bg-primary-600 text-white text-xs px-2 py-0.5 rounded shadow-sm whitespace-nowrap opacity-90"
                style={{ fontSize: `${Math.max(10, Math.min(field.fontSize, 14))}px` }}
              >
                {field.label}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
                className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none transition-opacity"
                title="Remove field"
              >
                x
              </button>
            </div>
          ))}
        </div>

        {/* Mapped fields list */}
        {fields.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Mapped Fields ({fields.length})</h4>
            <div className="space-y-1">
              {fields.map(field => (
                <div key={field.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded text-sm">
                  <div>
                    <span className="font-medium text-gray-900">{field.label}</span>
                    <span className="text-gray-400 ml-2">
                      ({field.xPercent.toFixed(1)}%, {field.yPercent.toFixed(1)}%)
                      size: {field.fontSize}pt
                      {totalPages > 1 && ` | page ${(field.page || 0) + 1}`}
                    </span>
                  </div>
                  <button
                    onClick={() => removeField(field.id)}
                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
