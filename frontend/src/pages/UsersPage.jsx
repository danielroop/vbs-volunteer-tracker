import React, { useState, useEffect } from 'react';
import { functions } from '../utils/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/common/Header';
import Button from '../components/common/Button';
import Spinner from '../components/common/Spinner';
import Modal from '../components/common/Modal';
import UserCard from '../components/Users/UserCard';
import UserRow from '../components/Users/UserRow';

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [temporaryPassword, setTemporaryPassword] = useState(null);

  // Form state for creating/editing users
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'adult_volunteer'
  });

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const listUsersFn = httpsCallable(functions, 'listUsers');
      const result = await listUsersFn();
      if (result.data.success) {
        setUsers(result.data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionMessage(null);

    try {
      const createUserFn = httpsCallable(functions, 'createUser');
      const result = await createUserFn(formData);

      if (result.data.success) {
        setActionMessage({ type: 'success', text: `User ${formData.email} created successfully!` });
        setIsCreateModalOpen(false);
        setFormData({ email: '', password: '', name: '', role: 'adult_volunteer' });
        fetchUsers();
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const updateUserFn = httpsCallable(functions, 'updateUser');
      const result = await updateUserFn({
        userId: selectedUser.id,
        name: formData.name,
        role: formData.role,
        isActive: formData.isActive
      });

      if (result.data.success) {
        setActionMessage({ type: 'success', text: 'User updated successfully!' });
        setIsEditModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error('Error updating user:', err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    setActionMessage(null);

    try {
      const deleteUserFn = httpsCallable(functions, 'deleteUser');
      const result = await deleteUserFn({ userId: selectedUser.id });

      if (result.data.success) {
        setActionMessage({ type: 'success', text: 'User deleted successfully!' });
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    setActionMessage(null);
    setTemporaryPassword(null);

    try {
      const resetPasswordFn = httpsCallable(functions, 'resetUserPassword');
      const result = await resetPasswordFn({ userId: selectedUser.id });

      if (result.data.success) {
        setTemporaryPassword(result.data.temporaryPassword);
        setActionMessage({ type: 'success', text: 'Password reset successfully!' });
      }
    } catch (err) {
      console.error('Error resetting password:', err);
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (userToEdit) => {
    setSelectedUser(userToEdit);
    setFormData({
      name: userToEdit.name || '',
      role: userToEdit.role || 'adult_volunteer',
      isActive: userToEdit.isActive !== false
    });
    setActionMessage(null);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (userToDelete) => {
    setSelectedUser(userToDelete);
    setActionMessage(null);
    setIsDeleteModalOpen(true);
  };

  const openResetPasswordModal = (userToReset) => {
    setSelectedUser(userToReset);
    setActionMessage(null);
    setTemporaryPassword(null);
    setIsResetPasswordModalOpen(true);
  };

  const filteredUsers = users.filter(u =>
    `${u.name} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700 border-purple-200',
      adult_volunteer: 'bg-blue-100 text-blue-700 border-blue-200'
    };
    const labels = {
      admin: 'Admin',
      adult_volunteer: 'Adult Volunteer'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
        {labels[role] || role}
      </span>
    );
  };

  const getStatusBadge = (isActive) => {
    return isActive !== false ? (
      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-green-100 text-green-700 border border-green-200">
        Active
      </span>
    ) : (
      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
        Inactive
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="p-20 text-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="p-6 max-w-7xl mx-auto">
        {/* PAGE HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">User Management</h1>
            <p className="text-gray-500 text-sm mt-1">
              Manage admin users and adult volunteers who can access the scanning tool.
            </p>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <input
              placeholder="Search users..."
              className="border border-gray-200 rounded-xl px-4 py-2 w-full md:w-64 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Button
              onClick={() => {
                setFormData({ email: '', password: '', name: '', role: 'adult_volunteer' });
                setActionMessage(null);
                setIsCreateModalOpen(true);
              }}
              variant="primary"
            >
              + Add User
            </Button>
          </div>
        </div>

      {/* Global action message */}
      {actionMessage && !isCreateModalOpen && !isEditModalOpen && !isDeleteModalOpen && !isResetPasswordModalOpen && (
        <div className={`mb-4 p-4 rounded-xl ${
          actionMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-800 border border-red-200">
          Error loading users: {error}
        </div>
      )}

      {/* Empty state */}
      {filteredUsers.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-500">
          {searchTerm ? 'No users found matching your search.' : 'No users found. Add your first user!'}
        </div>
      )}

      {/* DESKTOP TABLE VIEW (md and above) */}
      {filteredUsers.length > 0 && (
        <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map(u => (
                <UserRow
                  key={u.id}
                  userItem={u}
                  isSelf={u.id === user?.uid}
                  onEdit={openEditModal}
                  onResetPassword={openResetPasswordModal}
                  onDelete={openDeleteModal}
                  getRoleBadge={getRoleBadge}
                  getStatusBadge={getStatusBadge}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MOBILE CARD VIEW (below md) */}
      {filteredUsers.length > 0 && (
        <ul className="block md:hidden space-y-3">
          {filteredUsers.map(u => (
            <UserCard
              key={u.id}
              userItem={u}
              isSelf={u.id === user?.uid}
              onEdit={openEditModal}
              onResetPassword={openResetPasswordModal}
              onDelete={openDeleteModal}
              getRoleBadge={getRoleBadge}
              getStatusBadge={getStatusBadge}
            />
          ))}
        </ul>
      )}

      {/* CREATE USER MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New User"
        size="md"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {actionMessage && (
            <div className={`p-3 rounded-lg ${
              actionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {actionMessage.text}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Name</label>
            <input
              required
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              placeholder="Minimum 8 characters"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Role</label>
            <select
              required
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="adult_volunteer">Adult Volunteer (Scanner Access Only)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Adult Volunteers can only access the scanner. Admins have full dashboard access.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Create User'}
            </Button>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User"
        size="md"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4">
          {actionMessage && (
            <div className={`p-3 rounded-lg ${
              actionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {actionMessage.text}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Email</label>
            <input
              type="email"
              disabled
              className="w-full border border-gray-200 rounded-xl p-3 bg-gray-50 text-gray-500"
              value={selectedUser?.email || ''}
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed.</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Name</label>
            <input
              required
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Role</label>
            <select
              required
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.role}
              onChange={e => setFormData({ ...formData, role: e.target.value })}
              disabled={selectedUser?.id === user?.uid}
            >
              <option value="adult_volunteer">Adult Volunteer (Scanner Access Only)</option>
              <option value="admin">Admin (Full Access)</option>
            </select>
            {selectedUser?.id === user?.uid && (
              <p className="text-xs text-orange-600 mt-1">You cannot change your own role.</p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Status</label>
            <select
              className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.isActive ? 'active' : 'inactive'}
              onChange={e => setFormData({ ...formData, isActive: e.target.value === 'active' })}
              disabled={selectedUser?.id === user?.uid}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive (Cannot Login)</option>
            </select>
            {selectedUser?.id === user?.uid && (
              <p className="text-xs text-orange-600 mt-1">You cannot deactivate your own account.</p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </Button>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* DELETE USER MODAL */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          {actionMessage && (
            <div className={`p-3 rounded-lg ${
              actionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {actionMessage.text}
            </div>
          )}

          <p className="text-gray-600">
            Are you sure you want to delete <strong>{selectedUser?.name}</strong> ({selectedUser?.email})?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone. The user will be removed from authentication and will no longer be able to log in.
          </p>

          <div className="flex gap-3 pt-4">
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDeleteUser}
              disabled={actionLoading}
            >
              {actionLoading ? 'Deleting...' : 'Delete User'}
            </Button>
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => {
          setIsResetPasswordModalOpen(false);
          setTemporaryPassword(null);
        }}
        title="Reset Password"
        size="sm"
      >
        <div className="space-y-4">
          {actionMessage && (
            <div className={`p-3 rounded-lg ${
              actionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {actionMessage.text}
            </div>
          )}

          {!temporaryPassword ? (
            <>
              <p className="text-gray-600">
                Reset the password for <strong>{selectedUser?.name}</strong> ({selectedUser?.email})?
              </p>
              <p className="text-sm text-gray-500">
                A new temporary password will be generated. Make sure to share it securely with the user.
              </p>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="primary"
                  className="flex-1"
                  onClick={handleResetPassword}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  className="px-6 py-2 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600">
                New temporary password for <strong>{selectedUser?.email}</strong>:
              </p>
              <div className="bg-gray-100 p-4 rounded-xl font-mono text-lg text-center select-all">
                {temporaryPassword}
              </div>
              <p className="text-sm text-orange-600">
                Please copy this password now. It will not be shown again. Share it securely with the user.
              </p>

              <div className="flex justify-end pt-4">
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsResetPasswordModalOpen(false);
                    setTemporaryPassword(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
      </div>
    </div>
  );
}
