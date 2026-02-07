import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db, storage } from '../utils/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { FIELD_KEY_OPTIONS, ACTIVITY_COLUMN_OPTIONS, getPdfPageDimensions, renderPdfPageToImage } from '../utils/pdfTemplateUtils';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import Spinner from '../components/common/Spinner';

export default function PdfTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState({ isOpen: false });
  const [mapperModal, setMapperModal] = useState({ isOpen: false, template: null });

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
 */
function FieldMapperModal({ isOpen, template, onClose }) {
  const [fields, setFields] = useState(template.fields || []);
  const [selectedFieldKey, setSelectedFieldKey] = useState(FIELD_KEY_OPTIONS[0].key);
  const [fontSize, setFontSize] = useState(12);
  const [saving, setSaving] = useState(false);
  const [placingMode, setPlacingMode] = useState(null); // null, 'static', 'activityTable'
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfImage, setPdfImage] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(null);
  const [totalPages, setTotalPages] = useState(template.pageCount || 1);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [dragging, setDragging] = useState(null); // { fieldId, startX, startY, origXPct, origYPct, colKey? }
  const [justDragged, setJustDragged] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [previewScale, setPreviewScale] = useState(1); // container px / PDF pt ratio

  // Activity table config state
  const [atRowHeight, setAtRowHeight] = useState(3);
  const [atMaxRows, setAtMaxRows] = useState(5);
  const [atColumns, setAtColumns] = useState(
    ACTIVITY_COLUMN_OPTIONS.map((opt, i) => ({
      key: opt.key,
      label: opt.label,
      xPercent: 5 + (i * 23),
      fontSize: 10,
      maxWidth: 20,
      enabled: true,
    }))
  );

  const previewRef = useRef(null);
  const pageWidth = template.pageWidth || 612;
  const pageHeight = template.pageHeight || 792;

  // Track container scale for WYSIWYG font sizing
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;

    const updateScale = () => {
      const containerWidth = el.clientWidth;
      if (containerWidth > 0) {
        setPreviewScale(containerWidth / pageWidth);
      }
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageWidth]);

  // Load the PDF page as an image
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

  // Convert click position to percentage coordinates
  const getPercentFromEvent = useCallback((e) => {
    const rect = previewRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    const yPercent = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      xPercent: Math.max(0, Math.min(100, Math.round(xPercent * 100) / 100)),
      yPercent: Math.max(0, Math.min(100, Math.round(yPercent * 100) / 100)),
    };
  }, []);

  const handlePreviewClick = useCallback((e) => {
    if (dragging || justDragged) {
      setJustDragged(false);
      return;
    }

    if (placingMode === 'static') {
      const { xPercent, yPercent } = getPercentFromEvent(e);
      const opt = FIELD_KEY_OPTIONS.find(o => o.key === selectedFieldKey);

      const newFieldId = `field_${Date.now()}`;
      setFields(prev => [
        ...prev,
        {
          id: newFieldId,
          type: 'static',
          fieldKey: selectedFieldKey,
          label: opt?.label || selectedFieldKey,
          preview: opt?.preview || '',
          xPercent,
          yPercent,
          fontSize,
          page: currentPage - 1,
        }
      ]);
      setPlacingMode(null);
      setSelectedFieldId(newFieldId);
    } else if (placingMode === 'activityTable') {
      const { xPercent, yPercent } = getPercentFromEvent(e);
      const enabledCols = atColumns.filter(c => c.enabled).map(c => ({ ...c }));

      const newFieldId = `field_${Date.now()}`;
      setFields(prev => [
        ...prev,
        {
          id: newFieldId,
          type: 'activityTable',
          label: 'Activity Table',
          xPercent,
          yPercent,
          rowHeight: atRowHeight,
          maxRows: atMaxRows,
          columns: enabledCols,
          page: currentPage - 1,
        }
      ]);
      setPlacingMode(null);
      setSelectedFieldId(newFieldId);
    } else {
      // Deselect if clicking on empty area
      setSelectedFieldId(null);
    }
  }, [placingMode, dragging, justDragged, selectedFieldKey, fontSize, currentPage, getPercentFromEvent, atRowHeight, atMaxRows, atColumns]);

  // --- Drag support ---
  // For static fields: drag moves xPercent and yPercent
  // For activity table anchor: drag moves xPercent and yPercent (the starting Y for all rows)
  // For activity table column: drag moves only the column's xPercent (horizontal only)
  const handleFieldMouseDown = useCallback((e, field, colKey) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFieldId(field.id);

    if (colKey) {
      // Dragging an individual activity table column
      const col = (field.columns || []).find(c => c.key === colKey);
      if (!col) return;
      setDragging({
        fieldId: field.id,
        colKey,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: col.xPercent,
        origYPct: field.yPercent,
      });
    } else {
      setDragging({
        fieldId: field.id,
        colKey: null,
        startX: e.clientX,
        startY: e.clientY,
        origXPct: field.xPercent,
        origYPct: field.yPercent,
      });
    }
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e) => {
      const rect = previewRef.current.getBoundingClientRect();
      const dxPct = ((e.clientX - dragging.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - dragging.startY) / rect.height) * 100;

      if (dragging.colKey) {
        // Column drag: horizontal only
        const newX = Math.max(0, Math.min(100, dragging.origXPct + dxPct));
        setFields(prev => prev.map(f => {
          if (f.id !== dragging.fieldId) return f;
          const updatedCols = (f.columns || []).map(col =>
            col.key === dragging.colKey
              ? { ...col, xPercent: Math.round(newX * 100) / 100 }
              : col
          );
          return { ...f, columns: updatedCols };
        }));
      } else {
        // Field/table anchor drag: both axes
        const newX = Math.max(0, Math.min(100, dragging.origXPct + dxPct));
        const newY = Math.max(0, Math.min(100, dragging.origYPct + dyPct));
        setFields(prev => prev.map(f =>
          f.id === dragging.fieldId
            ? { ...f, xPercent: Math.round(newX * 100) / 100, yPercent: Math.round(newY * 100) / 100 }
            : f
        ));
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setJustDragged(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  // --- Field editing ---
  const selectedField = fields.find(f => f.id === selectedFieldId);

  const updateSelectedField = (updates) => {
    setFields(prev => prev.map(f =>
      f.id === selectedFieldId ? { ...f, ...updates } : f
    ));
  };

  const removeField = (fieldId) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
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
        {/* Toolbar */}
        <div className="p-4 bg-gray-50 rounded-lg space-y-3">
          {/* Static field placement */}
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Static Field</label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Size</label>
              <input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                min={6}
                max={36}
                className="input-field text-sm w-16"
              />
            </div>
            <Button
              size="sm"
              variant={placingMode === 'static' ? 'danger' : 'primary'}
              onClick={() => setPlacingMode(placingMode === 'static' ? null : 'static')}
            >
              {placingMode === 'static' ? 'Cancel' : 'Place Field'}
            </Button>
            <div className="border-l border-gray-300 h-8 mx-1" />
            <Button
              size="sm"
              variant={placingMode === 'activityTable' ? 'danger' : 'secondary'}
              onClick={() => setPlacingMode(placingMode === 'activityTable' ? null : 'activityTable')}
            >
              {placingMode === 'activityTable' ? 'Cancel' : 'Place Activity Table'}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <label className="text-xs text-gray-500 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                  className="rounded"
                />
                Preview text
              </label>
            </div>
          </div>

          {/* Activity table config (shown when placing activity table) */}
          {placingMode === 'activityTable' && (
            <div className="border-t border-gray-200 pt-3 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase">Activity Table Configuration</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Row Height (%)</label>
                  <input
                    type="number"
                    value={atRowHeight}
                    onChange={(e) => setAtRowHeight(Number(e.target.value))}
                    min={1}
                    max={15}
                    step={0.5}
                    className="input-field text-sm w-20"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Rows</label>
                  <input
                    type="number"
                    value={atMaxRows}
                    onChange={(e) => setAtMaxRows(Number(e.target.value))}
                    min={1}
                    max={20}
                    className="input-field text-sm w-16"
                  />
                </div>
              </div>
              <div className="space-y-1">
                {atColumns.map((col, idx) => (
                  <div key={col.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={col.enabled}
                      onChange={(e) => {
                        const updated = [...atColumns];
                        updated[idx] = { ...updated[idx], enabled: e.target.checked };
                        setAtColumns(updated);
                      }}
                      className="rounded"
                    />
                    <span className="w-40 text-gray-700">{col.label}</span>
                    <label className="text-xs text-gray-500">X%:</label>
                    <input
                      type="number"
                      value={col.xPercent}
                      onChange={(e) => {
                        const updated = [...atColumns];
                        updated[idx] = { ...updated[idx], xPercent: Number(e.target.value) };
                        setAtColumns(updated);
                      }}
                      min={0}
                      max={100}
                      className="input-field text-sm w-16"
                    />
                    <label className="text-xs text-gray-500">Size:</label>
                    <input
                      type="number"
                      value={col.fontSize}
                      onChange={(e) => {
                        const updated = [...atColumns];
                        updated[idx] = { ...updated[idx], fontSize: Number(e.target.value) };
                        setAtColumns(updated);
                      }}
                      min={6}
                      max={24}
                      className="input-field text-sm w-14"
                    />
                    <label className="text-xs text-gray-500">Width%:</label>
                    <input
                      type="number"
                      value={col.maxWidth || 0}
                      onChange={(e) => {
                        const updated = [...atColumns];
                        updated[idx] = { ...updated[idx], maxWidth: Number(e.target.value) || 0 };
                        setAtColumns(updated);
                      }}
                      min={0}
                      max={100}
                      className="input-field text-sm w-14"
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-primary-600">Click on the PDF where the first row should start. Drag columns to position them independently.</p>
            </div>
          )}
        </div>

        {placingMode === 'static' && (
          <p className="text-sm text-primary-600 font-medium">Click on the PDF to place the field. Drag to reposition after placement.</p>
        )}

        {/* Selected field editor - shown ABOVE the PDF so it's always visible */}
        {selectedField && (
          <SelectedFieldEditor
            field={selectedField}
            onUpdate={updateSelectedField}
            onRemove={() => removeField(selectedField.id)}
          />
        )}

        {/* Page navigation */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
            <span className="text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
          </div>
        )}

        {/* PDF Preview Area */}
        <div
          ref={previewRef}
          className={`relative border-2 rounded-lg bg-white overflow-hidden select-none ${
            placingMode ? 'border-primary-400 cursor-crosshair' : 'border-gray-200'
          } ${dragging ? 'cursor-grabbing' : ''}`}
          style={{
            width: '100%',
            aspectRatio: `${pageWidth} / ${pageHeight}`,
          }}
          onClick={handlePreviewClick}
          data-testid="pdf-preview-area"
        >
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
              className="absolute inset-0 w-full h-full pointer-events-none"
              draggable={false}
              style={{ objectFit: 'fill' }}
            />
          )}

          {/* Placed field markers */}
          {fieldsOnCurrentPage.map(field => (
            <FieldMarker
              key={field.id}
              field={field}
              isSelected={selectedFieldId === field.id}
              showPreview={showPreview}
              previewScale={previewScale}
              onMouseDown={(e, colKey) => handleFieldMouseDown(e, field, colKey)}
              onRemove={() => removeField(field.id)}
              isDragging={dragging?.fieldId === field.id}
              draggingColKey={dragging?.fieldId === field.id ? dragging.colKey : null}
            />
          ))}
        </div>

        {/* Mapped fields list */}
        {fields.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">Mapped Fields ({fields.length})</h4>
            <div className="space-y-1">
              {fields.map(field => (
                <div
                  key={field.id}
                  className={`flex items-center justify-between px-3 py-2 rounded text-sm cursor-pointer transition-colors ${
                    selectedFieldId === field.id ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  <div>
                    <span className={`font-medium ${field.type === 'activityTable' ? 'text-green-700' : 'text-gray-900'}`}>
                      {field.type === 'activityTable' ? 'Activity Table' : field.label}
                    </span>
                    <span className="text-gray-400 ml-2 text-xs">
                      ({field.xPercent.toFixed(1)}%, {field.yPercent.toFixed(1)}%)
                      {field.type !== 'activityTable' && ` ${field.fontSize}pt`}
                      {field.type === 'activityTable' && ` ${field.maxRows} rows, ${(field.columns || []).length} cols`}
                      {totalPages > 1 && ` | p${(field.page || 0) + 1}`}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeField(field.id); }}
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

/**
 * Renders field markers on the PDF preview.
 * Static fields: single draggable marker with WYSIWYG text.
 * Activity tables: anchor label + independently draggable column markers.
 */
function FieldMarker({ field, isSelected, showPreview, previewScale, onMouseDown, onRemove, isDragging, draggingColKey }) {
  const isTable = field.type === 'activityTable';

  if (!isTable) {
    // --- Static field ---
    const previewText = FIELD_KEY_OPTIONS.find(o => o.key === field.fieldKey)?.preview || field.label;
    const labelText = field.label;
    // WYSIWYG font size: PDF points * (container px / PDF page width)
    const displayFontSize = field.fontSize * previewScale;

    return (
      <div
        className={`absolute group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${field.xPercent}%`,
          top: `${field.yPercent}%`,
          zIndex: isSelected ? 20 : 10,
        }}
        onMouseDown={(e) => onMouseDown(e, null)}
      >
        {/* Label tag above the text */}
        <div
          className={`absolute bottom-full left-0 mb-0.5 flex items-center gap-1 ${isSelected ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
        >
          <span className={`text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap ${
            isSelected ? 'bg-primary-700' : 'bg-primary-500'
          }`}>
            {labelText}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
            className="bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] leading-none"
            title="Remove field"
          >
            x
          </button>
        </div>
        {/* Preview text in WYSIWYG style */}
        {showPreview ? (
          <span
            className="whitespace-nowrap pointer-events-none"
            style={{
              fontSize: `${displayFontSize}px`,
              fontFamily: 'Helvetica, Arial, sans-serif',
              color: 'black',
              lineHeight: 1.2,
            }}
          >
            {previewText}
          </span>
        ) : (
          <span
            className={`text-[9px] px-1 py-0.5 rounded whitespace-nowrap ${
              isSelected ? 'bg-primary-200 text-primary-800 ring-1 ring-primary-400' : 'bg-primary-100 text-primary-700'
            }`}
          >
            {labelText}
          </span>
        )}
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute inset-0 ring-2 ring-primary-400 ring-offset-1 rounded pointer-events-none" />
        )}
      </div>
    );
  }

  // --- Activity table ---
  const columns = field.columns || [];

  return (
    <>
      {/* Table anchor label - draggable to move the whole table's Y position */}
      <div
        className={`absolute group ${isDragging && !draggingColKey ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${field.xPercent}%`,
          top: `${field.yPercent}%`,
          zIndex: isSelected ? 20 : 10,
        }}
        onMouseDown={(e) => onMouseDown(e, null)}
      >
        <div className={`inline-flex items-center gap-1 ${isSelected ? 'ring-2 ring-green-400 rounded' : ''}`}
          style={{ transform: 'translateY(-100%)' }}
        >
          <span className="bg-green-600 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
            Activity Table ({field.maxRows} rows)
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
            className="opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] leading-none transition-opacity"
            title="Remove table"
          >
            x
          </button>
        </div>
      </div>

      {/* Column position markers - each independently draggable */}
      {columns.map(col => {
        const colPreview = ACTIVITY_COLUMN_OPTIONS.find(o => o.key === col.key)?.preview || col.label;
        const displayFontSize = (col.fontSize || 10) * previewScale;
        const isColDragging = draggingColKey === col.key;

        return (
          <React.Fragment key={`${field.id}-col-${col.key}`}>
            {/* Column drag handle at first row position */}
            <div
              className={`absolute ${isColDragging ? 'cursor-grabbing' : 'cursor-col-resize'}`}
              style={{
                left: `${col.xPercent}%`,
                top: `${field.yPercent}%`,
                transform: 'translateY(-100%)',
                zIndex: isSelected ? 19 : 9,
              }}
              onMouseDown={(e) => onMouseDown(e, col.key)}
            >
              <span className={`text-[8px] px-1 py-0.5 rounded whitespace-nowrap ${
                isColDragging
                  ? 'bg-green-700 text-white'
                  : isSelected
                    ? 'bg-green-100 text-green-800 ring-1 ring-green-300'
                    : 'bg-green-50 text-green-700'
              }`}>
                {col.label}
              </span>
            </div>

            {/* Column preview rows */}
            {showPreview && Array.from({ length: Math.min(field.maxRows, 3) }).map((_, rowIdx) => (
              <div
                key={`${field.id}-r${rowIdx}-${col.key}`}
                className="absolute pointer-events-none"
                style={{
                  left: `${col.xPercent}%`,
                  top: `${field.yPercent + (rowIdx * field.rowHeight)}%`,
                  maxWidth: col.maxWidth ? `${col.maxWidth}%` : undefined,
                  overflow: 'hidden',
                }}
              >
                <span
                  className="whitespace-nowrap"
                  style={{
                    fontSize: `${displayFontSize}px`,
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    color: 'black',
                    opacity: 0.5,
                    lineHeight: 1.2,
                  }}
                >
                  {colPreview}
                </span>
              </div>
            ))}
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * Inline editor for the currently selected field.
 * Shows above the PDF preview for immediate visibility.
 */
function SelectedFieldEditor({ field, onUpdate, onRemove }) {
  if (field.type === 'activityTable') {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-green-800">Edit Activity Table</h4>
          <Button size="sm" variant="danger" onClick={onRemove}>Remove Table</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="block text-xs text-green-700 mb-1">Row Height (%)</label>
            <input
              type="number"
              value={field.rowHeight}
              onChange={(e) => onUpdate({ rowHeight: Number(e.target.value) })}
              min={1}
              max={15}
              step={0.5}
              className="input-field text-sm w-20"
            />
          </div>
          <div>
            <label className="block text-xs text-green-700 mb-1">Max Rows</label>
            <input
              type="number"
              value={field.maxRows}
              onChange={(e) => onUpdate({ maxRows: Number(e.target.value) })}
              min={1}
              max={20}
              className="input-field text-sm w-16"
            />
          </div>
          <div>
            <label className="block text-xs text-green-700 mb-1">Y Position (%)</label>
            <input
              type="number"
              value={field.yPercent}
              onChange={(e) => onUpdate({ yPercent: Number(e.target.value) })}
              min={0}
              max={100}
              step={0.1}
              className="input-field text-sm w-20"
            />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-bold text-green-700 uppercase">Columns (drag on PDF to position, or edit X% below)</p>
          {(field.columns || []).map((col, idx) => (
            <div key={col.key} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-green-100">
              <span className="w-40 text-green-800 font-medium">{col.label}</span>
              <label className="text-xs text-green-600">X%:</label>
              <input
                type="number"
                value={col.xPercent}
                onChange={(e) => {
                  const updated = [...field.columns];
                  updated[idx] = { ...updated[idx], xPercent: Number(e.target.value) };
                  onUpdate({ columns: updated });
                }}
                min={0}
                max={100}
                step={0.5}
                className="input-field text-sm w-16"
              />
              <label className="text-xs text-green-600">Font:</label>
              <input
                type="number"
                value={col.fontSize}
                onChange={(e) => {
                  const updated = [...field.columns];
                  updated[idx] = { ...updated[idx], fontSize: Number(e.target.value) };
                  onUpdate({ columns: updated });
                }}
                min={6}
                max={24}
                className="input-field text-sm w-14"
              />
              <label className="text-xs text-green-600">MaxW%:</label>
              <input
                type="number"
                value={col.maxWidth || 0}
                onChange={(e) => {
                  const updated = [...field.columns];
                  updated[idx] = { ...updated[idx], maxWidth: Number(e.target.value) || 0 };
                  onUpdate({ columns: updated });
                }}
                min={0}
                max={100}
                className="input-field text-sm w-14"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Static field editor
  return (
    <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold text-primary-800">Edit Field: {field.label}</h4>
        <Button size="sm" variant="danger" onClick={onRemove}>Remove</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs text-primary-700 mb-1">Data Field</label>
          <select
            value={field.fieldKey}
            onChange={(e) => {
              const opt = FIELD_KEY_OPTIONS.find(o => o.key === e.target.value);
              onUpdate({ fieldKey: e.target.value, label: opt?.label || e.target.value, preview: opt?.preview || '' });
            }}
            className="input-field text-sm"
          >
            {FIELD_KEY_OPTIONS.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-primary-700 mb-1">Font Size</label>
          <input
            type="number"
            value={field.fontSize}
            onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
            min={6}
            max={36}
            className="input-field text-sm w-16"
          />
        </div>
        <div>
          <label className="block text-xs text-primary-700 mb-1">X Position (%)</label>
          <input
            type="number"
            value={field.xPercent}
            onChange={(e) => onUpdate({ xPercent: Number(e.target.value) })}
            min={0}
            max={100}
            step={0.1}
            className="input-field text-sm w-20"
          />
        </div>
        <div>
          <label className="block text-xs text-primary-700 mb-1">Y Position (%)</label>
          <input
            type="number"
            value={field.yPercent}
            onChange={(e) => onUpdate({ yPercent: Number(e.target.value) })}
            min={0}
            max={100}
            step={0.1}
            className="input-field text-sm w-20"
          />
        </div>
      </div>
    </div>
  );
}
