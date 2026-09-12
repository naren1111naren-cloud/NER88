import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { useDemo } from '../context/DemoContext';
import { useToast } from '../context/ToastContext';
import api, { checkBackendHealth } from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { translations, localizeAlert } from '../utils/i18n';
import { 
  Truck, Play, RefreshCw, Wifi, WifiOff, Bell, User, 
  LogOut, ShieldAlert, ChevronDown, CheckCircle2, AlertTriangle, Globe, Siren, Server
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout, switchRole } = useAuth();
  const { isOnline, pendingQueue, syncPendingReports } = useOfflineSync();
  const { isDemoMode, toggleDemoMode, startDemoScenario, resetDemoScenario } = useDemo();
  const { showToast } = useToast();

  const [lang, setLang] = useState(localStorage.getItem('link_x8_lang') || localStorage.getItem('ner_logiai_lang') || 'en');
  const t = translations[lang] || translations.en;

  const [emergencyMode, setEmergencyMode] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [backendStatus, setBackendStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected'

  const checkHealth = async () => {
    try {
      const res = await checkBackendHealth();
      if (res.connected) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  };

  const fetchNavbarAlerts = async () => {
    try {
      const res = await api.get('/alerts');
      setAlerts(safeArray(res.data));
      setBackendStatus('connected');
    } catch (err) {
      console.warn('Navbar alerts fetch error:', err.message);
      setBackendStatus('disconnected');
    }
  };

  useEffect(() => {
    fetchNavbarAlerts();
    const handleDemoEvent = () => fetchNavbarAlerts();
    const handleLangEvent = (e) => {
      if (e.detail) setLang(e.detail);
    };

    window.addEventListener('sih_demo_triggered', handleDemoEvent);
    window.addEventListener('sih_demo_reset', handleDemoEvent);
    window.addEventListener('ner_lang_changed', handleLangEvent);
    return () => {
      window.removeEventListener('sih_demo_triggered', handleDemoEvent);
      window.removeEventListener('sih_demo_reset', handleDemoEvent);
      window.removeEventListener('ner_lang_changed', handleLangEvent);
    };
  }, []);

  const handleToggleEmergency = async () => {
    try {
      const res = await api.post('/dashboard/emergency-mode/toggle');
      const active = res.data.emergency_operations_mode;
      setEmergencyMode(active);
      showToast(active ? '🚨 EMERGENCY OPERATIONS MODE ACTIVATED!' : 'Emergency Operations Mode Deactivated.', active ? 'error' : 'info');
      window.dispatchEvent(new Event('sih_demo_triggered'));
    } catch (err) {
      showToast('Failed to toggle Emergency Mode', 'error');
    }
  };

  const handleLangChange = (e) => {
    const selected = e.target.value;
    setLang(selected);
    localStorage.setItem('link_x8_lang', selected);
    window.dispatchEvent(new CustomEvent('ner_lang_changed', { detail: selected }));
    showToast(`Language set to ${selected.toUpperCase()}`, 'info');
  };

  const handleRoleChange = (e) => {
    const newRole = e.target.value;
    switchRole(newRole);
    showToast(`Active role switched to ${newRole}`, 'info');
  };

  const unreadAlertsCount = alerts.filter(a => !a.is_read).length;

  return (
    <header className={`border-b px-4 py-2.5 flex items-center justify-between sticky top-0 z-40 shadow-xs transition-colors duration-300 ${emergencyMode ? 'bg-rose-950 border-rose-800 text-white' : 'bg-white border-[#D9DEE7] text-[#172033]'}`}>
      {/* Brand Header */}
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-xs shrink-0 ${emergencyMode ? 'bg-rose-600 text-white' : 'bg-gradient-to-r from-purple-600 via-violet-600 to-teal-500 text-white'}`}>
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-base tracking-tight ${emergencyMode ? 'text-white' : 'text-[#172033]'}`}>
              LINK X8
            </span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded border ${emergencyMode ? 'bg-rose-900 text-rose-200 border-rose-700' : 'bg-purple-50 text-[#6D28D9] border-purple-200'}`}>
              Logistics Intelligence Platform
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded bg-emerald-50 text-[#047857] border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> SYSTEM ONLINE
            </span>
            {emergencyMode && (
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-rose-600 text-white border border-rose-400 animate-pulse flex items-center gap-1">
                <Siren className="w-3.5 h-3.5" /> EMERGENCY MODE
              </span>
            )}
          </div>
          <p className={`text-xs font-medium leading-none mt-0.5 ${emergencyMode ? 'text-rose-200' : 'text-[#475467]'}`}>
            Predict. Reroute. Deliver. · Northeast India Multi-Modal Corridor Telemetry
          </p>
        </div>
      </div>

      {/* Controls: Emergency Mode -> Demo Mode -> Run Scenario -> Reset -> Lang -> Backend -> Online -> Notifs -> Role -> Profile */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. Emergency Mode Button (Visually Prominent) */}
        <button
          onClick={handleToggleEmergency}
          className={`h-8 flex items-center gap-1.5 px-3 rounded-md font-bold text-xs transition active:scale-95 shadow-xs border shrink-0 ${
            emergencyMode 
              ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-400 animate-pulse'
              : 'bg-rose-50 hover:bg-rose-100 text-[#BE123C] border-rose-200'
          }`}
        >
          <Siren className="w-3.5 h-3.5" />
          <span>{emergencyMode ? 'EXIT EMERGENCY' : 'EMERGENCY MODE'}</span>
        </button>

        {/* 2. Demo Mode + ON/OFF Switcher (Secondary) */}
        <div className={`h-8 flex items-center gap-1.5 px-2.5 rounded-md border text-xs shrink-0 ${emergencyMode ? 'bg-rose-900/60 border-rose-800' : 'bg-[#F8FAFC] border-[#D9DEE7]'}`}>
          <span className="font-semibold text-[#475467] text-xs">Demo Mode</span>
          <button
            onClick={() => {
              toggleDemoMode();
              showToast(isDemoMode ? 'Switched to LIVE Data Stream' : 'Switched to Synthetic DEMO Scenario Mode', isDemoMode ? 'info' : 'warning');
            }}
            className={`px-2 py-0.5 rounded text-xs font-bold transition-all border ${
              isDemoMode
                ? 'bg-[#6D28D9] text-white border-purple-700'
                : 'bg-slate-200 text-[#475467] border-slate-300'
            }`}
          >
            {isDemoMode ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 3. Run Scenario & 4. Reset Demo Buttons */}
        <div className="hidden xl:flex items-center gap-1">
          <button
            onClick={startDemoScenario}
            className="h-8 flex items-center gap-1.5 px-2.5 rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs transition shadow-xs"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run Scenario</span>
          </button>

          <button
            onClick={resetDemoScenario}
            title="Reset Scenario State"
            className="h-8 p-2 rounded-md bg-white hover:bg-slate-100 text-[#172033] border border-[#D9DEE7] transition flex items-center justify-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 5. Multilingual Selector */}
        <div className="flex items-center gap-1 text-xs">
          <Globe className="w-3.5 h-3.5 text-[#6D28D9] hidden sm:inline shrink-0" />
          <select
            value={lang}
            onChange={handleLangChange}
            className={`h-8 text-xs font-semibold rounded-md px-2 border cursor-pointer focus:outline-none ${emergencyMode ? 'bg-rose-900 border-rose-700 text-white' : 'bg-[#F8FAFC] border-[#D9DEE7] text-[#172033]'}`}
          >
            <option value="en">English (EN)</option>
            <option value="hi">हिंदी (HI)</option>
            <option value="as">অসমীয়া (AS)</option>
            <option value="mni">মৈতৈলোন্ (MNI)</option>
            <option value="bn">বাংলা (BN)</option>
          </select>
        </div>

        {/* 6. Backend Connection Status */}
        <div className="hidden md:flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs shrink-0">
          {backendStatus === 'connected' ? (
            <span className="flex items-center gap-1.5 text-[#047857] font-semibold text-xs" title="FastAPI Backend is running on port 8000">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Backend: Connected</span>
            </span>
          ) : backendStatus === 'connecting' ? (
            <span className="flex items-center gap-1.5 text-[#B45309] font-semibold text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>Backend: Connecting...</span>
            </span>
          ) : (
            <button
              onClick={checkHealth}
              className="flex items-center gap-1.5 text-[#BE123C] hover:text-[#9F1239] font-semibold text-xs"
              title="Click to retry connecting to FastAPI backend"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Backend: Disconnected</span>
            </button>
          )}
        </div>

        {/* 7. Offline Sync / Online Status */}
        <div className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs shrink-0">
          {isOnline ? (
            <span className="flex items-center gap-1 text-[#047857] font-semibold text-xs">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" /> ONLINE
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#B45309] font-semibold text-xs animate-pulse">
              <WifiOff className="w-3.5 h-3.5 text-amber-500" /> OFFLINE
            </span>
          )}

          {pendingQueue.length > 0 && (
            <button
              onClick={syncPendingReports}
              className="ml-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 hover:bg-amber-200 text-xs font-bold border border-amber-300 flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              Sync ({pendingQueue.length})
            </button>
          )}
        </div>

        {/* 8. Notifications Modal Dropdown */}
        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifMenu((prev) => !prev);
              setShowProfileMenu(false);
            }}
            className={`h-8 w-8 flex items-center justify-center rounded-md transition border relative ${emergencyMode ? 'border-rose-700 text-white hover:bg-rose-900' : 'border-[#D9DEE7] text-[#475467] hover:text-[#172033] hover:bg-[#F8FAFC]'}`}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          {showNotifMenu && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#D9DEE7] rounded-md shadow-lg z-50 p-4 space-y-3 text-[#172033]">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                <span className="font-bold text-xs text-[#172033]">{t.recent_alerts}</span>
                <span className="text-xs text-[#6D28D9] font-bold">{alerts.length} total</span>
              </div>

              <div className="space-y-2 text-xs max-h-64 overflow-y-auto">
                {alerts.length > 0 ? (
                  alerts.slice(0, 4).map((a) => {
                    const localized = localizeAlert(a, lang);
                    return (
                      <div key={a.id} className={`p-2.5 rounded-md border space-y-1 ${a.severity === 'CRITICAL' ? 'bg-rose-50 border-rose-200 text-rose-950' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
                        <div className="font-bold text-xs">{localized.title}</div>
                        <p className="text-xs text-[#475467] leading-tight">{localized.message}</p>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center text-[#667085] py-4 text-xs">No active operational alerts.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 9. Role Switcher Select */}
        <select
          value={user?.role || 'Viewer'}
          onChange={handleRoleChange}
          className={`h-8 text-xs font-semibold rounded-md px-2 border cursor-pointer focus:outline-none ${emergencyMode ? 'bg-rose-900 border-rose-700 text-white' : 'bg-[#F8FAFC] border-[#D9DEE7] text-[#172033]'}`}
        >
          <option value="Admin">Role: Admin</option>
          <option value="Dispatcher">Role: Dispatcher</option>
          <option value="Field Officer">Role: Field Officer</option>
          <option value="Viewer">Role: Viewer</option>
        </select>

        {/* 10. User Profile Avatar & Logout */}
        <div className="relative border-l border-[#D9DEE7] pl-2">
          <button
            onClick={() => {
              setShowProfileMenu((prev) => !prev);
              setShowNotifMenu(false);
            }}
            className="h-8 flex items-center gap-1.5 p-1 rounded-md hover:bg-slate-100 transition"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-purple-600 via-violet-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              {user?.full_name?.[0] || 'A'}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#475467]" />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-52 bg-white border border-[#D9DEE7] rounded-md shadow-lg z-50 p-2 text-xs space-y-1 text-[#172033]">
              <div className="px-3 py-2 border-b border-[#E2E8F0]">
                <div className="font-bold text-[#172033]">{user?.full_name}</div>
                <div className="text-xs text-[#667085] truncate">{user?.email}</div>
              </div>
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  logout();
                }}
                className="w-full text-left px-3 py-2 rounded-md text-[#BE123C] hover:bg-rose-50 font-bold flex items-center gap-2 transition"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
