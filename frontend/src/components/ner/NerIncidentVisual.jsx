import React from 'react';

/**
 * Major Incident Visual Dictionary
 * Satisfies Section 8 & Section 12:
 * Meaningful visual symbols for major operational incidents:
 * - Landslide: ⛰️
 * - Flood / Flash Flood: 🌊
 * - Road Blockage / Debris: 🚧
 * - Heavy Rain / Mudflow: 🌧️
 * - Storm / Squall: ⛈️
 * - Accident: ⚠️
 * - Road Damage / Slump: 🛣️
 * - Fire: 🔥
 */
export const INCIDENT_CONFIGS = {
  landslide: {
    emoji: '⛰️',
    label: 'LANDSLIDE',
    defaultSeverity: 'CRITICAL',
    color: 'text-amber-700'
  },
  flood: {
    emoji: '🌊',
    label: 'FLASH FLOOD',
    defaultSeverity: 'CRITICAL',
    color: 'text-sky-700'
  },
  blockage: {
    emoji: '🚧',
    label: 'ROAD BLOCKAGE',
    defaultSeverity: 'HIGH',
    color: 'text-orange-600'
  },
  rain: {
    emoji: '🌧️',
    label: 'MONSOON RISK',
    defaultSeverity: 'MODERATE',
    color: 'text-blue-600'
  },
  storm: {
    emoji: '⛈️',
    label: 'STORM DISRUPTION',
    defaultSeverity: 'HIGH',
    color: 'text-indigo-600'
  },
  accident: {
    emoji: '⚠️',
    label: 'COLLISION / ACCIDENT',
    defaultSeverity: 'MODERATE',
    color: 'text-amber-600'
  },
  damage: {
    emoji: '🛣️',
    label: 'PAVEMENT / ROAD DAMAGE',
    defaultSeverity: 'MODERATE',
    color: 'text-slate-700'
  },
  fire: {
    emoji: '🔥',
    label: 'FIRE INCIDENT',
    defaultSeverity: 'HIGH',
    color: 'text-red-600'
  }
};

export const resolveIncidentConfig = (typeStr = '') => {
  const q = typeStr.toLowerCase().trim();
  if (q.includes('landslide') || q.includes('rockfall') || q.includes('slope') || q.includes('mud')) return INCIDENT_CONFIGS.landslide;
  if (q.includes('flood') || q.includes('water') || q.includes('inundat') || q.includes('teesta')) return INCIDENT_CONFIGS.flood;
  if (q.includes('block') || q.includes('obstruction') || q.includes('debris') || q.includes('slump')) return INCIDENT_CONFIGS.blockage;
  if (q.includes('storm') || q.includes('lightning')) return INCIDENT_CONFIGS.storm;
  if (q.includes('rain') || q.includes('monsoon')) return INCIDENT_CONFIGS.rain;
  if (q.includes('accident') || q.includes('collision') || q.includes('hazard')) return INCIDENT_CONFIGS.accident;
  if (q.includes('damage') || q.includes('pavement') || q.includes('crack') || q.includes('bridge')) return INCIDENT_CONFIGS.damage;
  if (q.includes('fire')) return INCIDENT_CONFIGS.fire;

  return INCIDENT_CONFIGS.landslide;
};

export const NerIncidentVisual = ({
  type = 'landslide',
  size = 'md', // 'lg' (40-48px) | 'md' (28-32px) | 'sm' (20-24px)
  className = '',
  showLabel = false
}) => {
  const cfg = resolveIncidentConfig(type);

  const sizeClasses = {
    lg: 'text-[44px] leading-none',
    md: 'text-[30px] leading-none',
    sm: 'text-[20px] leading-none',
  }[size] || 'text-[30px] leading-none';

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <span className={`${sizeClasses} drop-shadow-xs`} role="img" aria-label={cfg.label}>
        {cfg.emoji}
      </span>
      {showLabel && (
        <span className="text-[11px] font-bold text-ner-primary uppercase tracking-tight mt-1">
          {cfg.label}
        </span>
      )}
    </div>
  );
};

export default NerIncidentVisual;
