import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Truck, ArrowRight, MapPin, LogOut } from 'lucide-react';

// ─── Welcome Page ─────────────────────────────────────────────────────────────
export const Welcome = () => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  // Protect this page — BOTH token AND user required
  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true });
    }
  }, [token, user, navigate]);

  // Fade-in content
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const displayName =
    user?.full_name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Operator';

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50">
      {/* ── Header ── */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] flex items-center justify-center shadow-sm">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-[#1F2937] text-sm tracking-tight leading-none">
              LINK X8
            </div>
            <div className="text-[#6B7280] text-[10px] font-medium leading-none mt-0.5">
              Regional Logistics Intelligence
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-50 text-purple-700 border border-purple-200">
            SIH26002 • MDoNER
          </span>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 transition-colors duration-150"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Main: Full map background below header ── */}
      <main 
        className="flex-1 flex items-center justify-center px-4 py-12 relative"
        style={{
          backgroundImage: 'url(/ne-india-map.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div
          className={`relative z-10 text-center transition-all duration-700 ease-out ${
            visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          {/* Content card — subtle semi-solid backdrop ONLY behind text */}
          <div className="bg-white/90 rounded-3xl px-8 py-10 sm:px-12 sm:py-12 shadow-2xl max-w-xl mx-auto border border-white">
            
            {/* Greeting badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-600 shadow-sm mb-6">
              <MapPin className="w-3.5 h-3.5 text-[#8B5CF6]" />
              Welcome back, {displayName}
            </div>

            {/* Main heading */}
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight mb-4">
              Welcome to{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6]">
                LINK X8
              </span>
            </h1>

            {/* Sub-heading */}
            <h2 className="text-xl sm:text-2xl font-bold text-gray-700 mb-5 leading-snug">
              Regional Logistics &amp;{' '}
              <span className="text-[#8B5CF6]">Accessibility</span> Intelligence
            </h2>

            {/* Description */}
            <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-8 max-w-sm mx-auto">
              Intelligent visibility across the North Eastern Region of India.
              Monitor routes, risks and logistics from a unified command center.
            </p>

            {/* GET STARTED CTA */}
            <button
              id="welcome-get-started"
              onClick={() => navigate('/dashboard')}
              className="inline-flex items-center gap-2.5 px-9 py-3.5 bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] text-white font-extrabold text-sm rounded-2xl shadow-lg hover:opacity-90 active:scale-[0.97] transition-all duration-150"
            >
              GET STARTED
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
