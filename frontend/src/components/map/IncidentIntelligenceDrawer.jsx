import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  X, AlertTriangle, ShieldCheck, Clock, CloudRain, Truck, 
  MapPin, Activity, ArrowRight, Ban, Info, Database,
  Navigation, Waves, ChevronDown, ChevronUp, Eye, EyeOff,
  CheckCircle2, ShieldAlert, Sliders, ExternalLink,
  Layers, RefreshCw, Compass
} from 'lucide-react';

// Helper component for animated number count-up transition
const AnimatedNumber = ({ value, duration = 0.6, className = '' }) => {
  const [displayVal, setDisplayVal] = useState(0);

  useEffect(() => {
    const num = typeof value === 'number' ? value : parseInt(value, 10);
    if (isNaN(num)) {
      setDisplayVal(value);
      return;
    }

    let start = 0;
    const end = num;
    const stepTime = Math.max(10, Math.floor((duration * 1000) / Math.max(1, Math.abs(end))));
    const timer = setInterval(() => {
      start += (end - start > 0 ? 1 : -1) * Math.max(1, Math.ceil(Math.abs(end - start) / 8));
      if ((end >= 0 && start >= end) || (end < 0 && start <= end)) {
        setDisplayVal(end);
        clearInterval(timer);
      } else {
        setDisplayVal(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span className={className}>{displayVal}</span>;
};

export const IncidentIntelligenceDrawer = ({
  asset,
  onClose,
  onReroute,
  onViewRoute,
  onToggleFocus,
  isFocused = false,
  weatherData = null,
  activeDelivery = null
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showTimeline, setShowTimeline] = useState(false);
  const [showEvidence, setShowEvidence] = useState(true);

  if (!asset) return null;

  const isIncident = asset.asset_type === 'Incident' || (!asset.asset_type && (asset.incident_code || asset.incident_type || asset.severity));
  const isVehicle = asset.asset_type === 'Vehicle' || asset.vehicle_code;
  const isBridge = asset.asset_type === 'Bridge' || asset.bridge_code;
  const isDistrict = asset.asset_type === 'District' || (asset.state && !asset.corridor_code);
  const isCorridor = asset.asset_type === 'Corridor' || asset.corridor_code;

  // Derive standardized values
  const severity = (asset.severity || (asset.risk_level === 'CRITICAL' ? 'CRITICAL' : asset.risk_level === 'HIGH' ? 'HIGH' : 'MODERATE')).toUpperCase();
  const locationName = asset.location || asset.location_name || asset.name || 'North-East Logistics Corridor';
  const incidentType = (asset.incident_type || (asset.name?.toLowerCase().includes('landslide') ? 'LANDSLIDE' : 'ROAD_HAZARD')).toUpperCase();
  const description = asset.factor_summary || asset.explanation || asset.description || asset.reason || asset.condition_description || 'Active road restriction reported along transit corridor.';
  
  // Scores
  const currentAccessibility = asset.accessibility_score !== undefined ? Math.round(Number(asset.accessibility_score)) : (severity === 'CRITICAL' ? 42 : severity === 'HIGH' ? 55 : 82);
  const beforeAccessibility = asset.before_accessibility ?? (severity === 'CRITICAL' ? 78 : 88);
  
  const currentRisk = asset.risk_score ?? (severity === 'CRITICAL' ? 82 : severity === 'HIGH' ? 65 : 24);
  const beforeRisk = asset.before_risk ?? (severity === 'CRITICAL' ? 34 : 20);

  // Operational Impacts
  const vehiclesAffected = asset.vehicles_affected ?? (severity === 'CRITICAL' ? 4 : 2);
  const shipmentsDelayed = asset.shipments_delayed ?? (severity === 'CRITICAL' ? 2 : 1);
  const estimatedDelayMins = asset.estimated_delay_mins ?? (severity === 'CRITICAL' ? 35 : 15);
  const affectedRouteName = asset.affected_route || asset.connected_road || asset.corridor_code || (locationName.includes('NH-37') ? 'NH-37' : locationName.includes('NH-27') ? 'NH-27' : 'NH-29');
  const roadStatus = (asset.accessibility_status || asset.road_status || (currentAccessibility === 0 ? 'BLOCKED' : currentAccessibility < 70 ? 'RESTRICTED' : 'OPEN')).toUpperCase();

  // Environmental Evidence
  const rainfallRate = weatherData?.rainfall_mm_hr ?? (severity === 'CRITICAL' ? 75 : 12);
  const visibilityDist = weatherData?.visibility_km ?? 9.3;

  // Timeline events
  const timelineEvents = asset.timeline && Array.isArray(asset.timeline) ? asset.timeline : [
    { time: '10:02', title: 'Precipitation telemetry recorded', desc: `${rainfallRate} mm/hr monsoon rainfall recorded` },
    { time: '10:08', title: 'Slope instability threshold reached', desc: 'Geotechnical telemetry signal threshold alert' },
    { time: '10:12', title: `${incidentType} verified`, desc: `Road segment obstructed at ${locationName}` },
    { time: '10:14', title: 'Accessibility recalculated', desc: `Accessibility score adjusted to ${currentAccessibility}/100` },
    { time: '10:16', title: 'Operational impact mapped', desc: `${vehiclesAffected} vehicles and ${shipmentsDelayed} shipments queued` },
    { time: '10:18', title: 'Alternative route recommendation ready', desc: 'Alternate Route B via Silchar / Jiribam calculated' }
  ];

  // Severity color tokens for light theme
  const getSeverityStyle = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return {
          badge: 'bg-[#C62828]/10 text-[#C62828] border-[#C62828]/30',
          dot: 'bg-[#C62828]',
          accent: 'text-[#C62828]',
          border: 'border-[#C62828]/30',
          headerBg: 'bg-[#C62828]/5'
        };
      case 'HIGH':
      case 'MODERATE':
      case 'MEDIUM':
        return {
          badge: 'bg-[#D99A00]/10 text-[#D99A00] border-[#D99A00]/30',
          dot: 'bg-[#D99A00]',
          accent: 'text-[#D99A00]',
          border: 'border-[#D99A00]/30',
          headerBg: 'bg-[#D99A00]/5'
        };
      default:
        return {
          badge: 'bg-[#16834B]/10 text-[#16834B] border-[#16834B]/30',
          dot: 'bg-[#16834B]',
          accent: 'text-[#16834B]',
          border: 'border-[#16834B]/30',
          headerBg: 'bg-[#16834B]/5'
        };
    }
  };

  const sevStyle = getSeverityStyle(severity);

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="fixed inset-y-0 right-0 z-[1000] w-full max-w-md bg-white border-l border-[#D9E0E7] shadow-xl flex flex-col font-sans text-[#17202A]"
        aria-label="Incident and Asset Intelligence Drawer"
      >
        {/* ── 1. HEADER (SEVERITY + LOCATION + ASSET TYPE) ── */}
        <div className={`p-4 sm:p-5 border-b border-[#D9E0E7] flex items-start justify-between gap-3 ${sevStyle.headerBg}`}>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border flex items-center gap-1.5 ${sevStyle.badge}`}>
                <span className={`w-2 h-2 rounded-full ${sevStyle.dot}`} />
                <span>{severity === 'CRITICAL' ? '■ CRITICAL' : severity === 'HIGH' ? '! WARNING' : '▲ WATCH'} {isIncident ? 'INCIDENT' : asset.asset_type || 'ASSET'}</span>
              </span>

              {asset.incident_code && (
                <span className="text-[11px] font-mono text-[#5B6570] bg-[#F6F8FA] px-2 py-0.5 rounded border border-[#D9E0E7]">
                  {asset.incident_code}
                </span>
              )}

              {isFocused && (
                <span className="text-[11px] font-bold text-[#185A8D] bg-[#185A8D]/10 border border-[#185A8D]/30 px-2 py-0.5 rounded flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-[#185A8D]" /> FOCUS ACTIVE
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-[#0B2744] tracking-tight line-clamp-1">
              {locationName}
            </h2>

            <div className="flex items-center gap-2 text-xs text-[#5B6570]">
              <span className="font-bold text-[#123B66] uppercase tracking-wide">
                {incidentType}
              </span>
              <span>•</span>
              <span className="text-[#5B6570] flex items-center gap-1 truncate">
                <MapPin className="w-3.5 h-3.5 text-[#185A8D] shrink-0" />
                {asset.district_name || asset.district || asset.state || 'North-East Region'}
              </span>
            </div>

            <p className="text-xs text-[#5B6570] pt-0.5 leading-relaxed font-normal">
              {description}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#5B6570] hover:text-[#17202A] border border-[#D9E0E7] transition cursor-pointer shrink-0"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── BODY SCROLLABLE INTELLIGENCE CONTENT ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs scrollbar-thin">
          
          {/* ── 2. METRICS (ACCESSIBILITY & RISK BEFORE VS CURRENT) ── */}
          <div className="grid grid-cols-2 gap-3">
            {/* Accessibility Card */}
            <div className="bg-[#F6F8FA] border border-[#D9E0E7] p-3.5 rounded-[8px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">
                  ACCESSIBILITY
                </span>
                <span className="text-[10px] font-mono text-[#5B6570]">
                  Before <strong className="text-[#17202A]">{beforeAccessibility}</strong>
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <AnimatedNumber 
                  value={currentAccessibility} 
                  className={`text-3xl font-black font-mono ${
                    currentAccessibility < 50 ? 'text-[#C62828]' : currentAccessibility < 75 ? 'text-[#D99A00]' : 'text-[#16834B]'
                  }`}
                />
                <span className="text-xs text-[#5B6570] font-semibold">/ 100</span>
              </div>

              {/* Delta indicator */}
              <div className="flex items-center justify-between text-[10px] text-[#5B6570] pt-1 border-t border-[#D9E0E7]">
                <span>Impact Delta:</span>
                <span className="font-mono font-bold text-[#C62828]">
                  -{beforeAccessibility - currentAccessibility} pts
                </span>
              </div>
            </div>

            {/* Risk Card */}
            <div className="bg-[#F6F8FA] border border-[#D9E0E7] p-3.5 rounded-[8px] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">
                  RISK SCORE
                </span>
                <span className="text-[10px] font-mono text-[#5B6570]">
                  Before <strong className="text-[#17202A]">{beforeRisk}</strong>
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <AnimatedNumber 
                  value={currentRisk} 
                  className={`text-3xl font-black font-mono ${
                    currentRisk >= 70 ? 'text-[#C62828]' : currentRisk >= 40 ? 'text-[#D99A00]' : 'text-[#16834B]'
                  }`}
                />
                <span className="text-xs text-[#5B6570] font-semibold">/ 100</span>
              </div>

              {/* Delta indicator */}
              <div className="flex items-center justify-between text-[10px] text-[#5B6570] pt-1 border-t border-[#D9E0E7]">
                <span>Threat Surge:</span>
                <span className="font-mono font-bold text-[#C62828]">
                  +{currentRisk - beforeRisk} pts
                </span>
              </div>
            </div>
          </div>

          {/* ── 3. OPERATIONAL IMPACT SECTION ── */}
          <div className="bg-[#F6F8FA] border border-[#D9E0E7] p-4 rounded-[8px] space-y-3">
            <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-2">
              <span className="text-[11px] font-bold text-[#0B2744] uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#185A8D]" />
                OPERATIONAL IMPACT
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                roadStatus === 'BLOCKED' ? 'bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/30' : 'bg-[#D99A00]/10 text-[#D99A00] border border-[#D99A00]/30'
              }`}>
                {roadStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="bg-white p-2.5 rounded-[6px] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px] uppercase font-semibold">Vehicles Affected</span>
                <strong className="text-[#17202A] text-sm font-mono">{vehiclesAffected} Active</strong>
              </div>

              <div className="bg-white p-2.5 rounded-[6px] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px] uppercase font-semibold">Delayed Shipments</span>
                <strong className="text-[#D99A00] text-sm font-mono">{shipmentsDelayed} Consignments</strong>
              </div>

              <div className="bg-white p-2.5 rounded-[6px] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px] uppercase font-semibold">Estimated Delay</span>
                <strong className="text-[#D99A00] text-sm font-mono">+{estimatedDelayMins} min</strong>
              </div>

              <div className="bg-white p-2.5 rounded-[6px] border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px] uppercase font-semibold">Affected Corridor</span>
                <strong className="text-[#185A8D] text-sm font-mono">{affectedRouteName}</strong>
              </div>
            </div>
          </div>

          {/* ── 4. EVIDENCE & CONDITIONS ── */}
          <div className="bg-[#F6F8FA] border border-[#D9E0E7] p-4 rounded-[8px] space-y-2.5">
            <div 
              onClick={() => setShowEvidence(!showEvidence)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-[11px] font-bold text-[#0B2744] uppercase tracking-wider flex items-center gap-1.5">
                <CloudRain className="w-3.5 h-3.5 text-[#185A8D]" />
                ENVIRONMENTAL & SENSOR TELEMETRY
              </span>
              {showEvidence ? <ChevronUp className="w-3.5 h-3.5 text-[#5B6570]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#5B6570]" />}
            </div>

            {showEvidence && (
              <div className="space-y-2 pt-1 border-t border-[#D9E0E7]">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between bg-white p-2 rounded-[6px] border border-[#D9E0E7]">
                    <span className="text-[#5B6570]">Precipitation:</span>
                    <strong className="text-[#D99A00] font-mono">{rainfallRate} mm/hr</strong>
                  </div>
                  <div className="flex items-center justify-between bg-white p-2 rounded-[6px] border border-[#D9E0E7]">
                    <span className="text-[#5B6570]">Visibility:</span>
                    <strong className="text-[#17202A] font-mono">{visibilityDist} km</strong>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-[6px] border border-[#D9E0E7] text-[11px] text-[#5B6570]">
                  <span className="text-[#0B2744] block text-[10px] font-bold uppercase mb-0.5">Physical Roadway Status</span>
                  <span>{roadStatus === 'BLOCKED' ? 'Debris and slope displacement blocking transit corridor.' : 'Restricted single-lane clearance active.'}</span>
                </div>

                {asset.data_sources && (Array.isArray(asset.data_sources) ? asset.data_sources.length > 0 : Boolean(asset.data_sources)) && (
                  <div className="bg-white p-2.5 rounded-[6px] border border-[#D9E0E7] text-[11px] space-y-1">
                    <span className="text-[#0B2744] block text-[10px] font-bold uppercase">Contributing Data Sources</span>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(asset.data_sources) ? asset.data_sources : [asset.data_sources]).map((src, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-[#F0FDF4] text-[#16834B] border border-[#BBF7D0] text-[9.5px] font-medium">
                          ✓ {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 5. INCIDENT TIMELINE (EXPANDABLE) ── */}
          <div className="bg-[#F6F8FA] border border-[#D9E0E7] p-4 rounded-[8px] space-y-2.5">
            <div 
              onClick={() => setShowTimeline(!showTimeline)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-[11px] font-bold text-[#0B2744] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#185A8D]" />
                INCIDENT TIMELINE
              </span>
              <div className="flex items-center gap-1 text-[10px] text-[#185A8D] font-semibold">
                <span>{showTimeline ? 'Hide' : 'Expand'}</span>
                {showTimeline ? <ChevronUp className="w-3.5 h-3.5 text-[#5B6570]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#5B6570]" />}
              </div>
            </div>

            {showTimeline && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 pt-2 border-t border-[#D9E0E7] text-[11px]"
              >
                {timelineEvents.map((evt, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 pl-1 relative">
                    {idx < timelineEvents.length - 1 && (
                      <div className="absolute left-2.5 top-3.5 w-0.5 h-full bg-[#D9E0E7]" />
                    )}
                    <span className="w-2 h-2 rounded-full bg-[#185A8D] mt-1 shrink-0 ring-4 ring-[#F6F8FA]" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <strong className="text-[#17202A] font-sans">{evt.title}</strong>
                        <span className="text-[#5B6570]">{evt.time}</span>
                      </div>
                      <p className="text-[#5B6570] text-[10.5px] mt-0.5">{evt.desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          {/* ── 6. ROUTE RECOMMENDATION ── */}
          <div className="bg-[#185A8D]/5 border border-[#185A8D]/20 p-4 rounded-[8px] space-y-3">
            <div className="flex items-center gap-1.5 text-[#0B2744] font-bold text-xs uppercase tracking-wider">
              <Navigation className="w-4 h-4 text-[#185A8D]" />
              RECOMMENDED ACTION
            </div>

            <div className="bg-white p-3 rounded-[6px] border border-[#D9E0E7] space-y-1">
              <div className="font-bold text-xs text-[#0B2744]">
                Reroute via NH-37 Western Bypass → Silchar / Jiribam
              </div>
              <p className="text-[#5B6570] text-[11px] leading-relaxed">
                Avoids Senapati landslide blockage. Alternate Route B saves ~4.5 hours roadblock queue with verified bridge load capacity.
              </p>
            </div>

            {/* Route comparison matrix */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-white p-2 rounded-[6px] border border-[#C62828]/30">
                <span className="text-[#C62828] block font-bold uppercase">CURRENT ROUTE</span>
                <span className="text-[#5B6570]">NH-27 / NH-2 (Blocked)</span>
                <div className="text-[#17202A] font-semibold mt-0.5">480 km • ~11.0h</div>
                <div className="text-[#C62828] font-mono font-bold mt-0.5">Delay: +4.5 hours (Queue)</div>
              </div>

              <div className="bg-white p-2 rounded-[6px] border border-[#16834B]/30">
                <span className="text-[#16834B] block font-bold uppercase">ALT ROUTE B</span>
                <span className="text-[#5B6570]">NH-37 via Silchar (Open)</span>
                <div className="text-[#17202A] font-semibold mt-0.5">535 km • ~13.5h</div>
                <div className="text-[#16834B] font-mono font-bold mt-0.5">+55 km Detour (+150m)</div>
              </div>
            </div>
          </div>

        </div>

        {/* ── 7. FOOTER ACTION BUTTONS ── */}
        <div className="p-4 border-t border-[#D9E0E7] bg-[#F6F8FA] space-y-2">
          <div className="flex items-center gap-2">
            {/* View Route Action */}
            <button
              onClick={() => {
                if (onViewRoute) onViewRoute(asset);
                else navigate('/routes');
              }}
              className="flex-1 py-2 px-3 rounded-[6px] bg-white hover:bg-[#E7EBEF] text-[#123B66] border border-[#D9E0E7] font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-subtle"
            >
              <Navigation className="w-3.5 h-3.5 text-[#185A8D]" />
              <span>VIEW ROUTE</span>
            </button>

            {/* Focus Incident Mode Action */}
            <button
              onClick={onToggleFocus}
              className={`py-2 px-3 rounded-[6px] border font-semibold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-subtle ${
                isFocused
                  ? 'bg-[#185A8D] text-white border-[#185A8D]'
                  : 'bg-white hover:bg-[#E7EBEF] text-[#5B6570] border-[#D9E0E7]'
              }`}
              title={isFocused ? 'Exit Focus Mode' : 'Focus Incident Mode'}
            >
              {isFocused ? <EyeOff className="w-3.5 h-3.5 text-white" /> : <Eye className="w-3.5 h-3.5 text-[#5B6570]" />}
              <span>{isFocused ? 'EXIT FOCUS' : 'FOCUS'}</span>
            </button>
          </div>

          {/* Primary Action: Approve Reroute */}
          {onReroute && (
            <button
              onClick={() => onReroute(asset.incident_code || asset.id || activeDelivery?.id || 1)}
              className="w-full py-2.5 px-4 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>APPROVE REROUTE (ROUTE B)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
};

export default IncidentIntelligenceDrawer;

