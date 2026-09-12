import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useToast } from '../context/ToastContext';
import { Users, Plus, Shield, Search, Filter, Trash2, X } from 'lucide-react';

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

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === 'ALL' ? true : u.role.toUpperCase() === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            User & Access Control Management
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Manage user accounts and role assignments (Admin, Dispatcher, Field Officer, Viewer).
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 hover:opacity-90 text-white font-bold text-xs shadow-xs transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New User
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
            <input 
              type="text"
              placeholder="Search user name, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-9 pr-3 py-2 text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600 cursor-pointer"
            >
              <option value="ALL">Role: All Roles</option>
              <option value="ADMIN">Role: Admin</option>
              <option value="DISPATCHER">Role: Dispatcher</option>
              <option value="FIELD OFFICER">Role: Field Officer</option>
              <option value="VIEWER">Role: Viewer</option>
            </select>
          </div>
        </div>

        <div className="text-[#6B7280] font-semibold text-xs shrink-0">
          Showing <span className="font-extrabold text-[#1F2937]">{filteredUsers.length}</span> user accounts
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-[#F7F7FB] border-b border-[#E5E7EB] text-[11px] font-extrabold text-[#6B7280] uppercase tracking-wider">
                <th className="p-3.5">Full Name</th>
                <th className="p-3.5">Email Address</th>
                <th className="p-3.5">Assigned Role</th>
                <th className="p-3.5">Account Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] text-xs text-[#1F2937]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-[#6B7280]">
                    No user accounts matching search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-[#F7F7FB] transition">
                    <td className="p-3.5 font-extrabold text-[#1F2937]">{u.full_name}</td>
                    <td className="p-3.5 font-mono text-purple-700 font-bold">{u.email}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="text-emerald-700 font-extrabold text-[11px]">ACTIVE</span>
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setDeleteUserId(u.id)}
                        title="Delete User"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 transition"
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
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-[#E5E7EB] pb-3 flex justify-between items-center">
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937]">Create New User Account</h3>
                <p className="text-xs text-[#6B7280]">Assign credentials and operational access rights.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  required
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Password</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[#1F2937] font-semibold block mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl px-3 py-2 text-[#1F2937] focus:outline-none focus:border-purple-600"
                >
                  <option value="Admin">Admin</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Field Officer">Field Officer</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 text-white font-bold text-xs shadow-xs"
                >
                  Save User Account
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
        message="Are you sure you want to revoke this user account? The user will lose access to the LINK X8 platform."
        confirmText="Revoke Account"
        type="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteUserId(null)}
      />
    </div>
  );
};


