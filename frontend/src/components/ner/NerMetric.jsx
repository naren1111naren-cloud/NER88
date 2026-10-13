import React from 'react';

/**
 * NerMetric — High-Density Inline Operational Metric with Large Meaningful Icons
 * Satisfies Section 10:
 * - 🛣️ 68% Network Accessible
 * - 🚛 23 Vehicles Tracked
 * - ⚠️ 7 Active Incidents
 * - ⏱️ +18 min Average Delay
 * Compact visual metrics without turning each item into a giant decorative card.
 */
export const NerMetric = ({
  label,
  value,
  unit,
  change,
  variant = 'default', // default | open | restricted | blocked | info
  visualIcon, // e.g. '🛣️', '🚛', '⚠️', '⏱️'
  icon: Icon, // optional SVG fallback
  supporting,
  className = '',
  onClick
}) => {
  const valueColor = {
    open: 'text-ner-open',
    restricted: 'text-ner-restricted',
    blocked: 'text-ner-blocked',
    info: 'text-ner-info',
    default: 'text-ner-primary',
  }[variant] || 'text-ner-primary';

  return (
    <div
      onClick={onClick}
      className={`inline-flex flex-col justify-start select-none ${
        onClick ? 'cursor-pointer hover:opacity-85 transition-opacity' : ''
      } ${className}`}
    >
      {/* Large Meaningful Icon (Section 10) */}
      {visualIcon && (
        <div className="text-2xl sm:text-[26px] leading-none mb-1.5" role="img" aria-hidden="true">
          {visualIcon}
        </div>
      )}

      {/* Metric Value */}
      <div className="flex items-baseline gap-1">
        <span className={`text-xl lg:text-2xl font-black tracking-tight ${valueColor}`}>
          {value}
        </span>
        {unit && <span className="text-xs font-bold text-ner-muted">{unit}</span>}
        {change && (
          <span className="text-[11px] font-semibold text-ner-muted ml-1">
            {change}
          </span>
        )}
      </div>

      {/* Short Operational Label */}
      <div className="text-xs font-bold text-ner-text tracking-tight mt-0.5">
        {Icon && !visualIcon && <Icon className="w-3.5 h-3.5 inline mr-1 text-ner-muted" />}
        <span>{label}</span>
      </div>

      {/* Compact Supporting Context */}
      {supporting && (
        <div className="text-[11px] text-ner-muted font-normal mt-0.5 truncate">
          {supporting}
        </div>
      )}
    </div>
  );
};

export default NerMetric;
