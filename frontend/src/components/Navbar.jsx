import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useAlertStream } from '../context/AlertStreamContext';
import LanguageSelector from './LanguageSelector';
import GlobalSearchModal from './GlobalSearchModal';
import govEmblem from '../assets/gov-emblem.png';
import {
  Search, Bell, Sparkles, ChevronDown, Settings, LogOut, Shield,
  RefreshCw, CheckCircle2, AlertCircle, X, Type
} from 'lucide-react';

/* ── Primary navigation tabs (horizontal bar) ───────────── */
const PRIMARY_NAV = [
  {
    label: 'Home',
    to: '/command-center',
    aliases: ['/dashboard', '/'],
  },
  {
    label: 'Operations',
    dropdown: [
      { label: 'Command Center', to: '/command-center', desc: 'Regional dashboard' },
      { label: 'GIS Network',    to: '/network',        desc: 'Satellite corridor map' },
      { label: 'Fleet & Vehicles',to: '/vehicles',      desc: 'Live GPS tracking' },
      { label: 'Deliveries',     to: '/deliveries',     desc: 'Supply delivery status' },
      { label: 'Routes',         to: '/routes',         desc: 'Route intelligence' },
    ],
  },
  {
    label: 'Intelligence',
    dropdown: [
      { label: 'Incidents',     to: '/incidents',    desc: 'Active disruptions' },
      { label: 'Alerts',        to: '/alerts',       desc: 'Real-time alerts' },
      { label: 'Field Reports', to: '/field-report', desc: 'Ground-level data' },
      { label: 'Analytics',     to: '/analytics',    desc: 'Regional analytics' },
      { label: 'Weather',       to: '/weather',      desc: 'Meteorological risk' },
    ],
  },
  {
    label: 'Infrastructure',
    dropdown: [
      { label: 'Bridges',   to: '/bridges',   desc: 'Strategic bridges' },
      { label: 'Districts', to: '/districts', desc: 'Administrative data' },
    ],
  },
  {
    label: 'Administration',
    dropdown: [
      { label: 'Settings',             to: '/settings',                desc: 'Platform config' },
      { label: 'Gov Integrations',     to: '/government-integrations', desc: 'API & data sources' },
      { label: 'Audit Logs',           to: '/audit-logs',              desc: 'System audit trail' },
      { label: 'User Management',      to: '/user-management',         desc: 'Roles & access' },
    ],
  },
  {
    label: 'User Manual',
    to: '/how-to-use',
  },
];

export const Navbar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { connectionStatus, unreadCount, reconnectStream, refreshAlerts } = useAlertStream();

  const [openDropdown,    setOpenDropdown]    = useState(null);  // label of open dropdown
  const [showNotifMenu,   setShowNotifMenu]   = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [lastSyncTime,    setLastSyncTime]    = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [isPinging,       setIsPinging]       = useState(false);

  const notifRef   = useRef(null);
  const profileRef = useRef(null);
  const navRef     = useRef(null);

  // Close on route change
  useEffect(() => {
    setOpenDropdown(null);
    setShowNotifMenu(false);
    setShowProfileMenu(false);
  }, [location.pathname]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current     && !navRef.current.contains(e.target))     setOpenDropdown(null);
      if (notifRef.current   && !notifRef.current.contains(e.target))   setShowNotifMenu(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfileMenu(false);
    };
    const keyHandler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setShowSearchModal(true); }
      if (e.key === 'Escape') { setOpenDropdown(null); }
    };
    document.addEventListener('mousedown', handler);
    window.addEventListener('keydown', keyHandler);
    return () => { document.removeEventListener('mousedown', handler); window.removeEventListener('keydown', keyHandler); };
  }, []);

  const handlePingSync = async () => {
    setIsPinging(true);
    try {
      if (reconnectStream) reconnectStream();
      if (refreshAlerts) await refreshAlerts();
      setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      showToast('Telemetry stream refreshed & synchronized.', 'success');
    } catch { showToast('Unable to reach telemetry server.', 'error'); }
    finally { setIsPinging(false); }
  };

  const handleOpenAssistant = () => window.dispatchEvent(new CustomEvent('open_assistant_88'));

  const handleLogout = async () => {
    setShowProfileMenu(false);
    await logout();
    navigate('/welcome');
    showToast('Signed out of operational session.', 'info');
  };

  const isActive = (item) => {
    if (item.to && (location.pathname === item.to || (item.aliases || []).includes(location.pathname))) return true;
    if (item.dropdown) return item.dropdown.some(d => location.pathname === d.to);
    return false;
  };

  const isLive       = connectionStatus === 'CONNECTED';
  const isConnecting = connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING';

  return (
    <header className="w-full sticky top-0 z-40 select-none" style={{ fontFamily: "'Noto Sans', 'Open Sans', Arial, sans-serif" }}>

      {/* ══ ROW 1: Top Utility Strip ════════════════════════════════ */}
      <div style={{ background: '#f5f5f5', borderBottom: '1px solid #ddd', padding: '4px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: Gov identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#155724', fontWeight: 700, letterSpacing: 1 }}>GOVERNMENT OF INDIA</span>
        </div>
        {/* Right: Utility actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => setShowSearchModal(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#444', fontWeight: 500 }}>
            <Search size={13} /> Search
          </button>
          <span style={{ color: '#bbb' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Type size={13} style={{ color: '#555' }} />
            <span style={{ fontSize: 11.5, color: '#555', fontWeight: 500 }}>Text Size</span>
          </div>
          <span style={{ color: '#bbb' }}>|</span>
          {/* Live status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: isLive ? '#28a745' : isConnecting ? '#ffc107' : '#dc3545',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase' }}>
              {isLive ? 'LIVE' : isConnecting ? 'SYNC' : 'OFFLINE'}
            </span>
          </div>
          <span style={{ color: '#bbb' }}>|</span>
          <LanguageSelector variant="header" />
        </div>
      </div>

      {/* ══ ROW 2: Brand Header ══════════════════════════════════════ */}
      <div style={{ background: '#fff', borderBottom: '2px solid #155724', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: Emblem + NER88 Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => navigate('/command-center')}>
          <img src={govEmblem} alt="Emblem of India"
            style={{ height: 68, width: 68, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 13, color: '#155724', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              NORTH EAST REGION
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 26, color: '#155724', fontWeight: 900, letterSpacing: -0.5 }}>
                NER88
              </span>
              <span style={{ fontSize: 22, color: '#2d6a4f', fontWeight: 800, letterSpacing: -0.3 }}>
                LOGISTICS COMMAND
              </span>
            </div>
          </div>
        </div>

        {/* Right: Badges + functional controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* NER88 badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'linear-gradient(135deg, #155724 0%, #2d6a4f 100%)',
            color: '#ffffff',
            padding: '7px 18px',
            borderRadius: 20,
            boxShadow: '0 2px 8px rgba(21,87,36,0.25)',
            fontWeight: 800,
            fontSize: 15,
            letterSpacing: 0.5
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            NER88
          </div>

          {/* Digital India badge */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'conic-gradient(#FF6B00 0% 50%, #00A859 50% 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: 17, fontStyle: 'italic', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>i</div>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>Digital India</div>
          </div>

          <div style={{ width: 1, height: 44, background: '#e0e0e0', margin: '0 4px' }} />

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button onClick={() => { setShowNotifMenu(v => !v); setShowProfileMenu(false); }}
              style={{
                background: '#f0f7f2',
                border: '1px solid #d0e7d5',
                borderRadius: '50%',
                width: 42,
                height: 42,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
              className="hover:bg-emerald-100 hover:scale-105"
              title="Disruption Notifications"
            >
              <Bell size={19} style={{ color: '#155724' }} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#dc3545',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  boxShadow: '0 2px 4px rgba(220,53,69,0.4)'
                }}>
                  {unreadCount}
                </span>
              )}
            </button>
            {showNotifMenu && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 290, background: '#fff', border: '1px solid #c7dccb', borderRadius: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: 14, zIndex: 100 }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: '#155724', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Disruption Alerts</div>
                <div style={{ background: '#fff5f5', border: '1px solid #f5c6cb', borderRadius: 10, padding: '10px 12px', fontSize: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, color: '#721c24' }}>NH-10 Sevoke Landslide</div>
                  <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>12 vehicles affected · Sevoke sector restricted</div>
                </div>
                <div style={{ background: '#fffbf0', border: '1px solid #ffc107', borderRadius: 10, padding: '10px 12px', fontSize: 12 }}>
                  <div style={{ fontWeight: 700, color: '#856404' }}>Heavy Rainfall Warning</div>
                  <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Sikkim & Meghalaya — slope saturation risk</div>
                </div>
                <button onClick={() => { setShowNotifMenu(false); navigate('/incidents'); }}
                  style={{ width: '100%', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#155724', background: 'none', border: 'none', borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10, cursor: 'pointer' }}>
                  View all disruptions →
                </button>
              </div>
            )}
          </div>

          {/* Assistant 88 */}
          <button onClick={handleOpenAssistant}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg, #155724 0%, #1e7e34 100%)',
              border: 'none',
              borderRadius: 24,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 3px 10px rgba(21, 87, 36, 0.25)',
              transition: 'all 0.2s ease'
            }}
            className="hover:scale-105 hover:shadow-lg"
          >
            <Sparkles size={16} style={{ color: '#86efac' }} /> Assistant 88
          </button>

          {/* User Profile */}
          <div style={{ position: 'relative' }} ref={profileRef}>
            <button onClick={() => { setShowProfileMenu(v => !v); setShowNotifMenu(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#f0f7f2',
                border: '1px solid #d0e7d5',
                borderRadius: 24,
                padding: '4px 14px 4px 5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              className="hover:bg-emerald-100/70"
            >
              <div style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #155724 0%, #2d6a4f 100%)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 13,
                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
              }}>
                {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#13261d', lineHeight: 1.2 }}>
                  {user?.full_name || 'System Administrator'}
                </div>
                <div style={{ fontSize: 10.5, color: '#4f6b59', fontWeight: 500 }}>
                  {user?.role || 'Admin'}
                </div>
              </div>
              <ChevronDown size={14} style={{ color: '#4f6b59', marginLeft: 2 }} />
            </button>
            {showProfileMenu && (
              <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 230, background: '#fff', border: '1px solid #c7dccb', borderRadius: 16, boxShadow: '0 12px 32px rgba(0,0,0,0.14)', padding: 10, zIndex: 100 }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid #eee', marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a1a' }}>{user?.full_name || 'System Administrator'}</div>
                  <div style={{ fontSize: 11, color: '#888', fontFamily: 'monospace', marginTop: 2 }}>{user?.email || 'admin@ner88.gov.in'}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, background: '#e2f0e6', borderRadius: 12, padding: '3px 10px', fontSize: 10.5, fontWeight: 700, color: '#155724' }}>
                    <Shield size={11} /> {user?.role || 'Admin'}
                  </div>
                </div>
                <button onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: '#333', background: 'none', border: 'none', borderRadius: 8, cursor: 'pointer', textAlign: 'left' }}>
                  <Settings size={14} style={{ color: '#666' }} /> Platform Preferences
                </button>
                <button onClick={handleLogout}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: '#dc3545', background: 'none', border: 'none', borderTop: '1px solid #eee', borderRadius: 8, cursor: 'pointer', textAlign: 'left', marginTop: 4 }}>
                  <LogOut size={14} style={{ color: '#dc3545' }} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══ ROW 3: Dark Green Nav Bar ════════════════════════════════ */}
      <nav ref={navRef} style={{ background: '#155724', display: 'flex', alignItems: 'stretch', padding: '0 24px', position: 'relative' }}>
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item);
          const isOpen = openDropdown === item.label;

          return (
            <div key={item.label} style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (item.dropdown) { setOpenDropdown(isOpen ? null : item.label); }
                  else { navigate(item.to); setOpenDropdown(null); }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '12px 16px',
                  fontSize: 13.5, fontWeight: active || isOpen ? 700 : 500,
                  color: active || isOpen ? '#fff' : 'rgba(255,255,255,0.88)',
                  background: active || isOpen ? 'rgba(0,0,0,0.25)' : 'transparent',
                  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  borderBottom: active ? '3px solid #fff' : '3px solid transparent',
                  transition: 'background 0.15s',
                  height: '100%',
                }}
                onMouseEnter={e => { if (!active && !isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.15)'; }}
                onMouseLeave={e => { if (!active && !isOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                {item.label === 'Home' && <span style={{ marginRight: 2 }}>🏠</span>}
                {item.label}
                {item.dropdown && <ChevronDown size={13} style={{ opacity: 0.8, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
              </button>

              {/* Dropdown panel */}
              {item.dropdown && isOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0,
                  minWidth: 220, background: '#fff',
                  border: '1px solid #C7DCCB',
                  borderTop: '3px solid #155724',
                  borderRadius: '0 0 8px 8px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  zIndex: 100, padding: '6px 0'
                }}>
                  {item.dropdown.map((d) => {
                    const dActive = location.pathname === d.to;
                    return (
                      <button
                        key={d.to}
                        onClick={() => { navigate(d.to); setOpenDropdown(null); }}
                        style={{
                          width: '100%', display: 'flex', flexDirection: 'column',
                          alignItems: 'flex-start', padding: '9px 16px',
                          fontSize: 13, fontWeight: dActive ? 700 : 500,
                          color: dActive ? '#155724' : '#333',
                          background: dActive ? '#DDEFE3' : 'transparent',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          borderLeft: dActive ? '3px solid #155724' : '3px solid transparent',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!dActive) e.currentTarget.style.background = '#F0F7F2'; }}
                        onMouseLeave={e => { if (!dActive) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span>{d.label}</span>
                        <span style={{ fontSize: 10.5, color: '#888', fontWeight: 400, marginTop: 1 }}>{d.desc}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* More button — right aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
          <button
            onClick={() => setShowSearchModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', fontSize: 13, fontWeight: 600, color: '#fff', background: 'rgba(0,0,0,0.3)', border: 'none', cursor: 'pointer' }}>
            <Search size={14} /> Search <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', borderRadius: 3, padding: '1px 5px', fontFamily: 'monospace' }}>⌘K</kbd>
          </button>
        </div>
      </nav>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} />
    </header>
  );
};

export default Navbar;
