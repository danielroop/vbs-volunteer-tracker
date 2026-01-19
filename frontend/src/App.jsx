import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { EventProvider } from './contexts/EventContext';

// Pages
import LoginPage from './pages/LoginPage';
import AVScannerPage from './pages/AVScannerPage';
import CheckoutPage from './pages/CheckoutPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import DailyReviewPage from './pages/DailyReviewPage';
import FormGenerationPage from './pages/FormGenerationPage';
import StudentsPage from './pages/StudentsPage';
import EventsPage from './pages/EventsPage';
import CreateEventPage from './pages/CreateEventPage';
import StudentDetailPage from './pages/StudentDetailPage';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <EventProvider>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/scan/:eventId?/:activityId?" element={<AVScannerPage />} />
            <Route path="/checkout/:eventId?/:activityId?" element={<CheckoutPage />} />

            {/* Protected Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/daily-review"
              element={
                <ProtectedRoute>
                  <DailyReviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/forms"
              element={
                <ProtectedRoute>
                  <FormGenerationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/students"
              element={
                <ProtectedRoute>
                  <StudentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events"
              element={
                <ProtectedRoute>
                  <EventsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/events/new"
              element={
                <ProtectedRoute>
                  <CreateEventPage />
                </ProtectedRoute>
              }
            />

            <Route 
              path="/admin/students/:studentId" 
              element={<StudentDetailPage />} 
            />
            {/* Add more admin routes as needed */}

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/admin" />} />
            <Route path="*" element={<Navigate to="/admin" />} />
          </Routes>
        </EventProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
