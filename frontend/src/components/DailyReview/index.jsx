import React from 'react';
import Button from '../common/Button';

/**
 * Daily Review Component
 * Per PRD Section 3.5.2: Daily Review (Nightly)
 * - Review and approve hours
 * - Flag early/late times
 * - Bulk approve
 * - Individual adjustments
 */
export default function DailyReview() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Daily Review - {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h1>

          <div className="mt-4 flex items-center gap-4">
            <div className="text-amber-600">
              ⚠️ <span className="font-bold">--</span> pending
            </div>
            <div className="text-green-600">
              ✓ <span className="font-bold">--</span> approved
            </div>
          </div>

          <div className="mt-4 flex gap-4">
            <input
              type="text"
              placeholder="Search students..."
              className="input-field flex-1"
            />
            <select className="input-field w-48">
              <option>All</option>
              <option>Flagged</option>
              <option>Approved</option>
              <option>Need Review</option>
            </select>
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check-Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  No entries for today
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-between">
          <Button variant="secondary">
            Export Daily Report
          </Button>
          <Button variant="success">
            ✓ Approve All Good Hours
          </Button>
        </div>
      </div>
    </div>
  );
}
