import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { NER3DMap } from '../components/map3d/NER3DMap';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useDemo } from '../context/DemoContext';
import { useToast } from '../context/ToastContext';
import { useAlertStream } from '../context/AlertStreamContext';
import { 
  NerHeader, NerButton, NerStatus, NerMetric, 
  NerCriticalAlert, NerPanel, NerWeatherCard, NerIncidentVisual 
} from '../components/ner';
import { 
  Compass, AlertTriangle, Truck, CloudRain, Clock, ArrowRight, 
  CheckCircle2, ShieldAlert, Sliders, Check, Eye, RefreshCw, 
  Play, Loader2, Radio, Navigation, FileCheck, Info, X
} from 'lucide-react';

/**
 * NER88 Command Center
 */
export const Dashboard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { liveVehicles } = useAlertStream();

  const { 
    isDemoMode, 
    scenarioStep,
    startMasterScenario,
    disruptMasterScenario,
    fieldConfirmMasterScenario,
    rerouteApproveMasterScenario,
    telemetryAdvanceMasterScenario,
    deliverMasterScenario,
    resetMasterScenario,
    activeStepAction,
    isScenarioRunning,
    scenarioTimeline
  } = useDemo();

  // Operational Telemetry States
  const [vehicles, setVehicles] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [corridors, setCorridors] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showRerouteModal, setShowRerouteModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState('21:08 IST');
  const [refreshing, setRefreshing] = useState(false);


  // Active delivery for route rendering (prefer MED-102 or DEL-2026-001)
  const activeDelivery = deliveries.find(d => d.delivery_code === 'MED-102') 
    || deliveries.find(d => d.delivery_code === 'DEL-2026-001') 
    || deliveries[0];

  const safeParseWaypoints = (path) => {
    if (!path) return [];
    if (Array.isArray(path)) return path;
    try {
      const res = typeof path === 'string' ? JSON.parse(path) : path;
      return Array.isArray(res) ? res : [];
    } catch {
      return [];
    }
  };

  const primaryRouteWaypoints = safeParseWaypoints(activeDelivery?.active_route_path);
  const alternateRouteWaypoints = safeParseWaypoints(activeDelivery?.alternate_route_path);

  // Featured Incident (Derived from real incidents or selected asset; null if no data)
  const activeIncident = selectedAsset || (incidents && incidents.length > 0 ? {
    incident_code: incidents[0].incident_code || `INC-${incidents[0].id}`,
    name: incidents[0].name || incidents[0].incident_type,
    corridor: incidents[0].corridor || incidents[0].location_name,
    location: incidents[0].location_name,
    state: incidents[0].district_name || 'Northeast',
    status: incidents[0].road_status || 'BLOCKED',
    severity: incidents[0].severity || 'CRITICAL',
    delay: incidents[0].estimated_delay_mins ? `+${incidents[0].estimated_delay_mins}m` : null,
    vehicles_affected: incidents[0].vehicles_affected || null,
    coordinates: [incidents[0].latitude, incidents[0].longitude],
    explanation: incidents[0].description
  } : {
    incident_code: null,
    name: null,
    corridor: null,
    location: null,
    state: null,
    status: 'NO_ACTIVE_INCIDENTS',
    severity: null,
    delay: null,
    vehicles_affected: null,
    coordinates: null,
    explanation: null
  });

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [vehRes, incRes, delRes, distRes, corRes, brgRes] = await Promise.all([
        api.get('/vehicles').catch(() => ({ data: [] })),
        api.get('/incidents').catch(() => ({ data: [] })),
        api.get('/deliveries').catch(() => ({ data: [] })),
        api.get('/accessibility/districts').catch(() => ({ data: [] })),
        api.get('/accessibility/roads').catch(() => ({ data: [] })),
        api.get('/accessibility/bridges').catch(() => ({ data: [] }))
      ]);

      if (vehRes.data) setVehicles(safeArray(vehRes.data));
      if (incRes.data) setIncidents(safeArray(incRes.data));
      if (delRes.data) setDeliveries(safeArray(delRes.data));
      if (distRes.data) setDistricts(safeArray(distRes.data));
      if (corRes.data) setCorridors(safeArray(corRes.data));
      if (brgRes.data && Array.isArray(brgRes.data)) setBridges(brgRes.data);
      setLastUpdateTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' IST');
    } catch (err) {
      console.warn('Command Center telemetry sync warning:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 20000);

    const handleDemoEvent = () => fetchData();
    window.addEventListener('sih_demo_triggered', handleDemoEvent);
    window.addEventListener('sih_demo_reset', handleDemoEvent);

    return () => {
      clearInterval(timer);
      window.removeEventListener('sih_demo_triggered', handleDemoEvent);
      window.removeEventListener('sih_demo_reset', handleDemoEvent);
    };
  }, []);

  const handleConfirmReroute = async () => {
    setActionLoading(true);
    try {
      const targetId = activeDelivery?.id || 1;
      await api.post(`/deliveries/${targetId}/reroute`);
      rerouteApproveMasterScenario();
      fetchData();
      showToast('Detour approved: Alternate bypass corridor activated for affected freight.', 'success');
    } catch {
      rerouteApproveMasterScenario();
      showToast('Detour selected: Alternate route engaged.', 'info');
    } finally {
      setActionLoading(false);
      setShowRerouteModal(false);
    }
  };

  return (
    <div className="space-y-3.5 pb-8 font-sans text-ner-text select-none">
      
      {/* ── 4. HERO WORKSPACE: 65-70% GIS HERO MAP + CONTEXTUAL INSPECTOR ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* Dominant GIS Map Container (~68% width on desktop) */}
        <div className="lg:col-span-8 flex flex-col space-y-2">
          <div className="bg-white border border-ner-border rounded-lg shadow-xs h-[560px] lg:h-[620px] relative overflow-hidden flex flex-col">
            <NER3DMap
              vehicles={vehicles}
              incidents={incidents}
              bridges={bridges}
              corridors={corridors}
              districts={districts}
              primaryRoute={primaryRouteWaypoints}
              alternateRoute={alternateRouteWaypoints}
              liveVehicleOverrides={liveVehicles}
              selectedAsset={selectedAsset}
              isFocusMode={isFocusMode}
              onSelectAsset={(asset) => setSelectedAsset(asset)}
              onSelectIncident={(inc) => setSelectedAsset(inc)}
              onSelectVehicle={(veh) => setSelectedAsset(veh)}
              onToggleFocus={() => setIsFocusMode(!isFocusMode)}
              onViewRoute={() => setIsFocusMode(true)}
              onReroute={() => setShowRerouteModal(true)}
            />
          </div>

          {/* Map Layer Status Footer */}
          <div className="bg-white border border-ner-border rounded-md px-3 py-1.5 flex items-center justify-between text-xs text-ner-muted">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-ner-text">{t('map.layersActive', 'Layers Active:')}</span>
              <span>{t('commandCenter.gisFooterStates', '8 States · Monitored Corridors · Live Fleet · Risk Zones')}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span>EPSG:4326</span>
              <span>·</span>
              <span>{t('commandCenter.gisFooterSource', 'Survey of India / NHAI GIS')}</span>
            </div>
          </div>
        </div>

        {/* Contextual Intelligence & Action Rail (~32% width on desktop) */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          
          {/* ── CONTEXTUAL DISRUPTION INSPECTOR ── */}
          <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs flex flex-col space-y-3">
            <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-extrabold text-ner-primary">
                  {activeIncident.incident_code || 'null'}
                </span>
                <span className="text-[11px] text-ner-muted font-medium">· {t('commandCenter.disruptionInspector', 'Disruption Inspector')}</span>
              </div>
              <NerStatus
                status={activeIncident.status || 'OPEN'}
                size="sm"
              />
            </div>

            {/* Large Incident Icon + Title + Severity */}
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-lg bg-ner-background border border-ner-border flex items-center justify-center text-3xl shrink-0 shadow-2xs" role="img" aria-hidden="true">
                <NerIncidentVisual type={activeIncident.name || 'default'} size="md" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <h3 className="font-extrabold text-sm text-ner-primary uppercase tracking-tight truncate">
                    {activeIncident.name !== undefined ? (activeIncident.name === null ? 'null' : activeIncident.name) : 'null'}
                  </h3>
                  <span className="text-[10.5px] font-black text-ner-blocked shrink-0 px-1.5 py-0.5 rounded bg-ner-blocked-bg border border-ner-blocked-border">
                    {activeIncident.severity || 'NONE'}
                  </span>
                </div>
                <div className="text-xs text-ner-text-secondary mt-0.5 flex items-center gap-1 truncate font-medium">
                  <span role="img" aria-label="Location">📍</span>
                  <span>{activeIncident.location || 'null'}</span>
                </div>
              </div>
            </div>

            {/* Compact Values (No Text Walls) */}
            <div className="grid grid-cols-2 gap-2 bg-ner-background p-2.5 rounded-md border border-ner-border text-xs">
              <div>
                <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                  <span>🛣️</span>
                  <span>{t('common.corridor', 'Corridor')}</span>
                </span>
                <div className="font-extrabold text-ner-primary mt-0.5">
                  {activeIncident.corridor || 'null'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                  <span>⏱️</span>
                  <span>{t('commandCenter.estimatedDelay', 'Estimated Delay')}</span>
                </span>
                <div className="font-black text-ner-blocked mt-0.5">
                  {activeIncident.delay || 'null'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                  <span>🚛</span>
                  <span>{t('commandCenter.fleetAffected', 'Fleet Affected')}</span>
                </span>
                <div className="font-extrabold text-ner-text mt-0.5">
                  {activeIncident.vehicles_affected !== null ? `${activeIncident.vehicles_affected} ${t('common.fleet', 'vehicles')}` : 'null'}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-ner-muted uppercase font-bold flex items-center gap-1">
                  <span>🚦</span>
                  <span>{t('common.accessibility', 'Accessibility')}</span>
                </span>
                <div className="font-extrabold text-ner-restricted mt-0.5">
                  {activeIncident.status || 'null'}
                </div>
              </div>
            </div>

            {/* Clear Action Triggers */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <NerButton
                variant="outline"
                size="sm"
                onClick={() => {
                  if (activeIncident && activeIncident.name !== null) {
                    setSelectedAsset(activeIncident);
                    setIsFocusMode(true);
                  }
                }}
                icon={Eye}
              >
                {t('common.viewOnMap', 'VIEW ON MAP')}
              </NerButton>

              <NerButton
                variant="primary"
                size="sm"
                onClick={() => setShowRerouteModal(true)}
                icon={Compass}
              >
                {t('common.reroute', 'REROUTE')}
              </NerButton>
            </div>
          </div>

          {/* ── REGIONAL ACCESSIBILITY MODULE ── */}
          <div className="bg-white border border-ner-border rounded-lg p-3.5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
              <div>
                <span className="text-xs font-bold text-ner-primary uppercase tracking-wider block">
                  {t('accessibility.title', 'Regional Accessibility')}
                </span>
                <span className="text-[11px] text-ner-muted font-medium">{t('accessibility.deterministicScoring', 'Deterministic Multi-Factor Scoring')}</span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-ner-primary">68</span>
                <span className="text-xs text-ner-muted font-bold"> / 100</span>
              </div>
            </div>

            {/* Semantic Status Distribution */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
              <div className="p-2 rounded bg-ner-open-bg border border-ner-open-border">
                <div className="text-[10px] text-ner-open font-extrabold uppercase">🟢 {t('status.open', 'OPEN')}</div>
                <div className="text-base font-black text-ner-open mt-0.5">68%</div>
              </div>
              <div className="p-2 rounded bg-ner-restricted-bg border border-ner-restricted-border">
                <div className="text-[10px] text-ner-restricted font-extrabold uppercase">🟠 {t('status.restricted', 'RESTRICTED')}</div>
                <div className="text-base font-black text-ner-restricted mt-0.5">21%</div>
              </div>
              <div className="p-2 rounded bg-ner-blocked-bg border border-ner-blocked-border">
                <div className="text-[10px] text-ner-blocked font-extrabold uppercase">🔴 {t('status.blocked', 'BLOCKED')}</div>
                <div className="text-base font-black text-ner-blocked mt-0.5">11%</div>
              </div>
            </div>

            {/* Explainable Factor: WHY? */}
            <div className="bg-ner-background p-2.5 rounded-md border border-ner-border text-xs space-y-1.5">
              <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-ner-muted block">
                {t('accessibility.whyScore', 'WHY IS THE SCORE {{score}} / 100?', { score: 68 })}
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold">
                  <span role="img" aria-label="Rain">🌧️</span>
                  <span>{t('weather.heavyRain', 'Heavy rainfall')}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                  <span role="img" aria-label="Incidents">⚠️</span>
                  <span>{t('accessibility.activeIncidentsCount', '3 active incidents', { count: 3 })}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 text-[11px] font-semibold">
                  <span role="img" aria-label="Landslide">⛰️</span>
                  <span>{t('accessibility.landslideCount', '1 landslide', { count: 1 })}</span>
                </span>
              </div>
            </div>
          </div>

          {/* ── OPERATIONAL WEATHER RISK MODULE ── */}
          <NerWeatherCard
            condition="heavy_rain"
            temperature="28°C"
            riskLevel="HIGH"
            location="Sikkim · East Khasi Hills"
            roadImpact="RESTRICTED"
            fleetAffected={12}
            corridor="NH-10"
            onInspectRoute={() => navigate('/routes')}
          />

        </div>

      </div>

      {/* ── 2. TOP CRITICAL OPERATIONAL ALERT BANNER ── */}
      <NerCriticalAlert
        corridor={criticalIncident.corridor}
        hazard={criticalIncident.name}
        location={criticalIncident.location}
        affectedVehicles={criticalIncident.vehicles_affected}
        estimatedDelay={criticalIncident.delay}
        severity="CRITICAL"
        onViewIncident={() => {
          setSelectedAsset(criticalIncident);
          setIsFocusMode(true);
          showToast(`Focusing on ${criticalIncident.corridor} disruption.`, 'info');
        }}
        onReroute={() => setShowRerouteModal(true)}
      />

      {/* ── 1. PAGE HEADER ── */}
      <NerHeader
        title={t('commandCenter.title', 'Command Center')}
        subtitle={t('commandCenter.subtitle', 'Regional Logistics Intelligence & Disruption Decision Support Platform')}
        badge={t('commandCenter.heroBadge', 'Northeast Operational Grid')}
        lastUpdated={lastUpdateTime}
        onRefresh={fetchData}
      />

      {/* ── 5. INLINE OPERATIONAL METRICS STRIP WITH LARGE ICONS ── */}
      <div className="bg-white border border-ner-border rounded-lg p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-ner-border">
          
          <div className="sm:px-3 first:pl-0">
            <NerMetric
              visualIcon="🛣️"
              label={t('commandCenter.networkAccessible', 'Network Accessible')}
              value="68%"
              supporting="28 Trunk Corridors"
              variant="open"
            />
          </div>

          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="⚠️"
              label={t('commandCenter.restrictedCorridors', 'Restricted Corridors')}
              value="21%"
              supporting="Rain & axle watch"
              variant="restricted"
            />
          </div>

          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🚧"
              label={t('commandCenter.blockedCorridors', 'Blocked Corridors')}
              value="11%"
              supporting="NH-10, NH-6 Hazards"
              variant="blocked"
            />
          </div>

          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="⚠️"
              label={t('commandCenter.activeDisruptions', 'Active Incidents')}
              value={incidents.length || 7}
              supporting="1 Critical · 3 Watch"
              variant="default"
              onClick={() => navigate('/incidents')}
            />
          </div>

          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="🚛"
              label={t('commandCenter.vehiclesTracked', 'Vehicles Tracked')}
              value={vehicles.length || 23}
              supporting="VAHAN / Telemetry"
              variant="info"
              onClick={() => navigate('/vehicles')}
            />
          </div>

          <div className="pt-3 sm:pt-0 sm:px-3">
            <NerMetric
              visualIcon="⏱️"
              label={t('commandCenter.avgDelay', 'Average Delay')}
              value="+18 min"
              supporting="Detours active"
              variant="restricted"
            />
          </div>

        </div>
      </div>

      {/* ── 6. REROUTE CONFIRMATION MODAL ── */}
      <ConfirmationModal
        isOpen={showRerouteModal}
        title={t('commandCenter.rerouteModalTitle', 'Approve Alternative Route Detour?')}
        message={t('commandCenter.rerouteModalDesc', 'Divert heavy freight from NH-10 (Sevoke Landslide Hazard) to Alternative Bypass Corridor NH-37 / NH-106. Estimated net delay savings: 1h 45m.')}
        confirmText={t('commandCenter.dispatchDetour', 'Dispatch Detour Recommendation')}
        type="primary"
        loading={actionLoading}
        onConfirm={handleConfirmReroute}
        onCancel={() => setShowRerouteModal(false)}
      />

    </div>
  );
};

export default Dashboard;

