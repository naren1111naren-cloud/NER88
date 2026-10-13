import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  AlertTriangle, CheckCircle2, AlertCircle, ShieldAlert, ShieldCheck, 
  MapPin, CloudRain, Mountain, Navigation, Compass, Layers, 
  ChevronRight, ArrowRight, Activity, Clock, Database, Map as MapIcon,
  Check, Info
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function formatObservationTime(timestamp) {
  if (!timestamp) return 'Live';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      if (typeof timestamp === 'string' && timestamp.includes('T')) {
        const timePart = timestamp.split('T')[1]?.slice(0, 5);
        return `${timePart} IST`;
      }
      return timestamp;
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} IST`;
  } catch {
    return 'Live';
  }
}

// Auto-Fit Map View helper
const FitMapToBounds = ({ waypoints }) => {
  const map = useMap();
  useEffect(() => {
    if (map && waypoints && waypoints.length > 0) {
      try {
        const bounds = L.latLngBounds(waypoints);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
      } catch (err) {
        console.error('FitMapToBounds error:', err);
      }
    }
  }, [map, waypoints]);
  return null;
};

// Custom Marker Pin
const createMapPin = (label, color = '#15803D') => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto;">
        <div style="background: #FFFFFF; border: 1px solid #D5E4DB; border-radius: 4px; padding: 2px 6px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; color: #13261D; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.12); margin-bottom: 3px;">
          ${label}
        </div>
        <div style="width: 10px; height: 10px; background: ${color}; border: 2px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 6px ${color};"></div>
      </div>
    `,
    className: 'custom-segment-pin',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

export const RouteRiskAnalysisView = ({
  activeCorridor,
  weatherData,
  weatherLoading,
  weatherError,
  incidents = [],
  segmentRiskData = null,
  onSelectSegment
}) => {
  const { t } = useTranslation();
  const origin = activeCorridor?.from || 'Guwahati';
  const destination = activeCorridor?.to || 'Shillong';
  const hasLiveWeather = !!weatherData && !weatherError;
  const rainfallMmHr = hasLiveWeather
    ? (weatherData.rainfall_mm_hr ?? weatherData.precipitation_mm ?? weatherData.rain_mm ?? 0.0)
    : null;
  const weatherTimestamp = formatObservationTime(weatherData?.updated_at || weatherData?.observed_at || weatherData?.fetched_at);

  const [viewMode, setViewMode] = useState('visual');
  const [selectedSegId, setSelectedSegId] = useState(null);

  const emptySegment = {
    id: null,
    name: null,
    short_name: 'null',
    risk_level: 'LOW',
    risk_score: 0,
    reasons: [],
    reason_summary: 'No segment risk data',
    possible_impact: 'None',
    recommended_action: 'None',
    status_label: 'NO DATA',
    is_highest_risk: false
  };

  const segments = segmentRiskData?.segments || [];
  const highestSeg = segments.find(s => s.is_highest_risk) || segments.find(s => s.risk_level === 'HIGH') || segments[0] || emptySegment;

  useEffect(() => {
    if (!selectedSegId && highestSeg && highestSeg.id) {
      setSelectedSegId(highestSeg.id);
    }
  }, [highestSeg, selectedSegId]);

  const activeSeg = segments.find(s => s.id === selectedSegId) || highestSeg || emptySegment;

  const highCount = segmentRiskData?.high_risk_count ?? segments.filter(s => s.risk_level === 'HIGH').length;
  const cautionCount = segmentRiskData?.caution_count ?? segments.filter(s => s.risk_level === 'CAUTION').length;
  const normalCount = segmentRiskData?.normal_count ?? segments.filter(s => s.risk_level === 'LOW').length;

  let primaryStatus = segmentRiskData?.primary_status;
  if (!primaryStatus) {
    if (highCount === 1) primaryStatus = '1 HIGH-RISK SECTION DETECTED';
    else if (highCount > 1) primaryStatus = `${highCount} HIGH-RISK SECTIONS DETECTED`;
    else if (cautionCount > 0) primaryStatus = `${cautionCount} SECTIONS REQUIRE ATTENTION`;
    else primaryStatus = 'ALL SECTIONS CLEAR';
  }

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'HIGH':
        return {
          dot: 'bg-[#C62828]',
          text: 'text-[#C62828]',
          border: 'border-rose-300',
          bg: 'bg-rose-50',
          badge: 'bg-rose-50 border-rose-200 text-[#C62828]',
          hex: '#C62828'
        };
      case 'CAUTION':
        return {
          dot: 'bg-[#D98C00]',
          text: 'text-[#D98C00]',
          border: 'border-amber-300',
          bg: 'bg-amber-50',
          badge: 'bg-amber-50 border-amber-200 text-[#D98C00]',
          hex: '#D98C00'
        };
      default:
        return {
          dot: 'bg-[#198754]',
          text: 'text-[#198754]',
          border: 'border-emerald-300',
          bg: 'bg-emerald-50',
          badge: 'bg-emerald-50 border-emerald-200 text-[#198754]',
          hex: '#198754'
        };
    }
  };

  const waypoints = activeCorridor?.waypoints || [];
  const segmentWaypoints = [];
  if (waypoints.length >= 5) {
    const step = Math.floor(waypoints.length / 5);
    for (let i = 0; i < 5; i++) {
      const startIdx = i * step;
      const endIdx = (i === 4) ? waypoints.length : (i + 1) * step + 1;
      segmentWaypoints.push(waypoints.slice(startIdx, Math.min(waypoints.length, endIdx)));
    }
  }

  return (
    <div className="space-y-4 my-auto text-left text-[#13261D]">

      {/* ── TOP PRIMARY STATUS ALERT BANNER ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 sm:px-4 rounded-lg bg-white border border-[#D5E4DB] shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border ${highCount > 0 ? 'bg-rose-50 text-[#C62828] border-rose-200' : 'bg-amber-50 text-[#D98C00] border-amber-200'}`}>
            {primaryStatus}
          </span>
          <span className="text-xs text-[#3E5649] font-medium hidden md:inline">
            {activeCorridor?.route} ({activeCorridor?.dist})
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 self-end sm:self-center bg-[#F7FAF8] p-1 rounded-md border border-[#D5E4DB]">
          <button
            onClick={() => setViewMode('visual')}
            className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'visual' ? 'bg-[#0B3B24] text-white shadow-2xs' : 'text-[#3E5649] hover:text-[#13261D]'}`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{t('vulnerabilities.riskTrack', 'Risk Track')}</span>
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${viewMode === 'map' ? 'bg-[#0B3B24] text-white shadow-2xs' : 'text-[#3E5649] hover:text-[#13261D]'}`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{t('vulnerabilities.geospatialMap', 'GIS Map')}</span>
          </button>
        </div>
      </div>

      {/* ── ROUTE RISK TRACK VISUALIZATION ── */}
      {viewMode === 'visual' ? (
        <div className="bg-white border border-[#D5E4DB] rounded-lg p-5 shadow-xs space-y-4">
          
          {/* Origin & Destination */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-[#3E5649] block">{t('common.origin', 'ORIGIN')}</span>
              <span className="text-sm font-bold text-[#0B3B24] flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#15803D]" /> {origin}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-[#3E5649] block">{t('common.destination', 'DESTINATION')}</span>
              <span className="text-sm font-bold text-[#0B3B24] flex items-center gap-1 justify-end">
                {destination} <MapPin className="w-3.5 h-3.5 text-[#15803D]" />
              </span>
            </div>
          </div>

          {/* Continuous Multi-Color Route Risk Bar & Interactive Node Dots */}
          <div className="relative py-4 px-2">
            
            {/* Background Track Line */}
            <div className="absolute top-1/2 left-4 right-4 h-2 -translate-y-1/2 rounded-full overflow-hidden flex bg-[#EEF5F1]">
              {segments.map((s) => {
                return (
                  <div
                    key={s.id}
                    className="h-full flex-1"
                    style={{
                      backgroundColor: s.risk_level === 'HIGH' ? '#C62828' : (s.risk_level === 'CAUTION' ? '#D98C00' : '#198754')
                    }}
                  />
                );
              })}
            </div>

            {/* Interactive Segment Nodes */}
            <div className="relative flex items-center justify-between z-10">
              {segments.map((s) => {
                const isSelected = s.id === activeSeg.id;
                const isHigh = s.risk_level === 'HIGH';
                const color = getRiskColor(s.risk_level);

                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedSegId(s.id);
                      if (onSelectSegment) onSelectSegment(s);
                    }}
                    className="group relative flex flex-col items-center focus:outline-none cursor-pointer"
                  >
                    {/* Dot Marker */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] transition-all ${color.dot} text-white ${isSelected ? 'ring-3 ring-[#0B3B24] shadow-md scale-115' : 'shadow-xs hover:scale-105'}`}
                    >
                      {s.id}
                    </div>

                    {/* Segment Label */}
                    <div className="mt-2 text-center">
                      <span className={`text-[10px] sm:text-[11px] font-semibold block transition ${isSelected ? 'text-[#0B3B24] font-bold' : 'text-[#3E5649] group-hover:text-[#13261D]'}`}>
                        {s.short_name}
                      </span>
                      <span className={`text-[9px] font-bold tracking-wider uppercase block ${color.text}`}>
                        {s.status_label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Risk Legend */}
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-[#D5E4DB] text-xs">
            <div className="flex items-center gap-4">
              <span className="text-[#3E5649] font-bold uppercase">{t('vulnerabilities.routeRisk', 'STATUS')}:</span>
              <div className="flex items-center gap-1.5 text-[#198754] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#198754]" />
                <span>{t('common.lowRisk', 'Accessible')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#D98C00] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#D98C00]" />
                <span>{t('common.caution', 'Caution')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[#C62828] font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-[#C62828]" />
                <span>{t('common.highRisk', 'High Risk')}</span>
              </div>
            </div>

            <span className="text-[#3E5649] hidden sm:inline">
              {t('vulnerabilities.clickToInspect', 'Select any section to inspect risk factors')}
            </span>
          </div>

        </div>
      ) : (
        /* ── GEOSPATIAL MAP VIEW ── */
        <div className="w-full h-64 sm:h-72 rounded-lg border border-[#D5E4DB] relative isolate overflow-hidden shadow-xs bg-[#EEF5F1]">
          {waypoints.length > 0 ? (
            <MapContainer
              bounds={waypoints}
              zoom={8}
              scrollWheelZoom={false}
              dragging={true}
              className="w-full h-full"
            >
              <FitMapToBounds waypoints={waypoints} />
              
              <TileLayer
                attribution='Tiles &copy; Esri World Imagery'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />

              {segmentWaypoints.length > 0 ? (
                segmentWaypoints.map((segPts, i) => {
                  const seg = segments[i] || segments[0];
                  const segColor = getRiskColor(seg.risk_level);
                  const isHigh = seg.risk_level === 'HIGH';

                  return (
                    <Polyline
                      key={seg.id}
                      positions={segPts}
                      pathOptions={{
                        color: segColor.hex,
                        weight: isHigh ? 6 : 4,
                        opacity: 0.95,
                        lineCap: 'round',
                        lineJoin: 'round'
                      }}
                    />
                  );
                })
              ) : (
                <Polyline
                  positions={waypoints}
                  pathOptions={{
                    color: '#15803D',
                    weight: 4,
                    opacity: 0.95
                  }}
                />
              )}

              <Marker position={waypoints[0]} icon={createMapPin(`${origin} (Origin)`, '#198754')}>
                <Popup>
                  <div className="text-xs p-1">
                    <strong className="text-[#198754]">{origin}</strong> — Origin
                  </div>
                </Popup>
              </Marker>

              <Marker position={waypoints[waypoints.length - 1]} icon={createMapPin(`${destination} (Dest)`, '#15803D')}>
                <Popup>
                  <div className="text-xs p-1">
                    <strong className="text-[#15803D]">{destination}</strong> — Destination
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs text-[#3E5649]">
              Route coordinates unavailable
            </div>
          )}

          <div className="absolute top-3 left-3 z-[400] px-3 py-1 bg-white/95 border border-[#D5E4DB] rounded-md text-xs font-semibold text-[#0B3B24] shadow-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C62828]" />
            <span>{activeCorridor?.route} • High Risk in {activeSeg.short_name}</span>
          </div>
        </div>
      )}

      {/* ── SELECTED SEGMENT OPERATIONAL INTELLIGENCE PANEL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        
        {/* Left: High-Risk Area Banner & Primary Reason */}
        <div className="lg:col-span-7 bg-white border border-[#D5E4DB] rounded-lg p-5 flex flex-col justify-between shadow-xs space-y-3">
          
          <div className="flex items-center justify-between border-b border-[#D5E4DB] pb-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-[#3E5649] bg-[#F7FAF8] px-2 py-0.5 rounded border border-[#D5E4DB]">
                SECTION {activeSeg.id}
              </span>
              <span className="text-sm font-bold text-[#0B3B24] uppercase">
                {activeSeg.name !== undefined && activeSeg.name !== null ? activeSeg.name : 'null'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getRiskColor(activeSeg.risk_level).badge}`}>
                {activeSeg.status_label}
              </span>
            </div>
          </div>

          {/* Causal Reason */}
          <div className="p-3 rounded-md bg-[#F7FAF8] border border-[#D5E4DB] space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-[#3E5649] font-bold">
              {t('vulnerabilities.whyRisky', 'OPERATIONAL CONSTRAINT REASON')}
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#0B3B24]">
              {activeSeg.reason_summary.toUpperCase()}
            </div>
            
            <div className="flex flex-wrap gap-1.5 pt-1">
              {activeSeg.reasons.map((r, i) => (
                <span key={i} className="text-xs font-medium text-[#13261D] bg-white px-2 py-0.5 rounded border border-[#D5E4DB]">
                  {r}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-[#3E5649] block">
              {t('vulnerabilities.possibleImpact', 'POSSIBLE IMPACT')}
            </span>
            <p className="text-[#3E5649] font-medium">
              • {activeSeg.possible_impact}
            </p>
          </div>

        </div>

        {/* Right: Operational Recommendation & Numerical Risk Gauge */}
        <div className="lg:col-span-5 bg-white border border-[#D5E4DB] rounded-lg p-5 flex flex-col justify-between shadow-xs space-y-3">
          
          <div className="border-b border-[#D5E4DB] pb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-[#3E5649] font-bold">
              {t('vulnerabilities.recommendedAction', 'RECOMMENDED ACTION')}
            </span>
            <span className="text-xs text-[#3E5649]">
              Score: <strong className="text-[#13261D]">{activeSeg.risk_score} / 100</strong>
            </span>
          </div>

          {/* Operational Directive */}
          <div className={`p-3.5 rounded-md border space-y-1 ${activeSeg.risk_level === 'HIGH' ? 'bg-rose-50 border-rose-200 text-[#C62828]' : (activeSeg.risk_level === 'CAUTION' ? 'bg-amber-50 border-amber-200 text-[#D98C00]' : 'bg-emerald-50 border-emerald-200 text-[#198754]')}`}>
            <div className="text-xs uppercase font-bold tracking-wider">
              {t('vulnerabilities.whatShouldIDo', 'DIRECTIVE')}
            </div>
            <div className="text-sm sm:text-base font-bold">
              {activeSeg.recommended_action.toUpperCase()}
            </div>
            <p className="text-xs text-[#3E5649] font-normal leading-relaxed pt-1">
              {activeSeg.risk_level === 'HIGH'
                ? 'Check alternative routing options before freight dispatch to avoid potential transit delay.'
                : (activeSeg.risk_level === 'CAUTION'
                  ? 'Maintain convoy spacing and monitor real-time weather & speed limits.'
                  : 'Corridor reports clear clearance. Proceed according to standard schedule.')}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#D5E4DB] text-xs text-[#3E5649]">
            <span>{normalCount} {t('vulnerabilities.sectionsNormal', 'sections clear')}</span>
            <span>{highCount + cautionCount} {t('vulnerabilities.requireAttention', 'sections constrained')}</span>
          </div>

        </div>

      </div>

      {/* ── BOTTOM HUD ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#3E5649]">
        <div className="flex items-center gap-2">
          <span>{t('accessibility.dataQuality', 'DATA QUALITY')}: <strong className="text-[#198754]">HIGH</strong></span>
          <span>•</span>
          <span>Open-Meteo • OpenStreetMap • State Transport Feeds</span>
        </div>
        <div>
          {t('common.updated', 'Last updated')}: <strong className="text-[#13261D]">{weatherTimestamp}</strong>
        </div>
      </div>

    </div>
  );
};

export default RouteRiskAnalysisView;
