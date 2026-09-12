import React from 'react';
import { 
  X, AlertTriangle, ShieldCheck, Clock, CloudRain, Truck, 
  MapPin, Activity, HelpCircle, ArrowRight, Ban, Info, Database
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const AccessibilityDetailPanel = ({ asset, onClose, onReroute }) => {
  if (!asset) return null;

  const score = asset.accessibility_score ?? asset.accessibility_index ?? 90;
  
  const getStatusColor = (score) => {
    if (score >= 90) return { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', text: 'text-emerald-600', bar: 'bg-emerald-500', label: 'FULLY ACCESSIBLE' };
    if (score >= 70) return { bg: 'bg-amber-50 text-amber-800 border-amber-200', text: 'text-amber-600', bar: 'bg-amber-500', label: 'ACCESSIBLE WITH CAUTION' };
    if (score >= 40) return { bg: 'bg-orange-50 text-orange-800 border-orange-200', text: 'text-orange-600', bar: 'bg-orange-500', label: 'RESTRICTED' };
    if (score > 0) return { bg: 'bg-rose-50 text-rose-800 border-rose-200', text: 'text-rose-600', bar: 'bg-rose-500', label: 'HIGHLY RESTRICTED' };
    return { bg: 'bg-red-900 text-white border-red-950', text: 'text-rose-700', bar: 'bg-rose-700', label: 'BLOCKED' };
  };

  const statusCfg = getStatusColor(score);
  const assetType = (asset.asset_type || (asset.corridor_code ? 'Corridor' : asset.bridge_code ? 'Bridge' : asset.state ? 'District' : 'Asset')).toUpperCase();
  const assetCode = asset.corridor_code || asset.bridge_code || asset.asset_id || asset.id;

  return (
    <div className="fixed inset-y-0 right-0 z-[1000] w-full max-w-md bg-white border-l border-[#E2E8F0] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between bg-gradient-to-r from-slate-50 to-purple-50/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
              {assetType} ASSESSMENT
            </span>
            <span className="text-xs font-mono font-bold text-slate-500">{assetCode}</span>
          </div>
          <h2 className="text-base font-bold text-[#0F2747] mt-1 line-clamp-1">{asset.name}</h2>
          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-purple-600" />
            <span>{asset.district_name || asset.district || ''} {asset.state ? `· ${asset.state}` : ''} {asset.states_covered ? `· ${asset.states_covered}` : ''}</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {/* Unified Accessibility Score Gauge Card */}
        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Accessibility Status</span>
            <span className={`px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider border ${statusCfg.bg}`}>
              {statusCfg.label}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className={`text-4xl font-black ${statusCfg.text}`}>{score}</span>
              <span className="text-slate-400 font-bold text-sm">/ 100</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">Risk Level</span>
              <StatusBadge level={asset.risk_level || (score < 30 ? 'CRITICAL' : score < 70 ? 'MEDIUM' : 'LOW')} size="sm" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-500 ${statusCfg.bar}`} style={{ width: `${Math.max(4, score)}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[11px]">
            <div>
              <span className="text-slate-500 block">Estimated Delay</span>
              <span className="font-extrabold text-amber-700">+{asset.estimated_delay_mins ?? 0} mins</span>
            </div>
            <div>
              <span className="text-slate-500 block">Active Incidents</span>
              <span className="font-extrabold text-slate-800">{asset.active_incidents ?? asset.incident_count ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Why is Accessibility Changing? Root Cause Box */}
        <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-2">
          <div className="flex items-center gap-1.5 font-extrabold text-purple-900 text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4 text-purple-600" />
            <span>Why Is Accessibility Changing?</span>
          </div>
          <p className="text-slate-800 text-[11px] leading-relaxed font-medium bg-white/80 p-2.5 rounded-xl border border-purple-100">
            {asset.reason || asset.condition_description || asset.current_condition || 'All roadway segments, bridges, and mountain transit sectors report normal clearance.'}
          </p>
        </div>

        {/* Infrastructure & Environmental Conditions */}
        <div className="space-y-2">
          <span className="font-extrabold text-slate-700 text-[11px] uppercase tracking-wider">Environmental & Infrastructure Parameters</span>
          
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Condition */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[10px]">Physical Condition</span>
              <span className="font-bold text-slate-800">{asset.current_condition || asset.condition_description || 'Operational'}</span>
            </div>

            {/* Weather */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block text-[10px]">Weather Signals</span>
              <span className="font-bold text-slate-800">{asset.weather_condition || 'Monsoon Monitored'}</span>
            </div>

            {/* Bridge / Traffic specific */}
            {asset.load_capacity_tons && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px]">Max Load Limit</span>
                <span className="font-bold text-slate-800">{asset.load_capacity_tons} Metric Tons</span>
              </div>
            )}

            {asset.river_name && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[10px]">River Crossing</span>
                <span className="font-bold text-slate-800">{asset.river_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Data Provenance & Transparency */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[11px] uppercase tracking-wider">
            <Database className="w-3.5 h-3.5 text-purple-600" />
            <span>Data Provenance & Confidence</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
            <div>
              <span className="text-slate-400 block">Data Source</span>
              <span className="font-bold text-purple-900">{asset.data_source || 'INTEGRATED_ACCESSIBILITY_ENGINE'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Data Confidence</span>
              <span className="font-bold text-emerald-700">{asset.data_confidence || 'HIGH'} CONFIDENCE</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
            Last Updated: {asset.last_updated ? new Date(asset.last_updated).toLocaleString() : 'Just now'}
          </div>
        </div>
      </div>

      {/* Footer Action */}
      {score < 40 && onReroute && (
        <div className="p-4 border-t border-[#E2E8F0] bg-slate-50">
          <button
            onClick={() => onReroute(asset.corridor_code || asset.id)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#155E9E] hover:bg-[#0F2747] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2 active:scale-95"
          >
            <span>Activate Alternate Route B Bypass</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
