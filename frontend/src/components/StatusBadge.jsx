import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, Flame, Ban, Cpu, FlaskConical } from 'lucide-react';

export const StatusBadge = ({ level, variant, children, size = 'md', className = '' }) => {
  const normalized = (variant || level || 'LOW').toUpperCase();

  const configs = {
    LOW: {
      bg: 'bg-emerald-50 text-[#047857] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      icon: ShieldCheck,
      label: 'LOW RISK',
    },
    SAFE: {
      bg: 'bg-emerald-50 text-[#047857] border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      icon: ShieldCheck,
      label: 'OPERATIONAL',
    },
    MEDIUM: {
      bg: 'bg-amber-50 text-[#B45309] border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      icon: AlertTriangle,
      label: 'MEDIUM RISK',
    },
    HIGH: {
      bg: 'bg-orange-50 text-[#C2410C] border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
      icon: AlertOctagon,
      label: 'HIGH RISK',
    },
    CRITICAL: {
      bg: 'bg-rose-50 text-[#BE123C] border-rose-300 font-bold dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      icon: Flame,
      label: 'CRITICAL RISK',
    },
    BLOCKED: {
      bg: 'bg-rose-900 text-white border-rose-950 font-bold',
      icon: Ban,
      label: 'ROAD BLOCKED',
    },
    SIMULATION: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      icon: FlaskConical,
      label: 'SANDBOX ADAPTER',
    },
    SANDBOX: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200 font-semibold dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
      icon: FlaskConical,
      label: 'SANDBOX ADAPTER',
    }
  };

  const cfg = configs[normalized] || configs.LOW;
  const Icon = cfg.icon;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border ${cfg.bg} ${sizeClasses} ${className}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{children || cfg.label}</span>
    </span>
  );
};

export default StatusBadge;

