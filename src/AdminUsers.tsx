import React, { useState, useEffect, useCallback } from 'react';
import { AdminUserRecord } from './types';
import { Users, Edit2, Lock, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AdminUsersProps {
  token: string;
}

export default function AdminUsers({ token }: AdminUsersProps) {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editSalary, setEditSalary] = useState('');
  
  const [resettingUserId, setResettingUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEditInit = (user: AdminUserRecord) => {
    setEditingUserId(user.id);
    setEditUsername(user.username);
    setEditFullName(user.fullName || '');
    setEditRole(user.role);
    setEditSalary(user.salary ? user.salary.toString() : '');
    setResettingUserId(null); // Close password reset if open
    setError('');
    setSuccess('');
  };

  const handleEditCancel = () => {
    setEditingUserId(null);
  };

  const handleSaveEdit = async () => {
    try {
      const res = await fetch(`/api/admin/users/${editingUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          username: editUsername, 
          role: editRole, 
          fullName: editFullName,
          salary: editSalary ? parseFloat(editSalary) : null 
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('Failed to update user', { defaultValue: 'Failed to update user' }));
      }
      
      setSuccess(t('User updated successfully', { defaultValue: 'User updated successfully' }));
      setEditingUserId(null);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResetInit = (user: AdminUserRecord) => {
    setResettingUserId(user.id);
    setNewPassword('');
    setEditingUserId(null); // Close edit mode if open
    setError('');
    setSuccess('');
  };

  const handleResetCancel = () => {
    setResettingUserId(null);
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.', { defaultValue: 'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.' }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${resettingUserId}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ password: newPassword })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('Failed to reset password', { defaultValue: 'Failed to reset password' }));
      }
      
      setSuccess(t('Password reset successfully', { defaultValue: 'Password reset successfully' }));
      setResettingUserId(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
        <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
          <Users className="w-5 h-5 ltr:mr-2 rtl:ml-2 text-gray-500" /> {t('User Management')}
        </h3>
        <div className="text-sm text-gray-500 flex items-center">
          {t('Showing')} <strong>{users.length}</strong> {t('users')}
        </div>
      </div>

      {error && (
        <div className="m-4 p-4 rounded-md flex items-center bg-red-50 text-red-800 border border-red-200">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="m-4 p-4 rounded-md flex items-center bg-green-50 text-green-800 border border-green-200">
          <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p className="font-medium text-sm">{success}</p>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Username')}</th>
              <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Full Name')}</th>
              <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Contact Info', { defaultValue: 'Contact Info' })}</th>
              <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Salary')}</th>
              <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Role')}</th>
              <th scope="col" className="px-6 py-3 ltr:text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Actions', { defaultValue: 'Actions' })}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <React.Fragment key={user.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.username}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.fullName || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.email && <div className="text-gray-900">{user.email}</div>}
                    {user.phone && <div className="text-gray-500 text-xs">{user.phone}</div>}
                    {!user.email && !user.phone && '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.salary ? `${user.salary.toFixed(2)} EGP` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap ltr:text-right rtl:text-left text-sm font-medium">
                    <button 
                      onClick={() => handleEditInit(user)}
                      className="text-blue-600 hover:text-blue-900 ltr:mr-4 rtl:ml-4 inline-flex items-center"
                    >
                      <Edit2 className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('Edit')}
                    </button>
                    <button 
                      onClick={() => handleResetInit(user)}
                      className="text-amber-600 hover:text-amber-900 inline-flex items-center"
                    >
                      <Lock className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('Reset Password', { defaultValue: 'Reset Password' })}
                    </button>
                  </td>
                </tr>
                {/* Edit Form Row */}
                {editingUserId === user.id && (
                  <tr className="bg-blue-50/50">
                    <td colSpan={6} className="px-6 py-4 border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('Username')}</label>
                          <input 
                            type="text" 
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 bg-white"
                            value={editUsername}
                            onChange={e => setEditUsername(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('Full Name')}</label>
                          <input 
                            type="text" 
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 bg-white"
                            value={editFullName}
                            onChange={e => setEditFullName(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('Salary')}</label>
                          <input 
                            type="number" 
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 bg-white"
                            value={editSalary}
                            onChange={e => setEditSalary(e.target.value)}
                            placeholder={t('Monthly Salary', { defaultValue: 'Monthly Salary' })}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('Role')}</label>
                          <select 
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 bg-white"
                            value={editRole}
                            onChange={e => setEditRole(e.target.value)}
                          >
                            <option value="employee">{t('Employee')}</option>
                            <option value="admin">{t('Admin')}</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleSaveEdit} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700">
                            <Save className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('Save', { defaultValue: 'Save' })}
                          </button>
                          <button onClick={handleEditCancel} className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                            <X className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('Cancel', { defaultValue: 'Cancel' })}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {/* Reset Password Row */}
                {resettingUserId === user.id && (
                  <tr className="bg-amber-50/50">
                    <td colSpan={6} className="px-6 py-4 border-b border-gray-200">
                      <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('New Password')}</label>
                          <input 
                            type="password" 
                            className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-amber-500 focus:border-amber-500 sm:text-sm border p-2 bg-white"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder={t('Enter new password')}
                          />
                          <p className="mt-1 text-xs text-amber-700/50">{t('Minimum 8 chars, mixed case & numbers')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={handleSavePassword} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700">
                            <Save className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('Set Password', { defaultValue: 'Set Password' })}
                          </button>
                          <button onClick={handleResetCancel} className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50">
                            <X className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('Cancel', { defaultValue: 'Cancel' })}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {users.length === 0 && !loading && (
          <div className="text-center py-10 text-gray-500">
            {t('No users found.')}
          </div>
        )}
        {loading && (
          <div className="text-center py-10 text-gray-500">
            {t('Loading users...')}
          </div>
        )}
      </div>
    </div>
  );
}
