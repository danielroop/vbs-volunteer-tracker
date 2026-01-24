import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../utils/firebase';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext(null);

// User roles
export const ROLES = {
  ADMIN: 'admin',
  ADULT_VOLUNTEER: 'adult_volunteer'
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from Firestore (admins or users collection)
  const fetchUserProfile = async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      return null;
    }

    try {
      // First check admins collection
      const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
      if (adminDoc.exists()) {
        const profile = { id: adminDoc.id, ...adminDoc.data() };
        setUserProfile(profile);
        return profile;
      }

      // Then check users collection (for adult volunteers)
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const profile = { id: userDoc.id, ...userDoc.data() };
        setUserProfile(profile);
        return profile;
      }

      // User exists in Auth but not in Firestore - deny access
      console.warn('User authenticated but no profile found in Firestore');
      setUserProfile(null);
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Set loading to true when auth state changes to prevent race conditions
      setLoading(true);
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  /**
   * Sign in with email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<Object>}
   */
  const signIn = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: result.user };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * Sign out the current user
   * @returns {Promise<Object>}
   */
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  };

  // Helper to check if user has a specific role
  const hasRole = (role) => {
    return userProfile?.role === role;
  };

  // Helper to check if user is an admin
  const isAdmin = () => hasRole(ROLES.ADMIN);

  // Helper to check if user is an adult volunteer
  const isAdultVolunteer = () => hasRole(ROLES.ADULT_VOLUNTEER);

  // Helper to check if user can access scanner (admin or adult volunteer)
  const canAccessScanner = () => {
    return isAdmin() || isAdultVolunteer();
  };

  // Helper to check if user can access admin dashboard
  const canAccessAdmin = () => {
    return isAdmin();
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user && !!userProfile,
    hasRole,
    isAdmin,
    isAdultVolunteer,
    canAccessScanner,
    canAccessAdmin,
    refreshProfile: () => fetchUserProfile(user),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
