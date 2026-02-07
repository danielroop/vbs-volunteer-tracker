import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext';

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
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/daily-review"
              element={
                <AdminRoute>
                  <DailyReviewPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/forms"
              element={
                <AdminRoute>
                  <FormGenerationPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <AdminRoute>
                  <StudentsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/students/:studentId"
              element={
                <AdminRoute>
                  <StudentDetailPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/events"
              element={
                <AdminRoute>
                  <EventsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/events/new"
              element={
                <AdminRoute>
                  <CreateEventPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AdminRoute>
                  <UsersPage />
                </AdminRoute>
              }
            />
            <Route
              path="/admin/settings/pdf-templates"
              element={
                <AdminRoute>
                  <PdfTemplatesPage />
                </AdminRoute>
              }
            />

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
