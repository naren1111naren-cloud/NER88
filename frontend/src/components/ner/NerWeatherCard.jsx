import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NerWeatherVisual, resolveWeatherConfig } from './NerWeatherVisual';
import { ArrowRight } from 'lucide-react';

/**
 * NerWeatherCard — Operational Weather Risk Component
 * Satisfies Sections 4, 5 & 26 of the NER88 Master UI Specification:
 * - Weather is connected directly to Logistics (Weather -> Risk -> Road Accessibility -> Fleet Impact)
 * - Large weather visual (48–72px) is the first thing the eye notices
 * - Clear operational values: Temperature, Risk level, Location, Road Impact, Fleet Affected
 * - Concise action trigger: [INSPECT ROUTE IMPACT]
 */
export const NerWeatherCard = ({
  condition = 'heavy_rain',
  temperature = '28°C',
  riskLevel = 'HIGH',
  location = 'Sikkim · East Khasi Hills',
  roadImpact = 'RESTRICTED',
  fleetAffected = 12,
  corridor = 'NH-10',
  onInspectRoute,
  className = ''
}) => {
  const navigate = useNavigate();
  const config = resolveWeatherConfig(condition);

  const handleInspect = () => {
    if (onInspectRoute) {
      onInspectRoute();
    } else {
      navigate('/routes');
    }
  };

  // Status visual mapping (Section 9: both symbol + text)
  const impactConfig = {
    OPEN: {
      label: 'OPEN',
      symbol: '🟢',
      style: 'text-ner-open font-bold'
    },
    RESTRICTED: {
      label: 'RESTRICTED',
      symbol: '🟠',
      style: 'text-ner-restricted font-bold'
    },
    BLOCKED: {
      label: 'BLOCKED',
      symbol: '🔴',
      style: 'text-ner-blocked font-bold'
    }
  }[roadImpact] || {
    label: roadImpact,
    symbol: '🟠',
    style: 'text-ner-restricted font-bold'
  };

  return (
    <div className={`bg-white border border-ner-border rounded-lg p-4 shadow-xs flex flex-col justify-between select-none ${className}`}>
      
      {/* ── CARD HEADER ── */}
      <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base" role="img" aria-hidden="true">
            {config.emoji}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-ner-primary">
            Weather Operational Risk
          </span>
        </div>
        <span className="text-[10px] font-mono font-medium text-ner-muted">
          IMD / AWS TELEMETRY
        </span>
      </div>

      {/* ── HERO WEATHER VISUAL & CONDITION (48-72px) ── */}
      <div className="py-4 flex flex-col items-center justify-center text-center">
        {/* Large 64px Weather Visual */}
        <NerWeatherVisual 
          condition={condition} 
          size="hero" 
        />

        {/* Short Uppercase Condition Title */}
        <h3 className="text-base sm:text-lg font-black tracking-tight text-ner-primary mt-1.5 uppercase">
          {config.label}
        </h3>

        {/* Temperature & Risk Rating */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xl font-extrabold text-ner-primary tracking-tight">
            {temperature}
          </span>
          <span className="text-xs text-ner-muted font-bold">·</span>
          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
            riskLevel === 'HIGH' || riskLevel === 'CRITICAL' 
              ? 'bg-ner-restricted-bg text-ner-restricted border-ner-restricted-border'
              : 'bg-ner-open-bg text-ner-open border-ner-open-border'
          }`}>
            {riskLevel} RISK
          </span>
        </div>

        {/* Location with Pin */}
        <div className="text-xs text-ner-text-secondary font-medium mt-2 flex items-center justify-center gap-1">
          <span role="img" aria-label="Location">📍</span>
          <span>{location}</span>
        </div>
      </div>

      {/* ── LOGISTICS CONNECTION (ROAD IMPACT + FLEET AFFECTED) ── */}
      <div className="bg-ner-background border border-ner-border rounded-md p-2.5 text-xs space-y-1.5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-ner-muted font-semibold">Road Impact:</span>
          <span className={`inline-flex items-center gap-1.5 text-xs ${impactConfig.style}`}>
            <span role="img" aria-hidden="true">{impactConfig.symbol}</span>
            <span>{impactConfig.label}</span>
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-ner-muted font-semibold">Fleet Affected:</span>
          <span className="font-bold text-ner-text inline-flex items-center gap-1">
            <span role="img" aria-label="Truck">🚛</span>
            <span>{fleetAffected} vehicles</span>
          </span>
        </div>

        {corridor && (
          <div className="flex items-center justify-between pt-1 border-t border-ner-border/60 text-[11px]">
            <span className="text-ner-muted">Target Corridor:</span>
            <span className="font-mono font-bold text-ner-primary">{corridor}</span>
          </div>
        )}
      </div>

      {/* ── ACTION TRIGGER ── */}
      <button
        type="button"
        onClick={handleInspect}
        className="w-full py-2 px-3 rounded-md bg-ner-secondary-light hover:bg-ner-secondary text-ner-secondary hover:text-white border border-ner-secondary/20 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
      >
        <span>Inspect Route Impact</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>

    </div>
  );
};

export default NerWeatherCard;
