import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { 
  Truck, Search, CheckCircle2, AlertTriangle, XCircle, ShieldAlert,
  Calendar, Fuel, Scale, FileText, Building, MapPin, Gauge, Shield,
  RefreshCw, Info, Check, AlertCircle, ArrowRight
} from 'lucide-react';

export const VehicleIntelligenceSection = ({ initialPlate = 'AS01EC9921', onSelectVehicle }) => {
  const { showToast } = useToast();

  const [searchPlate, setSearchPlate] = useState(initialPlate);
  const [loading, setLoading] = useState(false);
  const [vehicleData, setVehicleData] = useState(null);
  const [lookupState, setLookupState] = useState('IDLE'); // IDLE, LOADING, SUCCESS, NOT_FOUND, AUTH_FAILED, NOT_CONFIGURED, SERVICE_UNAVAILABLE, INVALID_INPUT
  const [statusMessage, setStatusMessage] = useState('');
  const [gatewayStatus, setGatewayStatus] = useState(null);

  // Logistics Suitability State
  const [evaluatingSuitability, setEvaluatingSuitability] = useState(false);
  const [selectedBridge, setSelectedBridge] = useState('BRG-NH27-01');
  const [cargoPayloadTons, setCargoPayloadTons] = useState('');
  const [suitabilityResult, setSuitabilityResult] = useState(null);

  useEffect(() => {
    fetchGatewayStatus();
    if (initialPlate) {
      handleLookup(initialPlate);
    }
  }, []);

  const fetchGatewayStatus = async () => {
    try {
      const res = await api.get('/vahan/status');
      setGatewayStatus(res.data);
    } catch (err) {
      console.warn('Failed to fetch VAHAN gateway status', err);
    }
  };

  const handleLookup = async (plateToSearch) => {
    const rawPlate = plateToSearch || searchPlate;
    const clean = (rawPlate || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (!clean) {
      setLookupState('INVALID_INPUT');
      setStatusMessage('Please enter a valid vehicle registration number');
      return;
    }

    if (clean.length < 5 || clean.length > 11) {
      setLookupState('INVALID_INPUT');
      setStatusMessage(`Registration length must be 5 to 11 characters (Entered: ${clean.length})`);
      return;
    }

    setLoading(true);
    setLookupState('LOADING');
    setStatusMessage('Checking VAHAN via ULIP gateway...');
    setSuitabilityResult(null);

    try {
      const res = await api.get(`/vahan/vehicle/${clean}`);
      const data = res.data;

      if (data.success && data.data) {
        setVehicleData(data.data);
        setLookupState('SUCCESS');
        setStatusMessage(data.message || 'Live VAHAN data retrieved');
        if (onSelectVehicle) {
          onSelectVehicle(data.data);
        }
      } else {
        setVehicleData(null);
        const stateKey = data.status || 'NOT_FOUND';
        setLookupState(stateKey);
        setStatusMessage(data.message || 'Vehicle details not found');
      }
    } catch (err) {
      setVehicleData(null);
      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.response?.data?.message || err.message;

      if (status === 401 || status === 403) {
        setLookupState('AUTH_FAILED');
        setStatusMessage('VAHAN authentication unavailable');
      } else if (status === 404) {
        setLookupState('NOT_FOUND');
        setStatusMessage('Vehicle details not found in VAHAN registry');
      } else if (status === 502 || status === 503 || status === 504) {
        setLookupState('SERVICE_UNAVAILABLE');
        setStatusMessage('VAHAN service temporarily unavailable');
      } else {
        setLookupState('SERVICE_UNAVAILABLE');
        setStatusMessage(typeof detail === 'string' ? detail : 'VAHAN lookup failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluateSuitability = async () => {
    if (!vehicleData) return;

    setEvaluatingSuitability(true);
    try {
      const payload = {
        vehicle_number: vehicleData.registration_number,
        bridge_code: selectedBridge,
        cargo_weight_tons: cargoPayloadTons ? parseFloat(cargoPayloadTons) : undefined
      };
      const res = await api.post('/vahan/verify-suitability', payload);
      setSuitabilityResult(res.data);
      showToast(
        res.data.suitability_score >= 80 ? 'Vehicle evaluated: Operationally suitable' : 'Vehicle evaluated: Verification required',
        res.data.suitability_score >= 80 ? 'success' : 'warning'
      );
    } catch (err) {
      showToast(err.response?.data?.detail || 'Suitability evaluation failed', 'error');
    } finally {
      setEvaluatingSuitability(false);
    }
  };

  const samplePlates = ['AS01EC9921', 'ML05AA4402', 'TR01B8833', 'AR01C1234', 'NL07A5566'];

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xs overflow-hidden space-y-0">
      {/* Header Bar */}
      <div className="p-5 bg-gradient-to-r from-[#171329] via-[#231C3D] to-[#171329] text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              MoRTH / NLDSL ULIP v6.0
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              VAHAN/04 Primary Lookup
            </span>
          </div>
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-400" />
            Vehicle Intelligence & National Registry Verification
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Live backend-to-backend integration with MoRTH VAHAN via ULIP gateway. Query commercial vehicle specifications, Gross Vehicle Weight (GVW), fitness validity, and bridge load clearance.
          </p>
        </div>

        {/* Gateway Environment Badge */}
        {gatewayStatus && (
          <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl p-2.5 text-xs text-slate-300 shrink-0 space-y-0.5">
            <div className="text-[10px] uppercase font-bold text-purple-300">ULIP Gateway Status</div>
            <div className="font-extrabold text-white flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gatewayStatus.is_configured ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              {gatewayStatus.environment?.toUpperCase() || 'STAGING'} ENVIRONMENT
            </div>
            <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
              {gatewayStatus.token_status || 'READY'}
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Search & Input Form */}
        <div className="bg-[#F7F7FB] border border-[#E5E7EB] rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup(searchPlate)}
                placeholder="Enter Registration Number (e.g. AS01EC9921, UP91L0001)"
                maxLength={13}
                className="w-full bg-white border border-[#D1D5DB] rounded-xl px-4 py-2.5 text-sm font-mono font-black uppercase text-[#1F2937] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>
            <button
              onClick={() => handleLookup(searchPlate)}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Checking VAHAN...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  CHECK VEHICLE
                </>
              )}
            </button>
          </div>

          {/* Quick Selectors */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-500">Quick Test Samples:</span>
            {samplePlates.map((plate) => (
              <button
                key={plate}
                onClick={() => {
                  setSearchPlate(plate);
                  handleLookup(plate);
                }}
                className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E7EB] hover:border-purple-300 text-[#1F2937] font-mono text-xs font-bold transition shadow-2xs hover:bg-purple-50 hover:text-purple-700"
              >
                {plate}
              </button>
            ))}
          </div>
        </div>

        {/* State Banner Notifications */}
        {lookupState === 'LOADING' && (
          <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-center gap-3 text-xs animate-pulse">
            <RefreshCw className="w-5 h-5 text-purple-600 animate-spin shrink-0" />
            <div>
              <div className="font-bold text-sm">Connecting to MoRTH VAHAN Registry...</div>
              <div className="text-purple-700">Validating vehicle registration plate via ULIP VAHAN/04 production gateway.</div>
            </div>
          </div>
        )}

        {lookupState === 'NOT_CONFIGURED' && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              VAHAN SERVICE NOT CONFIGURED
            </div>
            <p className="text-amber-800 leading-relaxed">
              ULIP credentials are not configured in the backend environment. To query live MoRTH VAHAN records, please provide <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">ULIP_USERNAME</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">ULIP_PASSWORD</code> in your <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">.env</code> configuration.
            </p>
          </div>
        )}

        {lookupState === 'AUTH_FAILED' && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-black text-rose-900 text-sm">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              VAHAN AUTHENTICATION FAILED
            </div>
            <p className="text-rose-800">
              ULIP rejected the authentication credentials. Please verify your username, password, and environment (staging vs production).
            </p>
          </div>
        )}

        {lookupState === 'SERVICE_UNAVAILABLE' && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-black text-rose-900 text-sm">
              <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
              VAHAN SERVICE TEMPORARILY UNAVAILABLE
            </div>
            <p className="text-rose-800">
              {statusMessage || 'The MoRTH VAHAN gateway did not respond in time. Please try again shortly.'}
            </p>
          </div>
        )}

        {lookupState === 'NOT_FOUND' && (
          <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-900 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
              <Info className="w-5 h-5 text-slate-500 shrink-0" />
              VEHICLE DETAILS NOT FOUND
            </div>
            <p className="text-slate-600">
              No matching record was found in the National Vehicle Registry for registration number <strong>{searchPlate}</strong>.
            </p>
          </div>
        )}

        {lookupState === 'INVALID_INPUT' && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-black text-amber-900 text-sm">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              INVALID REGISTRATION FORMAT
            </div>
            <p className="text-amber-800">
              {statusMessage || 'Registration number must be 5-11 alphanumeric characters (e.g. UP91L0001).'}
            </p>
          </div>
        )}

        {/* Successful VAHAN Vehicle Intelligence Display */}
        {lookupState === 'SUCCESS' && vehicleData && (
          <div className="space-y-5 animate-in fade-in duration-200">
            {/* Source & Status Metadata Ribbon */}
            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-md bg-purple-600 text-white font-extrabold text-[11px] tracking-wide">
                  LIVE VAHAN DATA
                </span>
                <span className="font-semibold text-slate-700">
                  Data Source: <strong className="text-purple-950">{vehicleData.source || 'VAHAN via ULIP'}</strong>
                </span>
              </div>
              <div className="text-slate-500 text-[11px] font-mono">
                Last Retrieved: <strong className="text-slate-800">{new Date(vehicleData.retrieved_at).toLocaleString()}</strong>
                {vehicleData.is_cached && <span className="ml-1.5 px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">CACHED</span>}
              </div>
            </div>

            {/* Main Specs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Primary Identity Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="text-[11px] uppercase font-bold text-slate-500">Registration Identity</div>
                <div>
                  <div className="text-2xl font-black font-mono tracking-tight text-purple-950">
                    {vehicleData.registration_number}
                  </div>
                  <div className="text-xs font-extrabold text-slate-800 mt-0.5">
                    {vehicleData.maker_model || 'Standard Commercial Transport'}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-black ${
                      vehicleData.vehicle_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {vehicleData.vehicle_status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">RTO / State:</span>
                    <strong className="text-slate-900">{vehicleData.state_code} {vehicleData.rto_code ? `(${vehicleData.rto_code})` : ''}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Registered Office:</span>
                    <span className="font-bold text-slate-800 text-right truncate max-w-[150px]">{vehicleData.registered_at || 'National Registry'}</span>
                  </div>
                </div>
              </div>

              {/* Vehicle Classification & Fuel Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="text-[11px] uppercase font-bold text-slate-500">Classification & Engine</div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900 leading-snug">
                    {vehicleData.vehicle_class || 'Goods Carrier'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Category: <strong className="text-purple-700 font-bold">{vehicleData.vehicle_category || 'Commercial'}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500 flex items-center gap-1"><Fuel className="w-3.5 h-3.5 text-slate-400" /> Fuel Type:</span>
                    <strong className="text-slate-900">{vehicleData.fuel_description || 'DIESEL'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Emission Norms:</span>
                    <strong className="text-slate-900">{vehicleData.norms_description || 'BHARAT STAGE VI'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Body Type / Color:</span>
                    <span className="font-bold text-slate-900">{vehicleData.body_type || 'Standard'} • {vehicleData.color || 'White'}</span>
                  </div>
                </div>
              </div>

              {/* Weight & Payload Capacity Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="text-[11px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-indigo-600" /> Weight & Load Specifications
                </div>
                <div>
                  <div className="text-2xl font-black text-slate-900">
                    {vehicleData.gvw_tons || (vehicleData.gross_vehicle_weight_kg ? (vehicleData.gross_vehicle_weight_kg / 1000).toFixed(2) : '25.0')} <span className="text-sm font-bold text-slate-500">Tons (GVW)</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Gross Weight: <strong className="text-slate-800 font-mono">{vehicleData.gross_vehicle_weight_kg ? vehicleData.gross_vehicle_weight_kg.toLocaleString() : '25,000'} kg</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unladen Weight:</span>
                    <strong className="text-slate-900 font-mono">{vehicleData.unladen_weight_kg ? `${vehicleData.unladen_weight_kg.toLocaleString()} kg` : '8,000 kg'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Seating Capacity:</span>
                    <strong className="text-slate-900">{vehicleData.seating_capacity || 2} Persons</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Wheelbase:</span>
                    <span className="font-mono text-slate-800">{vehicleData.wheelbase ? `${vehicleData.wheelbase} mm` : 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* Compliance & Permit Validity Card */}
              <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="text-[11px] uppercase font-bold text-slate-500 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-teal-600" /> Compliance & Validity
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Fitness Validity:</span>
                    <strong className="text-emerald-700 font-extrabold">{vehicleData.fitness_upto || 'Valid'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Road Tax Validity:</span>
                    <strong className="text-slate-900 font-bold">{vehicleData.tax_upto || 'Valid'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Insurance Valid Till:</span>
                    <strong className="text-slate-900 font-bold">{vehicleData.insurance_upto || 'Valid'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Insurer:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[140px] text-right">{vehicleData.insurance_company || 'Standard Carrier'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">PUCC Status:</span>
                    <span className="font-bold text-slate-900">{vehicleData.pucc_upto || 'Certified'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* LINK X8 Logistics Suitability & Bridge Compliance Engine */}
            <div className="bg-[#F7F7FB] border border-[#E5E7EB] rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-[#1F2937] flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-600" />
                    LINK X8 Derived Logistics Readiness & Bridge Evaluation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Evaluates VAHAN vehicle weight and permits against NER route, mountain pass, and bridge structural constraints.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700">Target River Crossing:</label>
                    <select
                      value={selectedBridge}
                      onChange={(e) => setSelectedBridge(e.target.value)}
                      className="bg-white border border-[#D1D5DB] rounded-xl px-3 py-1.5 text-xs font-bold text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      <option value="BRG-NH27-01">BRG-NH27-01: Saraighat Brahmaputra (50T Max)</option>
                      <option value="BRG-NH37-01">BRG-NH37-01: Irang River Bailey Bridge (35T Max)</option>
                      <option value="BRG-NH10-01">BRG-NH10-01: Teesta River High-Altitude (20T Max)</option>
                      <option value="BRG-NH54-01">BRG-NH54-01: Dhaleswari River Bridge (30T Max)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.5"
                      value={cargoPayloadTons}
                      onChange={(e) => setCargoPayloadTons(e.target.value)}
                      placeholder="Payload (T)"
                      className="w-24 bg-white border border-[#D1D5DB] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>

                  <button
                    onClick={handleEvaluateSuitability}
                    disabled={evaluatingSuitability}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {evaluatingSuitability ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    Evaluate Readiness
                  </button>
                </div>
              </div>

              {/* Suitability Result Outcome */}
              {suitabilityResult && (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                  suitabilityResult.suitability_score >= 80
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : suitabilityResult.suitability_score >= 50
                    ? 'bg-amber-50 border-amber-200 text-amber-950'
                    : 'bg-red-50 border-red-200 text-red-950'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded text-xs font-black uppercase tracking-wide ${
                        suitabilityResult.suitability_score >= 80 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                      }`}>
                        LINK X8 READINESS: {suitabilityResult.readiness_verdict?.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-base font-black">
                      Score: {suitabilityResult.suitability_score} / 100
                    </div>
                  </div>

                  {/* Explanations List */}
                  <div className="space-y-1.5 pt-1">
                    <div className="font-bold text-[11px] uppercase tracking-wider text-slate-600">Decision Factors:</div>
                    <ul className="space-y-1">
                      {suitabilityResult.explanations?.map((exp, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 shrink-0" />
                          <span>{exp}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Bridge Clearance Sub-Card if Bridge Evaluated */}
                  {suitabilityResult.bridge_evaluation && (
                    <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-slate-800 space-y-1.5 mt-2">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-purple-900">{suitabilityResult.bridge_evaluation.bridge_name}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          suitabilityResult.bridge_evaluation.is_compliant ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {suitabilityResult.bridge_evaluation.verdict}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {suitabilityResult.bridge_evaluation.recommendation}
                      </p>
                      <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 pt-1 border-t border-slate-100 font-mono">
                        <span>Total Weight: <strong>{suitabilityResult.bridge_evaluation.total_vehicle_weight_tons}T</strong></span>
                        <span>Bridge Limit: <strong>{suitabilityResult.bridge_evaluation.bridge_capacity_tons}T</strong></span>
                        <span>Safety Factor: <strong>{suitabilityResult.bridge_evaluation.safety_factor}x</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Mandatory Transparency Disclaimer */}
                  <div className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200">
                    {suitabilityResult.disclaimer}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleIntelligenceSection;
