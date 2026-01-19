import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                VBS Volunteer Tracker
              </h1>
              <p className="text-sm text-gray-600">Admin Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                👤 {user?.email}
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Welcome to the Admin Dashboard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-3xl font-bold text-blue-700 mb-2">0</div>
              <div className="text-sm text-blue-600">Students Checked In</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-3xl font-bold text-green-700 mb-2">0</div>
              <div className="text-sm text-green-600">Students Checked Out</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-3xl font-bold text-purple-700 mb-2">0</div>
              <div className="text-sm text-purple-600">Total Students</div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left">
                <div className="text-2xl mb-2">📋</div>
                <div className="font-semibold text-gray-900">Daily Review</div>
                <div className="text-xs text-gray-600">Review hours</div>
              </button>
              <button className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left">
                <div className="text-2xl mb-2">📄</div>
                <div className="font-semibold text-gray-900">Generate Forms</div>
                <div className="text-xs text-gray-600">Create PDFs</div>
              </button>
              <button className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left">
                <div className="text-2xl mb-2">👥</div>
                <div className="font-semibold text-gray-900">Students</div>
                <div className="text-xs text-gray-600">Manage students</div>
              </button>
              <button className="p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left">
                <div className="text-2xl mb-2">📊</div>
                <div className="font-semibold text-gray-900">Reports</div>
                <div className="text-xs text-gray-600">Export data</div>
              </button>
            </div>
          </div>

          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="font-semibold text-green-900 mb-2">
              ✅ Firebase Emulator Connected
            </h3>
            <p className="text-sm text-green-700">
              You're successfully connected to the local Firebase emulator.
              All data is stored locally and will be cleared when you stop the emulator.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
