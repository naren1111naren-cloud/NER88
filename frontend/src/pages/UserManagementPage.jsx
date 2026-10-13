import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { Users, Plus, Shield, Search, Filter, Trash2, X, UserCheck } from 'lucide-react';

export const UserManagementPage = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    password: '',
    role: 'Dispatcher'
  });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      setShowModal(false);
      fetchUsers();
      showToast('New platform user account created!', 'success');
      setFormData({ email: '', full_name: '', password: '', role: 'Dispatcher' });
    } catch (err) {
      showToast('Failed to create user account.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    setActionLoading(true);
    try {
      if (deleteUserId) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteUserId));
        showToast('User account revoked.', 'info');
      }
    } catch (err) {
      showToast('Failed to delete user account.', 'error');
    } finally {
      setActionLoading(false);
      setDeleteUserId(null);
    }
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter((u) => {
    const s = (search || '').toLowerCase();
    const matchesSearch =
      (u.full_name || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.role || '').toLowerCase().includes(s);

    const matchesRole =
      roleFilter === 'ALL' ? true : (u.role || '').toUpperCase() === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-5 pb-8 text-[#17202A] font-sans">
      {/* Page Header */}
      <div className="bg-white border border-[#D9E0E7] p-4 sm:p-5 rounded-[8px] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#123B66] bg-[#123B66]/10 px-2 py-0.5 rounded border border-[#123B66]/20 uppercase tracking-wider">
              ACCESS CONTROL & RBAC
            </span>
            <span className="text-[10px] text-[#5B6570] font-mono">
              Role-Based Authorization Console
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#185A8D]" />
            User &amp; Access Control Management
          </h1>
          <p className="text-xs text-[#5B6570] mt-1">
            Manage operator accounts, administrative permissions, and security roles across the NER88 platform.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Operator Account
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#D9E0E7] p-3 rounded-[8px] shadow-subtle flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-[#5B6570] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search user name, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-3 py-1.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#5B6570]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#F6F8FA] border border-[#D9E0E7] text-[#17202A] text-xs font-semibold rounded-[6px] px-3 py-1.5 focus:outline-none focus:border-[#185A8D] cursor-pointer"
            >
              <option value="ALL">Role: All Roles</option>
              <option value="ADMIN">Role: Admin</option>
              <option value="DISPATCHER">Role: Dispatcher</option>
              <option value="FIELD OFFICER">Role: Field Officer</option>
              <option value="VIEWER">Role: Viewer</option>
            </select>
          </div>
        </div>

        <div className="text-[#5B6570] font-semibold text-xs shrink-0">
          Showing <span className="font-bold text-[#123B66]">{filteredUsers.length}</span> user accounts
        </div>
      </div>

      <div className="bg-white border border-[#D9E0E7] rounded-[8px] shadow-subtle overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-[#F6F8FA] border-b border-[#D9E0E7] text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">
                <th className="p-3">Full Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Assigned Role</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E7EBEF] text-xs text-[#17202A]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#5B6570]">
                    No user accounts matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F6F8FA] transition">
                    <td className="p-3 font-bold text-[#17202A] flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-[6px] bg-[#123B66]/10 text-[#123B66] border border-[#123B66]/20 flex items-center justify-center font-bold text-xs">
                        {u.full_name ? u.full_name.charAt(0) : 'U'}
                      </div>
                      <span>{u.full_name}</span>
                    </td>
                    <td className="p-3 font-mono text-[#5B6570] font-medium">{u.email}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F6F8FA] text-[#0B2744] border border-[#D9E0E7]">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-[#16834B] font-bold text-[11px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16834B]"></span> ● ACTIVE
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setDeleteUserId(u.id)}
                        title="Delete User"
                        className="p-1.5 rounded-[4px] bg-[#F6F8FA] hover:bg-red-50 text-[#5B6570] hover:text-[#C62828] border border-[#D9E0E7] transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#D9E0E7] rounded-[8px] p-6 space-y-4 shadow-xl text-[#17202A]">
            <div className="border-b border-[#D9E0E7] pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-[#0B2744]">Create Operator Account</h3>
                <p className="text-xs text-[#5B6570]">Assign credentials and operational access rights.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-[#5B6570] hover:text-[#17202A] cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-[#17202A] font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  placeholder="e.g. Officer R. Sharma"
                  className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3 py-2 text-[#17202A] focus:outline-none focus:border-[#185A8D]"
                />
              </div>
              <div>
                <label className="text-[#17202A] font-semibold block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="e.g. r.sharma@gov.in"
                  className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3 py-2 text-[#17202A] focus:outline-none focus:border-[#185A8D]"
                />
              </div>
              <div>
                <label className="text-[#17202A] font-semibold block mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3 py-2 text-[#17202A] focus:outline-none focus:border-[#185A8D]"
                />
              </div>
              <div>
                <label className="text-[#17202A] font-semibold block mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3 py-2 text-[#17202A] focus:outline-none focus:border-[#185A8D] cursor-pointer"
                >
                  <option value="Admin">Admin</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Field Officer">Field Officer</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#D9E0E7]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-[6px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#5B6570] text-xs font-semibold border border-[#D9E0E7] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle cursor-pointer"
                >
                  Save Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deleteUserId}
        title="Revoke User Account?"
        message="Are you sure you want to revoke this user account? The user will lose access to the NER88 platform."
        confirmText="Revoke Account"
        type="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteUserId(null)}
      />
    </div>
  );
};

export default UserManagementPage;
