import React from 'react';

export const KPICard = ({ 
  title, 
  value, 
  subtext, 
  icon: Icon, 
  color = 'primary', 
  badge,
  badgeType = 'neutral',
  onClick 
}) => {
  const colorMap = {
    primary: {
      icon: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/25',
      border: 'hover:border-[#2563EB]',
      val: 'text-[#1E40AF]'
    },
    blue: {
      icon: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/25',
      border: 'hover:border-[#2563EB]',
      val: 'text-[#1E40AF]'
    },
    teal: {
      icon: 'bg-[#0284C7]/10 text-[#0284C7] border-[#0284C7]/25',
      border: 'hover:border-[#0284C7]',
      val: 'text-[#0369A1]'
    },
    cyan: {
      icon: 'bg-[#2563EB]/10 text-[#2563EB] border-[#2563EB]/25',
      border: 'hover:border-[#2563EB]',
      val: 'text-[#1E40AF]'
    },
    amber: {
      icon: 'bg-[#D97706]/10 text-[#D97706] border-[#D97706]/25',
      border: 'hover:border-[#D97706]',
      val: 'text-[#B45309]'
    },
    rose: {
      icon: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/25',
      border: 'hover:border-[#DC2626]',
      val: 'text-[#B91C1C]'
    },
    emerald: {
      icon: 'bg-[#16A34A]/10 text-[#16A34A] border-[#16A34A]/25',
      border: 'hover:border-[#16A34A]',
      val: 'text-[#15803D]'
    }
  };

  const theme = colorMap[color] || colorMap.primary;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#E2E8F0] rounded-xl p-4 sm:p-5 shadow-[0_1px_4px_rgba(37,99,235,0.06)] flex flex-col justify-between relative transition duration-200 ${
        onClick ? `cursor-pointer ${theme.border} hover:shadow-[0_8px_20px_rgba(37,99,235,0.12)] hover:-translate-y-0.5 active:scale-[0.99]` : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs sm:text-sm font-bold text-[#334155] uppercase tracking-wider">
            {title}
          </div>
          <div className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight ${theme.val}`}>
            {value}
          </div>
        </div>
        {Icon && (
          <div className={`p-3 rounded-xl border ${theme.icon} shrink-0 shadow-xs`}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
      
      <div className="mt-3.5 pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs font-semibold">
        <span className="text-[#475569] truncate">{subtext}</span>
        {badge && (
          <span className={`px-2.5 py-0.5 rounded-md font-mono font-bold text-[11px] uppercase border ${
            badgeType === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200' :
            badgeType === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            badgeType === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]'
          }`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};

export default KPICard;
