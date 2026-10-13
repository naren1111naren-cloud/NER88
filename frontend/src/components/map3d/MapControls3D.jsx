import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  RotateCcw, Compass, ZoomIn, ZoomOut, Eye, 
  Layers, Truck, ShieldAlert, Navigation, Waves, MapPin 
} from 'lucide-react';

export const MapControls3D = ({
  layers,
  onToggleLayer,
  onResetView,
  onToggle2D3D,
  is2DView,
  onZoomIn,
  onZoomOut,
  stats = {}
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Top-Right GIS Layer Selector */}
      <div className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md border border-[#D5E4DB] p-3 rounded-xl text-xs space-y-2 shadow-md text-[#13261D] max-w-xs">
        <div className="font-bold text-[#0B3B24] text-xs uppercase tracking-wider pb-1.5 border-b border-[#D5E4DB] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#15803D]" />
            {t('map.layers', 'GIS Telemetry Layers')}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-[#3E5649]">
          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-[#13261D] transition-colors">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={layers.vehicles}
                onChange={(e) => onToggleLayer('vehicles', e.target.checked)}
                className="accent-[#15803D] rounded"
              />
              <span className="font-medium text-[#13261D]">{t('map.fleetVehicles', 'Fleet Vehicles')}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#15803D]/10 text-[#15803D] border border-[#15803D]/20">
              {stats.vehiclesCount ?? 0}
            </span>
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-[#13261D] transition-colors">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={layers.bridges}
                onChange={(e) => onToggleLayer('bridges', e.target.checked)}
                className="accent-[#198754] rounded"
              />
              <span className="font-medium text-[#13261D]">{t('map.strategicBridges', 'Strategic Bridges')}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#198754]/10 text-[#198754] border border-[#198754]/20">
              {stats.bridgesCount ?? 0}
            </span>
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-[#13261D] transition-colors">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={layers.incidents}
                onChange={(e) => onToggleLayer('incidents', e.target.checked)}
                className="accent-[#C62828] rounded"
              />
              <span className="font-medium text-[#13261D]">{t('map.activeIncidents', 'Disruptions / Blockages')}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#C62828]/10 text-[#C62828] border border-[#C62828]/20">
              {stats.incidentsCount ?? 0}
            </span>
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-[#13261D] transition-colors">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={layers.routes}
                onChange={(e) => onToggleLayer('routes', e.target.checked)}
                className="accent-[#15803D] rounded"
              />
              <span className="font-medium text-[#13261D]">{t('map.corridors', 'Active & Alt Corridors')}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#15803D]/10 text-[#15803D] border border-[#15803D]/20">
              NH27/37
            </span>
          </label>

          <label className="flex items-center justify-between gap-2 cursor-pointer hover:text-[#13261D] transition-colors">
            <span className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={layers.depots}
                onChange={(e) => onToggleLayer('depots', e.target.checked)}
                className="accent-[#15803D] rounded"
              />
              <span className="font-medium text-[#13261D]">{t('map.hubs', 'Hubs & Transit Cities')}</span>
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#EEF5F1] text-[#3E5649] border border-[#D5E4DB]">
              8 States
            </span>
          </label>
        </div>
      </div>

      {/* Bottom-Right Navigation Controls Bar */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 bg-white/95 backdrop-blur-md border border-[#D5E4DB] p-1.5 rounded-xl shadow-md">
        <button
          type="button"
          onClick={onResetView}
          title={t('map.resetView', 'Reset View')}
          className="p-2 rounded-lg bg-white hover:bg-[#F7FAF8] text-[#3E5649] hover:text-[#13261D] border border-[#CCE0D5] transition cursor-pointer flex items-center gap-1 text-xs font-semibold"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#15803D]" />
          <span className="hidden sm:inline">{t('map.resetView', 'Reset View')}</span>
        </button>

        <button
          type="button"
          onClick={onToggle2D3D}
          title={is2DView ? t('map.terrain', 'Terrain View') : t('map.toggle2D3D', '2D Map')}
          className={`p-2 rounded-lg border transition cursor-pointer flex items-center gap-1 text-xs font-semibold ${
            is2DView
              ? 'bg-[#15803D] text-white border-[#15803D]'
              : 'bg-white hover:bg-[#F7FAF8] text-[#3E5649] border-[#CCE0D5]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>{is2DView ? t('map.toggle2D3D', '2D Map') : t('map.terrain', 'Terrain View')}</span>
        </button>

        <div className="h-4 w-px bg-[#D5E4DB] mx-0.5" />

        <button
          type="button"
          onClick={onZoomIn}
          title={t('map.zoomIn', 'Zoom In')}
          className="p-2 rounded-lg bg-white hover:bg-[#F7FAF8] text-[#3E5649] hover:text-[#13261D] border border-[#CCE0D5] transition cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          title={t('map.zoomOut', 'Zoom Out')}
          className="p-2 rounded-lg bg-white hover:bg-[#F7FAF8] text-[#3E5649] hover:text-[#13261D] border border-[#CCE0D5] transition cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
};

export default MapControls3D;

