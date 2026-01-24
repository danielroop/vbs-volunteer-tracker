import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Valid roles
const VALID_ROLES = ['admin', 'adult_volunteer'];

/**
 * Helper function to verify the caller is an admin
 */
async function verifyAdmin(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const db = getFirestore();
  const adminDoc = await db.collection('admins').doc(request.auth.uid).get();

  if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can manage users');
  }

  return adminDoc.data();
}

/**
 * Create a new user with a role
 *
 * @param {Object} request.data
 * @param {string} request.data.email - User's email
 * @param {string} request.data.password - User's password
 * @param {string} request.data.name - User's display name
 * @param {string} request.data.role - User's role ('admin' or 'adult_volunteer')
 */
export const createUser = onCall(async (request) => {
  await verifyAdmin(request);

  const { email, password, name, role } = request.data;

  // Validate required fields
  if (!email || !password || !name || !role) {
    throw new HttpsError('invalid-argument', 'Missing required fields: email, password, name, and role');
  }

  // Validate role
  if (!VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  // Validate password strength
  if (password.length < 8) {
    throw new HttpsError('invalid-argument', 'Password must be at least 8 characters');
  }

  const auth = getAuth();
  const db = getFirestore();

  try {
    // Create the user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: true
    });

    // Determine which collection to use based on role
    const collection = role === 'admin' ? 'admins' : 'users';

    // Create the user document in Firestore
    await db.collection(collection).doc(userRecord.uid).set({
      email,
      name,
      role,
      isActive: true,
      createdAt: Timestamp.now(),
      createdBy: request.auth.uid
    });

    return {
      success: true,
      userId: userRecord.uid,
      message: `User ${email} created successfully as ${role}`
    };
  } catch (error) {
    console.error('Create user error:', error);

    if (error.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'A user with this email already exists');
    }
    if (error.code === 'auth/invalid-email') {
      throw new HttpsError('invalid-argument', 'Invalid email address');
    }
    if (error.code === 'auth/weak-password') {
      throw new HttpsError('invalid-argument', 'Password is too weak');
    }

    throw new HttpsError('internal', error.message);
  }
});

/**
 * Update a user's role or status
 *
 * @param {Object} request.data
 * @param {string} request.data.userId - User's UID
 * @param {string} [request.data.role] - New role (optional)
 * @param {boolean} [request.data.isActive] - Active status (optional)
 * @param {string} [request.data.name] - New name (optional)
 */
export const updateUser = onCall(async (request) => {
  await verifyAdmin(request);

  const { userId, role, isActive, name } = request.data;

  if (!userId) {
    throw new HttpsError('invalid-argument', 'Missing required field: userId');
  }

  if (role && !VALID_ROLES.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`);
  }

  const db = getFirestore();
  const auth = getAuth();

  try {
    // Find user in either admins or users collection
    let userDoc = await db.collection('admins').doc(userId).get();
    let currentCollection = 'admins';

    if (!userDoc.exists) {
      userDoc = await db.collection('users').doc(userId).get();
      currentCollection = 'users';
    }

    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const currentData = userDoc.data();
    const newCollection = role === 'admin' ? 'admins' : 'users';

    // If role is changing, move user to new collection
    if (role && role !== currentData.role) {
      // Delete from current collection
      await db.collection(currentCollection).doc(userId).delete();

      // Create in new collection
      await db.collection(newCollection).doc(userId).set({
        ...currentData,
        role,
        isActive: isActive !== undefined ? isActive : currentData.isActive,
        name: name || currentData.name,
        updatedAt: Timestamp.now(),
        updatedBy: request.auth.uid
      });
    } else {
      // Just update in place
      const updates = {
        updatedAt: Timestamp.now(),
        updatedBy: request.auth.uid
      };

      if (isActive !== undefined) updates.isActive = isActive;
      if (name) updates.name = name;

      await db.collection(currentCollection).doc(userId).update(updates);
    }

    // Update display name in Auth if name changed
    if (name) {
      await auth.updateUser(userId, { displayName: name });
    }

    // If deactivating, disable the auth account
    if (isActive === false) {
      await auth.updateUser(userId, { disabled: true });
    } else if (isActive === true) {
      await auth.updateUser(userId, { disabled: false });
    }

    return {
      success: true,
      message: 'User updated successfully'
    };
  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Delete a user (removes from Auth and Firestore)
 *
 * @param {Object} request.data
 * @param {string} request.data.userId - User's UID to delete
 */
export const deleteUser = onCall(async (request) => {
  await verifyAdmin(request);

  const { userId } = request.data;

  if (!userId) {
    throw new HttpsError('invalid-argument', 'Missing required field: userId');
  }

  // Prevent self-deletion
  if (userId === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'Cannot delete your own account');
  }

  const db = getFirestore();
  const auth = getAuth();

  try {
    // Delete from Firestore (check both collections)
    const adminDoc = await db.collection('admins').doc(userId).get();
    if (adminDoc.exists) {
      await db.collection('admins').doc(userId).delete();
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      await db.collection('users').doc(userId).delete();
    }

    // Delete from Firebase Auth
    await auth.deleteUser(userId);

    return {
      success: true,
      message: 'User deleted successfully'
    };
  } catch (error) {
    console.error('Delete user error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'User not found in authentication system');
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * List all users (from both admins and users collections)
 */
export const listUsers = onCall(async (request) => {
  await verifyAdmin(request);

  const db = getFirestore();

  try {
    // Get all admins
    const adminsSnapshot = await db.collection('admins').get();
    const admins = adminsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      collection: 'admins'
    }));

    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      collection: 'users'
    }));

    // Combine and sort by name
    const allUsers = [...admins, ...users].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    return {
      success: true,
      users: allUsers
    };
  } catch (error) {
    console.error('List users error:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Reset a user's password (sends reset email or sets new password)
 *
 * @param {Object} request.data
 * @param {string} request.data.userId - User's UID
 * @param {string} [request.data.newPassword] - New password (if not provided, generates random)
 */
export const resetUserPassword = onCall(async (request) => {
  await verifyAdmin(request);

  const { userId, newPassword } = request.data;

  if (!userId) {
    throw new HttpsError('invalid-argument', 'Missing required field: userId');
  }

  const auth = getAuth();

  try {
    // Generate random password if not provided
    const password = newPassword || generateRandomPassword();

    await auth.updateUser(userId, { password });

    return {
      success: true,
      temporaryPassword: password,
      message: 'Password reset successfully. Please share the new password securely.'
    };
  } catch (error) {
    console.error('Reset password error:', error);
    if (error.code === 'auth/user-not-found') {
      throw new HttpsError('not-found', 'User not found');
    }
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Generate a random password
 */
function generateRandomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}
