import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  X, AlertTriangle, ShieldCheck, Clock, CloudRain, Truck, 
  MapPin, Activity, HelpCircle, ArrowRight, Ban, Info, Database,
  Navigation, Waves, FileText, CheckCircle2
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const AccessibilityDetailPanel = ({ asset, onClose, onReroute }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if (!asset) return null;

  const score = asset.accessibility_score !== undefined ? Number(asset.accessibility_score) : (asset.accessibility_index ?? 90);
  const status = (asset.accessibility_status || asset.status || (score >= 70 ? 'OPEN' : score > 0 ? 'RESTRICTED' : 'BLOCKED')).toUpperCase();
  
  const getStatusColor = (score, status) => {
    if (status === 'BLOCKED' || score === 0) return { bg: 'bg-[#C62828]/10 text-[#C62828] border-[#C62828]/20', text: 'text-[#C62828]', bar: 'bg-[#C62828]', label: 'BLOCKED' };
    if (status === 'RESTRICTED' || (score > 0 && score < 70)) return { bg: 'bg-[#D99A00]/10 text-[#D99A00] border-[#D99A00]/20', text: 'text-[#D99A00]', bar: 'bg-[#D99A00]', label: 'RESTRICTED' };
    return { bg: 'bg-[#16834B]/10 text-[#16834B] border-[#16834B]/20', text: 'text-[#16834B]', bar: 'bg-[#16834B]', label: 'OPEN' };
  };

  const statusCfg = getStatusColor(score, status);
  const assetType = (asset.asset_type || (asset.corridor_code ? 'Corridor' : asset.bridge_code ? 'Bridge' : asset.state ? 'District' : 'Asset')).toUpperCase();
  const assetCode = asset.corridor_code || asset.bridge_code || asset.asset_id || asset.id;

  const dataSourcesList = Array.isArray(asset.data_sources) 
    ? asset.data_sources 
    : (asset.data_sources ? [asset.data_sources] : [asset.data_source || 'Integrated Regional Engine']);

  return (
    <div className="fixed inset-y-0 right-0 z-[1000] w-full max-w-md bg-white border-l border-[#D9E0E7] shadow-elevated flex flex-col transform transition-transform duration-200 ease-in-out text-[#17202A]">
      {/* Header */}
      <div className="p-4 border-b border-[#D9E0E7] flex items-center justify-between bg-[#F6F8FA]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[4px] bg-[#185A8D]/10 text-[#123B66] border border-[#185A8D]/20">
              {assetType} {t('detailPanel.assessment', 'ASSESSMENT')}
            </span>
            <span className="text-xs font-mono font-bold text-[#5B6570]">{assetCode}</span>
          </div>
          <h2 className="text-base font-bold text-[#0B2744] mt-1 line-clamp-1">{asset.name}</h2>
          <div className="text-[11px] text-[#5B6570] flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-[#185A8D]" />
            <span>{asset.district_name || asset.district || ''} {asset.state ? `· ${asset.state}` : ''} {asset.states_covered ? `· ${asset.states_covered}` : ''}</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-1.5 rounded-[6px] hover:bg-white text-[#5B6570] hover:text-[#17202A] border border-transparent hover:border-[#D9E0E7] transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {/* Unified Accessibility Score Gauge Card */}
        <div className="p-4 rounded-[8px] bg-white border border-[#D9E0E7] space-y-3 shadow-subtle">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#5B6570] uppercase tracking-wider">{t('detailPanel.accessibilityStatus', 'Accessibility Status')}</span>
            <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wider border ${statusCfg.bg}`}>
              {statusCfg.label}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className={`text-3xl font-extrabold ${statusCfg.text}`}>{Math.round(score)}</span>
              <span className="text-[#5B6570] font-semibold text-xs">/ 100</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[#5B6570] block mb-0.5">{t('detailPanel.riskLevel', 'Risk Level')}</span>
              <StatusBadge level={asset.risk_level || (score < 40 ? 'CRITICAL' : score < 70 ? 'MEDIUM' : 'LOW')} size="sm" />
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E7EBEF] h-2 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-300 ${statusCfg.bar}`} style={{ width: `${Math.max(4, score)}%` }} />
          </div>

          {/* Structured Explanation Pill */}
          <div className="bg-[#F6F8FA] border border-[#D9E0E7] p-2 rounded-[6px] text-[11px] font-medium text-[#123B66]">
            {asset.explanation || `Accessibility ${Math.round(score)}/100 — ${statusCfg.label}`}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#D9E0E7] text-xs">
            <div>
              <span className="text-[#5B6570] block text-[10.5px]">{t('detailPanel.estimatedDelay', 'Estimated Delay')}</span>
              <span className="font-bold text-[#D99A00]">+{asset.estimated_delay_mins ?? 0} {t('common.mins', 'mins')}</span>
            </div>
            <div>
              <span className="text-[#5B6570] block text-[10.5px]">{t('detailPanel.activeIncidents', 'Active Disruptions')}</span>
              <span className="font-bold text-[#17202A]">{asset.active_incidents ?? asset.incident_count ?? (asset.active_incidents_count || 0)}</span>
            </div>
          </div>
        </div>

        {/* Operational Assessment Box */}
        <div className="p-3.5 rounded-[8px] bg-white border border-[#D9E0E7] space-y-1.5 shadow-subtle">
          <div className="flex items-center gap-1.5 font-bold text-[#0B2744] text-xs uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-[#185A8D]" />
            <span>{t('detailPanel.whyChanging', 'Operational Assessment & Factor Summary')}</span>
          </div>
          <p className="text-[#17202A] text-[11px] leading-relaxed font-medium bg-[#F6F8FA] p-2.5 rounded-[6px] border border-[#D9E0E7]">
            {asset.factor_summary || asset.reason || asset.condition_description || asset.current_condition || 'All roadway segments, bridges, and regional transit sectors report normal clearance.'}
          </p>
        </div>

        {/* Operational Shortcut Actions */}
        <div className="space-y-1.5">
          <span className="font-bold text-[#5B6570] text-[11px] uppercase tracking-wider">
            {t('detailPanel.operationalNav', 'Operational Navigation')}
          </span>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <button
              onClick={() => {
                onClose();
                navigate('/routes');
              }}
              className="p-2 rounded-[6px] bg-[#F6F8FA] hover:bg-white border border-[#D9E0E7] hover:border-[#185A8D] text-center text-[#17202A] font-semibold transition cursor-pointer flex flex-col items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5 text-[#185A8D]" />
              <span>{t('nav.routes', 'ROUTES')}</span>
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/incidents');
              }}
              className="p-2 rounded-[6px] bg-[#F6F8FA] hover:bg-white border border-[#D9E0E7] hover:border-[#C62828] text-center text-[#17202A] font-semibold transition cursor-pointer flex flex-col items-center gap-1"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#C62828]" />
              <span>{t('nav.incidents', 'DISRUPTIONS')}</span>
            </button>
            <button
              onClick={() => {
                onClose();
                navigate('/districts');
              }}
              className="p-2 rounded-[6px] bg-[#F6F8FA] hover:bg-white border border-[#D9E0E7] hover:border-[#185A8D] text-center text-[#17202A] font-semibold transition cursor-pointer flex flex-col items-center gap-1"
            >
              <MapPin className="w-3.5 h-3.5 text-[#185A8D]" />
              <span>{t('detailPanel.districts', 'DISTRICTS')}</span>
            </button>
          </div>
        </div>

        {/* Infrastructure & Environmental Parameters */}
        <div className="space-y-1.5">
          <span className="font-bold text-[#5B6570] text-[11px] uppercase tracking-wider">{t('detailPanel.envParams', 'Environmental & Infrastructure Telemetry')}</span>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-[6px] bg-white border border-[#D9E0E7]">
              <span className="text-[#5B6570] block text-[10px]">{t('detailPanel.physicalCondition', 'Physical Condition')}</span>
              <span className="font-semibold text-[#17202A]">{asset.current_condition || asset.condition_description || 'Operational'}</span>
            </div>

            <div className="p-2.5 rounded-[6px] bg-white border border-[#D9E0E7]">
              <span className="text-[#5B6570] block text-[10px]">{t('detailPanel.weatherSignals', 'Weather Signals')}</span>
              <span className="font-semibold text-[#17202A]">{asset.weather_condition || 'Monitored'}</span>
            </div>

            {asset.load_capacity_tons && (
              <div className="p-2.5 rounded-[6px] bg-white border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px]">{t('detailPanel.maxLoadLimit', 'Max Axle Rating')}</span>
                <span className="font-semibold text-[#17202A]">{asset.load_capacity_tons} MT</span>
              </div>
            )}

            {asset.river_name && (
              <div className="p-2.5 rounded-[6px] bg-white border border-[#D9E0E7]">
                <span className="text-[#5B6570] block text-[10px]">{t('detailPanel.riverCrossing', 'River Crossing')}</span>
                <span className="font-semibold text-[#17202A]">{asset.river_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Data Provenance & Verified Sources */}
        <div className="p-3 rounded-[8px] bg-white border border-[#D9E0E7] space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-[#5B6570] text-[11px] uppercase tracking-wider">
            <Database className="w-3.5 h-3.5 text-[#185A8D]" />
            <span>{t('detailPanel.dataProvenance', 'Data Provenance & Contributing Sources')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {dataSourcesList.map((src, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F0FDF4] text-[#16834B] border border-[#BBF7D0] text-[10px] font-semibold">
                <CheckCircle2 className="w-3 h-3 text-[#16834B]" />
                {src}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10.5px] text-[#5B6570] pt-1">
            <div>
              <span className="text-[#5B6570] block">{t('detailPanel.telemetryConfidence', 'Telemetry Confidence')}</span>
              <span className="font-semibold text-[#16834B]">{asset.data_confidence || t('common.dataQualityHigh', 'HIGH')}</span>
            </div>
            <div>
              <span className="text-[#5B6570] block">{t('detailPanel.lastUpdated', 'Last Updated')}</span>
              <span className="font-semibold text-[#0B2744]">
                {asset.last_updated ? new Date(asset.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('common.live', 'Realtime Live')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Action */}
      {score < 50 && onReroute && (
        <div className="p-3.5 border-t border-[#D9E0E7] bg-[#F6F8FA]">
          <button
            onClick={() => onReroute(asset.corridor_code || asset.id)}
            className="w-full py-2.5 px-3 rounded-[6px] bg-[#123B66] hover:bg-[#0B2744] text-white font-bold text-xs shadow-subtle transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
          >
            <span>{t('detailPanel.activateBypass', 'Approve Alternate Detour Reroute')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default AccessibilityDetailPanel;
