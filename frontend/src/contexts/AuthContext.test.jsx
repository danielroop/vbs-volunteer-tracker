import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthProvider, useAuth, ROLES } from './AuthContext';

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args) => mockSignInWithEmailAndPassword(...args),
  signOut: (...args) => mockSignOut(...args),
  onAuthStateChanged: (...args) => mockOnAuthStateChanged(...args),
}));

// Mock Firebase Firestore
const mockGetDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: vi.fn((db, collection, id) => ({ collection, id })),
  getDoc: (...args) => mockGetDoc(...args),
}));

// Test component that uses the auth context
function TestConsumer({ onAuth }) {
  const auth = useAuth();
  React.useEffect(() => {
    if (onAuth) onAuth(auth);
  }, [auth, onAuth]);

  return (
    <div>
      <div data-testid="loading">{auth.loading.toString()}</div>
      <div data-testid="authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="is-admin">{auth.isAdmin().toString()}</div>
      <div data-testid="is-av">{auth.isAdultVolunteer().toString()}</div>
      <div data-testid="can-access-scanner">{auth.canAccessScanner().toString()}</div>
      <div data-testid="can-access-admin">{auth.canAccessAdmin().toString()}</div>
      {auth.userProfile && (
        <div data-testid="profile-name">{auth.userProfile.name}</div>
      )}
      <button onClick={() => auth.signIn('test@test.com', 'password')}>Sign In</button>
      <button onClick={() => auth.signOut()}>Sign Out</button>
    </div>
  );
}

describe('AuthContext', () => {
  let authStateCallback = null;

  beforeEach(() => {
    vi.clearAllMocks();
    authStateCallback = null;

    // Capture the auth state change callback
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      authStateCallback = callback;
      // Return unsubscribe function
      return vi.fn();
    });
  });

  describe('ROLES constant', () => {
    it('should define admin role', () => {
      expect(ROLES.ADMIN).toBe('admin');
    });

    it('should define adult_volunteer role', () => {
      expect(ROLES.ADULT_VOLUNTEER).toBe('adult_volunteer');
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      // Suppress console error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('initial state', () => {
    it('should start with loading true', async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Initial loading state before auth callback fires
      expect(screen.getByTestId('loading').textContent).toBe('true');
    });

    it('should not be authenticated initially', async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Simulate no user logged in
      await act(async () => {
        authStateCallback(null);
      });

      await waitFor(() => {
        expect(screen.getByTestId('authenticated').textContent).toBe('false');
      });
    });
  });

  describe('admin user authentication', () => {
    it('should set admin profile when admin user logs in', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'admin123',
        data: () => ({
          name: 'Admin User',
          role: 'admin',
          isActive: true,
        }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback({ uid: 'admin123', email: 'admin@test.com' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
        expect(screen.getByTestId('is-admin').textContent).toBe('true');
        expect(screen.getByTestId('can-access-admin').textContent).toBe('true');
        expect(screen.getByTestId('can-access-scanner').textContent).toBe('true');
      });
    });
  });

  describe('adult volunteer authentication', () => {
    it('should set AV profile when adult volunteer logs in', async () => {
      // Not in admins collection
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      // Found in users collection
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'av123',
        data: () => ({
          name: 'Volunteer User',
          role: 'adult_volunteer',
          isActive: true,
        }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback({ uid: 'av123', email: 'av@test.com' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('authenticated').textContent).toBe('true');
        expect(screen.getByTestId('is-admin').textContent).toBe('false');
        expect(screen.getByTestId('is-av').textContent).toBe('true');
        expect(screen.getByTestId('can-access-scanner').textContent).toBe('true');
        expect(screen.getByTestId('can-access-admin').textContent).toBe('false');
      });
    });
  });

  describe('user not in Firestore', () => {
    it('should not authenticate if user has no Firestore profile', async () => {
      // Not in admins collection
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });
      // Not in users collection
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback({ uid: 'unknown123', email: 'unknown@test.com' });
      });

      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
        expect(screen.getByTestId('authenticated').textContent).toBe('false');
      });
    });
  });

  describe('signIn', () => {
    it('should call Firebase signInWithEmailAndPassword', async () => {
      const mockUser = { uid: 'user123', email: 'test@test.com' };
      mockSignInWithEmailAndPassword.mockResolvedValueOnce({ user: mockUser });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      // Simulate initial no user state
      await act(async () => {
        authStateCallback(null);
      });

      const signInButton = screen.getByText('Sign In');
      await userEvent.click(signInButton);

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@test.com',
        'password'
      );
    });

    it('should return error on failed sign in', async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(
        new Error('Invalid credentials')
      );

      let capturedAuth;
      render(
        <AuthProvider>
          <TestConsumer onAuth={(auth) => { capturedAuth = auth; }} />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback(null);
      });

      await waitFor(() => {
        expect(capturedAuth).toBeDefined();
      });

      const result = await capturedAuth.signIn('bad@test.com', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });
  });

  describe('signOut', () => {
    it('should call Firebase signOut', async () => {
      mockSignOut.mockResolvedValueOnce();
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'user123',
        data: () => ({ name: 'Test', role: 'admin' }),
      });

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback({ uid: 'user123' });
      });

      const signOutButton = screen.getByText('Sign Out');
      await userEvent.click(signOutButton);

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('hasRole', () => {
    it('should return true for matching role', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'admin123',
        data: () => ({ name: 'Admin', role: 'admin' }),
      });

      let capturedAuth;
      render(
        <AuthProvider>
          <TestConsumer onAuth={(auth) => { capturedAuth = auth; }} />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback({ uid: 'admin123' });
      });

      await waitFor(() => {
        expect(capturedAuth.hasRole('admin')).toBe(true);
      });
    });

    it('should return false for non-matching role', async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        id: 'admin123',
        data: () => ({ name: 'Admin', role: 'admin' }),
      });

      let capturedAuth;
      render(
        <AuthProvider>
          <TestConsumer onAuth={(auth) => { capturedAuth = auth; }} />
        </AuthProvider>
      );

      await act(async () => {
        authStateCallback({ uid: 'admin123' });
      });

      await waitFor(() => {
        expect(capturedAuth.hasRole('adult_volunteer')).toBe(false);
      });
    });
  });
});
