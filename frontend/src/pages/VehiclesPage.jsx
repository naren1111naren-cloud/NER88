import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { usePhoneGPS } from '../hooks/usePhoneGPS';
import { useAlertStream } from '../context/AlertStreamContext';
import VehicleIntelligenceSection from '../components/VehicleIntelligenceSection';
import { 
  Truck, Phone, Navigation, Shield, Radio, Search, Filter, Eye, X, Wifi, 
  Activity, Play, CheckCircle, AlertTriangle, Cpu, Terminal, RefreshCw, Compass, Gauge,
  Smartphone, FileCheck2
} from 'lucide-react';

export const VehiclesPage = () => {
  const { showToast } = useToast();
  const { liveVehicles } = useAlertStream();
  const { isTracking, startTracking, stopTracking, coords, speed: phoneSpeed, activeVehicleCode } = usePhoneGPS();

  const [activeTab, setActiveTab] = useState('fleet'); // 'fleet' or 'vahan'
  const [selectedVahanPlate, setSelectedVahanPlate] = useState('AS01EC9921');

  const [vehicles, setVehicles] = useState([]);
  const [healthSummary, setHealthSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [healthFilter, setHealthFilter] = useState('ALL');
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [showIngestModal, setShowIngestModal] = useState(false);
  const [ingestForm, setIngestForm] = useState({
    vehicle_code: 'NER-V001',
    device_id: 'OBD-NER-001',
    device_api_key: '',
    latitude: 26.1445,
    longitude: 91.7362,
    speed_kmh: 46.5,
    heading_deg: 92.0,
    odometer_km: 14500.0,
    ignition_status: 'ON',
    altitude_m: 350.0,
    telemetry_source: 'HARDWARE_GPS_DEVICE'
  });

  const fetchVehicles = async () => {
    try {
      const res = await api.get('/vehicles');
      setVehicles(safeArray(res.data));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHealthSummary = async () => {
    try {
      const res = await api.get('/telemetry/health');
      setHealthSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchVehicles();
    fetchHealthSummary();
    const timer = setInterval(() => {
      fetchVehicles();
      fetchHealthSummary();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleSimulateStep = async (vehicleCode) => {
    setSimulating(true);
    try {
      const res = await api.post('/telemetry/simulate-step', {
        vehicle_code: vehicleCode,
        step_increment: 1
      });
      showToast(`Telemetry Step Ingested for ${vehicleCode}: Waypoint ${res.data.waypoint_index + 1}/${res.data.total_waypoints} (${res.data.speed_kmh} km/h, ${res.data.heading_deg}°)`, 'success');
      fetchVehicles();
      fetchHealthSummary();
      if (selectedVehicle && selectedVehicle.vehicle_code === vehicleCode) {
        handleViewDetails(selectedVehicle);
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to simulate telemetry step', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const handleViewDetails = async (vehicle) => {
    setSelectedVehicle(vehicle);
    setLoadingHistory(true);
    try {
      const res = await api.get(`/telemetry/vehicles/${vehicle.vehicle_code}/history?limit=10`);
      setBreadcrumbs(safeArray(res.data));
    } catch (err) {
      console.error(err);
      setBreadcrumbs([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleManualIngest = async (e) => {
    e.preventDefault();
    try {
      const headers = {};
      if (ingestForm.device_api_key) {
        headers['X-Device-API-Key'] = ingestForm.device_api_key;
      }
      const res = await api.post('/telemetry/ingest', {
        vehicle_code: ingestForm.vehicle_code,
        device_id: ingestForm.device_id,
        latitude: parseFloat(ingestForm.latitude),
        longitude: parseFloat(ingestForm.longitude),
        speed_kmh: parseFloat(ingestForm.speed_kmh),
        heading_deg: parseFloat(ingestForm.heading_deg),
        odometer_km: parseFloat(ingestForm.odometer_km),
        ignition_status: ingestForm.ignition_status,
        altitude_m: parseFloat(ingestForm.altitude_m),
        telemetry_source: ingestForm.telemetry_source
      }, { headers });

      showToast(`Hardware GPS Packet Ingested! Status: ${res.data.status} (${res.data.telemetry_health})`, 'success');
      setShowIngestModal(false);
      fetchVehicles();
      fetchHealthSummary();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Ingestion failed', 'error');
    }
  };

  const handleCallDriver = (phone, driverName) => {
    showToast(`Connecting emergency broadcast call to ${driverName} (${phone})...`, 'info');
  };

  const filteredVehicles = vehicles.map((v) => {
    const live = liveVehicles[v.vehicle_code];
    if (live) {
      return {
        ...v,
        current_lat: live.latitude,
        current_lng: live.longitude,
        speed_kmh: live.speed_kmh,
        tracking_mode: live.tracking_mode || v.tracking_mode,
        telemetry_source: live.telemetry_source || v.telemetry_source,
        telemetry_health: 'LIVE'
      };
    }
    return v;
  }).filter((v) => {
    const matchesSearch =
      v.vehicle_code.toLowerCase().includes(search.toLowerCase()) ||
      v.driver_name.toLowerCase().includes(search.toLowerCase()) ||
      v.destination_city.toLowerCase().includes(search.toLowerCase()) ||
      (v.device_id && v.device_id.toLowerCase().includes(search.toLowerCase()));

    const matchesRisk =
      riskFilter === 'ALL' ? true : v.risk_level.toUpperCase() === riskFilter;

    const matchesHealth =
      healthFilter === 'ALL' ? true : (v.telemetry_health || 'LIVE').toUpperCase() === healthFilter;

    return matchesSearch && matchesRisk && matchesHealth;
  });

  const getHealthBadge = (health) => {
    switch (health) {
      case 'LIVE':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>LIVE</span>;
      case 'RECENT':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">RECENT</span>;
      case 'STALE':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1"><AlertTriangle className="w-2.5 h-2.5" />STALE</span>;
      case 'OFFLINE':
      default:
        return <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-extrabold flex items-center gap-1">OFFLINE</span>;
    }
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Page Header */}
      <div className="bg-white border border-[#E5E7EB] p-5 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-[#1F2937] flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-600" />
            Fleet Vehicles & GPS Telematics Architecture
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Device-agnostic GPS & OBD telematics pipeline with real-time health, stale detection, and live phone GPS streaming.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIngestModal(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
          >
            <Terminal className="w-3.5 h-3.5" /> Test Hardware Ingest
          </button>
          <button
            onClick={() => handleSimulateStep(vehicles[0]?.vehicle_code || 'NER-V001')}
            disabled={simulating || vehicles.length === 0}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5" /> Advance Simulation Step
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-2">
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'fleet'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          Active Fleet Telematics & GPS ({vehicles.length})
        </button>

        <button
          onClick={() => setActiveTab('vahan')}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition cursor-pointer ${
            activeTab === 'vahan'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileCheck2 className="w-4 h-4 text-purple-400" />
          MoRTH VAHAN Vehicle Intelligence (ULIP)
        </button>
      </div>

      {activeTab === 'vahan' ? (
        <VehicleIntelligenceSection initialPlate={selectedVahanPlate || 'AS01EC9921'} />
      ) : (
        <>
          {/* Fleet Telemetry Health Bar */}
          {healthSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-3 shadow-xs">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Total Fleet</div>
                <div className="text-lg font-extrabold text-[#1F2937] mt-0.5">{healthSummary.total_vehicles} Units</div>
              </div>
              <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-3 shadow-xs">
                <div className="text-[10px] text-emerald-800 font-bold uppercase flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live Telemetry
                </div>
                <div className="text-lg font-extrabold text-emerald-800 mt-0.5">{healthSummary.live_count} Live</div>
              </div>
              <div className="bg-blue-50/50 border border-blue-200 rounded-2xl p-3 shadow-xs">
                <div className="text-[10px] text-blue-800 font-bold uppercase">Recent (&lt;10m)</div>
                <div className="text-lg font-extrabold text-blue-800 mt-0.5">{healthSummary.recent_count}</div>
              </div>
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-3 shadow-xs">
                <div className="text-[10px] text-amber-800 font-bold uppercase">Stale Signal</div>
                <div className="text-lg font-extrabold text-amber-800 mt-0.5">{healthSummary.stale_count}</div>
              </div>
              <div className="bg-purple-50/50 border border-purple-200 rounded-2xl p-3 shadow-xs">
                <div className="text-[10px] text-purple-800 font-bold uppercase">Hardware Mode</div>
                <div className="text-lg font-extrabold text-purple-800 mt-0.5">{healthSummary.active_hardware_count} Dev</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-xs">
                <div className="text-[10px] text-slate-600 font-bold uppercase">Simulation Mode</div>
                <div className="text-lg font-extrabold text-slate-700 mt-0.5">{healthSummary.active_simulation_count} Sim</div>
              </div>
            </div>
          )}

          {/* Filter Toolbar */}
          <div className="bg-white border border-[#E5E7EB] p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
                <input 
                  type="text"
                  placeholder="Search vehicle code, device ID, driver..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl pl-9 pr-3 py-2 text-[#1F2937] placeholder-[#6B7280] focus:outline-none focus:border-purple-600"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-[#6B7280]" />
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="ALL">Risk: All Levels</option>
                  <option value="LOW">Risk: Low / Safe</option>
                  <option value="MEDIUM">Risk: Medium</option>
                  <option value="HIGH">Risk: High</option>
                  <option value="CRITICAL">Risk: Critical</option>
                </select>

                <select
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value)}
                  className="bg-[#F7F7FB] border border-[#E5E7EB] text-[#1F2937] text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-purple-600 cursor-pointer"
                >
                  <option value="ALL">Telemetry: All Health</option>
                  <option value="LIVE">Telemetry: LIVE</option>
                  <option value="RECENT">Telemetry: RECENT</option>
                  <option value="STALE">Telemetry: STALE</option>
                  <option value="OFFLINE">Telemetry: OFFLINE</option>
                </select>
              </div>
            </div>

            <div className="text-[#6B7280] font-semibold text-xs shrink-0">
              Showing <span className="font-extrabold text-[#1F2937]">{filteredVehicles.length}</span> active vehicles
            </div>
          </div>

          {/* Vehicles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredVehicles.map((v) => {
              const isThisVehicleTracking = isTracking && activeVehicleCode === v.vehicle_code;

              return (
                <div
                  key={v.id}
                  className={`bg-white border rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-xs hover:shadow-md transition duration-200 ${
                    isThisVehicleTracking ? 'border-purple-500 ring-2 ring-purple-400/20' : 'border-[#E5E7EB] hover:border-purple-300'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-xs shadow-xs ${
                        isThisVehicleTracking ? 'bg-purple-600 text-white animate-pulse' : 'bg-purple-50 border border-purple-200 text-purple-700'
                      }`}>
                        <Truck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-[#1F2937] flex items-center gap-1.5">
                          {v.vehicle_code}
                          {isThisVehicleTracking ? (
                            <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded text-[10px] font-black animate-pulse flex items-center gap-1">
                              <Smartphone className="w-2.5 h-2.5" /> PHONE GPS LIVE
                            </span>
                          ) : (
                            getHealthBadge(v.telemetry_health || 'LIVE')
                          )}
                        </div>
                        <div className="text-[10px] text-[#6B7280] font-mono">Device: {v.device_id || 'GPS-UNIT'}</div>
                      </div>
                    </div>
                    <StatusBadge level={v.risk_level} size="sm" />
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between text-[#1F2937]">
                      <span className="text-[#6B7280] font-medium">Assigned Driver</span>
                      <span className="font-bold">{v.driver_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-[#1F2937]">
                      <span className="text-[#6B7280] font-medium">Driver Phone</span>
                      <button
                        onClick={() => handleCallDriver(v.driver_phone || '+91 98765 00000', v.driver_name)}
                        className="font-mono text-purple-700 hover:underline flex items-center gap-1 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200"
                      >
                        <Phone className="w-3 h-3" /> {v.driver_phone || '+91 98765 00000'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[#1F2937]">
                      <span className="text-[#6B7280] font-medium">Destination</span>
                      <span className="font-extrabold text-[#1F2937]">{v.destination_city}</span>
                    </div>

                    <div className="flex items-center justify-between text-[#1F2937]">
                      <span className="text-[#6B7280] font-medium">GPS Coordinates</span>
                      <span className="font-mono text-[11px] text-[#6B7280]">
                        {v.current_lat.toFixed(4)}, {v.current_lng.toFixed(4)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-center justify-between text-xs">
                        <span className="text-[#6B7280] font-medium flex items-center gap-1"><Gauge className="w-3 h-3" /> Speed</span>
                        <span className="font-extrabold text-purple-700">{v.speed_kmh} km/h</span>
                      </div>
                      <div className="p-2 rounded-xl bg-[#F7F7FB] border border-[#E5E7EB] flex items-center justify-between text-xs">
                        <span className="text-[#6B7280] font-medium flex items-center gap-1"><Compass className="w-3 h-3" /> Heading</span>
                        <span className="font-extrabold text-[#1F2937]">{v.heading_deg}°</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#6B7280] pt-1">
                      <span>Odometer: <strong className="text-[#1F2937] font-mono">{v.odometer_km ? v.odometer_km.toFixed(1) : '12450.0'} km</strong></span>
                      <span className="font-mono text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                        {v.tracking_mode || 'SIMULATION'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                      <button
                        onClick={() => handleViewDetails(v)}
                        className="py-1.5 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold text-xs flex items-center justify-center gap-1 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Details
                      </button>
                      <button
                        onClick={() => {
                          const cleanPlate = v.vehicle_code.replace(/^(VAHAN-|EXT-|NER-)/, '');
                          setSelectedVahanPlate(cleanPlate || 'AS01EC9921');
                          setActiveTab('vahan');
                        }}
                        className="py-1.5 rounded-xl bg-purple-100/70 hover:bg-purple-200/80 text-purple-900 font-extrabold text-xs flex items-center justify-center gap-1 border border-purple-200 transition"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-purple-700" /> VAHAN RC
                      </button>
                      <button
                        onClick={() => handleSimulateStep(v.vehicle_code)}
                        className="py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-1 border border-purple-200 transition"
                      >
                        <Play className="w-3.5 h-3.5" /> Step GPS
                      </button>
                    </div>

                    {/* Phone GPS Live Stream Action */}
                    <div className="pt-1">
                      {isThisVehicleTracking ? (
                        <button
                          onClick={stopTracking}
                          className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                          <Radio className="w-3.5 h-3.5 animate-spin" /> Stop Phone GPS Sharing
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            startTracking(v.vehicle_code);
                            showToast(`📡 Started streaming browser Geolocation for ${v.vehicle_code}!`, 'success');
                          }}
                          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5" /> Stream My Phone GPS to {v.vehicle_code}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Driver Telemetry Details & Breadcrumbs Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-mono">
                    {selectedVehicle.vehicle_code}
                  </span>
                  {getHealthBadge(selectedVehicle.telemetry_health || 'LIVE')}
                  <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                    {selectedVehicle.tracking_mode || 'SIMULATION'}
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[#1F2937] mt-1">{selectedVehicle.driver_name}</h3>
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-[#F7F7FB] rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Device ID</div>
                <div className="font-mono font-extrabold text-[#1F2937] text-xs truncate">{selectedVehicle.device_id || 'GPS-UNIT-01'}</div>
              </div>
              <div className="p-2.5 bg-[#F7F7FB] rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Speed / Heading</div>
                <div className="font-extrabold text-[#1F2937] text-xs">{selectedVehicle.speed_kmh} km/h ({selectedVehicle.heading_deg}°)</div>
              </div>
              <div className="p-2.5 bg-[#F7F7FB] rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Odometer</div>
                <div className="font-mono font-extrabold text-[#1F2937] text-xs">{selectedVehicle.odometer_km ? selectedVehicle.odometer_km.toFixed(1) : '12450.0'} km</div>
              </div>
              <div className="p-2.5 bg-[#F7F7FB] rounded-xl border border-[#E5E7EB]">
                <div className="text-[10px] text-[#6B7280] font-bold uppercase">Altitude</div>
                <div className="font-extrabold text-[#1F2937] text-xs">{selectedVehicle.altitude_m || 450} m ASL</div>
              </div>
            </div>

            <div className="p-3 bg-[#F7F7FB] rounded-xl border border-[#E5E7EB] text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6B7280] font-bold uppercase">Telemetry Source Provenance</span>
                <span className="font-mono text-purple-700 font-extrabold text-xs">
                  {selectedVehicle.telemetry_source || '[SIMULATED GPS TELEMETRY]'}
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                All incoming telemetry adheres to the generic unified telematics ingestion standard (<code className="bg-purple-100/50 text-purple-800 px-1 rounded">/api/v1/telemetry/ingest</code>).
              </p>
            </div>

            {/* GPS Breadcrumb Trail */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#1F2937]">
                <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-purple-600" /> Recent GPS Ingestion Breadcrumbs</span>
                <span className="text-[10px] text-[#6B7280]">Last 10 Pings</span>
              </div>

              {loadingHistory ? (
                <div className="p-4 text-center text-xs text-[#6B7280]">Loading GPS trail...</div>
              ) : breadcrumbs.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-dashed border-[#E5E7EB] rounded-xl text-center text-xs text-[#6B7280]">
                  No historical breadcrumb logs found for this vehicle. Click "Advance Step" to generate logs.
                </div>
              ) : (
                <div className="border border-[#E5E7EB] rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#F7F7FB] border-b border-[#E5E7EB] text-[10px] uppercase font-bold text-[#6B7280]">
                      <tr>
                        <th className="p-2">Timestamp</th>
                        <th className="p-2">Coordinates</th>
                        <th className="p-2">Speed</th>
                        <th className="p-2">Heading</th>
                        <th className="p-2">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {breadcrumbs.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50 font-mono text-[11px]">
                          <td className="p-2 text-[#6B7280]">{new Date(b.recorded_at).toLocaleTimeString()}</td>
                          <td className="p-2 text-[#1F2937]">{b.latitude.toFixed(4)}, {b.longitude.toFixed(4)}</td>
                          <td className="p-2 text-purple-700 font-bold">{b.speed_kmh} km/h</td>
                          <td className="p-2 text-[#1F2937]">{b.heading_deg}°</td>
                          <td className="p-2 text-[10px] text-slate-500 truncate max-w-[100px]">{b.telemetry_source}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
              <button
                onClick={() => handleSimulateStep(selectedVehicle.vehicle_code)}
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" /> Ingest Simulation Step
              </button>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Hardware Ingestion Test Modal */}
      {showIngestModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#1F2937] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-600" />
                  Hardware GPS / OBD Telemetry Ingestion Simulator
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Sends raw telematics packets directly to <code className="text-purple-700 font-mono">POST /api/v1/telemetry/ingest</code>.
                </p>
              </div>
              <button
                onClick={() => setShowIngestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualIngest} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Target Vehicle Code</label>
                  <select
                    value={ingestForm.vehicle_code}
                    onChange={(e) => setIngestForm({ ...ingestForm, vehicle_code: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-bold text-[#1F2937] focus:outline-none focus:border-purple-600"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.vehicle_code}>{v.vehicle_code} ({v.driver_name})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Hardware Device ID</label>
                  <input
                    type="text"
                    value={ingestForm.device_id}
                    onChange={(e) => setIngestForm({ ...ingestForm, device_id: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-mono text-[#1F2937] focus:outline-none focus:border-purple-600"
                    placeholder="e.g. OBD-HW-992"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">GPS Latitude (-90 to +90)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={ingestForm.latitude}
                    onChange={(e) => setIngestForm({ ...ingestForm, latitude: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-mono text-[#1F2937] focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">GPS Longitude (-180 to +180)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={ingestForm.longitude}
                    onChange={(e) => setIngestForm({ ...ingestForm, longitude: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-mono text-[#1F2937] focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Speed (km/h)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ingestForm.speed_kmh}
                    onChange={(e) => setIngestForm({ ...ingestForm, speed_kmh: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-mono text-[#1F2937] focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Heading (0-360°)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={ingestForm.heading_deg}
                    onChange={(e) => setIngestForm({ ...ingestForm, heading_deg: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-mono text-[#1F2937] focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#6B7280] uppercase mb-1">Ignition</label>
                  <select
                    value={ingestForm.ignition_status}
                    onChange={(e) => setIngestForm({ ...ingestForm, ignition_status: e.target.value })}
                    className="w-full bg-[#F7F7FB] border border-[#E5E7EB] rounded-xl p-2 font-bold text-[#1F2937] focus:outline-none focus:border-purple-600"
                  >
                    <option value="ON">ON</option>
                    <option value="OFF">OFF</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <CheckCircle className="w-4 h-4" /> Transmit Packet to Pipeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
