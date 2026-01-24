import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLES } from '../contexts/AuthContext';
import Button from '../components/common/Button';
import Input from '../components/common/Input';

/**
 * Login Page for Authentication
 * Supports both admin and adult volunteer logins
 */
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, isAuthenticated, userProfile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (authLoading) return;

    if (isAuthenticated && userProfile) {
      const redirectTo = userProfile.role === ROLES.ADMIN ? '/admin' : '/scan';
      navigate(redirectTo);
    }
  }, [isAuthenticated, userProfile, authLoading, navigate]);

  // Handle case where user is authenticated but has no profile (unauthorized)
  useEffect(() => {
    if (authLoading) return;

    if (user && !userProfile && loading) {
      setError('Account not authorized. Please contact an administrator.');
      setLoading(false);
    }
  }, [user, userProfile, authLoading, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn(email, password);

    if (!result.success) {
      setError(result.error || 'Failed to sign in');
      setLoading(false);
    }
    // If success, onAuthStateChanged in AuthContext will update the state
    // and the useEffect above will handle the redirect
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">VBS Volunteer Tracker</h1>
        <p className="text-gray-600 mb-8">Sign in to continue</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="bg-red-100 text-red-800 p-3 rounded-lg">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            loading={loading}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Access restricted to authorized users only</p>
        </div>
      </div>
    </div>
  );
}
