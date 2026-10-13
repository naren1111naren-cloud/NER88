import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAlertStream } from '../context/AlertStreamContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';
import { 
  Bell, CheckCircle2, ShieldAlert, AlertTriangle, Filter, 
  CheckCheck, Globe, Radio, ShieldCheck, Clock, MapPin, Zap, UserCheck 
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { localizeAlert } from '../utils/i18n';

export const AlertsPage = () => {
  const { t, i18n } = useTranslation();
  const { alerts, unreadCount, connectionStatus, acknowledgeAlert, markAsRead, refreshAlerts } = useAlertStream();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [acknowledgingId, setAcknowledgingId] = useState(null);
  const [isTriggeringTest, setIsTriggeringTest] = useState(false);

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
        title: 'LIVE TELEMETRY: FLASH FLOOD AT BRAHMAPUTRA CROSSING',
        message: 'Sudden high water level detected across NH27 approach corridor. Re-routing heavy freight convoys.',
        severity: 'CRITICAL',
        location: 'Brahmaputra Lowland Approach (COR-NH27)',
        recommended_action: 'Halt inbound 20T+ trucks and divert via alternate state arterial.'
      });
      showToast('Live operational alert broadcasted across command network!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to broadcast operational alert', 'error');
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
    <div className="space-y-5 pb-8 text-[#17202A] font-sans">
      {/* Page Header */}
      <div className="bg-white border border-[#D9E0E7] p-4 sm:p-5 rounded-[8px] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-bold text-[#123B66] bg-[#123B66]/10 px-2 py-0.5 rounded border border-[#123B66]/20 uppercase tracking-wider">
              NOTIFICATION STREAM
            </span>
            {/* Live SSE Connection Badge */}
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1.5 border shadow-2xs ${
              connectionStatus === 'CONNECTED'
                ? 'bg-[#16834B]/10 text-[#16834B] border-[#16834B]/30'
                : connectionStatus === 'RECONNECTING'
                ? 'bg-[#D99A00]/10 text-[#D99A00] border-[#D99A00]/30 animate-pulse'
                : 'bg-[#F6F8FA] text-[#5B6570] border-[#D9E0E7]'
            }`}>
              <Radio className={`w-3 h-3 ${connectionStatus === 'CONNECTED' ? 'text-[#16834B]' : 'text-[#D99A00]'}`} />
              <span>{connectionStatus === 'CONNECTED' ? '● LIVE SSE STREAM' : connectionStatus}</span>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#185A8D]" />
            Operational Alerts & Incident Stream
          </h1>
          <p className="text-xs text-[#5B6570] mt-1">
            Real-time telemetry stream of high-severity corridor disruptions, bridge load alerts, and emergency reroute notifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            onClick={handleTriggerTest}
            disabled={isTriggeringTest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>Broadcast Operational Alert</span>
          </button>
        </div>
      </div>

      {/* Filter & Metrics Toolbar */}
      <div className="bg-white border border-[#D9E0E7] p-3 rounded-[8px] shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-[#5B6570] font-bold">
            <Filter className="w-3.5 h-3.5 text-[#185A8D]" /> Filter Stream:
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-[#F6F8FA] border border-[#D9E0E7] text-[#17202A] text-xs font-semibold rounded-[6px] px-3 py-1.5 focus:outline-none focus:border-[#185A8D] cursor-pointer"
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
            className="bg-[#F6F8FA] border border-[#D9E0E7] text-[#17202A] text-xs font-semibold rounded-[6px] px-3 py-1.5 focus:outline-none focus:border-[#185A8D] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">Unread / New</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="SEEN">Seen</option>
          </select>
        </div>

        <div className="flex items-center gap-3 text-[#5B6570] font-semibold text-xs">
          <span>Active Feed: <strong className="text-[#17202A]">{filteredAlerts.length}</strong></span>
          <span className="text-[#D9E0E7]">&bull;</span>
          <span>Unacknowledged: <strong className="text-[#C62828] font-bold">{unreadCount}</strong></span>
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white border border-[#D9E0E7] p-8 rounded-[8px] text-center text-[#5B6570] text-xs">
            <CheckCircle2 className="w-8 h-8 text-[#16834B] mx-auto mb-2" />
            <h4 className="font-bold text-[#0B2744]">NO ACTIVE ALERTS</h4>
            <p className="mt-0.5">All monitored corridors operating smoothly. Real-time stream is listening for new telemetry events.</p>
          </div>
        ) : (
          filteredAlerts.map((a) => {
            const localized = localizeAlert(a, i18n.language);
            const isAck = a.status === 'ACKNOWLEDGED';
            const isCritical = a.severity === 'CRITICAL';

            return (
              <div 
                key={a.id} 
                className={`bg-white border rounded-[8px] p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 shadow-subtle border-l-4 transition duration-150 ${
                  isCritical 
                    ? 'border-l-[#C62828] border-[#D9E0E7]' 
                    : isAck 
                    ? 'border-l-[#16834B] border-[#D9E0E7]' 
                    : 'border-l-[#D99A00] border-[#D9E0E7]'
                }`}
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-[#0B2744]">{localized.title}</span>
                    <StatusBadge level={a.severity} size="sm" />
                    
                    {isAck ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#16834B]/10 text-[#16834B] border border-[#16834B]/30 flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-[#16834B]" /> ● ACKNOWLEDGED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/30 font-bold">
                        ■ ACTION REQUIRED
                      </span>
                    )}

                    {a.location && (
                      <span className="text-[11px] text-[#5B6570] font-semibold flex items-center gap-1 bg-[#F6F8FA] px-2 py-0.5 rounded border border-[#D9E0E7]">
                        <MapPin className="w-3 h-3 text-[#185A8D]" /> {a.location}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#5B6570] leading-relaxed">{localized.message}</p>

                  {localized.action && (
                    <div className="text-[11px] font-semibold text-[#0B2744] bg-[#185A8D]/5 p-2.5 rounded-[6px] border border-[#185A8D]/20">
                      <strong>Recommended Action:</strong> {localized.action}
                    </div>
                  )}

                  {/* Audit Trail Details if Acknowledged */}
                  {isAck && a.acknowledged_at && (
                    <div className="text-[10px] text-[#16834B] bg-[#16834B]/5 px-2.5 py-1 rounded-[4px] border border-[#16834B]/20 flex items-center gap-2 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#16834B]" />
                      <span>Action Log: Acknowledged by <strong>{a.acknowledged_by || 'Dispatcher'}</strong> on {new Date(a.acknowledged_at).toLocaleString()}</span>
                    </div>
                  )}

                  <div className="text-[10px] text-[#5B6570] font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#5B6570]" />
                    <span>Logged: {new Date(a.created_at || Date.now()).toLocaleString()} IST</span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                  {!isAck && (
                    <button
                      onClick={() => handleAcknowledge(a.id)}
                      disabled={acknowledgingId === a.id}
                      className="px-3.5 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white text-xs font-bold shadow-subtle flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{acknowledgingId === a.id ? 'Acknowledging...' : 'Acknowledge Alert'}</span>
                    </button>
                  )}
                  
                  {!a.is_read && isAck && (
                    <button
                      onClick={() => markAsRead(a.id)}
                      className="px-3 py-1.5 rounded-[6px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#5B6570] text-xs font-semibold border border-[#D9E0E7] transition cursor-pointer"
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

export default AlertsPage;
