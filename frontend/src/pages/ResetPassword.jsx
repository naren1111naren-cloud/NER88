import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import emblemSvg from '../assets/emblem.svg';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

export const ResetPassword = () => {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!password || password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword(password);
      if (res?.success) {
        setMessage(res.message || 'Password successfully updated.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(res?.error || 'Unable to update password. Session may have expired.');
      }
    } catch (err) {
      setError('Security verification error. Please request a new reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 relative font-sans text-[#17202A] bg-[#0B2744]"
      style={{
        backgroundImage: `linear-gradient(rgba(11, 39, 68, 0.90), rgba(18, 59, 102, 0.94)), url('/login-mountain-bg.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="w-full max-w-[440px] bg-white rounded-[10px] shadow-2xl p-6 sm:p-8 border border-[#D9E0E7] space-y-5 z-10 relative">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-2 border-b border-[#E7EBEF] pb-4">
          <img
            src={emblemSvg}
            alt="National Emblem of India"
            className="w-10 h-14 object-contain"
          />
          <div className="space-y-0.5">
            <div className="text-[11px] font-bold text-[#123B66] uppercase tracking-wider">
              Government of India &bull; MDoNER
            </div>
            <h1 className="text-lg font-bold text-[#0B2744]">Set New Password</h1>
            <p className="text-xs text-[#5B6570]">
              Establish a secure replacement passphrase for your operator account.
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3 bg-[#FFEBEE] border border-[#FFCDD2] rounded-[6px] text-xs text-[#C62828] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Notification */}
        {message && (
          <div className="p-3 bg-[#E8F5E9] border border-[#C8E6C9] rounded-[6px] text-xs text-[#16834B] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#123B66] uppercase tracking-wider mb-1">
              New Secure Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#5B6570] absolute left-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-9 py-2 text-xs font-medium text-[#17202A] focus:outline-none focus:border-[#185A8D]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-[#5B6570] hover:text-[#17202A]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#123B66] uppercase tracking-wider mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#5B6570] absolute left-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-3 py-2 text-xs font-medium text-[#17202A] focus:outline-none focus:border-[#185A8D]"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-[6px] bg-[#185A8D] hover:bg-[#123B66] text-white font-bold text-xs shadow-subtle transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{loading ? 'Securing Account...' : 'Update Password & Sign In'}</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-[#E7EBEF]">
          <Link to="/login" className="text-xs font-bold text-[#185A8D] hover:underline">
            Back to Command Center Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
