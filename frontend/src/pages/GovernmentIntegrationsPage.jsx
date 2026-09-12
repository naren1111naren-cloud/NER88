import React, { useState, useEffect } from 'react';
import { 
  Building2, Database, Shield, Truck, AlertTriangle, 
  CheckCircle2, RefreshCw, Search, ArrowRight, Gauge,
  Radio, Layers, Compass, Lock, ExternalLink, Activity,
  Info, AlertCircle, FileText, Mountain, MapPin
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from '../components/StatusBadge';
import VehicleIntelligenceSection from '../components/VehicleIntelligenceSection';

export const GovernmentIntegrationsPage = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [syncingAgency, setSyncingAgency] = useState(null);

  // Status & Health
  const [govStatus, setGovStatus] = useState(null);

  // Data.gov.in state
  const [dataGovCatalogs, setDataGovCatalogs] = useState([]);
  const [selectedCatalog, setSelectedCatalog] = useState('9ef84268-d588-465a-a308-a864a43d0070');
  const [dataGovRecords, setDataGovRecords] = useState(null);
  const [dataGovLoading, setDataGovLoading] = useState(false);

  // NHAI state
  const [nhaiCorridors, setNhaiCorridors] = useState([]);
  const [nhaiTolls, setNhaiTolls] = useState([]);

  // BRO state
  const [broPasses, setBroPasses] = useState([]);
  const [broBridges, setBroBridges] = useState([]);

  // VAHAN state
  const [vahanSearchPlate, setVahanSearchPlate] = useState('AS01EC9921');
  const [vahanVehicle, setVahanVehicle] = useState(null);
  const [vahanLoading, setVahanLoading] = useState(false);
  const [complianceBridge, setComplianceBridge] = useState('BRG-NH10-01');
  const [compliancePayloadTons, setCompliancePayloadTons] = useState('');
  const [complianceResult, setComplianceResult] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [statusRes, catalogRes, nhaiRes, tollRes, passRes, bridgeRes] = await Promise.allSettled([
        api.get('/government/status'),
        api.get('/government/data-gov/catalog'),
        api.get('/government/nhai/corridors'),
        api.get('/government/nhai/toll-plazas'),
        api.get('/government/bro/mountain-passes'),
        api.get('/government/bro/strategic-bridges')
      ]);

      if (statusRes.status === 'fulfilled') setGovStatus(statusRes.value.data);
      if (catalogRes.status === 'fulfilled') setDataGovCatalogs(catalogRes.value.data);
      if (nhaiRes.status === 'fulfilled') setNhaiCorridors(nhaiRes.value.data);
      if (tollRes.status === 'fulfilled') setNhaiTolls(tollRes.value.data);
      if (passRes.status === 'fulfilled') setBroPasses(passRes.value.data);
      if (bridgeRes.status === 'fulfilled') setBroBridges(bridgeRes.value.data);

      // Trigger initial Data.gov.in query
      fetchDataGovQuery('9ef84268-d588-465a-a308-a864a43d0070');
      // Trigger initial VAHAN lookup
      handleVahanLookup('AS01EC9921');
    } catch (err) {
      console.error('Failed to load initial government integration data', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataGovQuery = async (resId) => {
    setDataGovLoading(true);
    try {
      const res = await api.get(`/government/data-gov/query?resource_id=${resId}&limit=10`);
      setDataGovRecords(res.data);
    } catch (err) {
      showToast('error', 'Failed to fetch Data.gov.in dataset');
    } finally {
      setDataGovLoading(false);
    }
  };

  const handleSyncDataGov = async (resId) => {
    setSyncingAgency('DATA_GOV');
    try {
      const res = await api.post(`/government/data-gov/sync?resource_id=${resId}`);
      showToast('success', `Data.gov.in synced: ${res.data.incidents_created} incidents created, ${res.data.corridors_updated} corridors updated`);
      fetchInitialData();
    } catch (err) {
      showToast('error', 'Data.gov.in synchronization failed');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncNHAI = async () => {
    setSyncingAgency('NHAI');
    try {
      const res = await api.post('/government/nhai/sync');
      showToast('success', `NHAI RAMS synced: ${res.data.corridors_synced} corridors updated, ${res.data.incidents_created} blockages flagged`);
      fetchInitialData();
    } catch (err) {
      showToast('error', 'NHAI synchronization failed');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncBRO = async () => {
    setSyncingAgency('BRO');
    try {
      const res = await api.post('/government/bro/sync');
      showToast('success', `BRO Command synced: ${res.data.mountain_passes_tracked} passes monitored, ${res.data.bridges_updated} bridges updated`);
      fetchInitialData();
    } catch (err) {
      showToast('error', 'BRO synchronization failed');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncVahanFleet = async () => {
    setSyncingAgency('VAHAN');
    try {
      const res = await api.post('/government/vahan/sync-fleet');
      showToast('success', `VAHAN Registry synced: ${res.data.total_vahan_records} commercial vehicles verified & tracked`);
      fetchInitialData();
    } catch (err) {
      showToast('error', 'VAHAN fleet sync failed');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncAllMaster = async () => {
    setSyncingAgency('ALL');
    try {
      const res = await api.post('/government/sync-all');
      showToast('success', 'Master Multi-Agency Sync Complete across Data.gov.in, NHAI, BRO, and VAHAN!');
      fetchInitialData();
    } catch (err) {
      showToast('error', 'Master multi-agency sync failed');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleVahanLookup = async (plate) => {
    const clean = (plate || vahanSearchPlate).trim();
    if (!clean) return;
    setVahanLoading(true);
    setComplianceResult(null);
    try {
      const res = await api.get(`/government/vahan/vehicle/${clean}`);
      setVahanVehicle(res.data);
    } catch (err) {
      showToast('error', `Vehicle '${clean}' not found in VAHAN registry`);
      setVahanVehicle(null);
    } finally {
      setVahanLoading(false);
    }
  };

  const handleCheckBridgeCompliance = async () => {
    if (!vahanVehicle) {
      showToast('warning', 'Please lookup a registered vehicle first');
      return;
    }
    setComplianceLoading(true);
    try {
      const payload = {
        registration_number: vahanVehicle.registration_number,
        bridge_code_or_name: complianceBridge,
        actual_payload_tons: compliancePayloadTons ? parseFloat(compliancePayloadTons) : undefined
      };
      const res = await api.post('/government/vahan/verify-compliance', payload);
      setComplianceResult(res.data);
      if (res.data.is_compliant) {
        showToast('success', 'Vehicle Clearance Approved: Within bridge weight limit!');
      } else {
        showToast('error', 'OVERWEIGHT ALERT: Passage strictly prohibited!');
      }
    } catch (err) {
      showToast('error', 'Compliance evaluation failed');
    } finally {
      setComplianceLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#171329] via-[#231C3D] to-[#171329] border border-[#332A57] rounded-xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Integration Adapter Contracts (Pending NIC Gateway Keys)
              </span>
              <StatusBadge variant="simulation" size="sm">Sandbox Adapter</StatusBadge>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Building2 className="w-7 h-7 text-purple-400" />
              Government Integration Contracts & Sandbox Adapters
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Integration adapter contracts for <strong>data.gov.in</strong>, <strong>NHAI RAMS & FASTag</strong>, <strong>Border Roads Organisation (BRO)</strong>, and <strong>MoRTH VAHAN</strong> (operating under sandbox mock contracts pending NIC production API credentials).
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSyncAllMaster}
              disabled={syncingAgency === 'ALL'}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingAgency === 'ALL' ? 'animate-spin' : ''}`} />
              {syncingAgency === 'ALL' ? 'Synchronizing All Feeds...' : '1-Click Sync All Agencies'}
            </button>
          </div>
        </div>

        {/* Agency Readiness Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-5 border-t border-[#332A57]">
          <div className="bg-[#120E22]/80 border border-purple-500/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>data.gov.in</span>
              <StatusBadge variant="simulation" size="sm">Sandbox</StatusBadge>
            </div>
            <div className="font-bold text-xs text-white mt-1">OGD India Platform</div>
            <div className="text-[10px] text-purple-300 mt-0.5">3 Active Catalogs</div>
          </div>

          <div className="bg-[#120E22]/80 border border-purple-500/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>NHAI RAMS</span>
              <StatusBadge variant="simulation" size="sm">Sandbox</StatusBadge>
            </div>
            <div className="font-bold text-xs text-white mt-1">National Highways</div>
            <div className="text-[10px] text-purple-300 mt-0.5">{nhaiCorridors.length} NER Corridors</div>
          </div>

          <div className="bg-[#120E22]/80 border border-purple-500/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>BRO Command</span>
              <StatusBadge variant="simulation" size="sm">Sandbox</StatusBadge>
            </div>
            <div className="font-bold text-xs text-white mt-1">Border Roads Org</div>
            <div className="text-[10px] text-purple-300 mt-0.5">{broPasses.length} Mountain Passes</div>
          </div>

          <div className="bg-[#120E22]/80 border border-purple-500/20 rounded-lg p-2.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>MoRTH VAHAN</span>
              <StatusBadge variant="simulation" size="sm">Sandbox</StatusBadge>
            </div>
            <div className="font-bold text-xs text-white mt-1">National Registry</div>
            <div className="text-[10px] text-purple-300 mt-0.5">GVW & Permits</div>
          </div>

          <div className="bg-[#120E22]/80 border border-purple-500/20 rounded-lg p-2.5 col-span-2 sm:col-span-4 lg:col-span-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>NDMA Sachet</span>
              <StatusBadge variant="simulation" size="sm">Sandbox</StatusBadge>
            </div>
            <div className="font-bold text-xs text-white mt-1">CAP Early Warning</div>
            <div className="text-[10px] text-purple-300 mt-0.5">Flood & Landslides</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview & Gateway Health
        </button>

        <button
          onClick={() => setActiveTab('data_gov')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'data_gov'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Database className="w-4 h-4" />
          data.gov.in Explorer
        </button>

        <button
          onClick={() => setActiveTab('nhai')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'nhai'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Compass className="w-4 h-4" />
          NHAI Highways & FASTag
        </button>

        <button
          onClick={() => setActiveTab('bro')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'bro'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Mountain className="w-4 h-4" />
          BRO Mountain & Bridges
        </button>

        <button
          onClick={() => setActiveTab('vahan')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'vahan'
              ? 'bg-[#171329] text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-4 h-4" />
          VAHAN RC & Bridge Clearance
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">data.gov.in</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Active</span>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">3 Catalogs</div>
              <p className="text-xs text-slate-500 mt-1">MoRTH roads, IMD rainfall, Consumer goods</p>
              <button
                onClick={() => handleSyncDataGov(selectedCatalog)}
                disabled={syncingAgency === 'DATA_GOV'}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'DATA_GOV' ? 'animate-spin' : ''}`} />
                Sync OGD Feed
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">NHAI RAMS</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Live ATMS</span>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">{nhaiCorridors.length} Corridors</div>
              <p className="text-xs text-slate-500 mt-1">NH-27, NH-37, NH-102, NH-29, NH-6</p>
              <button
                onClick={handleSyncNHAI}
                disabled={syncingAgency === 'NHAI'}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'NHAI' ? 'animate-spin' : ''}`} />
                Sync NHAI Telemetry
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">BRO Command</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Defence Feed</span>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">{broPasses.length} Passes / {broBridges.length} Bridges</div>
              <p className="text-xs text-slate-500 mt-1">Sela, Bum La, Saraighat, Bailey limits</p>
              <button
                onClick={handleSyncBRO}
                disabled={syncingAgency === 'BRO'}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'BRO' ? 'animate-spin' : ''}`} />
                Sync BRO Intelligence
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">MoRTH VAHAN</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">Verified</span>
              </div>
              <div className="mt-3 text-2xl font-black text-slate-900">National Permit</div>
              <p className="text-xs text-slate-500 mt-1">Axle load & bridge clearance engine</p>
              <button
                onClick={handleSyncVahanFleet}
                disabled={syncingAgency === 'VAHAN'}
                className="mt-4 w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'VAHAN' ? 'animate-spin' : ''}`} />
                Sync VAHAN Fleet
              </button>
            </div>
          </div>

          {/* Connected Agency Specifications */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Connected Government Authorities & Security Protocol
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2.5 px-3">Agency Name</th>
                    <th className="py-2.5 px-3">Agency Code</th>
                    <th className="py-2.5 px-3">Monitored Domains</th>
                    <th className="py-2.5 px-3">Auth Mode</th>
                    <th className="py-2.5 px-3">Integration Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(govStatus?.connected_agencies || []).map((ag, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-semibold text-slate-900">{ag.agency_name}</td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">{ag.agency_code}</td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {ag.monitored_domains.map((d, di) => (
                            <span key={di} className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded text-[10px] font-medium">
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-medium">{ag.auth_type}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          {ag.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATA.GOV.IN EXPLORER */}
      {activeTab === 'data_gov' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Database className="w-5 h-5 text-indigo-600" />
                  Open Government Data (data.gov.in) Catalog Explorer
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Query and pull official ministry datasets directly into LINK X8 logistics intelligence models.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedCatalog}
                  onChange={(e) => {
                    setSelectedCatalog(e.target.value);
                    fetchDataGovQuery(e.target.value);
                  }}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {dataGovCatalogs.map((cat) => (
                    <option key={cat.resource_id} value={cat.resource_id}>
                      {cat.title.slice(0, 50)}...
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleSyncDataGov(selectedCatalog)}
                  disabled={syncingAgency === 'DATA_GOV'}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'DATA_GOV' ? 'animate-spin' : ''}`} />
                  Ingest to DB
                </button>
              </div>
            </div>

            {/* Selected Catalog Metadata Card */}
            {(() => {
              const cat = dataGovCatalogs.find((c) => c.resource_id === selectedCatalog);
              if (!cat) return null;
              return (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-4 mb-6 text-xs text-indigo-950 space-y-1">
                  <div className="font-bold text-sm text-indigo-900">{cat.title}</div>
                  <div className="text-slate-600">{cat.description}</div>
                  <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-slate-500">
                    <span><strong>Ministry:</strong> {cat.ministry}</span>
                    <span><strong>Category:</strong> {cat.category}</span>
                    <span><strong>Refresh:</strong> {cat.refresh_rate}</span>
                    <span><strong>Resource ID:</strong> <code className="font-mono bg-white px-1 py-0.5 rounded">{cat.resource_id}</code></span>
                  </div>
                </div>
              );
            })()}

            {/* Data Records View */}
            {dataGovLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mb-2" />
                <span className="text-xs">Fetching records from data.gov.in...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-100 rounded-lg">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      {dataGovRecords?.records?.[0] && Object.keys(dataGovRecords.records[0]).slice(0, 6).map((k) => (
                        <th key={k} className="py-2.5 px-3">{k.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataGovRecords?.records?.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {Object.values(r).slice(0, 6).map((val, vi) => (
                          <td key={vi} className="py-2.5 px-3 text-slate-700">
                            {typeof val === 'number' ? val.toLocaleString() : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: NHAI HIGHWAYS & FASTAG */}
      {activeTab === 'nhai' && (
        <div className="space-y-6">
          {/* Header Action */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">National Highways Authority of India (RAMS Telemetry)</h3>
              <p className="text-xs text-slate-500">Live corridor distress, pavement indices, and FASTag toll queue metrics.</p>
            </div>
            <button
              onClick={handleSyncNHAI}
              disabled={syncingAgency === 'NHAI'}
              className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'NHAI' ? 'animate-spin' : ''}`} />
              Sync NHAI
            </button>
          </div>

          {/* Corridor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nhaiCorridors.map((c) => (
              <div key={c.corridor_code} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded font-black text-xs">
                      {c.nh_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      c.active_blockages > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {c.active_blockages > 0 ? `${c.active_blockages} Blockage Active` : 'Open / Clear'}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 mt-2.5">{c.name}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">{c.nhai_project_director_office}</p>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Pavement Health</span>
                      <div className="font-bold text-slate-800 mt-0.5">{c.pavement_condition_index} / 100</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Avg Speed</span>
                      <div className="font-bold text-slate-800 mt-0.5">{c.avg_speed_kmh} km/h</div>
                    </div>
                  </div>

                  <div className="mt-3 p-2 bg-slate-50 rounded text-[11px] text-slate-700">
                    <span className="font-semibold">Condition:</span> {c.surface_status}
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-4 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span>{c.lane_configuration}</span>
                  <span>{c.corridor_code}</span>
                </div>
              </div>
            ))}
          </div>

          {/* FASTag Toll Plazas */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-purple-600" />
              NETC FASTag Electronic Toll Transit Density
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {nhaiTolls.map((t) => (
                <div key={t.plaza_id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span>{t.plaza_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      t.congestion_level === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {t.congestion_level} Traffic
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px] mt-0.5">{t.highway} • {t.district}</div>

                  <div className="mt-3 space-y-1 text-slate-700">
                    <div className="flex justify-between">
                      <span>FASTag Penetration:</span>
                      <strong>{t.fastag_penetration_rate_pct}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Wait Time:</span>
                      <strong>{t.avg_wait_time_minutes} mins</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Queue Length:</span>
                      <strong>{t.queue_length_meters} meters</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BRO MOUNTAIN & BRIDGES */}
      {activeTab === 'bro' && (
        <div className="space-y-6">
          {/* Header Action */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Border Roads Organisation (Ministry of Defence)</h3>
              <p className="text-xs text-slate-500">Real-time mountain pass clearance, snow depth, and strategic Bailey bridge load limits.</p>
            </div>
            <button
              onClick={handleSyncBRO}
              disabled={syncingAgency === 'BRO'}
              className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'BRO' ? 'animate-spin' : ''}`} />
              Sync BRO
            </button>
          </div>

          {/* Mountain Passes Grid */}
          <div>
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-3">High-Altitude Mountain Passes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {broPasses.map((p) => (
                <div key={p.pass_code} className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded font-bold text-[10px]">
                        {p.project_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.operational_status.includes('OPEN') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {p.operational_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h5 className="font-bold text-sm text-slate-900 mt-2.5">{p.pass_name}</h5>
                    <p className="text-xs text-slate-500">{p.district}, {p.state}</p>

                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Elevation:</span>
                        <strong className="text-slate-800">{p.elevation_ft.toLocaleString()} ft</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Snow Depth:</span>
                        <strong className="text-slate-800">{p.snow_depth_cm} cm</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Max GVW:</span>
                        <strong className="text-slate-800">{p.max_authorized_gross_weight_tons} Tons</strong>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <span>Convoy Window: {p.military_convoy_priority_window}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Bridges Table */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h4 className="font-bold text-sm text-slate-900 mb-4">BRO Strategic River Bridges & Bailey Classifications</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase">
                    <th className="py-2.5 px-3">Bridge Name</th>
                    <th className="py-2.5 px-3">River</th>
                    <th className="py-2.5 px-3">BRO Project</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Max Load</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {broBridges.map((b) => (
                    <tr key={b.bridge_code} className="hover:bg-slate-50">
                      <td className="py-3 px-3 font-semibold text-slate-900">{b.name}</td>
                      <td className="py-3 px-3 text-slate-600">{b.river}</td>
                      <td className="py-3 px-3 text-slate-600">{b.project}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-indigo-700 font-medium">{b.load_classification}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{b.current_capacity_tons} Tons</td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status.includes('OPEN') ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: VAHAN RC & BRIDGE CLEARANCE ENGINE */}
      {activeTab === 'vahan' && (
        <VehicleIntelligenceSection initialPlate={vahanSearchPlate || 'AS01EC9921'} />
      )}

    </div>
  );
};

export default GovernmentIntegrationsPage;
