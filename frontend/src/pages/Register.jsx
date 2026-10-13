import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import emblemSvg from '../assets/emblem.svg';
import { AlertCircle, CheckCircle2, Shield, UserPlus } from 'lucide-react';
import { supabase } from '../utils/supabase';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Dispatcher');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Please enter a valid official email address.');
      setLoading(false);
      return;
    }
    if (!password || password.length < 4) {
      setErrorMsg('Password must be at least 4 characters.');
      setLoading(false);
      return;
    }

    try {
      // 1. Supabase Cloud GoTrue Registration
      try {
        await supabase.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: fullName || cleanEmail.split('@')[0],
              role: role,
            },
          },
        });
      } catch (supaErr) {
        console.warn('[Supabase SignUp]', supaErr?.message || supaErr);
      }

      // 2. FastAPI Backend Registration
      const res = await api.post('/auth/register', {
        email: cleanEmail,
        password: password,
        full_name: fullName || cleanEmail.split('@')[0],
        role: role,
      });

      if (res.data) {
        setSuccessMsg('Account created successfully. Redirecting to sign in...');
        setTimeout(() => navigate('/login'), 1200);
      }
    } catch (err) {
      console.error('[Register Error]', err);
      const detail = err.response?.data?.detail || err.message || 'Registration failed.';
      setErrorMsg(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#17202A] flex items-center justify-center p-6 relative">
      <div className="w-full max-w-md bg-white border border-[#D9E0E7] rounded-[8px] p-8 space-y-6 shadow-subtle relative z-10">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-[8px] bg-[#F6F8FA] border border-[#D9E0E7] mx-auto flex items-center justify-center shadow-subtle p-2">
            <img src={emblemSvg} alt="State Emblem of India" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#5B6570]">
              Government of India &bull; MDoNER
            </div>
            <h1 className="text-xl font-bold text-[#0B2744]">Register Operator Account</h1>
            <p className="text-xs text-[#5B6570] mt-0.5">
              NER88 — Regional Logistics Intelligence & Decision Platform
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center gap-2 text-[#C62828] bg-[#C62828]/10 border border-[#C62828]/20 rounded-[6px] px-3.5 py-2 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#C62828]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 text-[#16834B] bg-[#16834B]/10 border border-[#16834B]/20 rounded-[6px] px-3.5 py-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#16834B]" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-[#5B6570] block mb-1 uppercase tracking-wider text-[11px]">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="e.g. Officer Tenzin Norbu"
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3.5 py-2.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="font-bold text-[#5B6570] block mb-1 uppercase tracking-wider text-[11px]">Official Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="e.g. tenzin@ner88.gov.in"
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3.5 py-2.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="font-bold text-[#5B6570] block mb-1 uppercase tracking-wider text-[11px]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3.5 py-2.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] focus:bg-white transition"
            />
          </div>

          <div>
            <label className="font-bold text-[#5B6570] block mb-1 uppercase tracking-wider text-[11px]">Assigned Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] px-3.5 py-2.5 text-xs text-[#17202A] focus:outline-none focus:border-[#185A8D] focus:bg-white transition cursor-pointer"
            >
              <option value="Admin">Admin (Command Center Administrator)</option>
              <option value="Dispatcher">Dispatcher (Route Optimization & Freight)</option>
              <option value="Field Officer">Field Officer (Incident Reporting)</option>
              <option value="Viewer">Viewer (Read-Only Observation)</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Creating Account…' : 'Register Operator Account'}
          </button>
        </form>

        <div className="text-center text-xs text-[#5B6570]">
          Already registered?{' '}
          <Link to="/login" className="text-[#185A8D] font-bold hover:underline">
            Sign In to Command Center
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
