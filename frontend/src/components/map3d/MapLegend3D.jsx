import React from 'react';
import { useTranslation } from 'react-i18next';

export const MapLegend3D = () => {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur-md border border-[#D9E0E7] p-3 rounded-[8px] text-xs space-y-2 shadow-elevated max-w-sm text-[#17202A]">
      <div className="font-bold text-[#0B2744] border-b border-[#D9E0E7] pb-1.5 flex items-center justify-between text-xs uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#185A8D]" />
          {t('map.legend', 'ACCESSIBILITY MATRIX (0–100)')}
        </span>
        <span className="text-[10px] text-[#185A8D] font-mono font-bold">NER88 GIS</span>
      </div>

      {/* Accessibility Score Ranges */}
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-3 bg-[#F6F8FA] px-2 py-1 rounded-[4px] border border-[#D9E0E7]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#16834B]" />
            <span className="font-semibold text-[#17202A]">80 – 100</span>
          </div>
          <span className="text-[11px] font-bold text-[#16834B]">● {t('status.open', 'Fully Accessible')}</span>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#F6F8FA] px-2 py-1 rounded-[4px] border border-[#D9E0E7]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#D99A00]" />
            <span className="font-semibold text-[#17202A]">60 – 79</span>
          </div>
          <span className="text-[11px] font-bold text-[#D99A00]">▲ {t('status.restricted', 'Watch / Moderate')}</span>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#F6F8FA] px-2 py-1 rounded-[4px] border border-[#D9E0E7]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#F28C28]" />
            <span className="font-semibold text-[#17202A]">40 – 59</span>
          </div>
          <span className="text-[11px] font-bold text-[#F28C28]">! {t('status.warning', 'High Risk')}</span>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[#F6F8FA] px-2 py-1 rounded-[4px] border border-[#D9E0E7]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-[2px] bg-[#C62828]" />
            <span className="font-semibold text-[#17202A]">0 – 39</span>
          </div>
          <span className="text-[11px] font-bold text-[#C62828]">■ {t('status.blocked', 'Critical / Impassable')}</span>
        </div>
      </div>

      {/* Operational Symbol Legend */}
      <div className="pt-1.5 border-t border-[#D9E0E7] grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[#5B6570]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#185A8D]" />
          <span>{t('map.fleetVehicles', 'Fleet Telematics')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#16834B]" />
          <span>{t('map.strategicBridges', 'Operational Bridge')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[#C62828]" />
          <span>{t('status.blocked', 'Corridor Blocked')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1.5 rounded-full bg-[#185A8D]" />
          <span>{t('routes.detour', 'Alternative Detour')}</span>
        </div>
      </div>
    </div>
  );
};

export default MapLegend3D;

