import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Truck, Mail, Phone, ArrowRight, Loader2, AlertCircle,
  CheckCircle2, Shield, MapPin, Activity
} from 'lucide-react';

// ─── Northeast India SVG Map Silhouette ─────────────────────────────────────
const NEIndiaMap = () => (
  <svg
    viewBox="0 0 520 420"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full"
    aria-hidden="true"
  >
    {/* Subtle geographic contour / route network lines */}
    <g opacity="0.12" stroke="#8B5CF6" strokeWidth="0.8" fill="none">
      {/* Outer boundary — NE India rough silhouette */}
      <path d="M 80 200 C 100 150, 140 120, 180 110 C 220 100, 250 90, 290 95 C 330 100, 360 115, 385 130 C 410 145, 420 165, 415 190 C 410 215, 395 235, 375 255 C 355 275, 330 290, 300 300 C 270 310, 240 315, 210 310 C 180 305, 155 290, 135 270 C 115 250, 90 235, 80 200 Z" />
      {/* Inner contour 1 */}
      <path d="M 100 200 C 118 158, 152 128, 188 118 C 224 108, 252 98, 288 103 C 324 108, 352 122, 374 136 C 396 150, 405 168, 400 192 C 395 216, 381 235, 362 253 C 343 271, 319 285, 291 294 C 263 303, 235 308, 207 303 C 179 298, 155 283, 137 265 C 119 247, 100 235, 100 200 Z" />
      {/* Inner contour 2 */}
      <path d="M 120 200 C 135 166, 164 138, 196 128 C 228 118, 254 108, 287 112 C 320 116, 346 129, 365 143 C 384 157, 391 173, 387 195 C 383 217, 370 234, 352 251 C 334 268, 311 281, 284 289 C 257 297, 231 301, 205 296 C 179 291, 157 277, 140 261 C 123 245, 108 228, 120 200 Z" />
    </g>

    {/* Route network lines */}
    <g opacity="0.18" stroke="#14B8A6" strokeWidth="1" fill="none">
      {/* NH-37 Assam corridor */}
      <path d="M 90 195 C 140 185, 200 178, 260 182 C 320 186, 370 195, 405 205" strokeDasharray="4 3" />
      {/* NH-40 Meghalaya */}
      <path d="M 140 230 C 175 215, 215 208, 255 212 C 295 216, 330 228, 360 240" strokeDasharray="4 3" />
      {/* NH-54 Silchar */}
      <path d="M 200 280 C 230 265, 260 255, 295 258 C 330 261, 355 272, 375 285" strokeDasharray="4 3" />
      {/* NH-2 Manipur */}
      <path d="M 280 140 C 290 165, 295 195, 292 225 C 289 255, 280 278, 270 298" strokeDasharray="4 3" />
      {/* NH-62 Arunachal */}
      <path d="M 330 120 C 345 145, 355 170, 358 200 C 361 230, 355 258, 345 280" strokeDasharray="4 3" />
      {/* Cross route */}
      <path d="M 150 165 C 200 170, 255 175, 305 178 C 345 181, 380 178, 410 175" strokeDasharray="3 4" />
    </g>

    {/* Location dots — major cities */}
    <g opacity="0.45">
      {/* Guwahati */}
      <circle cx="170" cy="185" r="4" fill="#8B5CF6" />
      <circle cx="170" cy="185" r="7" fill="none" stroke="#8B5CF6" strokeWidth="1" opacity="0.5" />
      {/* Shillong */}
      <circle cx="200" cy="230" r="3" fill="#14B8A6" />
      <circle cx="200" cy="230" r="6" fill="none" stroke="#14B8A6" strokeWidth="1" opacity="0.5" />
      {/* Imphal */}
      <circle cx="295" cy="258" r="3" fill="#8B5CF6" />
      {/* Agartala */}
      <circle cx="230" cy="280" r="3" fill="#14B8A6" />
      {/* Itanagar */}
      <circle cx="320" cy="145" r="3" fill="#8B5CF6" />
      {/* Dibrugarh */}
      <circle cx="370" cy="175" r="3" fill="#14B8A6" />
      {/* Aizawl */}
      <circle cx="275" cy="295" r="3" fill="#8B5CF6" />
      {/* Kohima */}
      <circle cx="340" cy="215" r="3" fill="#14B8A6" />
    </g>

    {/* State labels — very faint */}
    <g opacity="0.2" fill="#E2D9F3" fontFamily="Inter, sans-serif" fontSize="8" fontWeight="600">
      <text x="155" y="182">AS</text>
      <text x="195" y="228">ML</text>
      <text x="290" y="255">MN</text>
      <text x="225" y="280">TR</text>
      <text x="315" y="145">AR</text>
      <text x="365" y="178">AS</text>
      <text x="270" y="296">MZ</text>
      <text x="338" y="215">NL</text>
    </g>

    {/* Animated pulse on Guwahati */}
    <circle cx="170" cy="185" r="10" fill="none" stroke="#8B5CF6" strokeWidth="0.8" opacity="0.3">
      <animate attributeName="r" from="10" to="22" dur="2.5s" repeatCount="indefinite" />
      <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" repeatCount="indefinite" />
    </circle>
  </svg>
);

// ─── OTP Input ───────────────────────────────────────────────────────────────
const OTPInput = ({ value, onChange }) => {
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (e, idx) => {
    const key = e.key;
    if (key === 'Backspace') {
      const newVal = value.slice(0, -1);
      onChange(newVal);
      if (idx > 0) {
        document.getElementById(`otp-${idx - 1}`)?.focus();
      }
      return;
    }
    if (/^[0-9]$/.test(key)) {
      if (value.length < 6) {
        const newVal = value + key;
        onChange(newVal);
        if (idx < 5 && newVal.length <= 6) {
          document.getElementById(`otp-${idx + 1}`)?.focus();
        }
      }
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          readOnly
          onKeyDown={(e) => handleKey(e, i)}
          onFocus={() => document.getElementById(`otp-${i}`)?.select()}
          className="w-10 h-11 text-center text-base font-extrabold bg-[#F7F7FB] border-2 border-[#E5E7EB] rounded-xl text-[#1F2937] focus:outline-none focus:border-[#8B5CF6] transition-colors duration-150 cursor-text"
          style={{ caretColor: 'transparent' }}
        />
      ))}
    </div>
  );
};

// ─── Main Login Component ─────────────────────────────────────────────────────
export const Login = () => {
  const { login, loginWithMobile, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Tab: 'mobile' | 'email'
  const [tab, setTab] = useState('email');

  // Email fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Mobile fields
  const [mobile, setMobile] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Validation ──
  const validateEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validateMobile = (v) => /^[6-9]\d{9}$/.test(v.replace(/\s/g, ''));

  // ── Email Submit ──
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) { setError('Please enter a valid email address.'); return; }
    if (!password || password.length < 4) { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.success) {
        setSuccess(true);
        setTimeout(() => navigate('/welcome'), 600);
      } else {
        setError(result?.error || 'Authentication failed. Please check your credentials.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Mobile: Send OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    const cleaned = mobile.replace(/\s/g, '');
    if (!validateMobile(cleaned)) { setError('Enter a valid 10-digit mobile number.'); return; }
    setLoading(true);
    // Simulate OTP send (real integration would call backend)
    await new Promise(r => setTimeout(r, 1200));
    setOtpSent(true);
    setOtpStep(true);
    setLoading(false);
  };

  // ── Mobile: Verify OTP ──
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    try {
      const result = await loginWithMobile(mobile.replace(/\s/g, ''));
      if (result?.success) {
        setSuccess(true);
        setTimeout(() => navigate('/welcome'), 600);
      } else {
        setError('OTP verification failed. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Quick Demo Login ──
  const handleDemoLogin = async (demoEmail, demoPassword) => {
    setLoading(true);
    setError('');
    setTab('email');
    setEmail(demoEmail);
    setPassword(demoPassword);
    await new Promise(r => setTimeout(r, 400));
    const result = await login(demoEmail, demoPassword);
    if (result?.success) {
      setSuccess(true);
      setTimeout(() => navigate('/welcome'), 600);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-[#F7F7FB] font-sans">

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[55%] flex-col bg-[#171329] relative overflow-hidden">

        {/* Gradient overlay layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#171329] via-[#1E1540] to-[#1A1535] pointer-events-none" />

        {/* Subtle top accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] opacity-70" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">

          {/* Brand mark */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] flex items-center justify-center shadow-lg flex-shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-extrabold text-xl tracking-tight leading-none">LINK X8</div>
              <div className="text-purple-300/70 text-[11px] font-medium mt-0.5">Regional Logistics Intelligence</div>
            </div>
          </div>

          {/* Center: Map + headline */}
          <div className="flex-1 flex flex-col justify-center gap-8">
            {/* NE India map silhouette */}
            <div className="w-full max-w-sm mx-auto opacity-90">
              <NEIndiaMap />
            </div>

            <div className="space-y-3 max-w-sm mx-auto text-center">
              <h1 className="text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
                Regional Logistics &{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#8B5CF6] to-[#14B8A6]">
                  Accessibility
                </span>{' '}
                Command Center
              </h1>
              <p className="text-purple-200/60 text-sm leading-relaxed">
                AI-powered logistics, route, accessibility, weather and risk intelligence
                for the North Eastern Region of India.
              </p>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 max-w-sm mx-auto w-full">
              {[
                { icon: MapPin, label: '8 States', sub: 'Monitored' },
                { icon: Activity, label: 'Real-time', sub: 'Intelligence' },
                { icon: Shield, label: 'MDoNER', sub: 'Prototype' },
              ].map(({ icon: Icon, label, sub }) => (
                <div key={label} className="flex-1 bg-[#231C3D]/60 border border-[#2A2447] rounded-xl p-3 text-center">
                  <Icon className="w-4 h-4 text-[#8B5CF6] mx-auto mb-1" />
                  <div className="text-white font-bold text-xs leading-none">{label}</div>
                  <div className="text-purple-300/60 text-[10px] mt-0.5">{sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-8 border-t border-[#2A2447]">
            <div className="flex items-center gap-2 text-purple-300/40 text-[10px]">
              <span className="px-2 py-0.5 bg-[#231C3D] border border-[#2A2447] rounded-md font-bold text-purple-300/60">SIH26002</span>
              <span>•</span>
              <span>Ministry of Development of North Eastern Region</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — Auth Card ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-5 sm:p-8 relative">

        {/* Mobile top brand */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8 self-start">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] flex items-center justify-center shadow-md">
            <Truck className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-[#1F2937] text-base tracking-tight">LINK X8</div>
            <div className="text-[#6B7280] text-[10px] font-medium">Regional Logistics Intelligence</div>
          </div>
        </div>

        {/* Auth card */}
        <div className="w-full max-w-md">
          {/* Card header */}
          <div className="mb-7">
            <h2 className="text-2xl font-extrabold text-[#1F2937] tracking-tight leading-tight">
              Welcome to LINK X8
            </h2>
            <p className="text-[#6B7280] text-sm mt-1.5 leading-relaxed">
              Access the Regional Logistics &amp; Accessibility Command Center.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex bg-[#F0EFF8] rounded-xl p-1 mb-6 border border-[#E5E7EB]" role="tablist">
            {[
              { id: 'mobile', icon: Phone, label: 'Mobile' },
              { id: 'email', icon: Mail, label: 'Email' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={tab === id}
                onClick={() => { setTab(id); setError(''); setOtpStep(false); setOtp(''); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
                  tab === id
                    ? 'bg-white text-[#6D28D9] shadow-sm border border-[#E5E7EB]'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* ── EMAIL FORM ── */}
          {tab === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="text-xs font-bold text-[#1F2937] block mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError(''); }}
                    placeholder="admin@linkx8.in"
                    autoComplete="email"
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/10 transition-all duration-150"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="text-xs font-bold text-[#1F2937] block mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/10 transition-all duration-150"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Authentication successful. Redirecting…
                </div>
              )}

              <button
                id="login-continue-email"
                type="submit"
                disabled={loading || success}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] hover:opacity-90 active:scale-[0.98] text-white font-extrabold text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Authenticating…</>
                ) : (
                  <>Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ── MOBILE FORM ── */}
          {tab === 'mobile' && !otpStep && (
            <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-mobile" className="text-xs font-bold text-[#1F2937] block mb-1.5">
                  Mobile Number
                </label>
                <div className="relative flex">
                  <div className="flex items-center gap-1.5 px-3 bg-[#F0EFF8] border border-r-0 border-[#E5E7EB] rounded-l-xl text-xs font-bold text-[#1F2937]">
                    <span className="text-base">🇮🇳</span>
                    <span>+91</span>
                  </div>
                  <input
                    id="login-mobile"
                    type="tel"
                    value={mobile}
                    onChange={e => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(''); }}
                    placeholder="98XXXXXXXX"
                    autoComplete="tel"
                    className="flex-1 bg-[#F7F7FB] border border-[#E5E7EB] rounded-r-xl pl-3 pr-4 py-2.5 text-sm text-[#1F2937] placeholder-[#9CA3AF] focus:outline-none focus:border-[#8B5CF6] focus:ring-2 focus:ring-[#8B5CF6]/10 transition-all duration-150"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                id="login-send-otp"
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] hover:opacity-90 active:scale-[0.98] text-white font-extrabold text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</>
                ) : (
                  <>Send OTP <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ── OTP VERIFICATION STEP ── */}
          {tab === 'mobile' && otpStep && (
            <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
              <div className="bg-[#F0EFF8] border border-[#E5E7EB] rounded-xl px-4 py-3 text-xs text-[#1F2937]">
                <div className="font-bold mb-0.5">OTP sent to +91 {mobile}</div>
                <div className="text-[#6B7280]">
                  Enter the 6-digit code below.{' '}
                  <button type="button" onClick={() => { setOtpStep(false); setOtp(''); setError(''); }} className="text-[#8B5CF6] font-bold hover:underline">Change number</button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#1F2937] block mb-3 text-center">Enter OTP</label>
                <OTPInput value={otp} onChange={setOtp} />
                {/* Demo hint */}
                <p className="text-center text-[10px] text-[#9CA3AF] mt-2">
                  Demo mode: enter any 6 digits to continue
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  Verified. Redirecting…
                </div>
              )}

              <button
                id="login-verify-otp"
                type="submit"
                disabled={loading || success || otp.length !== 6}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#6D28D9] via-[#8B5CF6] to-[#14B8A6] hover:opacity-90 active:scale-[0.98] text-white font-extrabold text-sm shadow-md transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                ) : (
                  <>Verify &amp; Continue <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </form>
          )}

          {/* ── Divider ── */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-[#E5E7EB]" />
            <span className="text-[11px] text-[#6B7280] font-semibold">or continue with</span>
            <div className="flex-1 h-px bg-[#E5E7EB]" />
          </div>

          {/* ── Google Button ── */}
          <button
            id="login-google"
            type="button"
            disabled={loading}
            onClick={async () => {
              try {
                setLoading(true);
                setError('');
                await loginWithGoogle();
              } catch (err) {
                setError(err.message || 'Google authentication failed.');
                setLoading(false);
              }
            }}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white border border-[#E5E7EB] rounded-xl text-sm font-semibold text-[#1F2937] hover:bg-[#F7F7FB] hover:border-[#CBD5E1] active:scale-[0.98] transition-all duration-150 shadow-xs disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {/* Google G icon */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.64 9.20455C17.64 8.56637 17.5827 7.95274 17.4764 7.36365H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8196H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
              <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8196L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
              <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59319 3.68182 9C3.68182 8.40682 3.78409 7.83001 3.96409 7.29001V4.95819H0.957275C0.347727 6.17319 0 7.54774 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
              <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95819L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          {/* ── Quick Demo Role Selector ── */}
          <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
            <p className="text-[10px] font-extrabold text-[#6B7280] uppercase tracking-widest text-center mb-3">
              Quick Demo Access
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {[
                { label: 'Admin', email: 'admin@linkx8.in', pw: 'Admin@123' },
                { label: 'Dispatcher', email: 'dispatcher@linkx8.in', pw: 'Dispatch@123' },
                { label: 'Field Officer', email: 'field@linkx8.in', pw: 'Field@123' },
              ].map(({ label, email: dEmail, pw }) => (
                <button
                  key={label}
                  id={`demo-${label.toLowerCase().replace(' ', '-')}`}
                  type="button"
                  onClick={() => handleDemoLogin(dEmail, pw)}
                  className="px-3 py-1.5 bg-[#F0EFF8] hover:bg-purple-100 rounded-xl text-[11px] font-extrabold text-[#6D28D9] border border-purple-200/80 transition-all duration-150 active:scale-95"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
