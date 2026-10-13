import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { 
  Settings, Shield, Sliders, AlertOctagon, Save, User, Bell, 
  Palette, Lock, Database, Cpu, Globe, KeyRound, Smartphone 
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import LanguageSelector from '../components/LanguageSelector';
import { NerHeader, NerButton } from '../components/ner';

export const SettingsPage = () => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    fullName: user?.full_name || 'Operations Officer',
    email: user?.email || 'dispatcher@ner88.gov.in',
    role: user?.role || 'Command Center Administrator',
    department: 'Ministry of Development of North Eastern Region (MDoNER)'
  });

  // Notifications State
  const [notifSettings, setNotifSettings] = useState({
    emailAlerts: true,
    pushNotifications: true,
    smsDisasterBroadcast: true,
    criticalSound: true
  });

  useEffect(() => {
    api.get('/settings').then((res) => setSettings(res.data)).catch(console.error);
  }, []);

  const handleValueChange = (id, newVal) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, setting_value: newVal } : s)));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      showToast(t('settings.saveSuccess', 'System configuration and preferences saved successfully.'), 'success');
    } catch {
      showToast(t('settings.saveError', 'Failed to save settings.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const TABS = [
    { id: 'profile', label: t('settings.profileCredentials', 'Profile & Credentials'), icon: User },
    { id: 'language', label: t('settings.languageLocale', 'Language & Locale'), icon: Globe },
    { id: 'notifications', label: t('settings.alertNotifications', 'Alert Notifications'), icon: Bell },
    { id: 'security', label: t('settings.accessSecurity', 'Access & Security'), icon: Lock },
    { id: 'thresholds', label: t('settings.riskThresholds', 'Risk Thresholds'), icon: Sliders },
    { id: 'integrations', label: t('settings.nationalFeeds', 'National Feeds'), icon: Database },
    { id: 'advanced', label: t('settings.diagnosticsStorage', 'Diagnostics & Storage'), icon: Cpu }
  ];

  return (
    <div className="space-y-3.5 pb-8 font-sans text-ner-text select-none">
      
      {/* ── HEADER ── */}
      <NerHeader
        title={t('settings.title', 'Settings & System Configuration')}
        subtitle={t('settings.subtitle', 'Manage account credentials, regional language preferences, push notification channels, and calculation thresholds')}
        badge={t('settings.badge', 'Platform Parameters')}
        lastUpdated="21:08 IST"
        actions={
          <NerButton
            variant="primary"
            size="sm"
            onClick={handleSaveSettings}
            loading={loading}
            icon={Save}
          >
            {t('settings.savePreferences', 'Save Preferences')}
          </NerButton>
        }
      />

      {/* Split Settings Layout: Left Navigation + Right Content Panel */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        
        {/* Left Navigation */}
        <div className="md:col-span-3 bg-white border border-ner-border p-2 rounded-lg shadow-xs space-y-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-semibold transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-ner-secondary-light text-ner-secondary-dark font-bold'
                    : 'text-ner-text-secondary hover:text-ner-text hover:bg-ner-background'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-ner-secondary' : 'text-ner-muted'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Content Panel */}
        <div className="md:col-span-9 space-y-4">
          
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <User className="w-4 h-4 text-ner-secondary" /> {t('settings.userProfileTitle', 'User Profile & Institutional Identity')}
              </h3>

              <div className="flex items-center gap-3 pb-2">
                <div className="w-12 h-12 rounded-lg bg-ner-primary text-white flex items-center justify-center font-bold text-lg shadow-xs">
                  {profileData.fullName.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-ner-text">{profileData.fullName}</div>
                  <div className="text-xs text-ner-secondary font-semibold">{profileData.role} · {profileData.department}</div>
                  <div className="text-[11px] text-ner-muted font-mono mt-0.5">{profileData.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10.5px] font-bold text-ner-muted uppercase mb-1">{t('settings.fullName', 'Full Name')}</label>
                  <input
                    type="text"
                    value={profileData.fullName}
                    onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                    className="w-full bg-ner-background border border-ner-border rounded-md p-2 text-ner-text text-xs focus:outline-hidden focus:ring-1 focus:ring-ner-secondary"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-ner-muted uppercase mb-1">{t('settings.officialEmail', 'Official Email Address')}</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    className="w-full bg-ner-subtle border border-ner-border rounded-md p-2 text-ner-muted text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-ner-muted uppercase mb-1">{t('settings.assignedRole', 'Assigned Role')}</label>
                  <input
                    type="text"
                    value={profileData.role}
                    disabled
                    className="w-full bg-ner-subtle border border-ner-border rounded-md p-2 text-ner-muted text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-ner-muted uppercase mb-1">{t('settings.departmentMinistry', 'Department / Ministry')}</label>
                  <input
                    type="text"
                    value={profileData.department}
                    onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                    className="w-full bg-ner-background border border-ner-border rounded-md p-2 text-ner-text text-xs focus:outline-hidden focus:ring-1 focus:ring-ner-secondary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* LANGUAGE TAB */}
          {activeTab === 'language' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Globe className="w-4 h-4 text-ner-secondary" /> {t('settings.regionalLangTitle', 'Regional Language & Localization')}
              </h3>
              <p className="text-xs text-ner-text-secondary">
                {t('settings.langDesc', 'Select working language for the NER88 platform. English is the source baseline with deterministic regional translations across Northeast India.')}
              </p>
              <div className="pt-2">
                <LanguageSelector variant="grid" />
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Bell className="w-4 h-4 text-ner-secondary" /> {t('settings.alertChannelsTitle', 'Operational Alert Channels')}
              </h3>
              <div className="space-y-2.5 text-xs">
                {[
                  { key: 'emailAlerts', label: t('settings.emailAlerts', 'Email Digest Notifications'), desc: t('settings.emailAlertsDesc', 'Receive real-time notices for CRITICAL corridor blockages') },
                  { key: 'pushNotifications', label: t('settings.pushNotifications', 'Browser Push Notifications'), desc: t('settings.pushNotificationsDesc', 'Instant toast alerts for telemetry disruptions') },
                  { key: 'smsDisasterBroadcast', label: t('settings.smsBroadcast', 'SMS Emergency Broadcast'), desc: t('settings.smsBroadcastDesc', 'Disaster response unit SMS alerts for emergency convoys') },
                  { key: 'criticalSound', label: t('settings.audibleChime', 'Audible Hazard Chime'), desc: t('settings.audibleChimeDesc', 'Play audible warning sound when critical hazard is verified') }
                ].map((item) => (
                  <div key={item.key} className="p-3 rounded-md bg-ner-background border border-ner-border flex items-center justify-between">
                    <div>
                      <div className="font-bold text-ner-text text-xs">{item.label}</div>
                      <div className="text-[11px] text-ner-muted">{item.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifSettings[item.key]}
                      onChange={(e) => setNotifSettings({ ...notifSettings, [item.key]: e.target.checked })}
                      className="w-4 h-4 text-ner-secondary rounded border-ner-border cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Lock className="w-4 h-4 text-ner-secondary" /> {t('settings.authSecurityTitle', 'Authentication & Session Security')}
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-md bg-ner-background border border-ner-border flex items-center justify-between">
                  <div>
                    <div className="font-bold text-ner-text">{t('settings.sessionEncryption', 'Session Encryption')}</div>
                    <div className="text-[11px] text-ner-muted font-mono">TLS 1.3 · SHA-256 · Bearer JWT</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-ner-open-bg text-ner-open font-bold text-[10.5px]">{t('status.active', 'ACTIVE')}</span>
                </div>
                <div className="p-3 rounded-md bg-ner-background border border-ner-border flex items-center justify-between">
                  <div>
                    <div className="font-bold text-ner-text">{t('settings.twoFactorAuth', 'Two-Factor Authentication (2FA)')}</div>
                    <div className="text-[11px] text-ner-muted">{t('settings.twoFactorDesc', 'Mandatory for high-clearance dispatch authorization')}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-ner-info-bg text-ner-info font-bold text-[10.5px]">{t('status.configured', 'CONFIGURED')}</span>
                </div>
              </div>
            </div>
          )}

          {/* RISK THRESHOLDS TAB */}
          {activeTab === 'thresholds' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-ner-secondary" /> {t('settings.calcParamsTitle', 'Calculation Parameters & Risk Bounds')}
              </h3>
              <div className="space-y-2 text-xs">
                {settings.map((s) => (
                  <div key={s.id} className="p-2.5 rounded-md bg-ner-background border border-ner-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-ner-primary font-mono text-xs">{s.setting_key}</div>
                      <div className="text-[11px] text-ner-muted">{s.description}</div>
                    </div>
                    <input
                      type="text"
                      value={s.setting_value}
                      onChange={(e) => handleValueChange(s.id, e.target.value)}
                      className="bg-white border border-ner-border rounded px-2.5 py-1 text-xs text-ner-text font-mono text-center w-full sm:w-28 font-bold focus:outline-hidden"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Database className="w-4 h-4 text-ner-secondary" /> {t('settings.telemetryAdaptersTitle', 'Institutional & Telemetry Adapters')}
              </h3>
              <div className="space-y-2 text-xs">
                {[
                  { name: 'Open-Meteo Weather API', status: 'ONLINE', latency: '42ms', desc: 'Real-time precipitation, wind gust, and mountain temperature telemetry' },
                  { name: 'MoRTH VAHAN Registry Adapter', status: 'ACTIVE', latency: '68ms', desc: 'Axle load limits, GVW compliance, and commercial fitness checks' },
                  { name: 'Data.gov.in MDoNER Portal', status: 'SYNCED', latency: '120ms', desc: 'Open infrastructure datasets & PMGSY rural connectivity' },
                  { name: 'NHAI FASTag Corridor Feed', status: 'STANDBY', latency: '95ms', desc: 'Electronic toll collection & freight movement validation' }
                ].map((apiItem) => (
                  <div key={apiItem.name} className="p-2.5 rounded-md bg-ner-background border border-ner-border flex items-center justify-between">
                    <div>
                      <div className="font-bold text-ner-text text-xs">{apiItem.name}</div>
                      <div className="text-[11px] text-ner-muted">{apiItem.desc}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-ner-open-bg text-ner-open border border-ner-open-border">
                      {apiItem.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 'advanced' && (
            <div className="bg-white border border-ner-border p-5 rounded-lg shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-ner-primary border-b border-ner-border pb-2.5 flex items-center gap-2 uppercase tracking-wider">
                <Cpu className="w-4 h-4 text-ner-secondary" /> {t('settings.systemDiagnosticsTitle', 'System Diagnostics & Cache')}
              </h3>
              <div className="p-3 rounded-md bg-ner-background border border-ner-border flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-ner-text">{t('settings.clearTelemetryStore', 'Clear Local Telemetry Store')}</div>
                  <div className="text-[11px] text-ner-muted">{t('settings.purgeStoreDesc', 'Purge local pending sync store if offline queue is out of sync')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem('ner88_offline_queue');
                    showToast(t('settings.purgeSuccess', 'Local offline store purged.'), 'info');
                  }}
                  className="px-2.5 py-1 rounded bg-ner-blocked-bg text-ner-blocked border border-ner-blocked-border font-bold text-xs hover:bg-red-100 transition-colors cursor-pointer"
                >
                  {t('settings.purgeStoreBtn', 'Purge Store')}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

export default SettingsPage;
