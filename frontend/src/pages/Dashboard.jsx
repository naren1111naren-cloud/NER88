import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { API_BASE_URL } from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { KPICard } from '../components/KPICard';
import { GISMap } from '../components/GISMap';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AccessibilityDetailPanel } from '../components/AccessibilityDetailPanel';
import { WeatherWidget } from '../components/WeatherWidget';
import { useDemo } from '../context/DemoContext';
import { useToast } from '../context/ToastContext';
import { useAlertStream } from '../context/AlertStreamContext';
import { usePhoneGPS } from '../hooks/usePhoneGPS';
import { 
  Truck, Package, AlertTriangle, Clock, Ban, ArrowRight, 
  Navigation, Sparkles, Siren, MapPin, Activity, Waves, 
  Radio, CloudRain, Mountain, RotateCcw, Zap, RefreshCw, 
  ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { isDemoMode, startDemoScenario, startHeavyRainScenario, resetDemoScenario } = useDemo();
  const { showToast } = useToast();
  const { liveVehicles } = useAlertStream();
  const { isTracking, startTracking, stopTracking, coords, speed, error: gpsError, lastSyncTime, activeVehicleCode } = usePhoneGPS('NER-V001');

  const [summary, setSummary] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [corridors, setCorridors] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedWeatherCoords, setSelectedWeatherCoords] = useState(null);
  const [backendConnected, setBackendConnected] = useState(null);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [activeScenarioName, setActiveScenarioName] = useState(null);
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  const [showWhyRoute, setShowWhyRoute] = useState(true);
  const [decisionLog, setDecisionLog] = useState([
    { id: 1, time: '10:40:02', title: 'Route Monitored', desc: 'Primary corridor NH-27 normal clearance recorded.', badge: 'NORMAL', badgeColor: 'bg-emerald-50 text-[#047857] border border-emerald-200' },
    { id: 2, time: '10:41:15', title: 'Vehicle Telemetry Sync', desc: 'NER-V001 streaming live telemetry near Dimapur (42 km/h).', badge: 'TELEMETRY', badgeColor: 'bg-blue-50 text-[#1D4ED8] border border-blue-200' },
    { id: 3, time: '10:42:00', title: 'System Online', desc: 'Continuous accessibility and weather matrix active.', badge: 'ONLINE', badgeColor: 'bg-purple-50 text-[#6D28D9] border border-purple-200' }
  ]);

  const fetchData = async () => {
    try {
      const [sumRes, vehRes, incRes, delRes, distRes, corRes, brgRes] = await Promise.all([
        api.get('/dashboard/summary').catch((err) => ({ data: null, error: err })),
        api.get('/vehicles').catch((err) => ({ data: [], error: err })),
        api.get('/incidents').catch((err) => ({ data: [], error: err })),
        api.get('/deliveries').catch((err) => ({ data: [], error: err })),
        api.get('/accessibility/districts').catch((err) => ({ data: [], error: err })),
        api.get('/accessibility/roads').catch((err) => ({ data: [], error: err })),
        api.get('/accessibility/bridges').catch((err) => {
          console.warn('[Dashboard] Bridge telemetry request failed:', err.message);
          return { data: null, error: err };
        })
      ]);

      const connected = !!(sumRes.data || (brgRes.data && brgRes.data.length > 0) || (vehRes.data && vehRes.data.length > 0));
      setBackendConnected(connected);

      if (sumRes.data) setSummary(sumRes.data);
      if (vehRes.data) setVehicles(safeArray(vehRes.data));
      if (incRes.data) setIncidents(safeArray(incRes.data));
      if (delRes.data) setDeliveries(safeArray(delRes.data));
      if (distRes.data) setDistricts(safeArray(distRes.data));
      if (corRes.data) setCorridors(safeArray(corRes.data));
      if (brgRes.data && Array.isArray(brgRes.data)) {
        setBridges(brgRes.data);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setBackendConnected(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleDemoEvent = () => fetchData();
    window.addEventListener('sih_demo_triggered', handleDemoEvent);
    window.addEventListener('sih_demo_reset', handleDemoEvent);

    return () => {
      window.removeEventListener('sih_demo_triggered', handleDemoEvent);
      window.removeEventListener('sih_demo_reset', handleDemoEvent);
    };
  }, []);

  const triggerRerouteApproval = (id) => {
    setSelectedDeliveryId(id);
    setShowRerouteModal(true);
  };

  const handleConfirmReroute = async () => {
    setActionLoading(true);
    try {
      const targetId = selectedDeliveryId || activeDelivery?.id || 1;
      await api.post(`/deliveries/${targetId}/reroute`);
      fetchData();
      showToast('Alternate route approved. Updated corridor trajectory reflected on map.', 'success');
      
      const nowTime = new Date().toLocaleTimeString();
      setDecisionLog(prev => [
        { id: Date.now(), time: nowTime, title: 'Dispatcher Approved Detour', desc: 'Alternate Route B (via Silchar / Jiribam - NH37) active.', badge: 'REROUTED', badgeColor: 'bg-purple-50 text-[#6D28D9] border border-purple-200' },
        ...prev
      ]);
    } catch {
      showToast('Failed to approve reroute action.', 'error');
    } finally {
      setActionLoading(false);
      setShowRerouteModal(false);
    }
  };

  const handleTriggerHeavyRain = async () => {
    setScenarioLoading(true);
    setActiveScenarioName('HEAVY_RAIN');
    try {
      await startHeavyRainScenario();
      showToast('Heavy Rainfall Scenario active: Weather risk & accessibility updated across corridors.', 'warning');
      fetchData();
      
      const nowTime = new Date().toLocaleTimeString();
      setDecisionLog(prev => [
        { id: Date.now() + 1, time: nowTime, title: 'Weather Risk Escalation', desc: 'Precipitation 75 mm/hr over Senapati sector. Accessibility reduced to 48/100.', badge: 'WEATHER', badgeColor: 'bg-blue-50 text-[#1D4ED8] border border-blue-200' },
        { id: Date.now() + 2, time: nowTime, title: 'ETA Recalculated', desc: 'Speed reduction in hill passes. Delay revised to +20 mins.', badge: 'DELAY +20M', badgeColor: 'bg-amber-50 text-[#B45309] border border-amber-200' },
        ...prev
      ]);
    } catch {
      showToast('Failed to trigger rainfall scenario', 'error');
    } finally {
      setScenarioLoading(false);
    }
  };

  const handleTriggerLandslide = async () => {
    setScenarioLoading(true);
    setActiveScenarioName('LANDSLIDE');
    try {
      await startDemoScenario();
      showToast('Landslide Scenario active: Senapati Pass blocked on NH-27. Alternate Route B recommended.', 'error');
      fetchData();

      const nowTime = new Date().toLocaleTimeString();
      setDecisionLog(prev => [
        { id: Date.now() + 1, time: nowTime, title: 'Disruption Detected', desc: 'Landslide on NH-27 at Senapati Pass (Km 214). Both lanes blocked.', badge: 'ROAD BLOCKED', badgeColor: 'bg-rose-50 text-[#BE123C] border border-rose-200' },
        { id: Date.now() + 2, time: nowTime, title: 'Accessibility Recalculated', desc: 'NH-27 accessibility dropped to 0/100. Route risk escalated to 82/100 (CRITICAL).', badge: 'CRITICAL', badgeColor: 'bg-rose-50 text-[#BE123C] border border-rose-200' },
        { id: Date.now() + 3, time: nowTime, title: 'Alternate Route Identified', desc: 'LINK X8 recommends NH-37 Western Bypass via Silchar / Jiribam (+35 mins delay).', badge: 'DETOUR REC', badgeColor: 'bg-purple-50 text-[#6D28D9] border border-purple-200' },
        ...prev
      ]);
    } catch {
      showToast('Failed to trigger landslide scenario', 'error');
    } finally {
      setScenarioLoading(false);
    }
  };

  const handleReset = async () => {
    setScenarioLoading(true);
    setActiveScenarioName(null);
    try {
      await resetDemoScenario();
      showToast('Baseline parameters restored to normal operational state.', 'info');
      fetchData();

      const nowTime = new Date().toLocaleTimeString();
      setDecisionLog(prev => [
        { id: Date.now(), time: nowTime, title: 'Baseline Restored', desc: 'Corridors open, normal risk levels (18/100), zero active blockages.', badge: 'NORMAL', badgeColor: 'bg-emerald-50 text-[#047857] border border-emerald-200' },
        ...prev
      ]);
    } catch {
      showToast('Failed to reset demo scenario', 'error');
    } finally {
      setScenarioLoading(false);
    }
  };

  const activeDelivery = deliveries.find(d => d.delivery_code === 'DEL-2026-001') || deliveries[0];
  const primaryRouteWaypoints = activeDelivery?.active_route_path ? JSON.parse(activeDelivery.active_route_path) : [];
  const alternateRouteWaypoints = activeDelivery?.alternate_route_path ? JSON.parse(activeDelivery.alternate_route_path) : [];

  const isEmergencyActive = summary?.emergency_operations_mode;

  // KPI Calculations
  const rawVehicles = summary?.kpi?.active_vehicles ?? (vehicles.length > 0 ? vehicles.length : 4);
  const vehicleCount = rawVehicles;
  const onlineVehicles = summary?.kpi?.online_vehicles ?? vehicles.filter(v => v.telemetry_health === 'LIVE').length;
  const standbyVehicles = summary?.kpi?.offline_vehicles ?? Math.max(0, vehicles.length - onlineVehicles);
  const vehicleSubtext = isTracking 
    ? 'Phone GPS Broadcasting' 
    : (vehicles.length > 0 ? `${onlineVehicles} In Transit · ${standbyVehicles} Standby` : 'Fleet status active');

  const rawDeliveries = summary?.kpi?.active_deliveries ?? (deliveries.length > 0 ? deliveries.length : 3);
  const deliveryCount = rawDeliveries;
  const inTransitCount = summary?.kpi?.in_transit_deliveries ?? deliveries.filter(d => d.status === 'IN_TRANSIT' || d.status === 'REROUTED').length;
  const atHubCount = Math.max(0, (typeof deliveryCount === 'number' ? deliveryCount : 0) - inTransitCount);
  const deliverySubtext = deliveries.length > 0 ? `${inTransitCount} On Route · ${atHubCount} At Hub` : 'Consignments tracked';

  const operationalBridges = summary?.kpi?.operational_bridges ?? bridges.filter(b => b.status === 'OPERATIONAL').length;
  const totalBridgesCount = summary?.kpi?.total_bridges || bridges.length || 8;
  const bridgeDisplayValue = `${operationalBridges || 7} / ${totalBridgesCount || 8}`;
  const restrictedBridges = summary?.kpi?.restricted_bridges ?? bridges.filter(b => b.status === 'RESTRICTED' || b.status === 'CLOSED').length;
  const bridgeSubtext = restrictedBridges > 0 ? `${restrictedBridges} Restricted · River Crossings Monitored` : 'All Critical Crossings Clear';

  const hasLandslideDisruption = incidents.some(i => i.road_status === 'BLOCKED' || i.severity === 'CRITICAL') || activeScenarioName === 'LANDSLIDE';
  const hasRainDisruption = activeScenarioName === 'HEAVY_RAIN';

  const blockedCorridorsCount = hasLandslideDisruption ? 2 : (summary?.kpi?.blocked_corridors ?? 0);
  const corridorSubtext = blockedCorridorsCount > 0 ? 'Senapati Pass Road Closure' : 'All Monitored Corridors Open';

  const delayedDeliveriesCount = hasLandslideDisruption ? 4 : (hasRainDisruption ? 2 : (summary?.kpi?.delayed_deliveries ?? 1));
  const delaySubtext = delayedDeliveriesCount > 0 ? `ETA Impact: +${hasLandslideDisruption ? 35 : (hasRainDisruption ? 20 : 0)} min` : 'On Schedule';

  const criticalIncidentsCount = hasLandslideDisruption ? 2 : (hasRainDisruption ? 1 : (summary?.kpi?.critical_incidents ?? 0));
  const incidentSubtext = criticalIncidentsCount > 0 ? `${criticalIncidentsCount} Active Disruptions` : 'Zero Blocking Hazards';

  const networkRiskScore = hasLandslideDisruption ? 64 : (hasRainDisruption ? 48 : (summary?.kpi?.network_risk_score ?? 18));
  const networkRiskCategory = networkRiskScore >= 60 ? 'HIGH' : networkRiskScore >= 35 ? 'MODERATE' : 'LOW';
  const networkRiskSubtext = hasLandslideDisruption ? 'High Disruption Risk' : 'Normal Operating Baseline';

  // Dynamic Route Intelligence Values
  const routeRiskScore = hasLandslideDisruption ? 82 : (hasRainDisruption ? 52 : (activeDelivery?.route_risk_score ?? 18));
  const routeAccessibilityScore = hasLandslideDisruption ? 24 : (hasRainDisruption ? 58 : 88);
  const routeEstimatedDelay = hasLandslideDisruption ? 35 : (hasRainDisruption ? 20 : 0);
  const routeRiskCategory = routeRiskScore >= 75 ? 'CRITICAL' : routeRiskScore >= 45 ? 'MEDIUM' : 'LOW';

  // Prioritize degraded districts & bridges
  const attentionDistricts = [...districts].sort((a, b) => (a.accessibility_index || 50) - (b.accessibility_index || 50));
  const displayDistricts = showAllDistricts ? attentionDistricts : attentionDistricts.slice(0, 4);

  const attentionBridges = [...bridges].sort((a, b) => {
    if (a.status === 'CLOSED' || a.status === 'RESTRICTED') return -1;
    if (b.status === 'CLOSED' || b.status === 'RESTRICTED') return 1;
    return (a.accessibility_score || 80) - (b.accessibility_score || 80);
  });

  return (
    <div className="space-y-4 pb-12 font-sans text-[#172033]">
      {/* Emergency Mode Banner Callout */}
      {isEmergencyActive && (
        <div className="bg-[#BE123C] text-white p-3.5 rounded-lg shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Siren className="w-5 h-5 shrink-0" />
            <div>
              <div className="font-bold text-sm uppercase tracking-wider">EMERGENCY MODE ACTIVE</div>
              <div className="text-xs text-rose-100 mt-0.5">Disaster logistics protocols engaged. Priority routing for emergency relief and medical supplies.</div>
            </div>
          </div>
          <button 
            onClick={() => navigate('/deliveries?priority=EMERGENCY')}
            className="px-3 py-1.5 rounded-md bg-white text-[#BE123C] font-bold text-xs shadow-xs hover:bg-rose-50 transition active:scale-95 shrink-0"
          >
            View Emergency Shipments
          </button>
        </div>
      )}

      {/* Top Operations Header / Live Operations Overview Panel */}
      <div className="bg-[#171329] text-white px-5 py-3.5 rounded-lg border border-[#2A2447] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Title, Badge, Description & Pipeline */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-lg lg:text-xl font-bold tracking-tight text-white">
              LIVE OPERATIONS OVERVIEW
            </h1>
            <span className={`text-xs font-bold px-2.5 py-0.5 rounded-md border uppercase font-mono ${
              isDemoMode ? 'bg-amber-500/20 border-amber-400/30 text-amber-300' : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300'
            }`}>
              {isDemoMode ? 'DEMO SCENARIO' : 'LIVE DATA'}
            </span>
          </div>

          <p className="text-xs text-slate-300">
            Monitor weather, route conditions, incidents and accessibility across NER logistics corridors.
          </p>

          {/* Operational Pipeline Flow */}
          <div className="flex items-center gap-2 text-xs text-purple-200/90 font-medium pt-1 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-200">Weather & Field Data</span>
            <span className="text-purple-400 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-200">Risk Assessment</span>
            <span className="text-purple-400 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-200">Accessibility</span>
            <span className="text-purple-400 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-800 text-purple-200">Alert</span>
            <span className="text-purple-400 font-bold">→</span>
            <span className="px-2 py-0.5 rounded bg-purple-900 border border-purple-700 text-white font-semibold">Route Update</span>
          </div>
        </div>

        {/* Right Side: Scenario Simulation State & Compact Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0 lg:pl-5 lg:border-l lg:border-[#2A2447]">
          {/* Current Scenario State Indicator */}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-bold text-purple-300/80 uppercase tracking-wider">
              SCENARIO SIMULATION
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2.5 h-2.5 rounded-full ${
                activeScenarioName === 'LANDSLIDE' ? 'bg-[#EF4444] animate-pulse' :
                activeScenarioName === 'HEAVY_RAIN' ? 'bg-[#3B82F6] animate-pulse' :
                'bg-[#10B981]'
              }`} />
              <span className="text-xs font-bold text-white tracking-wide">
                {activeScenarioName === 'LANDSLIDE' ? 'Landslide Active' :
                 activeScenarioName === 'HEAVY_RAIN' ? 'Heavy Rain Active' :
                 'Normal Operations'}
              </span>
            </div>
          </div>

          {/* Scenario Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTriggerHeavyRain}
              disabled={scenarioLoading}
              title="Trigger Heavy Rain Weather Disruption Scenario"
              className={`h-8 px-3 rounded-md font-bold text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95 ${
                activeScenarioName === 'HEAVY_RAIN' 
                  ? 'bg-blue-500 text-white ring-2 ring-blue-300 shadow-sm' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              <CloudRain className="w-3.5 h-3.5" />
              <span>Heavy Rain</span>
            </button>

            <button
              onClick={handleTriggerLandslide}
              disabled={scenarioLoading}
              title="Trigger Senapati Pass Landslide Disruption Scenario"
              className={`h-8 px-3 rounded-md font-bold text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95 ${
                activeScenarioName === 'LANDSLIDE' 
                  ? 'bg-rose-600 text-white ring-2 ring-rose-300 shadow-sm animate-pulse' 
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              <Mountain className="w-3.5 h-3.5" />
              <span>Landslide</span>
            </button>

            <button
              onClick={handleReset}
              disabled={scenarioLoading}
              title="Reset to Normal Operations"
              className="h-8 px-3 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Scenario State Comparison Banner (Shown during active scenario) */}
      {(hasLandslideDisruption || hasRainDisruption) && (
        <div className="bg-[#171329] border border-purple-800/60 p-4 rounded-lg text-white shadow-sm space-y-3 transition-all">
          <div className="flex items-center justify-between border-b border-[#2A2447] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="font-bold text-xs uppercase tracking-wider text-rose-400">
                {activeScenarioName === 'LANDSLIDE' ? 'DISRUPTION DETECTED: SENAPATI PASS LANDSLIDE (NH-27)' : 'METEOROLOGICAL EVENT: MONSOON PRECIPITATION SURGE'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-purple-300">
              STATE: SCENARIO ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Before */}
            <div className="bg-[#231C3D] p-3 rounded-md border border-[#332A57]">
              <div className="text-xs font-bold text-slate-300 uppercase">1. BEFORE DISRUPTION</div>
              <div className="mt-1.5 space-y-1 text-xs text-slate-200">
                <div>Network Risk: <strong className="text-emerald-400 font-bold">18 / 100</strong> (LOW)</div>
                <div>Blocked Corridors: <strong className="text-emerald-400 font-bold">0</strong></div>
                <div>Delayed Deliveries: <strong className="text-slate-300">1</strong></div>
              </div>
            </div>

            {/* After */}
            <div className="bg-rose-950/50 p-3 rounded-md border border-rose-800/60">
              <div className="text-xs font-bold text-rose-300 uppercase">2. IMPACT EVALUATED</div>
              <div className="mt-1.5 space-y-1 text-xs text-rose-100">
                <div>Network Risk: <strong className="text-rose-400 font-bold">{networkRiskScore} / 100</strong> ({networkRiskCategory})</div>
                <div>Blocked Corridors: <strong className="text-rose-400 font-bold">{blockedCorridorsCount}</strong> (NH-27 Impassable)</div>
                <div>Delayed Deliveries: <strong className="text-amber-400 font-bold">{delayedDeliveriesCount}</strong> (+35 min impact)</div>
              </div>
            </div>

            {/* AI Decision */}
            <div className="bg-purple-950/60 p-3 rounded-md border border-purple-700/60">
              <div className="text-xs font-bold text-purple-200 uppercase">3. LINK X8 AI DECISION</div>
              <div className="mt-1.5 space-y-1 text-xs text-purple-100">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">✓ Recalculated corridor accessibility</div>
                <div className="flex items-center gap-1.5 text-purple-200 font-semibold">✓ Identified Alternate Route B (NH-37)</div>
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold">✓ Rerouted DEL-2026-001 (Saves 4.5h delay)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPI Section / Operational Status Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard
          title="ACTIVE VEHICLES"
          value={vehicleCount}
          subtext={vehicleSubtext}
          icon={Truck}
          color="purple"
          onClick={() => navigate('/vehicles')}
        />
        <KPICard
          title="ACTIVE DELIVERIES"
          value={deliveryCount}
          subtext={deliverySubtext}
          icon={Package}
          color="violet"
          onClick={() => navigate('/deliveries')}
        />
        <KPICard
          title="STRATEGIC BRIDGES"
          value={bridgeDisplayValue}
          subtext={bridgeSubtext}
          icon={Waves}
          color="teal"
          onClick={() => bridges[0] && setSelectedAsset({ ...bridges[0], asset_type: 'bridge' })}
        />
        <KPICard
          title="CRITICAL INCIDENTS"
          value={criticalIncidentsCount}
          subtext={incidentSubtext}
          icon={AlertTriangle}
          color={criticalIncidentsCount > 0 ? 'rose' : 'emerald'}
          badge={criticalIncidentsCount > 0 ? 'CRITICAL' : 'CLEAR'}
          badgeType={criticalIncidentsCount > 0 ? 'critical' : 'success'}
          onClick={() => navigate('/incidents')}
        />
        <KPICard
          title="BLOCKED CORRIDORS"
          value={blockedCorridorsCount}
          subtext={corridorSubtext}
          icon={Ban}
          color={blockedCorridorsCount > 0 ? 'rose' : 'emerald'}
          badge={blockedCorridorsCount > 0 ? 'BLOCKED' : 'OPEN'}
          badgeType={blockedCorridorsCount > 0 ? 'critical' : 'success'}
          onClick={() => navigate('/incidents')}
        />
        <KPICard
          title="DELAYED SHIPMENTS"
          value={delayedDeliveriesCount}
          subtext={delaySubtext}
          icon={Clock}
          color={delayedDeliveriesCount > 2 ? 'rose' : 'amber'}
          badge={delayedDeliveriesCount > 0 ? `+${hasLandslideDisruption ? 35 : 20}m` : null}
          badgeType="warning"
          onClick={() => navigate('/deliveries')}
        />
      </div>

      {/* Primary Operations Area: Live Network Map (Hero) + Route Risk Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Hero GIS Command Map (Col span 2) */}
        <div className="lg:col-span-2 bg-white border border-[#D9DEE7] p-3.5 rounded-lg shadow-xs flex flex-col h-[560px]">
          <div className="px-2 py-1.5 border-b border-[#E5E7EB] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#6D28D9]" />
                <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                  NETWORK OPERATIONS
                </h2>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">
                Live monitored corridors, strategic bridges, and reported disruptions across NER
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0F766E] bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
                {bridges.length} Bridges Monitored
              </span>
            </div>
          </div>

          <div className="flex-1 mt-2 rounded-md overflow-hidden relative border border-[#E5E7EB]">
            <GISMap 
              vehicles={vehicles}
              incidents={incidents}
              bridges={bridges}
              corridors={corridors}
              primaryRoute={primaryRouteWaypoints}
              alternateRoute={alternateRouteWaypoints}
              liveVehicleOverrides={liveVehicles}
              onSelectAsset={setSelectedAsset}
              onReroute={triggerRerouteApproval}
              onMapClick={(coords) => setSelectedWeatherCoords(coords)}
            />
          </div>
        </div>

        {/* Route Risk Panel (Col span 1) */}
        <div className="space-y-4 flex flex-col justify-between">
          <div className="bg-white border border-[#D9DEE7] rounded-lg p-4 shadow-xs space-y-3.5 border-t-4 border-t-[#6D28D9]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#6D28D9]" />
                  <h2 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                    ROUTE RISK
                  </h2>
                </div>
                <div className="text-xs font-semibold text-[#475467] mt-0.5">
                  Route: <strong className="text-[#172033]">{activeDelivery ? `${activeDelivery.origin_city || 'Guwahati'} → ${activeDelivery.destination_city || 'Imphal'}` : 'Guwahati → Imphal'}</strong>
                </div>
              </div>
              <StatusBadge level={routeRiskCategory} size="sm" />
            </div>

            {/* Core Risk & Delay Scores */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-md">
                <div className="text-xs text-[#475467] font-bold uppercase tracking-wider">Risk Score</div>
                <div className={`text-2xl font-bold tracking-tight mt-0.5 ${routeRiskScore >= 70 ? 'text-[#BE123C]' : routeRiskScore >= 40 ? 'text-[#B45309]' : 'text-[#047857]'}`}>
                  {routeRiskScore} <span className="text-xs text-[#667085] font-normal">/ 100</span>
                </div>
              </div>

              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-md">
                <div className="text-xs text-[#475467] font-bold uppercase tracking-wider">Estimated Delay</div>
                <div className="text-2xl font-bold text-[#B45309] tracking-tight mt-0.5">
                  +{routeEstimatedDelay} <span className="text-xs text-[#667085] font-normal">min</span>
                </div>
              </div>
            </div>

            {/* Risk Forecast Horizons */}
            <div className="space-y-1.5">
              <div className="font-bold text-[#475467] text-xs uppercase tracking-wider">
                Risk Forecast
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {(() => {
                  const baseRisk = routeRiskScore;
                  const h6 = Math.min(100, Math.round(baseRisk * (hasLandslideDisruption ? 1.05 : 1.02)));
                  const h12 = Math.min(100, Math.round(baseRisk * (hasLandslideDisruption ? 1.1 : 0.95)));
                  const h24 = Math.max(10, Math.round(baseRisk * 0.7));
                  return (
                    <>
                      <div className="p-2 rounded-md bg-[#F8FAFC] border border-[#E2E8F0]">
                        <div className="text-[#667085] font-semibold">6 HOURS</div>
                        <div className={`font-bold mt-0.5 ${h6 >= 70 ? 'text-[#BE123C]' : h6 >= 40 ? 'text-[#B45309]' : 'text-[#047857]'}`}>{h6} / {h6 >= 70 ? 'HIGH' : 'LOW'}</div>
                      </div>
                      <div className="p-2 rounded-md bg-[#F8FAFC] border border-[#E2E8F0]">
                        <div className="text-[#667085] font-semibold">12 HOURS</div>
                        <div className={`font-bold mt-0.5 ${h12 >= 70 ? 'text-[#BE123C]' : h12 >= 40 ? 'text-[#B45309]' : 'text-[#047857]'}`}>{h12} / {h12 >= 70 ? 'HIGH' : 'LOW'}</div>
                      </div>
                      <div className="p-2 rounded-md bg-[#F8FAFC] border border-[#E2E8F0]">
                        <div className="text-[#667085] font-semibold">24 HOURS</div>
                        <div className={`font-bold mt-0.5 ${h24 >= 70 ? 'text-[#BE123C]' : h24 >= 40 ? 'text-[#B45309]' : 'text-[#047857]'}`}>{h24} / LOW</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Key Risk Factors */}
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-[#475467] uppercase tracking-wider">
                Risk Factors
              </div>
              <ul className="space-y-1.5 text-xs text-[#172033]">
                {hasLandslideDisruption ? (
                  <>
                    <li className="flex items-center gap-2 text-[#BE123C] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#BE123C] shrink-0" />
                      <span>Road closure detected at Senapati Pass (Km 214)</span>
                    </li>
                    <li className="flex items-center gap-2 text-[#B45309] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                      <span>Monsoon precipitation rate: 75 mm/hr in mountain pass</span>
                    </li>
                  </>
                ) : hasRainDisruption ? (
                  <>
                    <li className="flex items-center gap-2 text-[#B45309] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0" />
                      <span>Heavy rainfall detected along Nagaon-Dimapur sector</span>
                    </li>
                    <li className="flex items-center gap-2 text-[#047857] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" />
                      <span>No physical roadway blockages reported</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2 text-[#047857] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" />
                      <span>Corridor clear of blocking incidents</span>
                    </li>
                    <li className="flex items-center gap-2 text-[#047857] font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] shrink-0" />
                      <span>Weather conditions favorable along transit corridor</span>
                    </li>
                  </>
                )}
                <li className="flex items-center gap-2 text-[#0F766E] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488] shrink-0" />
                  <span>Strategic bridges operational (40T load limit verified)</span>
                </li>
              </ul>
            </div>

            {/* Explainable Route Recommendation */}
            <div className="bg-[#F8FAFC] border border-[#D9DEE7] rounded-md p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#172033] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
                  Recommended Route
                </span>
                <button 
                  onClick={() => setShowWhyRoute(!showWhyRoute)}
                  className="text-[#6D28D9] hover:text-[#5B21B6] font-semibold"
                >
                  {showWhyRoute ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {showWhyRoute && (
                <div className="space-y-2 pt-1 border-t border-[#E2E8F0]">
                  {hasLandslideDisruption ? (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#172033]">
                        Alternate Route B (NH-37 via Silchar / Jiribam)
                      </div>
                      <div className="space-y-1 text-xs text-[#475467]">
                        <div className="flex items-start gap-1.5 text-[#047857] font-medium">
                          <span>✓</span> <span>Avoids impassable Senapati landslide blockage on NH-27</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[#047857] font-medium">
                          <span>✓</span> <span>Jiribam river bridge operational (40T structural load limit OK)</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[#047857] font-medium">
                          <span>✓</span> <span>Accessibility index 84/100 (vs 0/100 on blocked corridor)</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[#047857] font-medium">
                          <span>✓</span> <span>Predicted delay: +35 min (saves ~4.5 hours vs roadblock wait)</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="font-bold text-[#172033]">
                        Maintain Primary Route (NH-27 via Nagaon & Dimapur)
                      </div>
                      <div className="space-y-1 text-xs text-[#475467]">
                        <div className="flex items-start gap-1.5 text-[#047857] font-medium">
                          <span>✓</span> <span>Direct highway corridor with optimal transit velocity</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-[#047857] font-medium">
                          <span>✓</span> <span>Accessibility: 88/100 · Predicted delay: +0 min</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => triggerRerouteApproval(activeDelivery?.id)}
                    className="w-full mt-2 py-2 rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>{hasLandslideDisruption ? 'APPROVE DETOUR (ALT ROUTE B)' : 'CONFIRM ROUTE'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Operations & Delivery Intelligence Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Delivery Card */}
        <div className="bg-white border border-[#D9DEE7] rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#6D28D9]" />
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                ACTIVE DELIVERY
              </h3>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-purple-50 text-[#6D28D9] border border-purple-200">
              {activeDelivery?.delivery_code || 'DEL-2026-001'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="font-bold text-sm text-[#172033]">
                {activeDelivery?.cargo_description || 'Emergency Medical Supplies & Cold Chain'}
              </div>
              <div className="text-xs text-[#667085] mt-0.5">
                {activeDelivery?.origin_city || 'Guwahati'} → {activeDelivery?.destination_city || 'Imphal'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
              <div>
                <span className="text-[#667085] block text-xs">Vehicle:</span>
                <strong className="text-[#6D28D9] font-bold">{activeDelivery?.vehicle_code || 'NER-V001'}</strong>
              </div>
              <div>
                <span className="text-[#667085] block text-xs">Route:</span>
                <strong className="text-[#172033] font-bold">{hasLandslideDisruption ? 'NH-37 Bypass' : 'NH-27 Corridor'}</strong>
              </div>
              <div>
                <span className="text-[#667085] block text-xs">ETA:</span>
                <strong className="text-[#172033] font-bold">{hasLandslideDisruption ? '15:10' : '14:35'}</strong>
              </div>
              <div>
                <span className="text-[#667085] block text-xs">Risk:</span>
                <strong className={hasLandslideDisruption ? 'text-[#BE123C] font-bold' : 'text-[#047857] font-bold'}>
                  {hasLandslideDisruption ? 'REROUTED' : 'LOW'}
                </strong>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-[#475467] mb-1">
                <span>Route Progress</span>
                <strong className="text-[#172033] font-bold">64%</strong>
              </div>
              <div className="w-full bg-[#E5E7EB] h-2 rounded-full overflow-hidden">
                <div className="bg-[#6D28D9] h-full rounded-full transition-all" style={{ width: '64%' }} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => navigate('/deliveries')}
                className="flex-1 py-1.5 rounded-md bg-purple-50 hover:bg-purple-100 text-[#6D28D9] font-bold text-xs border border-purple-200 transition"
              >
                Track Delivery
              </button>
              <button
                onClick={() => navigate('/map')}
                className="flex-1 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[#475467] font-bold text-xs transition"
              >
                View Route
              </button>
            </div>
          </div>
        </div>

        {/* Vehicle Telemetry Card */}
        <div className="bg-white border border-[#D9DEE7] rounded-lg p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#1D4ED8]" />
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                VEHICLE TELEMETRY
              </h3>
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${isTracking ? 'bg-blue-50 text-[#1D4ED8] border-blue-300 animate-pulse' : 'bg-slate-100 text-[#475467] border-slate-200'}`}>
              {isTracking ? 'BROADCASTING LIVE' : 'CONNECTED'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] p-3 rounded-md border border-[#E2E8F0]">
              <div>
                <span className="text-[#667085] block text-xs">Vehicle ID:</span>
                <strong className="text-[#1D4ED8] font-bold">{activeVehicleCode}</strong>
              </div>
              <div>
                <span className="text-[#667085] block text-xs">Speed:</span>
                <strong className="text-[#172033] font-bold">{isTracking ? `${speed} km/h` : '42 km/h'}</strong>
              </div>
              <div>
                <span className="text-[#667085] block text-xs">Location:</span>
                <strong className="text-[#172033] font-mono text-xs">
                  {coords ? `[${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}]` : '[25.909, 93.726]'}
                </strong>
              </div>
              <div>
                <span className="text-[#667085] block text-xs">Last Update:</span>
                <strong className="text-[#047857] font-bold">{lastSyncTime || 'Real-time (<1s)'}</strong>
              </div>
            </div>

            <p className="text-xs text-[#475467] leading-relaxed">
              Receives vehicle positioning, speed, and heading data to monitor mountain pass transit and trigger automated rerouting.
            </p>

            {gpsError && <p className="text-xs text-[#BE123C] font-semibold">{gpsError}</p>}

            <div>
              {isTracking ? (
                <button
                  onClick={stopTracking}
                  className="w-full py-2 rounded-md bg-[#BE123C] hover:bg-[#9F1239] text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5 animate-spin" />
                  <span>STOP GPS TELEMETRY</span>
                </button>
              ) : (
                <button
                  onClick={() => startTracking('NER-V001')}
                  className="w-full py-2 rounded-md bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>START GPS BROADCAST</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* LINK X8 Decision Log / Timeline */}
        <div className="bg-white border border-[#D9DEE7] rounded-lg p-4 shadow-xs space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6D28D9]" />
              <h3 className="text-xs font-bold text-[#172033] uppercase tracking-wider">
                DECISION TIMELINE
              </h3>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 text-xs">
            {decisionLog.slice(0, 5).map((log) => (
              <div key={log.id} className="p-2.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-1.5 py-0.2 rounded font-mono ${log.badgeColor}`}>
                    {log.badge}
                  </span>
                  <span className="text-xs font-mono text-[#667085]">{log.time}</span>
                </div>
                <div className="font-bold text-[#172033] text-xs">{log.title}</div>
                <p className="text-xs text-[#475467] leading-tight">{log.desc}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/alerts')}
            className="w-full py-1.5 text-center text-[#6D28D9] hover:text-[#5B21B6] font-bold text-xs border-t border-[#F0F2F5] pt-2"
          >
            View Full Operational Audit Trail →
          </button>
        </div>
      </div>

      {/* Backend Disconnection Banner */}
      {backendConnected === false && (
        <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#BE123C] shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <strong className="font-bold text-sm block sm:inline mr-2">Backend Disconnected</strong>
              <span className="text-rose-700">
                Cannot reach FastAPI backend at <code className="font-mono bg-rose-100 px-1 py-0.5 rounded text-xs font-bold text-rose-800">{API_BASE_URL}</code>.
              </span>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="px-3 py-1 bg-[#BE123C] hover:bg-[#9F1239] text-white rounded-md font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-xs transition active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reconnect
          </button>
        </div>
      )}

      {/* Weather Conditions & Accessibility Monitor */}
      <WeatherWidget selectedCoordinates={selectedWeatherCoords} />

      {/* Strategic Bridges & District Accessibility */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Strategic Bridges Card */}
        <div className="bg-white border border-[#D9DEE7] p-4 rounded-lg shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-[#0D9488]" />
                <h3 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                  STRATEGIC BRIDGES
                </h3>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">Operational status of critical monitored river crossings</p>
            </div>
            <span className="text-xs font-bold text-[#0F766E] bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
              {bridges.length} Monitored
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attentionBridges.slice(0, 4).map((brg) => (
              <div 
                key={brg.id}
                onClick={() => setSelectedAsset({ ...brg, asset_type: 'bridge' })}
                className={`p-3.5 rounded-md border space-y-1.5 transition cursor-pointer hover:shadow-sm ${
                  brg.status === 'CLOSED'
                    ? 'bg-rose-50 border-rose-300'
                    : brg.status === 'RESTRICTED' || brg.status === 'DAMAGED'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-teal-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#172033] truncate">{brg.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                    brg.status === 'OPERATIONAL' ? 'bg-emerald-50 text-[#047857] border-emerald-200' : 'bg-amber-100 text-[#B45309] border-amber-300'
                  }`}>
                    {brg.status || 'OPERATIONAL'}
                  </span>
                </div>
                <div className="text-xs text-[#475467]">
                  {brg.river_name} · {brg.district_name}, {brg.state}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#E2E8F0] text-xs">
                  <span className="text-[#667085]">Accessibility</span>
                  <strong className={`font-bold ${brg.accessibility_score < 40 ? 'text-[#BE123C]' : brg.accessibility_score < 75 ? 'text-[#B45309]' : 'text-[#047857]'}`}>
                    {brg.accessibility_score} / 100
                  </strong>
                </div>
                {brg.condition_description && (
                  <div className="text-xs text-[#475467] truncate">
                    {brg.condition_description}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* District Accessibility */}
        <div className="bg-white border border-[#D9DEE7] p-4 rounded-lg shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
            <div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#6D28D9]" />
                <h3 className="text-sm font-bold text-[#172033] uppercase tracking-wider">
                  DISTRICT ACCESSIBILITY
                </h3>
              </div>
              <p className="text-xs text-[#667085] mt-0.5">Accessibility scores based on current weather and road conditions</p>
            </div>
            <button
              onClick={() => setShowAllDistricts(!showAllDistricts)}
              className="text-xs font-bold text-[#6D28D9] hover:text-[#5B21B6] bg-purple-50 px-2.5 py-1 rounded border border-purple-200"
            >
              {showAllDistricts ? 'Show Prioritized' : 'View All Districts'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {displayDistricts.map((dist) => (
              <div 
                key={dist.id}
                onClick={() => setSelectedAsset({ ...dist, asset_type: 'district' })}
                className={`p-3.5 rounded-md border space-y-2 transition cursor-pointer hover:shadow-sm ${
                  dist.accessibility_index < 40 
                    ? 'bg-rose-50 border-rose-300' 
                    : dist.accessibility_index < 70 
                    ? 'bg-amber-50 border-amber-300' 
                    : 'bg-[#F8FAFC] border-[#E2E8F0] hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#172033] truncate">{dist.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-white text-[#475467] border border-[#D9DEE7]">
                    {dist.state}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#667085]">Accessibility</span>
                  <span className={`font-bold text-sm ${dist.accessibility_index < 40 ? 'text-[#BE123C]' : dist.accessibility_index < 70 ? 'text-[#B45309]' : 'text-[#047857]'}`}>
                    {dist.accessibility_index} / 100
                  </span>
                </div>
                <div className="w-full bg-[#E5E7EB] h-1.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${dist.accessibility_index < 40 ? 'bg-[#BE123C]' : dist.accessibility_index < 70 ? 'bg-[#D97706]' : 'bg-[#059669]'}`} 
                    style={{ width: `${dist.accessibility_index}%` }}
                  />
                </div>
                <div className="text-xs text-[#475467] flex items-center justify-between">
                  <span>Incidents: <strong className="text-[#172033]">{dist.active_incidents_count}</strong></span>
                  <span className="font-bold uppercase text-xs text-[#172033]">{dist.accessibility_index >= 75 ? 'GOOD' : dist.accessibility_index >= 40 ? 'MODERATE' : 'POOR'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Slide-over Panel for Selected Asset */}
      <AccessibilityDetailPanel 
        asset={selectedAsset} 
        onClose={() => setSelectedAsset(null)} 
        onReroute={triggerRerouteApproval}
      />

      {/* Reroute Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRerouteModal}
        title="Approve Alternate Route B Detour?"
        message="This action will update the delivery corridor trajectory from Guwahati ➔ Imphal via Silchar / Jiribam (NH-37). Revised ETA delay: +35 mins."
        confirmText="Approve Route"
        type="primary"
        loading={actionLoading}
        onConfirm={handleConfirmReroute}
        onCancel={() => setShowRerouteModal(false)}
      />
    </div>
  );
};

export default Dashboard;
