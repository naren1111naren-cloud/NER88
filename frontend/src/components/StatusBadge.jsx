import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Flame, Ban } from 'lucide-react';

export const StatusBadge = ({ level, size = 'md' }) => {
  const normalized = (level || 'LOW').toUpperCase();

  const configs = {
    LOW: {
      bg: 'bg-emerald-50 text-[#047857] border-emerald-200',
      icon: ShieldCheck,
      label: 'LOW RISK',
    },
    SAFE: {
      bg: 'bg-emerald-50 text-[#047857] border-emerald-200',
      icon: ShieldCheck,
      label: 'OPERATIONAL',
    },
    MEDIUM: {
      bg: 'bg-amber-50 text-[#B45309] border-amber-200',
      icon: AlertTriangle,
      label: 'MEDIUM RISK',
    },
    HIGH: {
      bg: 'bg-orange-50 text-[#C2410C] border-orange-200',
      icon: AlertOctagon,
      label: 'HIGH RISK',
    },
    CRITICAL: {
      bg: 'bg-rose-50 text-[#BE123C] border-rose-300 font-bold',
      icon: Flame,
      label: 'CRITICAL RISK',
    },
    BLOCKED: {
      bg: 'bg-rose-900 text-white border-rose-950 font-bold',
      icon: Ban,
      label: 'ROAD BLOCKED',
    }
  };

  const cfg = configs[normalized] || configs.LOW;
  const Icon = cfg.icon;

  const sizeClasses = size === 'sm' ? 'px-2.5 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-md border ${cfg.bg} ${sizeClasses}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span>{cfg.label}</span>
    </span>
  );
};

export default StatusBadge;

