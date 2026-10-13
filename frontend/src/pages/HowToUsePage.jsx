import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Compass, MapPin, AlertTriangle, Truck, CloudRain, 
  ShieldCheck, ArrowRight, CheckCircle2, ChevronRight,
  Activity, Layers, RotateCcw, Sliders, ExternalLink,
  BookOpen, Eye, Check, AlertOctagon, HelpCircle, Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import emblemSvg from '../assets/emblem.svg';

// Custom Map Marker Pin
const createLocationPin = (label, color = '#123B66', isStart = false) => {
  return L.divIcon({
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); pointer-events: auto;">
        <div style="background: #FFFFFF; border: 1.5px solid ${color}; border-radius: 4px; padding: 2px 6px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; color: #17202A; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.15); margin-bottom: 3px;">
          ${label} ${isStart ? '<span style="color:#16834B;font-size:9px;">(ORIGIN)</span>' : '<span style="color:#185A8D;font-size:9px;">(DEST)</span>'}
        </div>
        <div style="width: 12px; height: 12px; background: ${color}; border: 2px solid #FFFFFF; border-radius: 50%; box-shadow: 0 0 6px rgba(18,59,102,0.4);"></div>
      </div>
    `,
    className: 'custom-corridor-pin',
    iconSize: [0, 0],
    iconAnchor: [0, 0]
  });
};

const FitMapToBounds = ({ waypoints }) => {
  const map = useMap();
  useEffect(() => {
    if (map && waypoints && waypoints.length > 0) {
      try {
        const bounds = L.latLngBounds(waypoints);
        map.fitBounds(bounds, { padding: [35, 35], maxZoom: 10 });
      } catch (err) {
        console.error('FitMapToBounds error:', err);
      }
    }
  }, [map, waypoints]);
  return null;
};

// Strategic Regional Corridors for Interactive Simulation
const REGIONAL_CORRIDORS = [
  {
    id: 'as-guw-shl',
    state: 'Assam / Meghalaya',
    from: 'Guwahati',
    to: 'Shillong',
    route: 'NH-40 Mountain Highway',
    dist: '103 km',
    elevGain: '+1,440m',
    weather: 'Heavy Rainfall (18 mm/hr)',
    terrain: 'Steep Incline (1,490m Peak)',
    road: '2-Lane Paved Highway',
    hazard: 'Active Landslide Advisory (Umling)',
    scoreA: 82,
    riskA: 'MODERATE',
    scoreB: 91,
    riskB: 'LOW',
    distB: '118 km',
    timeA: '3h 20m',
    timeB: '3h 35m',
    vulnSeg: 'Segment 04 — Umling Ridge',
    vulnReason: 'Heavy precipitation + steep slope increases mudslide susceptibility.',
    altBypass: 'Umsning High-Drainage Detour Bypass',
    waypoints: [
      [26.1445, 91.7362],
      [26.1158, 91.8214],
      [26.0825, 91.8682],
      [26.0468, 91.8845],
      [25.9034, 91.8796],
      [25.8240, 91.8890],
      [25.7516, 91.8950],
      [25.6631, 91.9022],
      [25.5925, 91.8890],
      [25.5788, 91.8933]
    ],
    altWaypoints: [
      [26.1445, 91.7362],
      [26.0825, 91.8682],
      [25.9034, 91.8796],
      [25.7950, 91.9420],
      [25.6631, 91.9022],
      [25.5788, 91.8933]
    ]
  },
  {
    id: 'as-guw-sil',
    state: 'Assam / Meghalaya',
    from: 'Guwahati',
    to: 'Silchar',
    route: 'NH-6 / NH-27 Trunk Corridor',
    dist: '315 km',
    elevGain: '+820m',
    weather: 'Heavy Monsoon (22 mm/hr)',
    terrain: 'Hilly Forest Cut',
    road: '2-Lane Mixed Surface',
    hazard: 'Landslide Debris Obstruction (Jowai)',
    scoreA: 64,
    riskA: 'HIGH',
    scoreB: 88,
    riskB: 'LOW',
    distB: '342 km',
    timeA: '8h 40m',
    timeB: '9h 15m',
    vulnSeg: 'Segment 03 — East Khasi Hills Slopes',
    vulnReason: 'Rockfall and debris blocking highway passage; restricted single-lane flow.',
    altBypass: 'NH-37 Western Bypass via Jiribam Link',
    waypoints: [
      [26.1445, 91.7362],
      [25.9034, 91.8796],
      [25.5788, 91.8933],
      [25.4419, 92.2038],
      [25.1500, 92.4800],
      [24.8333, 92.7789]
    ],
    altWaypoints: [
      [26.1445, 91.7362],
      [26.2280, 92.5180],
      [25.8500, 92.8900],
      [25.1000, 93.1200],
      [24.8333, 92.7789]
    ]
  },
  {
    id: 'sik-sil-gan',
    state: 'West Bengal / Sikkim',
    from: 'Siliguri',
    to: 'Gangtok',
    route: 'NH-10 Teesta River Highway',
    dist: '114 km',
    elevGain: '+1,530m',
    weather: 'River Basin Flash Rain (28 mm/hr)',
    terrain: 'Canyon Gorge / River Bank',
    road: 'High Mountain Arterial',
    hazard: 'Teesta River Basin Flooding & Road Washout',
    scoreA: 52,
    riskA: 'CRITICAL',
    scoreB: 84,
    riskB: 'MODERATE',
    distB: '148 km',
    timeA: '4h 30m',
    timeB: '5h 10m',
    vulnSeg: 'Segment 02 — Teesta Lowland Causeway',
    vulnReason: 'Rising river water level exceeding safety clearance gauge.',
    altBypass: 'Lava - Damdim High Ridge Detour',
    waypoints: [
      [26.7271, 88.3953],
      [26.8500, 88.4200],
      [26.9600, 88.4700],
      [27.0500, 88.5200],
      [27.1800, 88.5800],
      [27.3314, 88.6138]
    ],
    altWaypoints: [
      [26.7271, 88.3953],
      [26.8800, 88.6200],
      [27.0800, 88.6700],
      [27.2200, 88.6300],
      [27.3314, 88.6138]
    ]
  }
];

export const HowToUsePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(1);
  const [selectedCorridorId, setSelectedCorridorId] = useState('as-guw-sil');
  const [activeTab, setActiveTab] = useState('conditions');
  const [simulatedActionApplied, setSimulatedActionApplied] = useState(false);

  const selectedCorridor = REGIONAL_CORRIDORS.find(c => c.id === selectedCorridorId) || REGIONAL_CORRIDORS[0];

  const OPERATIONAL_STEPS = [
    {
      step: 1,
      title: 'Monitor Region',
      subtitle: 'Regional Accessibility & Top KPIs',
      icon: Activity,
      path: '/command-center',
      btnLabel: 'Open Command Center',
      description: 'Observe the 86/100 regional accessibility index, aggregate disruption count, blocked corridor counts, and live vehicle movements across all 8 North Eastern states in real time.'
    },
    {
      step: 2,
      title: 'Check Corridor',
      subtitle: 'Strategic Trunk Arterials',
      icon: Compass,
      path: '/corridors',
      btnLabel: 'Inspect Corridors',
      description: 'Examine key national logistics arteries (NH-40, NH-27, NH-6, NH-10). Check bridge load ratings (40T–60T), clearance gauges, and road surface passability.'
    },
    {
      step: 3,
      title: 'Understand Risk',
      subtitle: 'Weather & Slope Telemetry',
      icon: CloudRain,
      path: '/weather',
      btnLabel: 'View Weather & Risk',
      description: 'Track real-time precipitation, slope saturation friction models, mountain fog visibility, and flood alert zones from Open-Meteo telemetry feeds.'
    },
    {
      step: 4,
      title: 'Investigate Incident',
      subtitle: 'Hazard Severity & Corroboration',
      icon: AlertTriangle,
      path: '/incidents',
      btnLabel: 'Review Incidents',
      description: 'Drill down into verified field reports. Inspect detection timestamps, sensor readings, affected truck counts, and infrastructure impact timelines.'
    },
    {
      step: 5,
      title: 'Evaluate Impact',
      subtitle: 'Field Operations & Dispatch',
      icon: Truck,
      path: '/field-report',
      btnLabel: 'Coordinate Field Reports',
      description: 'Review GPS-tagged field officer reports, photo evidence, and priority supply convoys (medical, rations, fuel) operating in the disruption zone.'
    },
    {
      step: 6,
      title: 'Take Action',
      subtitle: 'Detour Approvals & Alerts',
      icon: ShieldCheck,
      path: '/corridors',
      btnLabel: 'Execute Reroute Actions',
      description: 'Evaluate calculated detour corridors, compare ETA delta against detour length, approve alternative highway diversions, and transmit emergency notifications.'
    }
  ];

  return (
    <div className="space-y-6 pb-12 text-[#17202A] max-w-6xl mx-auto">
      
      {/* ── HEADER BANNER ── */}
      <div className="bg-white border border-[#D9E0E7] p-5 sm:p-6 rounded-[8px] shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[8px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-center justify-center shrink-0 shadow-subtle p-2">
            <img src={emblemSvg} alt="State Emblem of India" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[4px] bg-[#185A8D]/10 text-[#185A8D] text-[11px] font-bold uppercase tracking-wider mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              Standard Operating Procedure
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] tracking-tight">
              How to Use NER88
            </h1>
            <p className="text-xs text-[#5B6570] mt-0.5">
              Regional Logistics Intelligence & Decision Workflow for Command-Centre Operators
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/command-center')}
          className="px-4 py-2.5 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition flex items-center justify-center gap-2 shrink-0 cursor-pointer active:scale-95"
        >
          <span>Return to Command Center</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── VISUAL FLOW INDICATOR (6 STEPS) ── */}
      <div className="bg-white border border-[#D9E0E7] p-5 rounded-[8px] shadow-subtle space-y-4">
        <div className="flex items-center justify-between border-b border-[#D9E0E7] pb-3">
          <div>
            <h2 className="text-xs font-bold text-[#0B2744] uppercase tracking-wider">
              Operational Decision Pipeline
            </h2>
            <p className="text-[11px] text-[#5B6570]">
              Sequential 6-step workflow for regional disruption handling
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#185A8D] bg-[#185A8D]/10 px-2 py-0.5 rounded-[4px]">
            GIGW 3.0 Standard
          </span>
        </div>

        {/* Responsive Flow Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
          {OPERATIONAL_STEPS.map((stepItem, idx) => {
            const Icon = stepItem.icon;
            const isSelected = activeStep === stepItem.step;

            return (
              <button
                key={stepItem.step}
                onClick={() => setActiveStep(stepItem.step)}
                className={`p-3 rounded-[6px] border text-left transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#185A8D]/10 border-[#185A8D] shadow-subtle ring-1 ring-[#185A8D]'
                    : 'bg-[#F6F8FA] border-[#D9E0E7] hover:border-[#185A8D] hover:bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isSelected ? 'bg-[#123B66] text-white' : 'bg-[#E7EBEF] text-[#5B6570]'
                    }`}>
                      {stepItem.step}
                    </span>
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[#185A8D]' : 'text-[#5B6570]'}`} />
                  </div>
                  <div className="font-bold text-xs text-[#0B2744] line-clamp-1">
                    {stepItem.title}
                  </div>
                  <div className="text-[10.5px] text-[#5B6570] line-clamp-1 mt-0.5">
                    {stepItem.subtitle}
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-[#D9E0E7] flex items-center justify-between text-[10px] text-[#185A8D] font-semibold">
                  <span>Step {stepItem.step}</span>
                  {idx < 5 && <ChevronRight className="w-3 h-3 text-[#5B6570] hidden md:inline" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Step Detail Panel */}
        {(() => {
          const cur = OPERATIONAL_STEPS.find(s => s.step === activeStep) || OPERATIONAL_STEPS[0];
          const CurIcon = cur.icon;

          return (
            <div className="p-4 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-[#123B66] text-white flex items-center justify-center shrink-0 shadow-subtle">
                  <CurIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#185A8D] font-mono">
                      STEP {cur.step} OF 6
                    </span>
                    <span className="text-xs font-bold text-[#0B2744]">
                      {cur.title} — {cur.subtitle}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6570] mt-1 leading-relaxed max-w-3xl">
                    {cur.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(cur.path)}
                  className="px-4 py-2 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{cur.btnLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── INTERACTIVE WORKFLOW SIMULATION SANDBOX (MIGRATED FROM OLD WELCOME) ── */}
      <div className="bg-white border border-[#D9E0E7] p-5 sm:p-6 rounded-[8px] shadow-subtle space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#D9E0E7] pb-3 gap-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[#16834B]/10 text-[#16834B] text-[10px] font-bold uppercase tracking-wider mb-1">
              <Sliders className="w-3 h-3" /> Interactive Simulation Sandbox
            </div>
            <h2 className="text-sm font-bold text-[#0B2744] uppercase tracking-wider">
              Corridor Evaluation & Detour Workbench
            </h2>
            <p className="text-xs text-[#5B6570]">
              Test real corridor parameters, evaluate landslide risk, and trigger simulated rerouting.
            </p>
          </div>

          {/* Corridor Selection Pills: Framer Motion animated movement replacing horizontal scroll */}
          <div className="flex flex-wrap items-center gap-1.5 py-0.5">
            {REGIONAL_CORRIDORS.map((c) => {
              const isSelected = selectedCorridorId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCorridorId(c.id);
                    setSimulatedActionApplied(false);
                  }}
                  className={`relative px-3 py-1.5 rounded-[6px] text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected ? 'text-white' : 'text-[#5B6570] hover:text-[#123B66]'
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="activeHowToUseCorridor"
                      className="absolute inset-0 bg-[#123B66] rounded-[6px] shadow-sm z-0"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{c.from} → {c.to}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Grid: Left Map + Right Intelligence Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column: Interactive GIS Map Surface (7 Cols) */}
          <div className="lg:col-span-7 bg-[#F6F8FA] border border-[#D9E0E7] rounded-[8px] overflow-hidden flex flex-col shadow-inner min-h-[360px] relative">
            <div className="p-2.5 bg-white border-b border-[#D9E0E7] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-bold text-[#0B2744]">
                <MapPin className="w-4 h-4 text-[#185A8D]" />
                <span>{selectedCorridor.route}</span>
                <span className="text-[#5B6570] font-normal font-mono">({selectedCorridor.dist})</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-1 bg-[#185A8D] rounded" /> Current Route
                </span>
                {simulatedActionApplied && (
                  <span className="flex items-center gap-1 font-bold text-[#16834B]">
                    <span className="w-2.5 h-1 bg-[#16834B] rounded" /> Alternative Detour
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 w-full relative z-0 h-[320px]">
              <MapContainer
                bounds={L.latLngBounds(selectedCorridor.waypoints)}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution='Tiles &copy; Esri World Imagery'
                  maxZoom={19}
                />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                <FitMapToBounds waypoints={selectedCorridor.waypoints} />

                {/* Primary Route Path */}
                <Polyline
                  positions={selectedCorridor.waypoints}
                  color={simulatedActionApplied ? '#5B6570' : '#185A8D'}
                  weight={simulatedActionApplied ? 3 : 5}
                  opacity={simulatedActionApplied ? 0.6 : 0.9}
                  dashArray={simulatedActionApplied ? '4, 4' : null}
                />

                {/* Alternative Detour Path */}
                {simulatedActionApplied && (
                  <Polyline
                    positions={selectedCorridor.altWaypoints}
                    color="#16834B"
                    weight={5}
                    opacity={0.95}
                  />
                )}

                {/* Origin Marker */}
                <Marker
                  position={selectedCorridor.waypoints[0]}
                  icon={createLocationPin(selectedCorridor.from, '#123B66', true)}
                />

                {/* Destination Marker */}
                <Marker
                  position={selectedCorridor.waypoints[selectedCorridor.waypoints.length - 1]}
                  icon={createLocationPin(selectedCorridor.to, '#16834B', false)}
                />
              </MapContainer>
            </div>

            <div className="p-2 bg-white border-t border-[#D9E0E7] flex items-center justify-between text-[11px] text-[#5B6570]">
              <span>Active State: {selectedCorridor.state}</span>
              <span>Elevation Delta: {selectedCorridor.elevGain}</span>
            </div>
          </div>

          {/* Right Column: Multi-tab Analysis & Decision (5 Cols) */}
          <div className="lg:col-span-5 bg-white border border-[#D9E0E7] rounded-[8px] p-4 flex flex-col justify-between shadow-subtle space-y-3">
            
            {/* Tab Navigation */}
            <div className="flex items-center gap-1 border-b border-[#D9E0E7] pb-2 text-xs">
              {[
                { id: 'conditions', label: 'Conditions' },
                { id: 'risk', label: 'Risk Factors' },
                { id: 'detour', label: 'Detour Comparison' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded-[4px] font-semibold text-[11px] transition cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#185A8D]/10 text-[#123B66] font-bold border-b-2 border-[#185A8D]'
                      : 'text-[#5B6570] hover:text-[#17202A]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Environmental Conditions */}
            {activeTab === 'conditions' && (
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6570]">Weather Telemetry</div>
                  <div className="font-bold text-[#0B2744] flex items-center gap-1.5">
                    <CloudRain className="w-4 h-4 text-[#185A8D]" />
                    {selectedCorridor.weather}
                  </div>
                  <p className="text-[11px] text-[#5B6570]">Heavy monsoon runoff impacting road friction and drainage canals.</p>
                </div>

                <div className="p-3 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6570]">Terrain & Surface</div>
                  <div className="font-bold text-[#0B2744]">{selectedCorridor.terrain}</div>
                  <div className="text-[11px] text-[#5B6570]">{selectedCorridor.road} · Max Slope: 7.4% Grade</div>
                </div>

                <div className="p-3 rounded-[6px] bg-[#C62828]/5 border border-[#C62828]/20 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#C62828]">Identified Hazard</div>
                  <div className="font-bold text-[#C62828] text-xs">{selectedCorridor.hazard}</div>
                  <p className="text-[11px] text-[#5B6570]">{selectedCorridor.vulnReason}</p>
                </div>
              </div>
            )}

            {/* Tab 2: Risk Factors */}
            {activeTab === 'risk' && (
              <div className="space-y-2.5 text-xs">
                <div className="p-3 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B6570]">Accessibility Score</div>
                    <div className="text-xl font-extrabold text-[#0B2744]">{selectedCorridor.scoreA} <span className="text-xs font-normal text-[#5B6570]">/ 100</span></div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold ${
                    selectedCorridor.riskA === 'CRITICAL' ? 'bg-[#C62828]/10 text-[#C62828]' : 'bg-[#D99A00]/10 text-[#D99A00]'
                  }`}>
                    {selectedCorridor.riskA} RISK
                  </span>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-[#5B6570]">
                    <span>Slope Friction Factor (35%):</span>
                    <strong className="text-[#0B2744]">68 / 100</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#5B6570]">
                    <span>Precipitation Threshold (20%):</span>
                    <strong className="text-[#C62828]">44 / 100 (HIGH RAIN)</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#5B6570]">
                    <span>Incident Severity (20%):</span>
                    <strong className="text-[#C62828]">32 / 100 (OBSTRUCTED)</strong>
                  </div>
                  <div className="flex items-center justify-between text-[#5B6570]">
                    <span>Transit Delay Forecast:</span>
                    <strong className="text-[#D99A00] font-mono">+45 mins</strong>
                  </div>
                </div>

                <div className="p-2.5 rounded-[6px] bg-[#185A8D]/5 border border-[#185A8D]/20 text-[11px] text-[#5B6570]">
                  Vulnerable Sector: <strong className="text-[#0B2744]">{selectedCorridor.vulnSeg}</strong>
                </div>
              </div>
            )}

            {/* Tab 3: Detour Comparison */}
            {activeTab === 'detour' && (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7]">
                    <div className="text-[10px] font-bold text-[#5B6570] uppercase">Current Corridor</div>
                    <div className="font-bold text-[#C62828] text-xs mt-0.5">{selectedCorridor.dist} · {selectedCorridor.timeA}</div>
                    <div className="text-[10px] text-[#C62828] mt-0.5">Score: {selectedCorridor.scoreA}/100</div>
                  </div>

                  <div className="p-2.5 rounded-[6px] bg-[#16834B]/5 border border-[#16834B]/20">
                    <div className="text-[10px] font-bold text-[#16834B] uppercase">Alternative Detour</div>
                    <div className="font-bold text-[#16834B] text-xs mt-0.5">{selectedCorridor.distB} · {selectedCorridor.timeB}</div>
                    <div className="text-[10px] text-[#16834B] mt-0.5">Score: {selectedCorridor.scoreB}/100</div>
                  </div>
                </div>

                <div className="p-3 rounded-[6px] bg-[#F6F8FA] border border-[#D9E0E7] space-y-1">
                  <div className="font-bold text-[#0B2744] text-[11px]">Recommended Detour:</div>
                  <div className="text-xs font-semibold text-[#185A8D]">{selectedCorridor.altBypass}</div>
                  <p className="text-[11px] text-[#5B6570]">Bypasses landslide hazard zone. Safe load clearance verified for commercial freight.</p>
                </div>
              </div>
            )}

            {/* Bottom Decision Action Button */}
            <div className="pt-2 border-t border-[#D9E0E7]">
              {simulatedActionApplied ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#16834B] flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-[#16834B]" />
                    Detour Approved on Map
                  </span>
                  <button
                    onClick={() => setSimulatedActionApplied(false)}
                    className="px-3 py-1.5 rounded-[4px] bg-white border border-[#D9E0E7] hover:bg-[#F6F8FA] text-[#5B6570] text-xs font-semibold transition cursor-pointer"
                  >
                    Reset Detour
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSimulatedActionApplied(true);
                    setActiveTab('detour');
                  }}
                  className="w-full py-2.5 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Simulate Detour Reroute Action</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

    </div>
  );
};

export default HowToUsePage;
