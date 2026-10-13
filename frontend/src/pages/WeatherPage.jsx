import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Layers, ArrowRight, Compass
} from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { NerHeader, NerButton, NerStatus, NerWeatherVisual, resolveWeatherConfig } from '../components/ner';

const customWeatherIcon = new L.DivIcon({
  className: 'custom-weather-icon',
  html: '<div style="background-color: #2563EB; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #FFFFFF; box-shadow: 0 1px 4px rgba(0,0,0,0.4);"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});

/**
 * NER88 Weather Intelligence & Risk Page (/weather)
 */
export const WeatherPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState('ALL');
  const [activeLayer, setActiveLayer] = useState('Rainfall');

  // Comprehensive all-season regional weather telemetry database for Northeast India
  const weatherZones = [
    {
      id: 'w-gangtok',
      district: 'East Sikkim & Teesta Basin',
      state: 'Sikkim',
      condition: 'heavy_rain',
      conditionLabel: 'HEAVY RAIN',
      temperature: '14°C',
      rainfall: '58 mm/hr',
      visibility: '2.8 km',
      windSpeed: '22 km/h',
      road_impact: 'BLOCKED',
      risk: 'CRITICAL',
      fleet_affected: 12,
      primary_corridor: 'NH-10 (Sevoke – Gangtok)',
      seasonCategory: 'MONSOON',
      updated: '21:05 IST',
      logistics_impact: 'Severe landslide hazard. Teesta Bridge restricted. Convoys held.',
      coords: [27.3389, 88.6065]
    },
    {
      id: 'w-shillong',
      district: 'Shillong & Plateau Approaches',
      state: 'Meghalaya',
      condition: 'rain',
      conditionLabel: 'MONSOON PRECIPITATION',
      temperature: '21°C',
      rainfall: '42 mm/hr',
      visibility: '4.2 km',
      windSpeed: '18 km/h',
      road_impact: 'RESTRICTED',
      risk: 'RESTRICTED',
      fleet_affected: 8,
      primary_corridor: 'NH-6 (Jowai – Silchar)',
      seasonCategory: 'MONSOON',
      updated: '21:07 IST',
      logistics_impact: 'High slope saturation risk on NH-6. Axle load limit reduced to 16t.',
      coords: [25.5788, 91.8933]
    },
    {
      id: 'w-imphal',
      district: 'Imphal Valley & Senapati Pass',
      state: 'Manipur',
      condition: 'thunderstorm',
      conditionLabel: 'THUNDERSTORM',
      temperature: '22°C',
      rainfall: '28 mm/hr',
      visibility: '5.2 km',
      windSpeed: '38 km/h',
      road_impact: 'RESTRICTED',
      risk: 'RESTRICTED',
      fleet_affected: 6,
      primary_corridor: 'NH-37 & NH-2 Corridor',
      seasonCategory: 'STORM',
      updated: '21:06 IST',
      logistics_impact: 'Mountain squall and low visibility. High clearance convoys only.',
      coords: [24.8170, 93.9368]
    },
    {
      id: 'w-teesta',
      district: 'Mangan & North Sikkim Valleys',
      state: 'Sikkim',
      condition: 'flood',
      conditionLabel: 'FLASH FLOOD SURGE',
      temperature: '12°C',
      rainfall: '65 mm/hr',
      visibility: '1.9 km',
      windSpeed: '32 km/h',
      road_impact: 'BLOCKED',
      risk: 'CRITICAL',
      fleet_affected: 9,
      primary_corridor: 'NH-10 River Gateway',
      seasonCategory: 'MONSOON',
      updated: '21:09 IST',
      logistics_impact: 'Teesta River discharge +2.4m above amber warning. Road cut-offs active.',
      coords: [27.5054, 88.5332]
    },
    {
      id: 'w-dibrugarh',
      district: 'Dibrugarh & Upper Brahmaputra',
      state: 'Assam',
      condition: 'fog',
      conditionLabel: 'DENSE RIVER FOG',
      temperature: '17°C',
      rainfall: '0 mm/hr',
      visibility: '0.8 km',
      windSpeed: '6 km/h',
      road_impact: 'RESTRICTED',
      risk: 'WARNING',
      fleet_affected: 4,
      primary_corridor: 'NH-15 / Bogibeel Bridge',
      seasonCategory: 'WINTER',
      updated: '21:04 IST',
      logistics_impact: 'Severe sub-kilometer visibility. Bridge speed limit restricted to 25 km/h.',
      coords: [27.4728, 94.9120]
    },
    {
      id: 'w-tawang',
      district: 'Tawang & Sela High Ridge',
      state: 'Arunachal Pradesh',
      condition: 'freezing',
      conditionLabel: 'FREEZING / BLACK ICE',
      temperature: '1°C',
      rainfall: '0 mm/hr',
      visibility: '3.4 km',
      windSpeed: '28 km/h',
      road_impact: 'RESTRICTED',
      risk: 'WARNING',
      fleet_affected: 3,
      primary_corridor: 'NH-13 (Trans-Arunachal)',
      seasonCategory: 'WINTER',
      updated: '21:02 IST',
      logistics_impact: 'Black ice on high-altitude hairpin bends. Chains required for multi-axle.',
      coords: [27.5861, 91.8594]
    },
    {
      id: 'w-kohima',
      district: 'Kohima Ridge Approaches',
      state: 'Nagaland',
      condition: 'wind',
      conditionLabel: 'STRONG RIDGE GALE',
      temperature: '19°C',
      rainfall: '6 mm/hr',
      visibility: '6.5 km',
      windSpeed: '46 km/h',
      road_impact: 'RESTRICTED',
      risk: 'WARNING',
      fleet_affected: 5,
      primary_corridor: 'NH-29 (Dimapur – Kohima)',
      seasonCategory: 'STORM',
      updated: '21:08 IST',
      logistics_impact: 'High side winds on exposed valley viaducts. Container trucks throttled.',
      coords: [25.6751, 94.1086]
    },
    {
      id: 'w-guwahati',
      district: 'Kamrup Metropolitan Hub',
      state: 'Assam',
      condition: 'clear',
      conditionLabel: 'CLEAR / STABLE',
      temperature: '31°C',
      rainfall: '0 mm/hr',
      visibility: '10.0 km',
      windSpeed: '9 km/h',
      road_impact: 'OPEN',
      risk: 'OPEN',
      fleet_affected: 0,
      primary_corridor: 'NH-27 / NH-37 Hub',
      seasonCategory: 'SUMMER',
      updated: '21:08 IST',
      logistics_impact: 'Regional logistics hub fully operational. Clear dispatch windows.',
      coords: [26.1445, 91.7362]
    }
  ];

  const [selectedZone, setSelectedZone] = useState(weatherZones[0]);

  // Filtered weather zones based on season tab
  const filteredZones = weatherZones.filter((z) => {
    if (selectedSeasonFilter === 'ALL') return true;
    return z.seasonCategory === selectedSeasonFilter;
  });

  const weatherLayers = [
    { key: 'Rainfall', label: t('weather.rainfall', 'Rainfall') },
    { key: 'Flood Risk', label: t('weather.floodRisk', 'Flood Risk') },
    { key: 'Visibility', label: t('weather.visibility', 'Visibility') },
    { key: 'Road Impact', label: t('weather.roadImpact', 'Road Impact') }
  ];

  return (
    <div className="space-y-4 pb-8 font-sans text-ner-text select-none">
      
      {/* ── HEADER ── */}
      <NerHeader
        title={t('weather.title', 'Weather & Operational Risk')}
        subtitle={t('weather.subtitle', 'Meteorological factors and precipitation rates influencing Northeast road accessibility and freight transit risk')}
        badge={t('weather.telemetryActive', 'IMD / AWS Telemetry Active')}
        lastUpdated="21:10 IST"
      />

      {/* ── ALL-SEASON WEATHER FILTER TABS ── */}
      <div className="bg-white border border-ner-border rounded-lg p-2.5 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-extrabold text-ner-muted uppercase tracking-wider mr-1">
            {t('weather.seasonProfile', 'Season Profile:')}
          </span>

          {[
            { id: 'ALL', label: t('weather.allRegions', 'All Regions (8 States)'), icon: '🌏' },
            { id: 'MONSOON', label: t('weather.monsoonFlood', 'Monsoon & Flood Surge'), icon: '🌧️' },
            { id: 'STORM', label: t('weather.thunderstormGales', 'Thunderstorm & Gales'), icon: '⛈️' },
            { id: 'WINTER', label: t('weather.winterFog', 'Winter Fog & Ice'), icon: '🌫️' },
            { id: 'SUMMER', label: t('weather.summerClear', 'Summer & Clear'), icon: '☀️' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedSeasonFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer border ${
                selectedSeasonFilter === tab.id
                  ? 'bg-ner-primary text-white border-ner-primary shadow-2xs'
                  : 'bg-ner-background text-ner-text-secondary border-ner-border hover:bg-ner-subtle'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono text-ner-muted">
          {t('weather.showingSectors', 'Showing {{count}} of {{total}} Monitored Sectors', { count: filteredZones.length, total: weatherZones.length })}
        </span>
      </div>

      {/* ── OPERATIONAL WEATHER RISK CARDS WITH LARGE VISUALS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {filteredZones.map((z) => {
          const isSelected = selectedZone.id === z.id;
          const statusVariant = z.risk === 'CRITICAL' ? 'BLOCKED' : z.risk;

          return (
            <div
              key={z.id}
              onClick={() => setSelectedZone(z)}
              className={`bg-white border rounded-lg p-3.5 shadow-xs hover:shadow-subtle transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                isSelected 
                  ? 'border-ner-secondary ring-2 ring-ner-secondary/30 bg-ner-secondary-light/10' 
                  : 'border-ner-border hover:border-ner-border-strong'
              }`}
            >
              <div>
                {/* Sector Header + Status */}
                <div className="flex items-center justify-between border-b border-ner-border pb-2">
                  <span className="text-[10px] font-mono font-bold text-ner-muted uppercase tracking-wider">
                    {z.state}
                  </span>
                  <NerStatus status={statusVariant} size="sm" />
                </div>

                {/* Hero Weather Visual (48-54px) + Condition Name */}
                <div className="py-3 flex flex-col items-center justify-center text-center">
                  <NerWeatherVisual 
                    condition={z.condition} 
                    size="lg" 
                  />
                  <div className="font-black text-xs text-ner-primary uppercase tracking-tight mt-1.5">
                    {z.conditionLabel}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xl font-extrabold text-ner-primary tracking-tight">
                      {z.temperature}
                    </span>
                    <span className="text-xs text-ner-muted font-bold">·</span>
                    <span className="text-xs font-semibold text-ner-text-secondary">
                      {z.rainfall}
                    </span>
                  </div>
                </div>

                {/* Location Title */}
                <div className="border-t border-ner-border/60 pt-2">
                  <div className="font-extrabold text-xs text-ner-primary truncate">{z.district}</div>
                  <div className="text-[11px] text-ner-muted font-medium truncate mt-0.5">
                    {t('common.corridor', 'Corridor')}: <strong className="text-ner-text font-bold">{z.primary_corridor}</strong>
                  </div>
                </div>

                {/* Logistics Connection */}
                <div className="grid grid-cols-2 gap-1.5 bg-ner-background p-2 rounded-md border border-ner-border my-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-ner-muted uppercase font-bold block">{t('weather.roadImpact', 'Road Impact')}</span>
                    <strong className={
                      z.road_impact === 'BLOCKED' ? 'text-ner-blocked font-black' :
                      z.road_impact === 'RESTRICTED' ? 'text-ner-restricted font-bold' :
                      'text-ner-open font-bold'
                    }>
                      {z.road_impact === 'BLOCKED' ? `🔴 ${t('status.blocked', 'BLOCKED')}` : z.road_impact === 'RESTRICTED' ? `🟠 ${t('status.restricted', 'RESTRICTED')}` : `🟢 ${t('status.open', 'OPEN')}`}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-ner-muted uppercase font-bold block">{t('weather.fleetImpact', 'Fleet Impact')}</span>
                    <strong className="text-ner-text font-extrabold inline-flex items-center gap-1">
                      <span>🚛</span>
                      <span>{z.fleet_affected} {t('common.fleet', 'units')}</span>
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setSelectedZone(z); 
                }}
                className={`w-full py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors text-center cursor-pointer border ${
                  isSelected
                    ? 'bg-ner-secondary text-white border-ner-secondary'
                    : 'bg-ner-subtle hover:bg-ner-secondary-light text-ner-secondary border-ner-border'
                }`}
              >
                {t('weather.inspectSectorImpact', 'Inspect Sector Impact')}
              </button>
            </div>
          );
        })}
      </div>

      {/* ── WEATHER GIS RADAR & FOCUSED LOGISTICS ASSESSMENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        
        {/* Map View (8 of 12 columns) */}
        <div className="lg:col-span-8 bg-white border border-ner-border rounded-lg p-3 shadow-xs flex flex-col space-y-3">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-ner-border pb-2">
            <div className="flex items-center gap-2 font-extrabold text-xs text-ner-primary uppercase tracking-wider">
              <Layers className="w-4 h-4 text-ner-secondary" />
              <span>{t('weather.gisOverlays', 'GIS Precipitation & Hazard Overlays:')}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {weatherLayers.map((layer) => (
                <button
                  key={layer.key}
                  type="button"
                  onClick={() => setActiveLayer(layer.key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer border ${
                    activeLayer === layer.key
                      ? 'bg-ner-primary text-white border-ner-primary'
                      : 'bg-ner-background text-ner-text-secondary border-ner-border hover:border-ner-border-strong'
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[430px] rounded-md overflow-hidden border border-ner-border">
            <MapContainer
              center={[26.2, 92.5]}
              zoom={7}
              scrollWheelZoom={false}
              className="w-full h-full"
            >
              <TileLayer
                attribution='Tiles &copy; Esri World Imagery'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              <TileLayer
                url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
              {weatherZones.map((zone) => (
                <React.Fragment key={zone.id}>
                  <Circle
                    center={zone.coords}
                    radius={zone.risk === 'CRITICAL' ? 45000 : zone.risk === 'RESTRICTED' ? 32000 : 22000}
                    pathOptions={{
                      color: zone.risk === 'CRITICAL' ? '#DC2626' : zone.risk === 'RESTRICTED' ? '#D97706' : '#16A34A',
                      fillColor: zone.risk === 'CRITICAL' ? '#DC2626' : zone.risk === 'RESTRICTED' ? '#D97706' : '#16A34A',
                      fillOpacity: 0.22,
                      weight: 1.5
                    }}
                  />
                  <Marker position={zone.coords} icon={customWeatherIcon}>
                    <Popup>
                      <div className="text-xs p-1">
                        <strong className="text-ner-primary block">{zone.district}</strong>
                        <div className="text-[11px] text-ner-muted font-bold mt-0.5">{zone.conditionLabel} · {zone.temperature}</div>
                        <div className="text-[11px] mt-1">{t('weather.rainfall', 'Precipitation')}: <strong>{zone.rainfall}</strong></div>
                        <div className="text-[11px]">{t('weather.visibility', 'Visibility')}: <strong>{zone.visibility}</strong></div>
                        <div className="text-[11px] text-ner-blocked font-bold mt-1">{t('common.status', 'Status')}: {zone.road_impact}</div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Selected Zone Deep Logistics Assessment (4 of 12 columns) */}
        <div className="lg:col-span-4 bg-white border border-ner-border rounded-lg p-4 shadow-xs space-y-3.5">
          
          <div className="flex items-center justify-between border-b border-ner-border pb-2.5">
            <span className="text-xs font-black text-ner-primary uppercase tracking-wider">
              {t('weather.operationalAssessment', 'Operational Zone Assessment')}
            </span>
            <NerStatus status={selectedZone.risk === 'CRITICAL' ? 'BLOCKED' : selectedZone.risk} size="sm" />
          </div>

          {/* Large Focused Weather Visual (64px) */}
          <div className="flex items-center gap-3.5 p-3 rounded-lg bg-ner-background border border-ner-border">
            <NerWeatherVisual 
              condition={selectedZone.condition} 
              size="hero" 
            />
            <div className="min-w-0">
              <div className="font-black text-sm text-ner-primary uppercase tracking-tight">
                {selectedZone.conditionLabel}
              </div>
              <div className="text-xl font-extrabold text-ner-primary tracking-tight mt-0.5">
                {selectedZone.temperature}
              </div>
              <div className="text-xs text-ner-text-secondary font-medium mt-0.5">
                {selectedZone.district} ({selectedZone.state})
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="p-2 bg-ner-subtle rounded border border-ner-border">
              <span className="text-[10px] font-bold text-ner-muted uppercase block">{t('weather.rainfall', 'Rainfall')}</span>
              <span className="font-extrabold text-ner-text mt-0.5 block">{selectedZone.rainfall}</span>
            </div>
            <div className="p-2 bg-ner-subtle rounded border border-ner-border">
              <span className="text-[10px] font-bold text-ner-muted uppercase block">{t('weather.visibility', 'Visibility')}</span>
              <span className="font-extrabold text-ner-text mt-0.5 block">{selectedZone.visibility}</span>
            </div>
            <div className="p-2 bg-ner-subtle rounded border border-ner-border">
              <span className="text-[10px] font-bold text-ner-muted uppercase block">{t('weather.wind', 'Wind')}</span>
              <span className="font-extrabold text-ner-text mt-0.5 block">{selectedZone.windSpeed}</span>
            </div>
          </div>

          {/* Road Corridor & Logistics Delay */}
          <div className="space-y-2 text-xs">
            <div className="bg-ner-background p-2.5 rounded-md border border-ner-border">
              <div className="text-[10px] font-bold text-ner-muted uppercase flex items-center gap-1">
                <span>🛣️</span>
                <span>{t('weather.affectedCorridor', 'Affected Strategic Corridor')}</span>
              </div>
              <div className="font-bold text-ner-primary mt-1">
                {selectedZone.primary_corridor}
              </div>
            </div>

            <div className="bg-ner-restricted-bg p-2.5 rounded-md border border-ner-restricted-border text-ner-text">
              <div className="text-[10px] font-black text-ner-restricted uppercase flex items-center gap-1">
                <span>⚠️</span>
                <span>{t('weather.logisticsImpact', 'Expected Logistics Impact')}</span>
              </div>
              <div className="font-medium mt-1 leading-relaxed text-[11.5px]">
                {selectedZone.logistics_impact}
              </div>
            </div>
          </div>

          {/* Direct Link to Reroute */}
          <button
            type="button"
            onClick={() => navigate('/routes')}
            className="w-full py-2 px-3 rounded-md bg-ner-secondary hover:bg-ner-secondary-dark text-white font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{t('weather.inspectDetourOptions', 'Inspect Corridor Detour Options')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

    </div>
  );
};

export default WeatherPage;

