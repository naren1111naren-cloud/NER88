import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { AccessibilityDetailPanel } from '../components/AccessibilityDetailPanel';
import { 
  Waves, Search, ShieldCheck, AlertTriangle, MapPin, 
  ArrowRight, Activity, Filter, CheckCircle2, RefreshCw,
  Navigation, ShieldAlert, AlertOctagon, Scale
} from 'lucide-react';

export const BridgesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedBridge, setSelectedBridge] = useState(null);

  const fetchBridges = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accessibility/bridges');
      setBridges(safeArray(res.data));
    } catch (err) {
      console.warn('Failed to load bridges:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBridges();
    window.addEventListener('sih_demo_triggered', fetchBridges);
    window.addEventListener('sih_demo_reset', fetchBridges);
    return () => {
      window.removeEventListener('sih_demo_triggered', fetchBridges);
      window.removeEventListener('sih_demo_reset', fetchBridges);
    };
  }, []);

  const states = ['ALL', ...new Set(bridges.map(b => b.state).filter(Boolean))];

  const filteredBridges = bridges.filter(b => {
    const matchesSearch = (b.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (b.river_name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (b.district_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter === 'ALL' || b.state === stateFilter;
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesState && matchesStatus;
  });

  const operationalCount = bridges.filter(b => b.status === 'OPERATIONAL').length;
  const restrictedCount = bridges.filter(b => b.status === 'RESTRICTED' || b.status === 'DAMAGED').length;
  const closedCount = bridges.filter(b => b.status === 'CLOSED').length;

  return (
    <div className="space-y-5 pb-10 text-[#17202A] font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D9E0E7] p-4 sm:p-5 rounded-[8px] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#123B66] bg-[#123B66]/10 px-2 py-0.5 rounded border border-[#123B66]/20 uppercase tracking-wider">
              INFRASTRUCTURE TELEMETRY
            </span>
            <span className="text-[10px] text-[#5B6570] font-mono">
              Source: BRO / NHAI / State PWD Bridges Wing
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] flex items-center gap-2">
            <Waves className="w-5 h-5 text-[#185A8D]" />
            Strategic Bridges & River Crossings
          </h1>
          <p className="text-xs text-[#5B6570] mt-1">
            Monitoring structural load ratings, clearance levels, water gauges, and flood risks across critical Northeast waterways.
          </p>
        </div>

        <button
          onClick={fetchBridges}
          className="px-3.5 py-2 rounded-[6px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#123B66] border border-[#D9E0E7] text-xs font-bold flex items-center gap-1.5 transition self-start md:self-auto shadow-subtle cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#185A8D] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* KPI Summary Tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#D9E0E7] p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">Total Monitored</span>
          <div className="text-2xl font-bold text-[#0B2744] mt-1 font-mono">{bridges.length} Units</div>
          <span className="text-[11px] text-[#185A8D] font-medium">8 NER States Covered</span>
        </div>

        <div className="bg-white border border-[#16834B]/30 p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#16834B] uppercase tracking-wider">Fully Operational</span>
          <div className="text-2xl font-bold text-[#16834B] mt-1 font-mono">{operationalCount}</div>
          <span className="text-[11px] text-[#16834B] font-medium">● 40T-60T Standard Clearance</span>
        </div>

        <div className="bg-white border border-[#D99A00]/30 p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#D99A00] uppercase tracking-wider">Restricted / Warning</span>
          <div className="text-2xl font-bold text-[#D99A00] mt-1 font-mono">{restrictedCount}</div>
          <span className="text-[11px] text-[#D99A00] font-medium">! Water Gauge / Structural Alert</span>
        </div>

        <div className="bg-white border border-[#C62828]/30 p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#C62828] uppercase tracking-wider">Closed</span>
          <div className="text-2xl font-bold text-[#C62828] mt-1 font-mono">{closedCount}</div>
          <span className="text-[11px] text-[#C62828] font-medium">■ Emergency Detour Required</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-[#D9E0E7] p-3 rounded-[8px] flex flex-col md:flex-row items-center justify-between gap-3 shadow-subtle text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#5B6570] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bridge, river, district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-4 py-1.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-[#F6F8FA] border border-[#D9E0E7] text-xs text-[#17202A] px-3 py-1.5 rounded-[6px] focus:outline-none focus:border-[#185A8D] cursor-pointer font-medium"
          >
            {states.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All States' : s}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#F6F8FA] border border-[#D9E0E7] text-xs text-[#17202A] px-3 py-1.5 rounded-[6px] focus:outline-none focus:border-[#185A8D] cursor-pointer font-medium"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPERATIONAL">Operational</option>
            <option value="RESTRICTED">Restricted</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Bridges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredBridges.map((b) => {
          const isClosed = b.status === 'CLOSED';
          const isRestricted = b.status === 'RESTRICTED' || b.status === 'DAMAGED';
          const isOperational = b.status === 'OPERATIONAL';

          return (
            <div
              key={b.id}
              onClick={() => setSelectedBridge({ ...b, asset_type: 'bridge' })}
              className={`p-4 rounded-[8px] border transition cursor-pointer hover:shadow-subtle space-y-3 bg-white ${
                isClosed 
                  ? 'border-l-4 border-l-[#C62828] border-[#D9E0E7]'
                  : isRestricted
                  ? 'border-l-4 border-l-[#D99A00] border-[#D9E0E7]'
                  : 'border-l-4 border-l-[#16834B] border-[#D9E0E7]'
              }`}
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#E7EBEF] pb-2">
                <div>
                  <h3 className="font-bold text-sm text-[#0B2744]">{b.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-[#5B6570] mt-0.5">
                    <Waves className="w-3.5 h-3.5 text-[#185A8D]" />
                    <span>{b.river_name}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                  isClosed
                    ? 'bg-[#C62828]/10 text-[#C62828] border-[#C62828]/30'
                    : isRestricted
                    ? 'bg-[#D99A00]/10 text-[#D99A00] border-[#D99A00]/30'
                    : 'bg-[#16834B]/10 text-[#16834B] border-[#16834B]/30'
                }`}>
                  {isClosed ? '■ CLOSED' : isRestricted ? '! RESTRICTED' : '● OPERATIONAL'}
                </span>
              </div>

              <div className="text-xs text-[#5B6570] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#185A8D]" />
                <span>{b.district_name}, {b.state}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#F6F8FA] p-2.5 rounded-[6px] border border-[#D9E0E7] text-xs">
                <div>
                  <span className="text-[10px] text-[#5B6570] block uppercase font-bold">Accessibility</span>
                  <span className={`font-bold font-mono ${
                    (b.accessibility_score || 80) < 50 ? 'text-[#C62828]' :
                    (b.accessibility_score || 80) < 75 ? 'text-[#D99A00]' : 'text-[#16834B]'
                  }`}>
                    {b.accessibility_score || 80} / 100
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#5B6570] block uppercase font-bold">Max Load Limit</span>
                  <span className="font-bold text-[#0B2744] font-mono flex items-center gap-1">
                    <Scale className="w-3 h-3 text-[#185A8D]" />
                    {b.max_load_tons ? `${b.max_load_tons} Tons` : '40 Tons'}
                  </span>
                </div>
              </div>

              {b.condition_description && (
                <p className="text-xs text-[#5B6570] line-clamp-2 leading-relaxed">
                  {b.condition_description}
                </p>
              )}

              <div className="pt-2 border-t border-[#E7EBEF] flex items-center justify-between text-xs text-[#123B66] font-bold">
                <span>View Full Telemetry & Clearance</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#185A8D]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-out detail panel */}
      <AccessibilityDetailPanel
        asset={selectedBridge}
        onClose={() => setSelectedBridge(null)}
        onReroute={() => navigate('/map')}
      />
    </div>
  );
};

export default BridgesPage;

