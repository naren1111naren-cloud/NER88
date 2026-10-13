import React from 'react';

/**
 * Weather Visual Dictionary & Classification Engine
 * Satisfies Sections 2, 3, 6, 7 of the NER88 Visual Master Specification:
 * - High-quality all-season weather visuals for Northeast India
 * - Large sizes: 48-72px (hero/lg), 36-42px (md), 24-28px (sm)
 * - Dynamic data mapping (not hardcoded)
 * - Semantic risk & road impact connection
 */
export const WEATHER_CONDITIONS = {
  clear: {
    emoji: '☀️',
    label: 'CLEAR / SUNNY',
    defaultRisk: 'LOW',
    defaultImpact: 'OPEN',
    season: 'Summer / Post-Monsoon',
    colorClass: 'text-amber-500'
  },
  partly_cloudy: {
    emoji: '🌤️',
    label: 'PARTLY CLOUDY',
    defaultRisk: 'LOW',
    defaultImpact: 'OPEN',
    season: 'All Seasons',
    colorClass: 'text-sky-500'
  },
  cloudy: {
    emoji: '☁️',
    label: 'CLOUDY',
    defaultRisk: 'LOW',
    defaultImpact: 'OPEN',
    season: 'Monsoon / Transition',
    colorClass: 'text-slate-500'
  },
  mostly_cloudy: {
    emoji: '🌥️',
    label: 'MOSTLY CLOUDY',
    defaultRisk: 'LOW',
    defaultImpact: 'OPEN',
    season: 'Monsoon / Winter',
    colorClass: 'text-slate-600'
  },
  rain: {
    emoji: '🌧️',
    label: 'MODERATE RAIN',
    defaultRisk: 'MODERATE',
    defaultImpact: 'RESTRICTED',
    season: 'Monsoon',
    colorClass: 'text-blue-600'
  },
  rain_sun: {
    emoji: '🌦️',
    label: 'PASSING SHOWERS',
    defaultRisk: 'LOW',
    defaultImpact: 'OPEN',
    season: 'Summer Monsoon',
    colorClass: 'text-blue-500'
  },
  heavy_rain: {
    emoji: '🌧️',
    label: 'HEAVY RAIN',
    defaultRisk: 'HIGH',
    defaultImpact: 'RESTRICTED',
    season: 'Monsoon Surge',
    colorClass: 'text-blue-700 font-extrabold'
  },
  thunderstorm: {
    emoji: '⛈️',
    label: 'THUNDERSTORM',
    defaultRisk: 'HIGH',
    defaultImpact: 'RESTRICTED',
    season: 'Pre-Monsoon / Monsoon',
    colorClass: 'text-indigo-600'
  },
  severe_thunderstorm: {
    emoji: '🌩️',
    label: 'SEVERE THUNDERSTORM',
    defaultRisk: 'CRITICAL',
    defaultImpact: 'BLOCKED',
    season: 'Pre-Monsoon Nor\'westers',
    colorClass: 'text-amber-600'
  },
  fog: {
    emoji: '🌫️',
    label: 'DENSE FOG / MIST',
    defaultRisk: 'MODERATE',
    defaultImpact: 'RESTRICTED',
    season: 'Winter / Brahmaputra Basin',
    colorClass: 'text-slate-400'
  },
  wind: {
    emoji: '💨',
    label: 'STRONG WIND',
    defaultRisk: 'MODERATE',
    defaultImpact: 'RESTRICTED',
    season: 'High-Altitude Ridge',
    colorClass: 'text-teal-600'
  },
  cyclone: {
    emoji: '🌪️',
    label: 'CYCLONIC STORM',
    defaultRisk: 'CRITICAL',
    defaultImpact: 'BLOCKED',
    season: 'Bay of Bengal Depressions',
    colorClass: 'text-red-600'
  },
  snow: {
    emoji: '🌨️',
    label: 'SNOW / SLEET',
    defaultRisk: 'HIGH',
    defaultImpact: 'RESTRICTED',
    season: 'Winter High Altitude',
    colorClass: 'text-cyan-600'
  },
  flood: {
    emoji: '🌊',
    label: 'FLOOD / WATER RISK',
    defaultRisk: 'CRITICAL',
    defaultImpact: 'BLOCKED',
    season: 'Teesta / Brahmaputra Flash Flood',
    colorClass: 'text-sky-700 font-black'
  },
  freezing: {
    emoji: '🧊',
    label: 'FREEZING / BLACK ICE',
    defaultRisk: 'HIGH',
    defaultImpact: 'RESTRICTED',
    season: 'Sikkim / Arunachal Passes',
    colorClass: 'text-cyan-700'
  }
};

/**
 * Resolves any free-form weather condition string into standardized weather config
 */
export const resolveWeatherConfig = (conditionStr = '') => {
  const query = conditionStr.toLowerCase().trim();

  if (query.includes('flood') || query.includes('teesta surge') || query.includes('inundat')) return WEATHER_CONDITIONS.flood;
  if (query.includes('cyclon') || query.includes('tornado') || query.includes('squall')) return WEATHER_CONDITIONS.cyclone;
  if (query.includes('severe') && query.includes('storm')) return WEATHER_CONDITIONS.severe_thunderstorm;
  if (query.includes('thunder') || query.includes('lightning')) return WEATHER_CONDITIONS.thunderstorm;
  if (query.includes('heavy') && (query.includes('rain') || query.includes('monsoon') || query.includes('downpour'))) return WEATHER_CONDITIONS.heavy_rain;
  if (query.includes('rain') || query.includes('shower') || query.includes('precip')) return WEATHER_CONDITIONS.rain;
  if (query.includes('fog') || query.includes('mist') || query.includes('haze') || query.includes('smog')) return WEATHER_CONDITIONS.fog;
  if (query.includes('snow') || query.includes('sleet') || query.includes('blizzard')) return WEATHER_CONDITIONS.snow;
  if (query.includes('ice') || query.includes('freez') || query.includes('frost')) return WEATHER_CONDITIONS.freezing;
  if (query.includes('wind') || query.includes('gale')) return WEATHER_CONDITIONS.wind;
  if (query.includes('mostly cloudy') || query.includes('broken')) return WEATHER_CONDITIONS.mostly_cloudy;
  if (query.includes('partly') || query.includes('scattered')) return WEATHER_CONDITIONS.partly_cloudy;
  if (query.includes('cloud') || query.includes('overcast')) return WEATHER_CONDITIONS.cloudy;
  if (query.includes('clear') || query.includes('sun')) return WEATHER_CONDITIONS.clear;

  // Default fallback for regional operations
  return WEATHER_CONDITIONS.heavy_rain;
};

/**
 * NerWeatherVisual Component
 * Renders large, recognizable, accessible weather symbols at 48-72px, 40-56px, 28-36px
 */
export const NerWeatherVisual = ({
  condition = 'heavy_rain',
  size = 'lg', // 'hero' (64-72px) | 'lg' (48-56px) | 'md' (36-42px) | 'sm' (24-28px)
  className = '',
  showLabel = false,
  customLabel = null
}) => {
  const config = typeof condition === 'string' 
    ? resolveWeatherConfig(condition) 
    : condition || WEATHER_CONDITIONS.heavy_rain;

  const sizeStyles = {
    hero: 'text-[64px] sm:text-[72px] leading-none',
    lg: 'text-[48px] sm:text-[54px] leading-none',
    md: 'text-[36px] sm:text-[40px] leading-none',
    sm: 'text-[24px] sm:text-[28px] leading-none',
  }[size] || 'text-[48px] leading-none';

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      <span 
        className={`${sizeStyles} drop-shadow-xs transition-transform duration-200 hover:scale-105`}
        role="img" 
        aria-label={config.label}
      >
        {config.emoji}
      </span>
      {showLabel && (
        <span className="font-extrabold text-[12px] sm:text-xs uppercase tracking-wider text-ner-primary mt-1 text-center">
          {customLabel || config.label}
        </span>
      )}
    </div>
  );
};

export default NerWeatherVisual;
