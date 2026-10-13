import React from 'react';
import { ShieldAlert, CloudRain, Navigation, Activity, BellRing, Crosshair } from 'lucide-react';

const CATEGORY_ICONS = {
  risk: ShieldAlert,
  weather: CloudRain,
  route: Navigation,
  accessibility: Activity,
  alerts: BellRing,
  context: Crosshair,
};

export const AssistantQuickActions = ({ actions = [], onSelectAction, disabled }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-1 scrollbar-thin">
      {actions.map((act) => {
        const IconComponent = CATEGORY_ICONS[act.category] || Activity;
        return (
          <button
            key={act.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectAction(act.prompt)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#13261D] bg-white hover:bg-[#EEF5F1] border border-[#CCE0D5] rounded-lg transition whitespace-nowrap shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <IconComponent className="w-3.5 h-3.5 text-[#15803D]" />
            <span>{act.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default AssistantQuickActions;
