import React from 'react';

export const KPICard = ({ 
  title, 
  value, 
  subtext, 
  icon: Icon, 
  color = 'purple', 
  badge,
  badgeType = 'neutral',
  onClick 
}) => {
  const colorMap = {
    purple: {
      icon: 'bg-purple-50 text-[#6D28D9] border-purple-200',
      border: 'hover:border-[#6D28D9]',
      val: 'text-[#172033]'
    },
    violet: {
      icon: 'bg-violet-50 text-[#7C3AED] border-violet-200',
      border: 'hover:border-[#7C3AED]',
      val: 'text-[#172033]'
    },
    teal: {
      icon: 'bg-teal-50 text-[#0D9488] border-teal-200',
      border: 'hover:border-[#0D9488]',
      val: 'text-[#0F766E]'
    },
    amber: {
      icon: 'bg-amber-50 text-[#D97706] border-amber-200',
      border: 'hover:border-[#D97706]',
      val: 'text-[#B45309]'
    },
    rose: {
      icon: 'bg-rose-50 text-[#E11D48] border-rose-200',
      border: 'hover:border-[#E11D48]',
      val: 'text-[#BE123C]'
    },
    emerald: {
      icon: 'bg-emerald-50 text-[#059669] border-emerald-200',
      border: 'hover:border-[#059669]',
      val: 'text-[#047857]'
    }
  };

  const theme = colorMap[color] || colorMap.purple;

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[#D9DEE7] rounded-lg p-4 shadow-xs flex flex-col justify-between relative transition-all duration-150 ${
        onClick ? `cursor-pointer ${theme.border} hover:shadow-sm active:scale-[0.99]` : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-xs font-bold text-[#475467] uppercase tracking-wider">
            {title}
          </div>
          <div className={`text-2xl lg:text-3xl font-bold tracking-tight ${theme.val}`}>
            {value}
          </div>
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-md border ${theme.icon} shrink-0`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      
      <div className="mt-3 pt-2.5 border-t border-[#F0F2F5] flex items-center justify-between text-xs">
        <span className="text-[#667085] font-medium truncate">{subtext}</span>
        {badge && (
          <span className={`px-2 py-0.5 rounded font-mono font-bold text-xs uppercase border ${
            badgeType === 'critical' ? 'bg-rose-50 text-[#BE123C] border-rose-200' :
            badgeType === 'warning' ? 'bg-amber-50 text-[#B45309] border-amber-200' :
            badgeType === 'success' ? 'bg-emerald-50 text-[#047857] border-emerald-200' :
            'bg-slate-100 text-[#475467] border-slate-200'
          }`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};

export default KPICard;


