import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle2, AlertTriangle, AlertOctagon, Flame, 
  Info, HelpCircle, ShieldCheck, Ban, Sparkles 
} from 'lucide-react';

/**
 * NER88 Institutional Operational Status Badge
 * Strictly follows Section 5: Always combines ICON + LABEL + COLOUR.
 * Never communicates status using colour alone.
 */
export const StatusBadge = ({ level, variant, status, children, size = 'md', className = '' }) => {
  const { t } = useTranslation();
  const rawKey = (variant || level || status || 'NORMAL').toString().toUpperCase().trim();

  // Normalize state keys
  let state = 'NORMAL';
  if (rawKey.includes('CRIT') || rawKey.includes('BLOCK') || rawKey === 'DANGER') state = 'CRITICAL';
  else if (rawKey.includes('WARN') || rawKey === 'HIGH') state = 'WARNING';
  else if (rawKey.includes('WATCH') || rawKey.includes('MED') || rawKey.includes('CAUTION')) state = 'WATCH';
  else if (rawKey.includes('INFO') || rawKey.includes('SYSTEM')) state = 'INFORMATION';
  else if (rawKey.includes('NORM') || rawKey.includes('OPERAT') || rawKey.includes('SAFE') || rawKey.includes('LOW') || rawKey.includes('SUCCESS')) state = 'NORMAL';
  else if (rawKey.includes('SIMULAT') || rawKey.includes('SANDBOX')) state = 'SIMULATION';
  else state = 'UNKNOWN';

  const configs = {
    NORMAL: {
      bg: 'bg-[#E8F5E9] text-[#16834B] border-[#C8E6C9]',
      symbol: '●',
      icon: CheckCircle2,
      defaultLabel: 'NORMAL',
    },
    WATCH: {
      bg: 'bg-[#FFF8E1] text-[#D99A00] border-[#FFE082]',
      symbol: '▲',
      icon: AlertTriangle,
      defaultLabel: 'WATCH',
    },
    WARNING: {
      bg: 'bg-[#FFF3E0] text-[#E67E22] border-[#FFCC80]',
      symbol: '!',
      icon: AlertTriangle,
      defaultLabel: 'WARNING',
    },
    CRITICAL: {
      bg: 'bg-[#FFEBEE] text-[#C62828] border-[#FFCDD2]',
      symbol: '■',
      icon: AlertOctagon,
      defaultLabel: 'CRITICAL',
    },
    INFORMATION: {
      bg: 'bg-[#E3F2FD] text-[#1769AA] border-[#BBDEFB]',
      symbol: 'ℹ',
      icon: Info,
      defaultLabel: 'INFORMATION',
    },
    SIMULATION: {
      bg: 'bg-[#EDE7F6] text-[#5E35B1] border-[#D1C4E9]',
      symbol: '◆',
      icon: Sparkles,
      defaultLabel: 'SIMULATION',
    },
    UNKNOWN: {
      bg: 'bg-[#F5F5F5] text-[#667085] border-[#E0E0E0]',
      symbol: '○',
      icon: HelpCircle,
      defaultLabel: 'UNKNOWN',
    }
  };

  const cfg = configs[state] || configs.UNKNOWN;
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px]' 
    : size === 'lg' 
      ? 'px-3 py-1 text-sm' 
      : 'px-2.5 py-0.5 text-xs';

  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-[6px] border font-bold tracking-wide uppercase ${cfg.bg} ${sizeClasses} ${className}`}
      role="status"
    >
      <span className="font-bold text-[11px] leading-none select-none" aria-hidden="true">
        {cfg.symbol}
      </span>
      <span>{children || cfg.defaultLabel}</span>
    </span>
  );
};

export default StatusBadge;
