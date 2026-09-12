import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Truck, Lock, Mail, User, Shield } from 'lucide-react';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Dispatcher');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await api.post('/auth/register', {
        full_name: fullName,
        email,
        password,
        role
      });
      navigate('/login');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Registration failed. Navigating to login.');
      setTimeout(() => navigate('/login'), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-[#E2E8F0] rounded-lg p-8 space-y-6 shadow-md">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-lg bg-[#0F2747] text-white mx-auto flex items-center justify-center shadow-sm">
            <Truck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-[#0F2747]">Create Account</h1>
          <p className="text-xs text-[#64748B]">Join LINK X8 Logistics Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-[#172033] block mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#172033] focus:outline-none focus:border-[#155E9E]"
            />
          </div>

          <div>
            <label className="font-semibold text-[#172033] block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#172033] focus:outline-none focus:border-[#155E9E]"
            />
          </div>

          <div>
            <label className="font-semibold text-[#172033] block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#172033] focus:outline-none focus:border-[#155E9E]"
            />
          </div>

          <div>
            <label className="font-semibold text-[#172033] block mb-1">Requested Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#F5F7FA] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[#172033] focus:outline-none focus:border-[#155E9E]"
            >
              <option value="Dispatcher">Dispatcher</option>
              <option value="Field Officer">Field Officer</option>
              <option value="Viewer">Viewer</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded bg-[#155E9E] hover:bg-[#0F2747] text-white font-bold text-xs shadow-sm transition active:scale-95"
          >
            Register Account
          </button>
        </form>

        <div className="text-center text-xs text-[#64748B]">
          Already have an account? <Link to="/login" className="text-[#155E9E] font-bold hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
};

