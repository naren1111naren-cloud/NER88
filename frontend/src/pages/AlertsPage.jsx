import React, { useState, useEffect } from 'react';
import { useAlertStream } from '../context/AlertStreamContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { 
  Bell, CheckCircle2, ShieldAlert, AlertTriangle, Filter, 
  CheckCheck, Globe, Radio, ShieldCheck, Clock, MapPin, Zap, UserCheck 
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { translations, supportedLanguages, localizeAlert } from '../utils/i18n';

export const AlertsPage = () => {
  const { alerts, unreadCount, connectionStatus, acknowledgeAlert, markAsRead, refreshAlerts } = useAlertStream();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [lang, setLang] = useState(() => localStorage.getItem('link_x8_lang') || localStorage.getItem('ner_logiai_lang') || 'en');
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [isTriggeringTest, setIsTriggeringTest] = useState(false);

  const t = translations[lang] || translations.en;

  useEffect(() => {
    const handleLangEvent = (e) => {
      if (e.detail) setLang(e.detail);
    };
    window.addEventListener('ner_lang_changed', handleLangEvent);
    return () => {
      window.removeEventListener('ner_lang_changed', handleLangEvent);
    };
  }, []);

  const handleLangSelect = (e) => {
    const selected = e.target.value;
    setLang(selected);
    localStorage.setItem('link_x8_lang', selected);
    window.dispatchEvent(new CustomEvent('ner_lang_changed', { detail: selected }));
    showToast(`Language set to ${selected.toUpperCase()}`, 'info');
  };

  const handleAcknowledge = async (id) => {
    setAcknowledgingId(id);
    await acknowledgeAlert(id, `Operator ${user?.full_name || 'Dispatcher'} verified operational impact`);
    setAcknowledgingId(null);
  };

  const handleTriggerTest = async () => {
    setIsTriggeringTest(true);
    try {
      await api.post('/alerts/trigger-test', {
        alert_type: 'ROAD_BLOCKAGE',
        title: '🚨 LIVE TELEMETRY: FLASH FLOOD AT BRAHMAPUTRA CROSSING',
        message: 'Sudden high water level detected across NH27 approach corridor. Re-routing heavy freight convoys.',
        severity: 'CRITICAL',
        location: 'Brahmaputra Lowland Approach (COR-NH27)',
        recommended_action: 'Halt inbound 20T+ trucks and divert via alternate state arterial.'
      });
      showToast('Live test alert broadcasted to all active streams!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to trigger test alert', 'error');
    } finally {
      setIsTriggeringTest(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter !== 'ALL' && a.severity && a.severity.toUpperCase() !== severityFilter) {
      return false;
    }
    if (statusFilter !== 'ALL') {
      const currentStatus = a.status || (a.is_read ? 'SEEN' : 'NEW');
      if (currentStatus !== statusFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-600" />
              {t.alerts_title || "Automated Real-Time Alert & Notification Stream"}
            </h1>
            {/* Live SSE Connection Badge */}
            <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 border shadow-xs ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}>
              <Radio className={`w-3 h-3 ${connectionStatus === 'CONNECTED' ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              <span>{connectionStatus === 'CONNECTED' ? 'LIVE SSE STREAM' : connectionStatus}</span>
            </div>
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5">
            {t.alerts_subtitle || "Real-time push delivery of mission-critical corridor disruptions, bridge load limits, landslides, and offline field report synchronizations."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Multilingual Selector */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl text-xs font-bold text-[#1F2937]">
            <Globe className="w-4 h-4 text-purple-600" />
            <select
              value={lang}
              onChange={handleLangSelect}
              className="bg-transparent text-xs font-bold text-[#1F2937] focus:outline-none cursor-pointer"
            >
              {supportedLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
          </div>

          {/* Test Trigger Button for demonstration */}
          <button
            onClick={handleTriggerTest}
            disabled={isTriggeringTest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition active:scale-95"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Broadcast Live Alert</span>
          </button>
        </div>
      </div>

      {/* Filter & Metrics Toolbar */}
      <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-600 cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Severity</option>
            <option value="HIGH">High Severity</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low Severity</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-600 cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">Unread / New</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="SEEN">Seen</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-[#6B7280] font-semibold text-xs">
          <span>Active Feed: <strong className="text-[#1F2937]">{filteredAlerts.length}</strong></span>
          <span className="text-purple-600 font-extrabold">•</span>
          <span>Unacknowledged: <strong className="text-rose-600">{unreadCount}</strong></span>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] p-8 rounded-2xl text-center text-[#6B7280] text-xs">
            No active alerts matching criteria. Real-time stream is listening for new events.
          </div>
        ) : (
          filteredAlerts.map((a) => {
            const localized = localizeAlert(a, lang);
            const isAck = a.status === 'ACKNOWLEDGED';
            const isCritical = a.severity === 'CRITICAL';

            return (
              <div 
                key={a.id} 
                className={`bg-white border rounded-2xl p-4.5 flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-xs border-l-4 transition duration-200 ${
                  isCritical 
                    ? 'border-l-rose-600 border-[#E5E7EB] bg-rose-50/20' 
                    : isAck 
                    ? 'border-l-emerald-500 border-[#E5E7EB] bg-slate-50/40' 
                    : 'border-l-amber-500 border-[#E5E7EB]'
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-[#1F2937]">{localized.title}</span>
                    <StatusBadge level={a.severity} size="sm" />
                    
                    {isAck ? (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-emerald-600" /> ACKNOWLEDGED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
                        ACTION REQUIRED
                      </span>
                    )}

                    {a.location && (
                      <span className="text-[11px] text-[#6B7280] font-semibold flex items-center gap-1 bg-[#F7F7FB] px-2 py-0.5 rounded-md border border-[#E5E7EB]">
                        <MapPin className="w-3 h-3 text-purple-600" /> {a.location}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#1F2937] leading-relaxed">{localized.message}</p>

                  {localized.action && (
                    <div className="text-[11px] font-bold text-purple-900 bg-purple-50 p-2.5 rounded-xl border border-purple-200">
                      {t.recommended_action || "Recommended Action"}: {localized.action}
                    </div>
                  )}

                  {/* Audit Trail Details if Acknowledged */}
                  {isAck && a.acknowledged_at && (
                    <div className="text-[10px] text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-2 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Acknowledged by <strong>{a.acknowledged_by || 'Dispatcher'}</strong> on {new Date(a.acknowledged_at).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-[#6B7280] font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#9CA3AF]" />
                    <span>Logged: {new Date(a.created_at || Date.now()).toLocaleString()}</span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                  {!isAck && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      disabled={acknowledgingId === a.id}
                      className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition active:scale-95"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{acknowledgingId === a.id ? 'Acknowledging...' : 'Acknowledge'}</span>
                    </button>
                  )}
                  
                  {!a.is_read && isAck && (
                    <button
                      onClick={() => markAsRead(a.id)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

