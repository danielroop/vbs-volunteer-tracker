import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext';
import Header from './components/common/Header';

// Pages
import LoginPage from './pages/LoginPage';
import ScannerPage from './pages/ScannerPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import DailyReviewPage from './pages/DailyReviewPage';
import FormGenerationPage from './pages/FormGenerationPage';
import StudentsPage from './pages/StudentsPage';
import EventsPage from './pages/EventsPage';
import CreateEventPage from './pages/CreateEventPage';
import StudentDetailPage from './pages/StudentDetailPage';
import UsersPage from './pages/UsersPage';
import PdfTemplatesPage from './pages/PdfTemplatesPage';
import EventStudentsPage from './pages/EventStudentsPage';

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
    </div>
  );
}

// Protected Route Component (basic authentication)
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

// Admin-only Protected Route Component
function AdminRoute({ children }) {
  const { isAuthenticated, canAccessAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!canAccessAdmin()) {
    // Redirect non-admins to scanner
    return <Navigate to="/scan" />;
  }

  return children;
}

// Scanner Protected Route Component (admin or adult volunteer)
function ScannerRoute({ children }) {
  const { isAuthenticated, canAccessScanner, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (!canAccessScanner()) {
    return <Navigate to="/login" />;
  }

  return children;
}

// Default redirect based on user role
function DefaultRedirect() {
  const { isAuthenticated, canAccessAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Admins go to admin dashboard, others go to scanner
  return canAccessAdmin() ? <Navigate to="/admin" /> : <Navigate to="/scan" />;
}

function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50 lg:flex">
      <Header />
      <main className="min-w-0 flex-1 lg:pl-72">
        <Outlet />
      </main>
    </div>
  );
}

function SettingsLayout() {
  const location = useLocation();
  const tabs = [
    { path: '/admin/settings/students', label: 'Students' },
    { path: '/admin/settings/events', label: 'Events' },
    { path: '/admin/settings/users', label: 'Users' },
    { path: '/admin/settings/pdf-templates', label: 'PDF Templates' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-gray-900">Settings</h1>
          <p className="mt-1 text-sm font-medium text-gray-500">
            Configure events, access, and document templates.
          </p>
        </div>

        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Settings sections">
            {tabs.map((tab) => {
              const active = location.pathname.startsWith(tab.path);
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-bold transition-colors ${
                    active
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Outlet />
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <EventProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />

            {/* Scanner Routes - Protected (admin or adult volunteer) */}
            <Route
              path="/scan/:eventId?/:activityId?/:action?"
              element={
                <ScannerRoute>
                  <ScannerPage />
                </ScannerRoute>
              }
            />

            {/* Protected Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="daily-review" element={<DailyReviewPage />} />
              <Route path="forms" element={<FormGenerationPage />} />
              <Route path="students" element={<EventStudentsPage />} />
              <Route path="events" element={<Navigate to="/admin/settings/events" replace />} />
              <Route path="events/new" element={<Navigate to="/admin/settings/events/new" replace />} />
              <Route path="users" element={<Navigate to="/admin/settings/users" replace />} />
              <Route path="settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="students" replace />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="students/:studentId" element={<StudentDetailPage />} />
                <Route path="events" element={<EventsPage />} />
                <Route path="events/new" element={<CreateEventPage />} />
                <Route path="events/:eventId/students" element={<EventStudentsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="pdf-templates" element={<PdfTemplatesPage />} />
              </Route>
            </Route>

            {/* Default Route - redirect based on role */}
            <Route path="/" element={<DefaultRedirect />} />
            <Route path="*" element={<DefaultRedirect />} />
          </Routes>
        </EventProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
