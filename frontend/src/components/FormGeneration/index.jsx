import React from 'react';
import Header from '../common/Header';
import Button from '../common/Button';

/**
 * Form Generation Component
 * Per PRD Section 3.6: Form Generation
 * - Multi-form type support (OCPS, NJHS, NHS, etc.)
 * - Batch generation
 * - Individual form generation
 * - PDF download
 */
export default function FormGeneration() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Form Generation - {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h1>

          <div className="mt-4 space-y-2">
            <div className="text-green-600">
              Mon-Thu hours reviewed and approved
            </div>
            <div className="text-amber-600">
              Friday: <span className="font-bold">--</span> students still checked in
            </div>
          </div>
        </div>

        {/* Generate All Forms */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Generate Forms for All Students
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900">
              Students still checked in will have estimated Friday hours (~6 hrs based on averages)
            </p>
          </div>

          <Button variant="primary" size="lg" className="w-full">
            Generate All Forms (-- students)
          </Button>
        </div>

        {/* Generate by Type */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            OR generate by school/form type:
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="secondary">
              OCPS (-- students)
            </Button>
            <Button variant="secondary">
              NJHS (-- students)
            </Button>
            <Button variant="secondary">
              NHS (-- students)
            </Button>
            <Button variant="secondary">
              Other (-- students)
            </Button>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OR search individual:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Student name..."
                className="input-field flex-1"
              />
              <Button variant="primary">🔍 Search</Button>
            </div>
          </div>
        </div>

        {/* Generated Forms */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            📥 Generated Forms
          </h2>

          <div className="text-center py-8 text-gray-500">
            No forms generated yet
          </div>

          <div className="mt-4 flex gap-4">
            <Button variant="primary" disabled>
              Download All as PDF
            </Button>
            <Button variant="secondary" disabled>
              Download as ZIP
            </Button>
            <Button variant="secondary" disabled>
              Print All
            </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
