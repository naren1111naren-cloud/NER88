import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * NerStatus — Strict Semantic Operational Status Visuals
 * Satisfies Section 9 & Section 28 of the Master Specification:
 * - 🟢 OPEN
 * - 🟠 RESTRICTED
 * - 🔴 BLOCKED
 * - 🔴 CRITICAL
 * - 🟠 WARNING
 * - 🔵 INFORMATION
 * Always combines semantic symbol + textual label (never color alone).
 */
export const NerStatus = ({
  status = 'OPEN',
  variant,
  size = 'md',
  showSymbol = true,
  className = '',
  labelOverride
}) => {
  const { t } = useTranslation();
  const raw = (variant || status || 'OPEN').toString().toUpperCase().trim();

  let state = 'OPEN';
  if (raw.includes('CRIT') || raw === 'CRITICAL') {
    state = 'CRITICAL';
  } else if (raw.includes('BLOCK') || raw.includes('CLOSED') || raw === 'RED' || raw === 'HIGH') {
    state = 'BLOCKED';
  } else if (raw.includes('WARN') || raw === 'WARNING') {
    state = 'WARNING';
  } else if (raw.includes('RESTRICT') || raw.includes('WATCH') || raw === 'AMBER' || raw === 'MODERATE') {
    state = 'RESTRICTED';
  } else if (raw.includes('INFO') || raw === 'BLUE') {
    state = 'INFO';
  } else if (raw.includes('OPEN') || raw.includes('SAFE') || raw.includes('NORMAL') || raw.includes('OPERAT') || raw === 'GREEN' || raw === 'LOW') {
    state = 'OPEN';
  } else {
    state = 'UNKNOWN';
  }

  const configs = {
    OPEN: {
      key: 'open',
      label: 'OPEN',
      symbol: '🟢',
      style: 'bg-ner-open-bg text-ner-open border-ner-open-border',
    },
    RESTRICTED: {
      key: 'restricted',
      label: 'RESTRICTED',
      symbol: '🟠',
      style: 'bg-ner-restricted-bg text-ner-restricted border-ner-restricted-border',
    },
    BLOCKED: {
      key: 'blocked',
      label: 'BLOCKED',
      symbol: '🔴',
      style: 'bg-ner-blocked-bg text-ner-blocked border-ner-blocked-border',
    },
    CRITICAL: {
      key: 'critical',
      label: 'CRITICAL',
      symbol: '🔴',
      style: 'bg-red-100 text-red-700 border-red-300 font-black',
    },
    WARNING: {
      key: 'warning',
      label: 'WARNING',
      symbol: '🟠',
      style: 'bg-amber-100 text-amber-800 border-amber-300 font-black',
    },
    INFO: {
      key: 'info',
      label: 'INFORMATION',
      symbol: '🔵',
      style: 'bg-ner-info-bg text-ner-info border-ner-info-border',
    },
    UNKNOWN: {
      key: 'unknown',
      label: 'UNKNOWN',
      symbol: '⚪',
      style: 'bg-ner-subtle text-ner-muted border-ner-border',
    },
  };

  const cfg = configs[state] || configs.UNKNOWN;
  const displayLabel = labelOverride || t(`status.${cfg.key}`, cfg.label);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10.5px] gap-1",
    md: "px-2.5 py-0.5 text-xs gap-1.5",
    lg: "px-3 py-1 text-sm gap-2",
  }[size] || "px-2.5 py-0.5 text-xs gap-1.5";

  return (
    <span
      className={`inline-flex items-center font-extrabold uppercase tracking-wider rounded-md border select-none ${cfg.style} ${sizeClasses} ${className}`}
      role="status"
    >
      {showSymbol && (
        <span className="text-[11px] leading-none" role="img" aria-hidden="true">
          {cfg.symbol}
        </span>
      )}
      <span>{displayLabel}</span>
    </span>
  );
};

export default NerStatus;

