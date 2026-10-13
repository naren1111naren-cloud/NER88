import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { safeArray } from '../utils/apiHelpers';
import { AccessibilityDetailPanel } from '../components/AccessibilityDetailPanel';
import { 
  MapPin, Search, AlertTriangle, ShieldCheck, 
  ArrowRight, Filter, RefreshCw, BarChart2, ShieldAlert
} from 'lucide-react';

export const DistrictsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  const fetchDistricts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/accessibility/districts');
      setDistricts(safeArray(res.data));
    } catch (err) {
      console.warn('Failed to load districts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDistricts();
    window.addEventListener('sih_demo_triggered', fetchDistricts);
    window.addEventListener('sih_demo_reset', fetchDistricts);
    return () => {
      window.removeEventListener('sih_demo_triggered', fetchDistricts);
      window.removeEventListener('sih_demo_reset', fetchDistricts);
    };
  }, []);

  const states = ['ALL', ...new Set(districts.map(d => d.state).filter(Boolean))];

  const filteredDistricts = districts.filter(d => {
    const matchesSearch = (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
                          (d.state || '').toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter === 'ALL' || d.state === stateFilter;
    return matchesSearch && matchesState;
  });

  const highRiskDistricts = districts.filter(d => (d.accessibility_index || 50) < 40).length;
  const moderateDistricts = districts.filter(d => (d.accessibility_index || 50) >= 40 && (d.accessibility_index || 50) < 70).length;
  const goodDistricts = districts.filter(d => (d.accessibility_index || 50) >= 70).length;

  return (
    <div className="space-y-5 pb-10 text-[#17202A] font-sans">
      {/* Header */}
      <div className="bg-white border border-[#D9E0E7] p-4 sm:p-5 rounded-[8px] shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#123B66] bg-[#123B66]/10 px-2 py-0.5 rounded border border-[#123B66]/20 uppercase tracking-wider">
              REGIONAL ACCESSIBILITY
            </span>
            <span className="text-[10px] text-[#5B6570] font-mono">
              Composite GIS Vulnerability Index
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2744] flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#185A8D]" />
            District Accessibility & Vulnerability Index
          </h1>
          <p className="text-xs text-[#5B6570] mt-1">
            Dynamic accessibility index evaluating road infrastructure, weather severity, incident density, and connectivity across all 8 Northeast states.
          </p>
        </div>

        <button
          onClick={fetchDistricts}
          className="px-3.5 py-2 rounded-[6px] bg-[#F6F8FA] hover:bg-[#E7EBEF] text-[#123B66] border border-[#D9E0E7] text-xs font-bold flex items-center gap-1.5 transition self-start md:self-auto shadow-subtle cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#185A8D] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Scores</span>
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-[#D9E0E7] p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#5B6570] uppercase tracking-wider">Districts Evaluated</span>
          <div className="text-2xl font-bold text-[#0B2744] mt-1 font-mono">{districts.length} Districts</div>
          <span className="text-[11px] text-[#185A8D] font-medium">8 NER States Covered</span>
        </div>

        <div className="bg-white border border-[#16834B]/30 p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#16834B] uppercase tracking-wider">Optimal Accessibility (≥70)</span>
          <div className="text-2xl font-bold text-[#16834B] mt-1 font-mono">{goodDistricts}</div>
          <span className="text-[11px] text-[#16834B] font-medium">● Normal Transit Feasibility</span>
        </div>

        <div className="bg-white border border-[#D99A00]/30 p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#D99A00] uppercase tracking-wider">Moderate Caution (40-69)</span>
          <div className="text-2xl font-bold text-[#D99A00] mt-1 font-mono">{moderateDistricts}</div>
          <span className="text-[11px] text-[#D99A00] font-medium">▲ Weather / Terrain Drag</span>
        </div>

        <div className="bg-white border border-[#C62828]/30 p-4 rounded-[8px] shadow-subtle">
          <span className="text-[10px] font-bold text-[#C62828] uppercase tracking-wider">Critical Risk (&lt;40)</span>
          <div className="text-2xl font-bold text-[#C62828] mt-1 font-mono">{highRiskDistricts}</div>
          <span className="text-[11px] text-[#C62828] font-medium">■ Detour Corridor Advised</span>
        </div>
      </div>

      {/* Search & State Filter */}
      <div className="bg-white border border-[#D9E0E7] p-3 rounded-[8px] flex flex-col md:flex-row items-center justify-between gap-3 shadow-subtle text-xs">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#5B6570] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search district or state..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#F6F8FA] border border-[#D9E0E7] rounded-[6px] pl-9 pr-4 py-1.5 text-xs text-[#17202A] placeholder-[#5B6570] focus:outline-none focus:border-[#185A8D] transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="bg-[#F6F8FA] border border-[#D9E0E7] text-xs text-[#17202A] px-3 py-1.5 rounded-[6px] focus:outline-none focus:border-[#185A8D] cursor-pointer w-full md:w-auto font-medium"
          >
            {states.map(s => (
              <option key={s} value={s}>{s === 'ALL' ? 'All States (8 NER States)' : s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* District Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDistricts.map((dist) => {
          const score = dist.accessibility_index || 75;
          const isCritical = score < 40;
          const isCaution = score >= 40 && score < 70;

          return (
            <div
              key={dist.id}
              onClick={() => {
                setSelectedDistrict({ ...dist, asset_type: 'district' });
                window.dispatchEvent(new CustomEvent('linkx8:district_selected', {
                  detail: {
                    district: dist.name,
                    state: dist.state
                  }
                }));
              }}
              className={`p-4 rounded-[8px] border transition cursor-pointer hover:shadow-subtle space-y-3 bg-white ${
                isCritical
                  ? 'border-l-4 border-l-[#C62828] border-[#D9E0E7]'
                  : isCaution
                  ? 'border-l-4 border-l-[#D99A00] border-[#D9E0E7]'
                  : 'border-l-4 border-l-[#16834B] border-[#D9E0E7]'
              }`}
            >
              <div className="flex items-center justify-between border-b border-[#E7EBEF] pb-2">
                <div>
                  <h3 className="font-bold text-sm text-[#0B2744]">{dist.name}</h3>
                  <span className="text-xs text-[#5B6570]">{dist.state}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  isCritical ? 'bg-[#C62828]/10 text-[#C62828] border-[#C62828]/30' :
                  isCaution ? 'bg-[#D99A00]/10 text-[#D99A00] border-[#D99A00]/30' :
                  'bg-[#16834B]/10 text-[#16834B] border-[#16834B]/30'
                }`}>
                  {isCritical ? '■ CRITICAL' : isCaution ? '▲ CAUTION' : '● OPTIMAL'}
                </span>
              </div>

              {/* Progress Bar Score */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5B6570]">Accessibility Index</span>
                  <span className={`font-bold font-mono text-sm ${
                    isCritical ? 'text-[#C62828]' : isCaution ? 'text-[#D99A00]' : 'text-[#16834B]'
                  }`}>
                    {score} / 100
                  </span>
                </div>
                <div className="w-full bg-[#F6F8FA] h-2 rounded-full overflow-hidden border border-[#D9E0E7]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isCritical ? 'bg-[#C62828]' : isCaution ? 'bg-[#D99A00]' : 'bg-[#16834B]'
                    }`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E7EBEF] text-xs text-[#5B6570]">
                <span>Active Incidents: <strong className="text-[#0B2744]">{dist.active_incidents_count || 0}</strong></span>
                <span className="text-[#123B66] font-bold flex items-center gap-1">
                  Inspect Factors <ArrowRight className="w-3.5 h-3.5 text-[#185A8D]" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Slide-out detail panel */}
      <AccessibilityDetailPanel
        asset={selectedDistrict}
        onClose={() => setSelectedDistrict(null)}
        onReroute={() => navigate('/map')}
      />
    </div>
  );
};

export default DistrictsPage;

