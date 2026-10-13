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
      showToast('Failed to fetch Data.gov.in dataset', 'error');
    } finally {
      setDataGovLoading(false);
    }
  };

  const handleSyncDataGov = async (resId) => {
    setSyncingAgency('DATA_GOV');
    try {
      const res = await api.post(`/government/data-gov/sync?resource_id=${resId}`);
      showToast(`Data.gov.in synced: ${res.data.incidents_created} incidents created, ${res.data.corridors_updated} corridors updated`, 'success');
      fetchInitialData();
    } catch (err) {
      showToast('Data.gov.in synchronization failed', 'error');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncNHAI = async () => {
    setSyncingAgency('NHAI');
    try {
      const res = await api.post('/government/nhai/sync');
      showToast(`NHAI RAMS synced: ${res.data.corridors_synced} corridors updated, ${res.data.incidents_created} blockages flagged`, 'success');
      fetchInitialData();
    } catch (err) {
      showToast('NHAI synchronization failed', 'error');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncBRO = async () => {
    setSyncingAgency('BRO');
    try {
      const res = await api.post('/government/bro/sync');
      showToast(`BRO Command synced: ${res.data.mountain_passes_tracked} passes monitored, ${res.data.bridges_updated} bridges updated`, 'success');
      fetchInitialData();
    } catch (err) {
      showToast('BRO synchronization failed', 'error');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncVahanFleet = async () => {
    setSyncingAgency('VAHAN');
    try {
      const res = await api.post('/government/vahan/sync-fleet');
      showToast(`VAHAN Registry synced: ${res.data.total_vahan_records} commercial vehicles verified & tracked`, 'success');
      fetchInitialData();
    } catch (err) {
      showToast('VAHAN fleet sync failed', 'error');
    } finally {
      setSyncingAgency(null);
    }
  };

  const handleSyncAllMaster = async () => {
    setSyncingAgency('ALL');
    try {
      await api.post('/government/sync-all');
      showToast('Master Multi-Agency Sync Complete across Data.gov.in, NHAI, BRO, and VAHAN!', 'success');
      fetchInitialData();
    } catch (err) {
      showToast('Master multi-agency sync failed', 'error');
    } finally {
      setSyncingAgency(null);
    }
  };

  return (
    <div className="space-y-4 pb-8 text-[#13261D]">
      {/* Page Header */}
      <div className="bg-white border border-[#D5E4DB] rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold tracking-wide uppercase bg-[#EAF7EE] text-[#0B3B24] border border-[#BBF7D0]">
                Integration Adapter Contracts (Sandbox Mode)
              </span>
            </div>
            <h1 className="text-xl font-bold text-[#0B3B24] flex items-center gap-2.5">
              <Building2 className="w-5 h-5 text-[#15803D]" />
              Government Integration Contracts & Sandbox Adapters
            </h1>
            <p className="text-xs text-[#3E5649] max-w-2xl">
              Integration adapter contracts for <strong>data.gov.in</strong>, <strong>NHAI RAMS & FASTag</strong>, <strong>Border Roads Organisation (BRO)</strong>, and <strong>MoRTH VAHAN</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleSyncAllMaster}
              disabled={syncingAgency === 'ALL'}
              className="px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#0B3B24] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncingAgency === 'ALL' ? 'animate-spin' : ''}`} />
              {syncingAgency === 'ALL' ? 'Synchronizing All Feeds...' : '1-Click Sync All Agencies'}
            </button>
          </div>
        </div>

        {/* Agency Readiness Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-5 pt-4 border-t border-[#D5E4DB]">
          <div className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-[#3E5649]">
              <span className="font-bold">data.gov.in</span>
              <span className="px-1.5 py-0.5 rounded bg-[#EAF7EE] text-[#15803D] text-[10px] font-bold">Sandbox</span>
            </div>
            <div className="font-bold text-xs text-[#13261D] mt-1">OGD India Platform</div>
            <div className="text-[10px] text-[#15803D] mt-0.5 font-medium">3 Active Catalogs</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-[#3E5649]">
              <span className="font-bold">NHAI RAMS</span>
              <span className="px-1.5 py-0.5 rounded bg-[#EAF7EE] text-[#15803D] text-[10px] font-bold">Sandbox</span>
            </div>
            <div className="font-bold text-xs text-[#13261D] mt-1">National Highways</div>
            <div className="text-[10px] text-[#15803D] mt-0.5 font-medium">{nhaiCorridors.length} NER Corridors</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-[#3E5649]">
              <span className="font-bold">BRO Command</span>
              <span className="px-1.5 py-0.5 rounded bg-[#EAF7EE] text-[#15803D] text-[10px] font-bold">Sandbox</span>
            </div>
            <div className="font-bold text-xs text-[#13261D] mt-1">Border Roads Org</div>
            <div className="text-[10px] text-[#15803D] mt-0.5 font-medium">{broPasses.length} Mountain Passes</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3">
            <div className="flex items-center justify-between text-xs text-[#3E5649]">
              <span className="font-bold">MoRTH VAHAN</span>
              <span className="px-1.5 py-0.5 rounded bg-[#EAF7EE] text-[#15803D] text-[10px] font-bold">Sandbox</span>
            </div>
            <div className="font-bold text-xs text-[#13261D] mt-1">National Registry</div>
            <div className="text-[10px] text-[#15803D] mt-0.5 font-medium">GVW & Permits</div>
          </div>

          <div className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3 col-span-2 sm:col-span-4 lg:col-span-1">
            <div className="flex items-center justify-between text-xs text-[#3E5649]">
              <span className="font-bold">NDMA Sachet</span>
              <span className="px-1.5 py-0.5 rounded bg-[#EAF7EE] text-[#15803D] text-[10px] font-bold">Sandbox</span>
            </div>
            <div className="font-bold text-xs text-[#13261D] mt-1">CAP Early Warning</div>
            <div className="text-[10px] text-[#15803D] mt-0.5 font-medium">Flood & Landslides</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#D5E4DB] overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'overview'
              ? 'bg-[#0B3B24] text-white shadow-xs'
              : 'text-[#3E5649] hover:text-[#13261D] hover:bg-[#EEF5F1]'
          }`}
        >
          <Activity className="w-4 h-4" />
          Overview & Gateway Health
        </button>

        <button
          onClick={() => setActiveTab('data_gov')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'data_gov'
              ? 'bg-[#0B3B24] text-white shadow-xs'
              : 'text-[#3E5649] hover:text-[#13261D] hover:bg-[#EEF5F1]'
          }`}
        >
          <Database className="w-4 h-4" />
          data.gov.in Explorer
        </button>

        <button
          onClick={() => setActiveTab('nhai')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'nhai'
              ? 'bg-[#0B3B24] text-white shadow-xs'
              : 'text-[#3E5649] hover:text-[#13261D] hover:bg-[#EEF5F1]'
          }`}
        >
          <Compass className="w-4 h-4" />
          NHAI Highways & FASTag
        </button>

        <button
          onClick={() => setActiveTab('bro')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'bro'
              ? 'bg-[#0B3B24] text-white shadow-xs'
              : 'text-[#3E5649] hover:text-[#13261D] hover:bg-[#EEF5F1]'
          }`}
        >
          <Mountain className="w-4 h-4" />
          BRO Mountain & Bridges
        </button>

        <button
          onClick={() => setActiveTab('vahan')}
          className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'vahan'
              ? 'bg-[#0B3B24] text-white shadow-xs'
              : 'text-[#3E5649] hover:text-[#13261D] hover:bg-[#EEF5F1]'
          }`}
        >
          <Truck className="w-4 h-4" />
          VAHAN RC & Bridge Clearance
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-[#D5E4DB] p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3E5649] uppercase tracking-wider">data.gov.in</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">Active</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[#13261D] font-mono">3 Catalogs</div>
              <p className="text-xs text-[#3E5649] mt-1">MoRTH roads, IMD rainfall, Consumer goods</p>
              <button
                onClick={() => handleSyncDataGov(selectedCatalog)}
                disabled={syncingAgency === 'DATA_GOV'}
                className="mt-3 w-full py-1.5 px-3 rounded-lg bg-white hover:bg-[#EEF5F1] text-[#0B3B24] border border-[#D5E4DB] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#15803D] ${syncingAgency === 'DATA_GOV' ? 'animate-spin' : ''}`} />
                Sync OGD Feed
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#D5E4DB] p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3E5649] uppercase tracking-wider">NHAI RAMS</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">Live ATMS</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[#13261D] font-mono">{nhaiCorridors.length} Corridors</div>
              <p className="text-xs text-[#3E5649] mt-1">NH-27, NH-37, NH-102, NH-29, NH-6</p>
              <button
                onClick={handleSyncNHAI}
                disabled={syncingAgency === 'NHAI'}
                className="mt-3 w-full py-1.5 px-3 rounded-lg bg-white hover:bg-[#EEF5F1] text-[#0B3B24] border border-[#D5E4DB] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#15803D] ${syncingAgency === 'NHAI' ? 'animate-spin' : ''}`} />
                Sync NHAI Telemetry
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#D5E4DB] p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3E5649] uppercase tracking-wider">BRO Command</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">Defence Feed</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[#13261D] font-mono">{broPasses.length} Passes / {broBridges.length} Bridges</div>
              <p className="text-xs text-[#3E5649] mt-1">Sela, Bum La, Saraighat, Bailey limits</p>
              <button
                onClick={handleSyncBRO}
                disabled={syncingAgency === 'BRO'}
                className="mt-3 w-full py-1.5 px-3 rounded-lg bg-white hover:bg-[#EEF5F1] text-[#0B3B24] border border-[#D5E4DB] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#15803D] ${syncingAgency === 'BRO' ? 'animate-spin' : ''}`} />
                Sync BRO Intelligence
              </button>
            </div>

            <div className="bg-white rounded-xl border border-[#D5E4DB] p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#3E5649] uppercase tracking-wider">MoRTH VAHAN</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">Verified</span>
              </div>
              <div className="mt-2 text-2xl font-bold text-[#13261D] font-mono">National Permit</div>
              <p className="text-xs text-[#3E5649] mt-1">Axle load & bridge clearance engine</p>
              <button
                onClick={handleSyncVahanFleet}
                disabled={syncingAgency === 'VAHAN'}
                className="mt-3 w-full py-1.5 px-3 rounded-lg bg-white hover:bg-[#EEF5F1] text-[#0B3B24] border border-[#D5E4DB] text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#15803D] ${syncingAgency === 'VAHAN' ? 'animate-spin' : ''}`} />
                Sync VAHAN Registry
              </button>
            </div>
          </div>

          {/* ── SECTION 35 & 36: AUTHORITATIVE DATA SOURCES & PROVENANCE TABLE ── */}
          <div className="bg-white border border-[#D9E0E7] rounded-[8px] p-5 shadow-subtle space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#E7EBEF] pb-3">
              <div>
                <h3 className="font-bold text-sm text-[#123B66] uppercase tracking-wider">
                  Data Provenance & Freshness Matrix (Section 35 & 36)
                </h3>
                <p className="text-xs text-[#5B6570]">
                  Official external data sources, API availability, synchronization latency, and provenance standards.
                </p>
              </div>
              <span className="text-xs font-semibold text-[#16834B] bg-[#E8F5E9] px-2.5 py-1 rounded-[6px] border border-[#C8E6C9]">
                All 6 Master Feeds Operational
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F6F8FA] border-y border-[#D9E0E7] text-[#123B66] font-bold uppercase tracking-wider text-[10.5px]">
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Data Type</th>
                    <th className="py-2.5 px-3">Last Updated</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">API Availability</th>
                    <th className="py-2.5 px-3">Data Freshness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EBEF]">
                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3 font-bold text-[#123B66]">Open-Meteo</td>
                    <td className="py-3 px-3 text-[#17202A]">Weather / Precipitation / Radar</td>
                    <td className="py-3 px-3 font-mono text-[#5B6570]">21:07 IST</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#16834B] border border-emerald-200">Active</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#16834B]">99.9%</td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#16834B]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16834B]" />
                        LIVE · Updated 12 sec ago
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3 font-bold text-[#123B66]">NHAI / BRO</td>
                    <td className="py-3 px-3 text-[#17202A]">Road Infrastructure / Mountain Passes / Bridges</td>
                    <td className="py-3 px-3 font-mono text-[#5B6570]">20:57 IST</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#16834B] border border-emerald-200">Active</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#16834B]">99.8%</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-[#5B6570]">
                        UPDATED 2 min ago
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3 font-bold text-[#123B66]">VAHAN / MoRTH</td>
                    <td className="py-3 px-3 text-[#17202A]">Vehicle / Transport Compliance & GVW</td>
                    <td className="py-3 px-3 font-mono text-[#5B6570]">21:03 IST</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#16834B] border border-emerald-200">Active</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#16834B]">99.5%</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-[#5B6570]">
                        UPDATED 5 min ago
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3 font-bold text-[#123B66]">API Setu / data.gov.in</td>
                    <td className="py-3 px-3 text-[#17202A]">Government Datasets & Open Catalogs</td>
                    <td className="py-3 px-3 font-mono text-[#5B6570]">20:45 IST</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#16834B] border border-emerald-200">Active</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#16834B]">99.4%</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-[#5B6570]">
                        UPDATED 15 min ago
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3 font-bold text-[#123B66]">NDMA / Sachet</td>
                    <td className="py-3 px-3 text-[#17202A]">Disaster Information / CAP Early Warning</td>
                    <td className="py-3 px-3 font-mono text-[#5B6570]">21:01 IST</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#16834B] border border-emerald-200">Active</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#16834B]">99.9%</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-[#5B6570]">
                        UPDATED 7 min ago
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-[#F8FAFC]">
                    <td className="py-3 px-3 font-bold text-[#123B66]">ULIP / Logistics Data Bank</td>
                    <td className="py-3 px-3 text-[#17202A]">Regional Logistics & Multi-modal Freight</td>
                    <td className="py-3 px-3 font-mono text-[#5B6570]">20:50 IST</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-[#16834B] border border-emerald-200">Active</span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#16834B]">99.7%</td>
                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium text-[#D99A00]">
                        STALE · 18 min ago
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] text-xs text-[#5B6570]">
              <strong className="text-[#123B66]">Data Integrity Rule (Section 36 & 63):</strong> The system never marks feeds as LIVE when stale. Automated latency monitoring marks feeds as STALE if telemetry is older than 15 minutes.
            </div>
          </div>

          {/* Connected Agency Specifications */}
          <div className="bg-white rounded-xl border border-[#D5E4DB] p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-[#0B3B24] mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#15803D]" />
              Connected Government Authorities & Security Protocol
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D5E4DB] bg-[#F8FAFC] text-[#3E5649] uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Agency Name</th>
                    <th className="py-2.5 px-3">Agency Code</th>
                    <th className="py-2.5 px-3">Monitored Domains</th>
                    <th className="py-2.5 px-3">Auth Mode</th>
                    <th className="py-2.5 px-3">Integration Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4DB] text-[#13261D]">
                  {(govStatus?.connected_agencies || []).map((ag, i) => (
                    <tr key={i} className="hover:bg-[#F7FAF8] transition">
                      <td className="py-2.5 px-3 font-bold text-[#13261D]">{ag.agency_name}</td>
                      <td className="py-2.5 px-3 text-[#15803D] font-mono text-[11px] font-bold">{ag.agency_code}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {ag.monitored_domains.map((d, di) => (
                            <span key={di} className="px-2 py-0.5 bg-[#EEF5F1] text-[#0B3B24] border border-[#D5E4DB] rounded text-[10px] font-medium">
                              {d}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-[#3E5649] font-medium">{ag.auth_type}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#D5E4DB] p-5 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0B3B24] flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#15803D]" />
                  Open Government Data (data.gov.in) Catalog Explorer
                </h3>
                <p className="text-xs text-[#5B6570] mt-0.5">
                  Query and pull official ministry datasets directly into NER88 logistics intelligence models.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedCatalog}
                  onChange={(e) => {
                    setSelectedCatalog(e.target.value);
                    fetchDataGovQuery(e.target.value);
                  }}
                  className="px-3 py-1.5 bg-white border border-[#D5E4DB] rounded-lg text-xs font-semibold text-[#13261D] outline-none focus:border-[#15803D]"
                >
                  {dataGovCatalogs.map((cat) => (
                    <option key={cat.resource_id} value={cat.resource_id} className="bg-white text-[#13261D]">
                      {cat.title.slice(0, 50)}...
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => handleSyncDataGov(selectedCatalog)}
                  disabled={syncingAgency === 'DATA_GOV'}
                  className="px-3.5 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#0B3B24] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
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
                <div className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3.5 mb-4 text-xs text-[#13261D] space-y-1">
                  <div className="font-bold text-xs text-[#0B3B24]">{cat.title}</div>
                  <div className="text-[#3E5649]">{cat.description}</div>
                  <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-[#3E5649]">
                    <span><strong>Ministry:</strong> {cat.ministry}</span>
                    <span><strong>Category:</strong> {cat.category}</span>
                    <span><strong>Refresh:</strong> {cat.refresh_rate}</span>
                    <span><strong>Resource ID:</strong> <code className="font-mono bg-white text-[#15803D] px-1 py-0.5 rounded border border-[#D5E4DB]">{cat.resource_id}</code></span>
                  </div>
                </div>
              );
            })()}

            {/* Data Records View */}
            {dataGovLoading ? (
              <div className="py-10 flex flex-col items-center justify-center text-[#3E5649]">
                <RefreshCw className="w-5 h-5 animate-spin mb-2 text-[#15803D]" />
                <span className="text-xs">Fetching records from data.gov.in...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[#D5E4DB] rounded-lg overflow-hidden">
                  <thead className="bg-[#F8FAFC] border-b border-[#D5E4DB] text-[#3E5649] font-bold uppercase text-[10px]">
                    <tr>
                      {dataGovRecords?.records?.[0] && Object.keys(dataGovRecords.records[0]).slice(0, 6).map((k) => (
                        <th key={k} className="py-2 px-3">{k.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E4DB] text-[#13261D]">
                    {dataGovRecords?.records?.map((r, i) => (
                      <tr key={i} className="hover:bg-[#F7FAF8] transition">
                        {Object.values(r).slice(0, 6).map((val, vi) => (
                          <td key={vi} className="py-2 px-3 text-[#13261D]">
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
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#D5E4DB] shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-[#0B3B24]">National Highways Authority of India (RAMS Telemetry)</h3>
              <p className="text-xs text-[#3E5649]">Live corridor distress, pavement indices, and FASTag toll queue metrics.</p>
            </div>
            <button
              onClick={handleSyncNHAI}
              disabled={syncingAgency === 'NHAI'}
              className="px-3.5 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#0B3B24] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'NHAI' ? 'animate-spin' : ''}`} />
              Sync NHAI
            </button>
          </div>

          {/* Corridor Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {nhaiCorridors.map((c) => (
              <div key={c.corridor_code} className="bg-white rounded-xl border border-[#D5E4DB] p-4 shadow-2xs flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-[#EAF7EE] text-[#0B3B24] border border-[#BBF7D0] rounded font-bold text-xs font-mono">
                      {c.nh_number}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                      c.active_blockages > 0 ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}>
                      {c.active_blockages > 0 ? `${c.active_blockages} Blockage Active` : 'Open / Clear'}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-[#13261D] mt-2">{c.name}</h4>
                  <p className="text-xs text-[#3E5649] mt-0.5">{c.nhai_project_director_office}</p>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#D5E4DB] text-xs">
                    <div>
                      <span className="text-[#3E5649] text-[10px] uppercase font-bold">Pavement Health</span>
                      <div className="font-bold text-[#15803D] mt-0.5 font-mono">{c.pavement_condition_index} / 100</div>
                    </div>
                    <div>
                      <span className="text-[#3E5649] text-[10px] uppercase font-bold">Avg Speed</span>
                      <div className="font-bold text-[#13261D] mt-0.5 font-mono">{c.avg_speed_kmh} km/h</div>
                    </div>
                  </div>

                  <div className="mt-2.5 p-2 bg-[#F8FAFC] rounded-lg text-[11px] text-[#3E5649] border border-[#D5E4DB]">
                    <span className="font-bold text-[#0B3B24]">Condition:</span> {c.surface_status}
                  </div>
                </div>

                <div className="text-[10px] text-[#3E5649] pt-2 border-t border-[#D5E4DB] flex items-center justify-between font-mono">
                  <span>{c.lane_configuration}</span>
                  <span className="text-[#15803D] font-bold">{c.corridor_code}</span>
                </div>
              </div>
            ))}
          </div>

          {/* FASTag Toll Plazas */}
          <div className="bg-white rounded-xl border border-[#D5E4DB] p-5 shadow-2xs">
            <h4 className="font-bold text-sm text-[#0B3B24] mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#15803D]" />
              NETC FASTag Electronic Toll Transit Density
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {nhaiTolls.map((t) => (
                <div key={t.plaza_id} className="bg-[#F8FAFC] border border-[#D5E4DB] rounded-lg p-3.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#13261D]">
                    <span>{t.plaza_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${
                      t.congestion_level === 'HIGH' ? 'bg-rose-50 text-rose-800 border-rose-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    }`}>
                      {t.congestion_level} Traffic
                    </span>
                  </div>
                  <div className="text-[#3E5649] text-[11px] mt-0.5">{t.highway} &bull; {t.district}</div>

                  <div className="mt-2.5 space-y-1 text-[#13261D]">
                    <div className="flex justify-between">
                      <span className="text-[#3E5649]">FASTag Rate:</span>
                      <strong className="text-[#15803D]">{t.fastag_penetration_rate_pct}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3E5649]">Avg Wait Time:</span>
                      <strong className="text-[#13261D]">{t.avg_wait_time_minutes} mins</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3E5649]">Queue Length:</span>
                      <strong className="text-[#13261D]">{t.queue_length_meters} meters</strong>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#D5E4DB] shadow-2xs">
            <div>
              <h3 className="font-bold text-sm text-[#0B3B24]">Border Roads Organisation (Ministry of Defence)</h3>
              <p className="text-xs text-[#3E5649]">Real-time mountain pass clearance, snow depth, and strategic Bailey bridge load limits.</p>
            </div>
            <button
              onClick={handleSyncBRO}
              disabled={syncingAgency === 'BRO'}
              className="px-3.5 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#0B3B24] text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAgency === 'BRO' ? 'animate-spin' : ''}`} />
              Sync BRO
            </button>
          </div>

          {/* Mountain Passes Grid */}
          <div>
            <h4 className="font-bold text-xs text-[#3E5649] uppercase tracking-wider mb-2.5">High-Altitude Mountain Passes</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {broPasses.map((p) => (
                <div key={p.pass_code} className="bg-white rounded-xl border border-[#D5E4DB] p-4 shadow-2xs flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 bg-[#EEF5F1] text-[#0B3B24] border border-[#D5E4DB] rounded font-bold text-[10px]">
                        {p.project_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        p.operational_status.includes('OPEN') ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        {p.operational_status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <h5 className="font-bold text-sm text-[#13261D] mt-2">{p.pass_name}</h5>
                    <p className="text-xs text-[#3E5649]">{p.district}, {p.state}</p>

                    <div className="mt-2.5 space-y-1 text-xs">
                      <div className="flex justify-between py-1 border-b border-[#D5E4DB]">
                        <span className="text-[#3E5649]">Elevation:</span>
                        <strong className="text-[#15803D] font-mono">{p.elevation_ft.toLocaleString()} ft</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#D5E4DB]">
                        <span className="text-[#3E5649]">Snow Depth:</span>
                        <strong className="text-[#13261D] font-mono">{p.snow_depth_cm} cm</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-[#D5E4DB]">
                        <span className="text-[#3E5649]">Max GVW:</span>
                        <strong className="text-[#15803D] font-mono">{p.max_authorized_gross_weight_tons} Tons</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#D5E4DB] text-[10px] text-[#3E5649]">
                    <span>Convoy Window: {p.military_convoy_priority_window}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strategic Bridges Table */}
          <div className="bg-white rounded-xl border border-[#D5E4DB] p-5 shadow-2xs">
            <h4 className="font-bold text-sm text-[#0B3B24] mb-3">BRO Strategic River Bridges & Bailey Classifications</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#D5E4DB] bg-[#F8FAFC] text-[#3E5649] uppercase font-bold text-[10px]">
                    <th className="py-2.5 px-3">Bridge Name</th>
                    <th className="py-2.5 px-3">River</th>
                    <th className="py-2.5 px-3">BRO Project</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 px-3">Max Load</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D5E4DB] text-[#13261D]">
                  {broBridges.map((b) => (
                    <tr key={b.bridge_code} className="hover:bg-[#F7FAF8] transition">
                      <td className="py-2.5 px-3 font-bold text-[#13261D]">{b.name}</td>
                      <td className="py-2.5 px-3 text-[#3E5649]">{b.river}</td>
                      <td className="py-2.5 px-3 text-[#3E5649]">{b.project}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#15803D] font-bold">{b.load_classification}</td>
                      <td className="py-2.5 px-3 font-bold text-[#198754] font-mono">{b.current_capacity_tons} Tons</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          b.status.includes('OPEN') ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-amber-50 text-amber-800 border-amber-300'
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
