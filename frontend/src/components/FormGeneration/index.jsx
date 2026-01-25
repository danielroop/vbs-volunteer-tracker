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
      <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
        {/* Page Header */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Form Generation
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>

          <div className="mt-4 space-y-2 text-sm sm:text-base">
            <div className="text-green-600">
              Mon-Thu hours reviewed and approved
            </div>
            <div className="text-amber-600">
              Friday: <span className="font-bold">--</span> students still checked in
            </div>
          </div>
        </div>

        {/* Generate All Forms */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-8 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
            Generate Forms for All Students
          </h2>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
            <p className="text-xs sm:text-sm text-blue-900">
              Students still checked in will have estimated Friday hours (~6 hrs based on averages)
            </p>
          </div>

          <Button variant="primary" size="lg" className="w-full">
            Generate All Forms (-- students)
          </Button>
        </div>

        {/* Generate by Type */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            OR generate by school/form type:
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Button variant="secondary" className="text-sm">
              OCPS (--)
            </Button>
            <Button variant="secondary" className="text-sm">
              NJHS (--)
            </Button>
            <Button variant="secondary" className="text-sm">
              NHS (--)
            </Button>
            <Button variant="secondary" className="text-sm">
              Other (--)
            </Button>
          </div>

          <div className="mt-4 sm:mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OR search individual:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Student name..."
                className="input-field flex-1"
              />
              <Button variant="primary" className="w-full sm:w-auto">🔍 Search</Button>
            </div>
          </div>
        </div>

        {/* Generated Forms */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
            📥 Generated Forms
          </h2>

          <div className="text-center py-6 sm:py-8 text-gray-500 text-sm sm:text-base">
            No forms generated yet
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-4">
            <Button variant="primary" disabled className="w-full sm:w-auto">
              Download All as PDF
            </Button>
            <Button variant="secondary" disabled className="w-full sm:w-auto">
              Download as ZIP
            </Button>
            <Button variant="secondary" disabled className="w-full sm:w-auto">
              Print All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
