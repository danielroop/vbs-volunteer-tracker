import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../common/Button';

/**
 * Admin Dashboard Component
 * Per PRD Section 3.5: Volunteer Admin (VA) Dashboard
 * - Real-time monitoring
 * - Recent activity feed
 * - Quick actions
 */
export default function AdminDashboard() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">VBS Volunteer Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">👤 {user?.email}</span>
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <Link to="/admin" className="px-4 py-2 border-b-2 border-primary-600 font-medium text-primary-600">
            Dashboard
          </Link>
          <Link to="/admin/daily-review" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Daily Review
          </Link>
          <Link to="/admin/forms" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Forms
          </Link>
          <Link to="/admin/students" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Students
          </Link>
          <Link to="/admin/reports" className="px-4 py-2 font-medium text-gray-600 hover:text-gray-900">
            Reports
          </Link>
        </div>

        {/* Today's Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Today's Overview</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>🟢 Checked In:</span>
                <span className="font-bold">--</span>
              </div>
              <div className="flex justify-between">
                <span>✓ Checked Out:</span>
                <span className="font-bold">--</span>
              </div>
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-bold">--</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">🔔 Recent Activity</h3>
            <p className="text-gray-500 text-sm">No recent activity</p>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">⚠️ Needs Attention</h3>
            <p className="text-gray-500 text-sm">All clear</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="primary" as="link" to="/admin/daily-review">
              Review Today
            </Button>
            <Button variant="primary" as="link" to="/admin/forms">
              Generate Forms
            </Button>
            <Button variant="secondary">
              Export Report
            </Button>
            <Button variant="secondary">
              Search Student
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
