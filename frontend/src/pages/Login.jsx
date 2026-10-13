import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import govEmblem from '../assets/gov-emblem.png';
import { Loader2, AlertCircle } from 'lucide-react';

const s = {
  page: { fontFamily: "'Noto Sans', 'Open Sans', Arial, sans-serif", background: '#f0f4f8', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#1a1a1a' },
  breadcrumb: { background: '#fff', borderBottom: '1px solid #dde3ec', padding: '8px 32px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#555' },
  breadHome: { color: '#155724', cursor: 'pointer', fontWeight: 500 },
  content: { flex: 1, padding: '32px 32px 40px', maxWidth: 780, width: '100%', margin: '0 auto' },
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#155724', marginBottom: 20 },
  tabs: { display: 'flex', borderBottom: '1px solid #c8d3e0', marginBottom: 28 },
  tab: { padding: '9px 18px', fontSize: 13, fontWeight: 500, color: '#444', cursor: 'pointer', background: '#e8edf3', border: '1px solid #c8d3e0', borderBottom: 'none', marginRight: 3, borderRadius: '4px 4px 0 0', userSelect: 'none' },
  tabActive: { background: '#155724', color: '#fff', border: '1px solid #155724', borderBottom: 'none', fontWeight: 600 },
  form: { maxWidth: 600 },
  fieldGroup: { marginBottom: 18 },
  label: { display: 'block', fontSize: 13.5, fontWeight: 600, color: '#222', marginBottom: 5 },
  required: { color: '#c0392b', marginLeft: 2 },
  input: { display: 'block', width: '100%', padding: '7px 10px', fontSize: 13.5, border: '1px solid #aab4c4', borderRadius: 3, background: '#fff', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  hint: { display: 'block', fontSize: 12, color: '#666', marginTop: 4, lineHeight: 1.4 },
  btnBlue: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#155724', color: '#fff', border: 'none', borderRadius: 3, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 4 },
  error: { display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fdf2f2', border: '1px solid #e8b4b4', borderRadius: 3, padding: '10px 14px', fontSize: 13, color: '#a00', marginBottom: 18, maxWidth: 600 },
  quickPanel: { background: '#fff', border: '1px solid #c8d3e0', borderRadius: 4, padding: '20px 24px', maxWidth: 600 },
  quickTitle: { fontSize: 13, fontWeight: 700, color: '#155724', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  quickBtn: { background: '#f0f4f8', border: '1px solid #c8d3e0', borderRadius: 3, padding: '10px 14px', fontSize: 12.5, fontWeight: 600, color: '#1a1a1a', cursor: 'pointer', textAlign: 'left', lineHeight: 1.4 },
  footer: { background: '#1a1a2e', padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap' },
  footerLink: { color: '#aab4c4', fontSize: 12, cursor: 'pointer' },
  footerSep: { color: '#444', fontSize: 11 },
};

const TABS = ['Log In', 'Create Account', 'Forgot Password'];
const QUICK_USERS = [
  { label: 'System Administrator', role: 'Admin', email: 'admin@ner88.gov.in', pass: 'Admin@123' },
  { label: 'Duty Dispatcher', role: 'Dispatcher', email: 'dispatcher@ner88.gov.in', pass: 'Dispatch@123' },
  { label: 'Field Inspector', role: 'Field Officer', email: 'field@ner88.gov.in', pass: 'Field@123' },
  { label: 'Public Observer', role: 'Viewer', email: 'viewer@ner88.gov.in', pass: 'Viewer@123' },
];

export const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusEmail, setFocusEmail] = useState(false);
  const [focusPass, setFocusPass] = useState(false);

  const doLogin = async (emailVal, passVal) => {
    setError('');
    setLoading(true);
    try {
      const result = await login(emailVal.trim(), passVal);
      if (result?.success) { navigate('/command-center'); }
      else { setError(result?.error || 'Authentication failed. Please verify your credentials.'); }
    } catch { setError('Authentication service unreachable. Please check your connection.'); }
    finally { setLoading(false); }
  };

  const handleSubmit = (e) => { e.preventDefault(); if (!email.trim()) { setError('Please enter your username or email.'); return; } if (!password) { setError('Please enter your password.'); return; } doLogin(email, password); };

  return (
    <div style={s.page}>
      {/* Institutional Government Header */}
      <header style={{ background: '#fff', borderBottom: '2px solid #155724', padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => navigate('/welcome')}>
          <img src={govEmblem} alt="Emblem of India" style={{ height: 52, width: 52, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 11.5, color: '#666', letterSpacing: 0.3 }}>Government of India</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#155724', letterSpacing: -0.3 }}>
              NER88 — North East Region Logistics Command
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ background: 'none', border: '1px solid #155724', color: '#155724', borderRadius: 4, padding: '6px 16px', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }} onClick={() => navigate('/welcome')}>
            ← Return to Overview
          </button>
        </div>
      </header>

      <div style={s.breadcrumb}>
        <span>🏠</span>
        <span style={s.breadHome} onClick={() => navigate('/welcome')}>Home</span>
        <span style={{ color: '#999' }}>›</span>
        <span style={{ color: '#333', fontWeight: 500 }}>User Account</span>
      </div>

      <div style={s.content}>
        <h1 style={s.pageTitle}>User account</h1>

        <div style={s.tabs}>
          {TABS.map((tab, i) => (
            <div key={tab} style={{ ...s.tab, ...(activeTab === i ? s.tabActive : {}) }}
              onClick={() => { setActiveTab(i); setError(''); }}>{tab}</div>
          ))}
        </div>

        {activeTab === 0 && (
          <>
            {error && (
              <div style={s.error}>
                <AlertCircle size={15} style={{ marginTop: 1, flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.fieldGroup}>
                <label style={s.label}>Username / Official Email<span style={s.required}> *</span></label>
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusEmail(true)} onBlur={() => setFocusEmail(false)}
                  autoComplete="username"
                  style={{ ...s.input, borderColor: focusEmail ? '#1a5fa8' : '#aab4c4', boxShadow: focusEmail ? '0 0 0 2px rgba(26,95,168,0.15)' : 'none' }} />
                <span style={s.hint}>Enter your NER88 | North East Logistics Platform username or official government email.</span>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Password<span style={s.required}> *</span></label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusPass(true)} onBlur={() => setFocusPass(false)}
                  autoComplete="current-password"
                  style={{ ...s.input, borderColor: focusPass ? '#1a5fa8' : '#aab4c4', boxShadow: focusPass ? '0 0 0 2px rgba(26,95,168,0.15)' : 'none' }} />
                <span style={s.hint}>Enter the password that accompanies your username.</span>
              </div>
              <div style={{ marginBottom: 20, marginTop: -6 }}>
                <span onClick={() => setActiveTab(2)} style={{ color: '#1a5fa8', fontSize: 12.5, cursor: 'pointer', textDecoration: 'underline' }}>Forgot / Request new password?</span>
              </div>
              <button type="submit" disabled={loading} style={{ ...s.btnBlue, opacity: loading ? 0.7 : 1 }}>
                {loading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
                {loading ? 'Signing In...' : 'LOG IN'}
              </button>
            </form>
          </>
        )}

        {activeTab === 1 && (
          <div style={s.form}>
            <p style={{ fontSize: 14, color: '#444', marginBottom: 20, lineHeight: 1.65 }}>
              NER88 accounts are provisioned by system administrators for authorized government personnel. Contact your district logistics officer or MDoNER IT helpdesk to request access.
            </p>
            <div style={{ background: '#fff8e1', border: '1px solid #f0c040', borderRadius: 3, padding: '12px 16px', fontSize: 13, color: '#7a5800', marginBottom: 20 }}>
              <strong>Note:</strong> Self-registration is restricted to authorized officials only. All accounts are subject to role verification.
            </div>
            <button onClick={() => navigate('/register')} style={s.btnBlue}>REQUEST ACCOUNT ACCESS</button>
          </div>
        )}

        {activeTab === 2 && (
          <div style={s.form}>
            <p style={{ fontSize: 14, color: '#444', marginBottom: 20, lineHeight: 1.65 }}>
              Enter your registered official email address. A password reset link will be sent to your inbox.
            </p>
            <div style={s.fieldGroup}>
              <label style={s.label}>Registered Email Address<span style={s.required}> *</span></label>
              <input type="email" placeholder="e.g. officer@ner88.gov.in" style={s.input} />
              <span style={s.hint}>Enter the email address associated with your NER88 account.</span>
            </div>
            <button onClick={() => navigate('/forgot-password')} style={s.btnBlue}>REQUEST NEW PASSWORD</button>
          </div>
        )}

        <div style={{ marginTop: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, height: 1, background: '#c8d3e0' }} />
            <span style={{ fontSize: 11.5, color: '#888', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Quick Access — Official Evaluation</span>
            <div style={{ flex: 1, height: 1, background: '#c8d3e0' }} />
          </div>
          <div style={s.quickPanel}>
            <div style={s.quickTitle}>Pre-configured Role Accounts</div>
            <div style={s.quickGrid}>
              {QUICK_USERS.map((u) => (
                <button key={u.email} style={s.quickBtn} disabled={loading}
                  onClick={() => { setActiveTab(0); setEmail(u.email); setPassword(u.pass); doLogin(u.email, u.pass); }}>
                  {u.label}
                  <span style={{ display: 'block', fontSize: 11, color: '#1a5fa8', fontWeight: 500, marginTop: 2 }}>● {u.role}</span>
                  <span style={{ display: 'block', fontSize: 10.5, color: '#888', marginTop: 1, fontFamily: 'monospace' }}>{u.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer style={s.footer}>
        {['Website Policies', 'Help', 'Contact Us', 'FAQs', 'Terms & Conditions'].map((item, i, arr) => (
          <React.Fragment key={item}>
            <span style={s.footerLink}>{item}</span>
            {i < arr.length - 1 && <span style={s.footerSep}>|</span>}
          </React.Fragment>
        ))}
      </footer>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input:focus { outline: none; }`}</style>
    </div>
  );
};

export default Login;
