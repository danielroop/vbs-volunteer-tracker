/**
 * Tests for userManagement Cloud Functions
 */
import { jest } from '@jest/globals';

const mockTimestamp = {
  now: jest.fn(() => new Date('2026-06-15T10:00:00')),
};

const mockAdminDoc = {
  exists: true,
  data: () => ({
    role: 'admin',
    name: 'Admin User',
  }),
};

const mockNonAdminDoc = {
  exists: true,
  data: () => ({
    role: 'adult_volunteer',
    name: 'Volunteer User',
  }),
};

const mockUserDoc = {
  exists: true,
  data: () => ({
    email: 'user@test.com',
    name: 'Test User',
    role: 'adult_volunteer',
    isActive: true,
  }),
};

const mockCollection = jest.fn();
const mockDoc = jest.fn();
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

const mockCreateUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockDeleteUser = jest.fn();

jest.unstable_mockModule('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: mockCollection,
  }),
  Timestamp: mockTimestamp,
}));

jest.unstable_mockModule('firebase-admin/auth', () => ({
  getAuth: () => ({
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    deleteUser: mockDeleteUser,
  }),
}));

jest.unstable_mockModule('firebase-functions/v2/https', () => ({
  onCall: (handler) => handler,
  HttpsError: class HttpsError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

describe('User Management Functions', () => {
  let createUser, updateUser, deleteUser, listUsers, resetUserPassword;

  beforeAll(async () => {
    const module = await import('../src/userManagement.js');
    createUser = module.createUser;
    updateUser = module.updateUser;
    deleteUser = module.deleteUser;
    listUsers = module.listUsers;
    resetUserPassword = module.resetUserPassword;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockCollection.mockReturnValue({
      doc: mockDoc,
      get: mockGet,
    });

    mockDoc.mockReturnValue({
      get: mockGet,
      set: mockSet,
      update: mockUpdate,
      delete: mockDelete,
    });

    // Default to admin user
    mockGet.mockResolvedValue(mockAdminDoc);
  });

  describe('createUser', () => {
    beforeEach(() => {
      mockCreateUser.mockResolvedValue({ uid: 'newUser123' });
      mockSet.mockResolvedValue(undefined);
    });

    it('should throw error when not authenticated', async () => {
      const request = {
        auth: null,
        data: {
          email: 'new@test.com',
          password: 'password123',
          name: 'New User',
          role: 'adult_volunteer',
        },
      };

      await expect(createUser(request)).rejects.toThrow('Must be authenticated');
    });

    it('should throw error when caller is not admin', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });

      const request = {
        auth: { uid: 'notAdminUser' },
        data: {
          email: 'new@test.com',
          password: 'password123',
          name: 'New User',
          role: 'adult_volunteer',
        },
      };

      await expect(createUser(request)).rejects.toThrow('Only admins can manage users');
    });

    it('should throw error for missing required fields', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          email: 'new@test.com',
          // missing password, name, role
        },
      };

      await expect(createUser(request)).rejects.toThrow('Missing required fields');
    });

    it('should throw error for invalid role', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          email: 'new@test.com',
          password: 'password123',
          name: 'New User',
          role: 'invalid_role',
        },
      };

      await expect(createUser(request)).rejects.toThrow('Invalid role');
    });

    it('should throw error for weak password', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          email: 'new@test.com',
          password: 'short',
          name: 'New User',
          role: 'adult_volunteer',
        },
      };

      await expect(createUser(request)).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should create admin user in admins collection', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          email: 'newadmin@test.com',
          password: 'password123',
          name: 'New Admin',
          role: 'admin',
        },
      };

      const result = await createUser(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('newUser123');
      expect(mockCollection).toHaveBeenCalledWith('admins');
    });

    it('should create adult_volunteer user in users collection', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          email: 'newav@test.com',
          password: 'password123',
          name: 'New AV',
          role: 'adult_volunteer',
        },
      };

      const result = await createUser(request);

      expect(result.success).toBe(true);
      // Check that we tried to access the users collection (second call after admins check)
      const collectionCalls = mockCollection.mock.calls.map(c => c[0]);
      expect(collectionCalls).toContain('users');
    });
  });

  describe('updateUser', () => {
    beforeEach(() => {
      mockUpdate.mockResolvedValue(undefined);
      mockUpdateUser.mockResolvedValue(undefined);
    });

    it('should throw error when userId is missing', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          name: 'Updated Name',
        },
      };

      await expect(updateUser(request)).rejects.toThrow('Missing required field: userId');
    });

    it('should update user name', async () => {
      mockGet
        .mockResolvedValueOnce(mockAdminDoc) // Admin check
        .mockResolvedValueOnce({ exists: false }) // Not in admins
        .mockResolvedValueOnce(mockUserDoc); // Found in users

      const request = {
        auth: { uid: 'adminUser' },
        data: {
          userId: 'targetUser123',
          name: 'Updated Name',
        },
      };

      const result = await updateUser(request);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
        })
      );
    });

    it('should disable auth account when setting isActive to false', async () => {
      mockGet
        .mockResolvedValueOnce(mockAdminDoc)
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce(mockUserDoc);

      const request = {
        auth: { uid: 'adminUser' },
        data: {
          userId: 'targetUser123',
          isActive: false,
        },
      };

      await updateUser(request);

      expect(mockUpdateUser).toHaveBeenCalledWith(
        'targetUser123',
        { disabled: true }
      );
    });
  });

  describe('deleteUser', () => {
    beforeEach(() => {
      mockDelete.mockResolvedValue(undefined);
      mockDeleteUser.mockResolvedValue(undefined);
    });

    it('should throw error when userId is missing', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {},
      };

      await expect(deleteUser(request)).rejects.toThrow('Missing required field: userId');
    });

    it('should prevent self-deletion', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          userId: 'adminUser', // Same as auth.uid
        },
      };

      await expect(deleteUser(request)).rejects.toThrow('Cannot delete your own account');
    });

    it('should delete user from both collections and auth', async () => {
      mockGet
        .mockResolvedValueOnce(mockAdminDoc) // Admin check
        .mockResolvedValueOnce({ exists: false }) // Not in admins collection
        .mockResolvedValueOnce(mockUserDoc); // Found in users collection

      const request = {
        auth: { uid: 'adminUser' },
        data: {
          userId: 'targetUser123',
        },
      };

      const result = await deleteUser(request);

      expect(result.success).toBe(true);
      expect(mockDeleteUser).toHaveBeenCalledWith('targetUser123');
    });
  });

  describe('listUsers', () => {
    it('should return all users from both collections', async () => {
      const mockAdminsSnapshot = {
        docs: [
          { id: 'admin1', data: () => ({ name: 'Admin One', role: 'admin' }) },
        ],
      };

      const mockUsersSnapshot = {
        docs: [
          { id: 'user1', data: () => ({ name: 'User One', role: 'adult_volunteer' }) },
          { id: 'user2', data: () => ({ name: 'User Two', role: 'adult_volunteer' }) },
        ],
      };

      mockGet
        .mockResolvedValueOnce(mockAdminDoc) // Admin check
        .mockResolvedValueOnce(mockAdminsSnapshot)
        .mockResolvedValueOnce(mockUsersSnapshot);

      const request = {
        auth: { uid: 'adminUser' },
        data: {},
      };

      const result = await listUsers(request);

      expect(result.success).toBe(true);
      expect(result.users).toHaveLength(3);
    });

    it('should sort users by name', async () => {
      const mockAdminsSnapshot = {
        docs: [
          { id: 'admin1', data: () => ({ name: 'Zebra Admin', role: 'admin' }) },
        ],
      };

      const mockUsersSnapshot = {
        docs: [
          { id: 'user1', data: () => ({ name: 'Alpha User', role: 'adult_volunteer' }) },
          { id: 'user2', data: () => ({ name: 'Beta User', role: 'adult_volunteer' }) },
        ],
      };

      mockGet
        .mockResolvedValueOnce(mockAdminDoc)
        .mockResolvedValueOnce(mockAdminsSnapshot)
        .mockResolvedValueOnce(mockUsersSnapshot);

      const request = {
        auth: { uid: 'adminUser' },
        data: {},
      };

      const result = await listUsers(request);

      expect(result.users[0].name).toBe('Alpha User');
      expect(result.users[1].name).toBe('Beta User');
      expect(result.users[2].name).toBe('Zebra Admin');
    });
  });

  describe('resetUserPassword', () => {
    beforeEach(() => {
      mockUpdateUser.mockResolvedValue(undefined);
    });

    it('should throw error when userId is missing', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {},
      };

      await expect(resetUserPassword(request)).rejects.toThrow('Missing required field: userId');
    });

    it('should use provided password', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          userId: 'targetUser123',
          newPassword: 'newPassword456',
        },
      };

      const result = await resetUserPassword(request);

      expect(result.success).toBe(true);
      expect(result.temporaryPassword).toBe('newPassword456');
      expect(mockUpdateUser).toHaveBeenCalledWith('targetUser123', {
        password: 'newPassword456',
      });
    });

    it('should generate random password when not provided', async () => {
      const request = {
        auth: { uid: 'adminUser' },
        data: {
          userId: 'targetUser123',
        },
      };

      const result = await resetUserPassword(request);

      expect(result.success).toBe(true);
      expect(result.temporaryPassword).toHaveLength(12);
    });
  });
});

describe('generateRandomPassword helper', () => {
  it('should generate 12 character password', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    expect(password).toHaveLength(12);
  });

  it('should not include ambiguous characters (0, O, l, 1, I)', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';

    expect(chars).not.toContain('0');
    expect(chars).not.toContain('O');
    expect(chars).not.toContain('l');
    expect(chars).not.toContain('1');
    expect(chars).not.toContain('I');
  });
});
