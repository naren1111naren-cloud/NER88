import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api, { API_BASE_URL } from '../services/api';
import { supabase } from '../utils/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const AlertStreamContext = createContext();

export const AlertStreamProvider = ({ children }) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING'); // CONNECTED, RECONNECTING, FALLBACK_POLL, DISCONNECTED
  const [lastEventId, setLastEventId] = useState(null);
  const [liveVehicles, setLiveVehicles] = useState({});
  const [liveEventFeed, setLiveEventFeed] = useState([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      type: 'SYSTEM',
      badge: 'ONLINE',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      message: 'NER88 Live Decision Intelligence Loop Active'
    }
  ]);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const seenAlertIds = useRef(new Set());

  const addEventFeedItem = useCallback((type, message, badge, badgeColor) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newItem = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      time: timeStr,
      type,
      message,
      badge: badge || type,
      badgeColor: badgeColor || 'bg-emerald-100 text-emerald-800'
    };
    setLiveEventFeed((prev) => [newItem, ...prev.slice(0, 40)]);
  }, []);

  // Fetch initial alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await api.get('/alerts');
      const fetched = Array.isArray(res.data) ? res.data : [];
      setAlerts(fetched);
      fetched.forEach((a) => seenAlertIds.current.add(a.id));
      const unread = fetched.filter((a) => !a.is_read).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Failed to load initial alerts:', err);
    }
  }, []);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    // Clear any pending timeouts
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const streamUrl = `${API_BASE_URL}/alerts/stream?token=${encodeURIComponent(token || 'demo-token')}`;

      setConnectionStatus('CONNECTING');
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.addEventListener('connection', (e) => {
        try {
          const data = JSON.parse(e.data);
          setConnectionStatus('CONNECTED');
          setLastEventId(data.event_id);
          console.log('[SSE] Stream connected successfully:', data);
          addEventFeedItem('STREAM', 'Real-time telemetry & alert SSE channel connected', 'CONNECTED', 'bg-emerald-100 text-emerald-800');
        } catch (err) {
          console.warn('[SSE] Error parsing connection event:', err);
        }
      });

      es.addEventListener('alert', (e) => {
        try {
          const eventPayload = JSON.parse(e.data);
          const eventType = eventPayload.event_type;
          const data = eventPayload.data || eventPayload.alert || {};

          setLastEventId(eventPayload.event_id);

          if (eventType === 'VEHICLE_POSITION_UPDATE') {
            const vCode = data.vehicle_code;
            if (vCode) {
              setLiveVehicles((prev) => ({
                ...prev,
                [vCode]: { ...data, updatedAt: Date.now() }
              }));
              addEventFeedItem(
                'GPS',
                `${vCode} position update: [${data.latitude?.toFixed(4)}, ${data.longitude?.toFixed(4)}] (${data.speed_kmh} km/h)`,
                data.tracking_mode === 'LIVE_PHONE_GPS' ? 'PHONE GPS' : 'TELEMETRY',
                data.tracking_mode === 'LIVE_PHONE_GPS' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-800'
              );
            }
            return;
          }

          if (eventType === 'DEMO_SCENARIO_EVENT') {
            window.dispatchEvent(new CustomEvent('sih_demo_triggered', { detail: data }));
            addEventFeedItem(
              'SIMULATION',
              `${data.title || 'Demo Scenario Triggered'}: ${data.affected_corridor || ''}`,
              'DEMO SIMULATION',
              'bg-amber-100 text-amber-800'
            );
            return;
          }

          if (eventType === 'ALERT_ACKNOWLEDGED') {
            setAlerts((prev) =>
              prev.map((a) => (a.id === data.id ? { ...a, ...data } : a))
            );
            showToast(`✓ Alert #${data.id} acknowledged by ${data.acknowledged_by || 'Dispatcher'}`, 'info');
            addEventFeedItem('AUDIT', `Alert #${data.id} acknowledged`, 'ACK', 'bg-emerald-100 text-emerald-800');
            return;
          }

          // New Alert Handling
          const alert = data;
          if (alert && alert.id && !seenAlertIds.current.has(alert.id)) {
            seenAlertIds.current.add(alert.id);
            setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
            setUnreadCount((prev) => prev + 1);

            // Toast alert notification
            if (alert.severity === 'CRITICAL') {
              showToast(`🚨 CRITICAL ALERT: ${alert.title}`, 'error');
            } else if (alert.severity === 'HIGH') {
              showToast(`⚠️ HIGH SEVERITY ALERT: ${alert.title}`, 'warning');
            } else {
              showToast(`ℹ️ Alert: ${alert.title}`, 'info');
            }

            addEventFeedItem(
              'ALERT',
              `${alert.title} (${alert.location || 'Corridor'})`,
              alert.severity,
              alert.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-800' : 'bg-orange-100 text-orange-800'
            );
          }
        } catch (err) {
          console.error('[SSE] Error handling incoming event:', err);
        }
      });

      es.onerror = (err) => {
        console.warn('[SSE] Connection lost. Initiating auto-reconnect fallback...', err);
        setConnectionStatus('RECONNECTING');
        es.close();

        // Schedule reconnection in 4 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectSSE();
        }, 4000);

        // Fallback polling during connection loss
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(() => {
            fetchAlerts();
          }, 10000);
        }
      };
    } catch (err) {
      console.error('[SSE] Could not establish EventSource:', err);
      setConnectionStatus('FALLBACK_POLL');
      pollingIntervalRef.current = setInterval(() => {
        fetchAlerts();
      }, 10000);
    }
  }, [token, user, fetchAlerts, showToast, addEventFeedItem]);

  useEffect(() => {
    fetchAlerts();
    connectSSE();

    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [connectSSE, fetchAlerts]);

  // 3. Supabase Realtime Subscription for operational entities (Vehicles, Corridors, Alerts, Field Reports)
  useEffect(() => {
    let channel = null;
    try {
      channel = supabase
        .channel('ner88-operations-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'alerts' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const newAlert = payload.new;
              if (newAlert && newAlert.id && !seenAlertIds.current.has(newAlert.id)) {
                seenAlertIds.current.add(newAlert.id);
                setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== newAlert.id)]);
                setUnreadCount((prev) => prev + 1);
                showToast(`🚨 Realtime Alert: ${newAlert.title}`, newAlert.severity === 'CRITICAL' ? 'error' : 'warning');
                addEventFeedItem('REALTIME_ALERT', `${newAlert.title} (${newAlert.location || 'Corridor'})`, newAlert.severity, 'bg-rose-100 text-rose-800');
              }
            } else if (payload.eventType === 'UPDATE') {
              setAlerts((prev) =>
                prev.map((a) => (a.id === payload.new.id ? { ...a, ...payload.new } : a))
              );
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'vehicles' },
          (payload) => {
            const v = payload.new;
            if (v && v.vehicle_code) {
              setLiveVehicles((prev) => ({
                ...prev,
                [v.vehicle_code]: {
                  vehicle_code: v.vehicle_code,
                  latitude: v.current_lat,
                  longitude: v.current_lng,
                  speed_kmh: v.speed_kmh,
                  heading_deg: v.heading_deg,
                  status: v.status,
                  risk_level: v.risk_level,
                  updatedAt: Date.now()
                }
              }));
              addEventFeedItem('SUPABASE_GPS', `${v.vehicle_code} location updated [${v.current_lat?.toFixed(3)}, ${v.current_lng?.toFixed(3)}]`, 'REALTIME', 'bg-blue-100 text-blue-800');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'field_reports' },
          (payload) => {
            if (payload.eventType === 'INSERT') {
              const report = payload.new;
              addEventFeedItem('FIELD_REPORT', `New field report synced: ${report.report_type} (${report.location_name || ''})`, 'SYNCED', 'bg-purple-100 text-purple-800');
              showToast(`✓ Field Report Synced: ${report.report_type}`, 'info');
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'corridors' },
          (payload) => {
            const c = payload.new;
            addEventFeedItem('CORRIDOR', `${c.name || c.corridor_code} accessibility is now ${c.accessibility_status} (Score: ${c.accessibility_score})`, c.accessibility_status, c.accessibility_status === 'BLOCKED' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800');
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Operations channel active');
          }
        });
    } catch (err) {
      console.warn('[Supabase Realtime Warning]', err);
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [addEventFeedItem, showToast]);

  // Acknowledge alert with audit trail
  const acknowledgeAlert = async (alertId, notes = '') => {
    try {
      const res = await api.post(`/alerts/${alertId}/acknowledge`, {
        acknowledged_by: user?.full_name || user?.email || 'Regional Dispatcher',
        notes: notes || 'Operator acknowledged in dispatch console'
      });
      const updated = res.data;
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, ...updated } : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      showToast(`Alert #${alertId} successfully acknowledged.`, 'success');
      return { success: true, alert: updated };
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
      showToast('Failed to acknowledge alert. Please try again.', 'error');
      return { success: false, error: err.message };
    }
  };

  // Mark alert as read
  const markAsRead = async (alertId) => {
    try {
      await api.put(`/alerts/${alertId}/read`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true, status: a.status === 'NEW' ? 'SEEN' : a.status } : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark alert as read:', err);
    }
  };

  return (
    <AlertStreamContext.Provider
      value={{
        alerts,
        unreadCount,
        connectionStatus,
        lastEventId,
        liveVehicles,
        liveEventFeed,
        acknowledgeAlert,
        markAsRead,
        refreshAlerts: fetchAlerts,
        reconnectStream: connectSSE,
        addEventFeedItem
      }}
    >
      {children}
    </AlertStreamContext.Provider>
  );
};

export const useAlertStream = () => useContext(AlertStreamContext);
