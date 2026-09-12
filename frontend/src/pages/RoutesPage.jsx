import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { safeArray, safeObject } from '../utils/apiHelpers';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { 
  Compass, Cpu, AlertTriangle, ShieldCheck, ArrowRight, Zap, CheckCircle2, 
  Sparkles, Navigation, Layers, Shield, Scale, Clock, Activity, MapPin, 
  TrendingUp, Sliders, CheckCircle, Info, ExternalLink, Award
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const customHubIcon = new L.DivIcon({
  className: 'custom-hub-icon',
  html: '<div style="background-color: #7C3AED; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.4);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

const NER_NODES = {
  'Guwahati': [26.1445, 91.7362],
  'Shillong': [25.5788, 91.8933],
  'Nagaon': [26.3452, 92.6841],
  'Jorhat': [26.7509, 94.2037],
  'Dimapur': [25.9090, 93.7266],
  'Kohima': [25.6751, 94.1086],
  'Senapati': [25.2677, 94.0174],
  'Imphal': [24.8170, 93.9368],
  'Silchar': [24.8333, 92.7789],
  'Jiribam': [24.8036, 93.1235],
  'Aizawl': [23.7271, 92.7176],
  'Agartala': [23.8315, 91.2868],
  'Itanagar': [27.0844, 93.6053],
  'Gangtok': [27.3389, 88.6065]
};

const NER_HUBS = Object.keys(NER_NODES);

export const RoutesPage = () => {
  const { showToast } = useToast();
  const [origin, setOrigin] = useState('Guwahati');
  const [destination, setDestination] = useState('Imphal');
  const [objective, setObjective] = useState('BALANCED');
  const [cargoPriority, setCargoPriority] = useState('EMERGENCY');
  const [vehicleWeight, setVehicleWeight] = useState(20.0);
  const [isSimulatingBlockage, setIsSimulatingBlockage] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [objectivesList, setObjectivesList] = useState([]);

  const fetchObjectives = async () => {
    try {
      const res = await api.get('/routes/objectives');
      setObjectivesList(safeArray(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  const handleOptimize = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const blockages = isSimulatingBlockage ? [
        {
          incident_type: 'LANDSLIDE',
          location_name: 'Senapati Pass (Km 214)',
          road_status: 'BLOCKED'
        }
      ] : [];

      const payload = {
        origin_city: origin,
        destination_city: destination,
        optimization_objective: objective,
        cargo_priority: cargoPriority,
        vehicle_weight_tons: parseFloat(vehicleWeight),
        active_blockages: blockages,
        consider_live_weather: true
      };

      const res = await api.post('/routes/optimize', payload);
      setOptimizationResult(res.data);
      setSelectedRouteId(res.data.recommended_route_id);
      showToast(`Optimization complete: ${res.data.recommended_route_name} ranked #1`, 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to execute route optimization', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
    handleOptimize();
  }, []);

  const candidates = optimizationResult?.candidate_routes || [];
  const selectedRoute = candidates.find(c => c.id === selectedRouteId) || candidates[0];

  const getRouteColor = (route, isSelected) => {
    if (route.is_blocked) return '#EF4444'; // Red
    if (route.id === optimizationResult?.recommended_route_id) return '#7C3AED'; // Purple
    if (route.id === 'ROUTE_B') return '#0284C7'; // Blue
    return '#F59E0B'; // Amber
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-[#1F2937] flex items-center gap-2">
            <Compass className="w-5 h-5 text-purple-600" />
            Corridor Route Optimization
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5 font-normal">
            Evaluates candidate corridors using travel time, live Open-Meteo weather conditions, bridge clearances, and route resilience.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Multi-Attribute Model v2.0
          </span>
        </div>
      </div>

      {/* Control Studio & Objective Selection */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
          <div className="text-xs font-bold text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-purple-600" /> 1. Select Optimization Policy
          </div>
          <div className="text-xs text-[#6B7280]">
            Dynamic Multi-Factor Weight Distribution
          </div>
        </div>

        {/* Objective Mode Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'BALANCED', label: 'Balanced Route', desc: 'Harmonizes time, risk, weather & distance' },
            { key: 'SAFEST', label: 'Maximum Safety', desc: 'Minimizes landslide, flood & weather hazard risks' },
            { key: 'FASTEST', label: 'Fastest Transit', desc: 'Prioritizes shortest duration & transit velocity' },
            { key: 'MOST_RESILIENT', label: 'High Resilience', desc: 'Prioritizes high accessibility & bridge load limits' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setObjective(item.key);
              }}
              className={`p-3 rounded-xl border text-left transition ${
                objective === item.key
                  ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
                  : 'bg-[#F7F7FB] border-[#E5E7EB] hover:bg-slate-50'
              }`}
            >
              <div className="font-bold text-xs text-[#1F2937] flex items-center justify-between">
                <span>{item.label}</span>
                {objective === item.key && <CheckCircle className="w-3.5 h-3.5 text-purple-600" />}
              </div>
              <div className="text-[11px] text-[#6B7280] mt-1 leading-snug">{item.desc}</div>
            </button>
          ))}
        </div>

        {/* Corridor Route Parameters Form */}
        <form onSubmit={handleOptimize} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Origin Node</label>
            <select
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-bold text-[#1F2937] focus:outline-none focus:border-purple-600"
            >
              {NER_HUBS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Destination Node</label>
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-bold text-[#1F2937] focus:outline-none focus:border-purple-600"
            >
              {NER_HUBS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Cargo Priority</label>
            <select
              value={cargoPriority}
              onChange={(e) => setCargoPriority(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-bold text-[#1F2937] focus:outline-none focus:border-purple-600"
            >
              <option value="EMERGENCY">EMERGENCY (Medicines/Disaster)</option>
              <option value="URGENT">URGENT (Essential Supplies)</option>
              <option value="HIGH">HIGH (Standard Freight)</option>
              <option value="NORMAL">NORMAL</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Vehicle Weight (Tons)</label>
            <input
              type="number"
              step="1"
              value={vehicleWeight}
              onChange={(e) => setVehicleWeight(e.target.value)}
              className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-mono font-bold text-[#1F2937] focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{loading ? 'Evaluating...' : 'Calculate Routes'}</span>
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3 pt-1 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isSimulatingBlockage}
              onChange={(e) => setIsSimulatingBlockage(e.target.checked)}
              className="accent-purple-600 rounded"
            />
            <span className="font-semibold text-[#1F2937]">
              Simulate Active Disaster Blockage on NH27 Senapati Pass (Landslide)
            </span>
          </label>
        </div>
      </div>

      {/* Main Analysis Grid */}
      {optimizationResult && (
        <div className="space-y-5">
          {/* Recommendation & Explainable Decision Card */}
          <div className="bg-gradient-to-r from-purple-50 via-indigo-50/40 to-teal-50/40 border border-purple-200 p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-purple-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-600 text-white flex items-center gap-1 w-fit">
                  <Award className="w-3 h-3" /> Recommended Route
                </span>
                <h2 className="text-base font-bold text-[#1F2937] mt-1.5">
                  {optimizationResult.recommended_route_name}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-white border border-purple-200 text-center shadow-xs">
                  <div className="text-[9px] text-[#6B7280] font-bold uppercase">Suitability Score</div>
                  <div className="text-base font-bold text-purple-700">
                    {candidates.find(c => c.id === optimizationResult.recommended_route_id)?.suitability_score || 84} / 100
                  </div>
                </div>
                <div className="p-2 rounded-xl bg-white border border-purple-200 text-center shadow-xs">
                  <div className="text-[9px] text-[#6B7280] font-bold uppercase">Total Distance</div>
                  <div className="text-base font-bold text-[#1F2937]">
                    {candidates.find(c => c.id === optimizationResult.recommended_route_id)?.distance_km || 535} km
                  </div>
                </div>
              </div>
            </div>

            {/* Decision Factors (Why this route was chosen) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
              <div className="lg:col-span-2 space-y-2">
                <div className="font-bold text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Decision Factors (Why this route was chosen)
                </div>
                <div className="space-y-1.5">
                  {optimizationResult.why_this_route.map((reason, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white/90 border border-purple-100 text-[#1F2937] flex items-start gap-2 shadow-2xs font-medium">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mathematical Weights Breakdown */}
              <div className="space-y-2">
                <div className="font-bold text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-600" /> Applied Policy Weights ({objective})
                </div>
                <div className="space-y-1.5">
                  {optimizationResult.why_this_route.map((reason, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-white/90 border border-purple-100 text-[#1F2937] flex items-start gap-2 shadow-2xs font-medium">
                      <span className="text-purple-600 font-bold">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mathematical Weights Breakdown */}
              <div className="space-y-2">
                <div className="font-extrabold text-purple-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-purple-600" /> Applied Policy Weights ({objective})
                </div>
                <div className="p-3 bg-white/90 border border-purple-100 rounded-xl space-y-2 shadow-2xs text-[11px]">
                  {Object.entries(optimizationResult.applied_weights).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="capitalize text-[#6B7280] font-medium">{k} Factor:</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-purple-600 h-full" style={{ width: `${v * 100}%` }}></div>
                        </div>
                        <span className="font-mono font-bold text-[#1F2937]">{Math.round(v * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Candidate Routes Comparison Table */}
          <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
              <h3 className="text-xs font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-purple-600" /> Multi-Candidate Evaluation Matrix ({candidates.length} Routes Analyzed)
              </h3>
              <span className="text-[11px] text-[#6B7280]">Click any candidate to inspect route on map</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F7F7FB] border-b border-[#E5E7EB] text-[10px] uppercase font-bold text-[#6B7280]">
                  <tr>
                    <th className="p-2.5">Rank & Route</th>
                    <th className="p-2.5">Corridor</th>
                    <th className="p-2.5">Distance</th>
                    <th className="p-2.5">Est. Time / Delay</th>
                    <th className="p-2.5">Risk Level</th>
                    <th className="p-2.5">Live Weather</th>
                    <th className="p-2.5">Bridges</th>
                    <th className="p-2.5">Suitability</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {candidates.map((c) => (
                    <tr 
                      key={c.id} 
                      onClick={() => setSelectedRouteId(c.id)}
                      className={`cursor-pointer transition ${
                        selectedRouteId === c.id 
                          ? 'bg-purple-50/70 font-semibold' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            c.rank === 1 ? 'bg-purple-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            #{c.rank}
                          </span>
                          <div>
                            <div className="font-extrabold text-[#1F2937]">{c.name}</div>
                            {c.id === optimizationResult.recommended_route_id && (
                              <span className="text-[9px] font-extrabold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">RECOMMENDED</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 font-mono text-[11px] text-purple-700 font-bold">{c.corridor_code}</td>
                      <td className="p-2.5 font-mono">{c.distance_km} km</td>
                      <td className="p-2.5">
                        <div className="font-bold">{c.estimated_travel_time_hours} hrs</div>
                        {c.estimated_delay_mins > 0 && (
                          <div className="text-[10px] text-rose-600 font-medium">+{c.estimated_delay_mins}m delay</div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <StatusBadge level={c.risk_category} size="sm" />
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          c.weather_risk_category === 'SEVERE' ? 'bg-rose-100 text-rose-800' :
                          c.weather_risk_category === 'HIGH' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {c.weather_risk_category}
                        </span>
                      </td>
                      <td className="p-2.5 text-[11px] text-[#6B7280] truncate max-w-[140px]">{c.bridge_clearance_status}</td>
                      <td className="p-2.5">
                        <div className="font-extrabold text-purple-700 font-mono text-sm">{c.suitability_score}</div>
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          c.is_blocked ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {c.is_blocked ? 'BLOCKED' : 'PASSABLE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Leaflet Map Showing Multiple Candidate Corridors */}
          <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2.5">
              <div>
                <h3 className="text-xs font-extrabold text-[#1F2937] uppercase tracking-wider flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-purple-600" /> Interactive Candidate Route Trajectory Visualizer
                </h3>
                <p className="text-[11px] text-[#6B7280]">
                  Comparing {candidates.length} alternative trajectories across North East mountain terrain.
                </p>
              </div>

              {/* Route Selector Badges */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedRouteId(c.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      selectedRouteId === c.id
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    <span 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getRouteColor(c, selectedRouteId === c.id) }}
                    ></span>
                    {c.id} ({c.rank === 1 ? 'Optimal' : `#${c.rank}`})
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[420px] rounded-xl overflow-hidden border border-[#E5E7EB] relative">
              <MapContainer
                center={[25.6, 92.8]}
                zoom={7}
                scrollWheelZoom={true}
                className="w-full h-full"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Candidate Route Polylines */}
                {candidates.map((c) => {
                  const isSelected = selectedRouteId === c.id;
                  const isRec = c.id === optimizationResult.recommended_route_id;
                  const color = getRouteColor(c, isSelected);

                  return (
                    <Polyline
                      key={c.id}
                      positions={c.waypoints}
                      color={color}
                      weight={isSelected ? 6 : 3}
                      opacity={isSelected ? 0.95 : 0.45}
                      dashArray={c.is_blocked ? '8, 8' : (!isRec && !isSelected ? '6, 6' : undefined)}
                      eventHandlers={{
                        click: () => setSelectedRouteId(c.id)
                      }}
                    >
                      <Popup>
                        <div className="p-2 space-y-1 text-xs min-w-[200px]">
                          <div className="font-extrabold text-[#1F2937] border-b pb-1">{c.name}</div>
                          <div>Corridor: <strong>{c.corridor_code}</strong></div>
                          <div>Distance: <strong>{c.distance_km} km</strong> ({c.estimated_travel_time_hours} hrs)</div>
                          <div>Suitability Score: <strong>{c.suitability_score}/100</strong> (Rank #{c.rank})</div>
                          <div className="text-[10px] text-slate-500">Status: {c.is_blocked ? 'BLOCKED' : 'PASSABLE'}</div>
                        </div>
                      </Popup>
                    </Polyline>
                  );
                })}

                {/* Hub Node Markers */}
                {Object.entries(NER_NODES).map(([name, coords]) => (
                  <Marker key={name} position={coords} icon={customHubIcon}>
                    <Popup>
                      <div className="p-1 text-xs">
                        <strong>{name} Hub</strong> (NER Node)
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              {/* Map Floating Legend */}
              <div className="absolute bottom-3 right-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-[#E5E7EB] shadow-lg text-[11px] space-y-1 z-[1000]">
                <div className="font-bold text-[#1F2937] text-[10px] uppercase">Route Trajectories</div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-purple-600 rounded"></span>
                  <span className="font-semibold text-purple-700">Recommended (Rank #1)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-sky-600 rounded"></span>
                  <span>Alternative (Route B)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-amber-500 rounded"></span>
                  <span>Secondary (Route C)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-rose-500 rounded border border-dashed"></span>
                  <span className="text-rose-600">Blocked Corridor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
