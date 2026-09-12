import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { safeArray } from '../utils/apiHelpers';

// Handler for Map Clicks
const MapEventsHandler = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    }
  });
  return null;
};

// Fix Leaflet Default Marker Icon Assets
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom Vector SVG Icons
const createCustomIcon = (svgString, color, borderColor = '#0F2747', isPulsing = false) => {
  const pulseClass = isPulsing ? 'animate-bounce' : '';
  return L.divIcon({
    html: `<div class="${pulseClass}" style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid ${borderColor}; box-shadow: 0 2px 6px rgba(0,0,0,0.25); cursor: pointer;">${svgString}</div>`,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const truckSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`;
const phoneGpsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`;
const warningSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const alertSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const bridgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V7"/><path d="M20 19V7"/><path d="M4 11h16"/><path d="M2 19h20"/><path d="m4 11 4 8"/><path d="m12 11 4 8"/><path d="m12 11-4 8"/><path d="m20 11-4 8"/></svg>`;

const vehicleIcon = createCustomIcon(truckSvg, '#2563EB');
const phoneGpsIcon = createCustomIcon(phoneGpsSvg, '#2563EB', '#1D4ED8', true);
const incidentIcon = createCustomIcon(warningSvg, '#F97316');
const blockedIcon = createCustomIcon(alertSvg, '#EF4444');
const bridgeOperationalIcon = createCustomIcon(bridgeSvg, '#10B981');
const bridgeRestrictedIcon = createCustomIcon(bridgeSvg, '#F59E0B');
const bridgeClosedIcon = createCustomIcon(bridgeSvg, '#EF4444');

const NER_DEPOTS = [
  { id: 'dep-1', name: 'Guwahati Regional Logistics Depot', lat: 26.1445, lng: 91.7362, state: 'Assam', type: 'Primary Distribution Hub' },
  { id: 'dep-2', name: 'Shillong Medical Cold Chain Hub', lat: 25.5788, lng: 91.8933, state: 'Meghalaya', type: 'Vaccine & Medical Depot' },
  { id: 'dep-3', name: 'Silchar Junction Warehouse', lat: 24.8333, lng: 92.7789, state: 'Assam', type: 'Barak Valley Transit Depot' },
  { id: 'dep-4', name: 'Imphal Valley Relief Station', lat: 24.8170, lng: 93.9368, state: 'Manipur', type: 'Emergency Cargo Destination' },
  { id: 'dep-5', name: 'Kohima Supply Depot', lat: 25.6751, lng: 94.1086, state: 'Nagaland', type: 'High-Altitude Depot' }
];

export const GISMap = ({ 
  vehicles = [], 
  incidents = [], 
  bridges = [],
  corridors = [],
  primaryRoute = [], 
  alternateRoute = [],
  liveVehicleOverrides = {},
  onSelectVehicle,
  onSelectAsset,
  onReroute,
  onMapClick
}) => {
  const [layers, setLayers] = useState({
    vehicles: true,
    incidents: true,
    routes: true,
    bridges: true,
    depots: true
  });

  const safeVehicles = safeArray(vehicles).map((v) => {
    const liveUpdate = liveVehicleOverrides[v.vehicle_code];
    if (liveUpdate) {
      return {
        ...v,
        current_lat: liveUpdate.latitude,
        current_lng: liveUpdate.longitude,
        speed_kmh: liveUpdate.speed_kmh,
        tracking_mode: liveUpdate.tracking_mode || v.tracking_mode,
        telemetry_source: liveUpdate.telemetry_source || v.telemetry_source,
        telemetry_health: 'LIVE'
      };
    }
    return v;
  });

  const safeIncidents = safeArray(incidents);
  const safeBridges = safeArray(bridges);
  const safePrimary = safeArray(primaryRoute);
  const safeAlternate = safeArray(alternateRoute);

  const defaultCenter = [25.7000, 93.0000];
  const hasBlockedIncidents = safeIncidents.some(i => i.road_status === 'BLOCKED' || i.road_status === 'CLOSED');

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-[#D9DEE7] shadow-xs">
      {/* Map Layer Controls Bar */}
      <div className="absolute top-3 right-3 z-[500] bg-white/95 backdrop-blur-sm border border-[#D9DEE7] p-3 rounded-md text-xs space-y-2 shadow-sm">
        <div className="font-bold text-[#172033] text-xs uppercase tracking-wider pb-1.5 border-b border-[#E2E8F0] flex items-center justify-between gap-2">
          <span>GIS Operational Layers</span>
        </div>
        <div className="space-y-1.5 text-xs text-[#172033]">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#1D4ED8]">
            <input 
              type="checkbox" 
              checked={layers.vehicles} 
              onChange={(e) => setLayers({ ...layers, vehicles: e.target.checked })}
              className="accent-blue-600 rounded"
            />
            <span className="font-medium">Fleet Vehicles ({safeVehicles.length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#0D9488]">
            <input 
              type="checkbox" 
              checked={layers.bridges} 
              onChange={(e) => setLayers({ ...layers, bridges: e.target.checked })}
              className="accent-teal-600 rounded"
            />
            <span className="font-medium">Bridges ({safeBridges.length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#BE123C]">
            <input 
              type="checkbox" 
              checked={layers.incidents} 
              onChange={(e) => setLayers({ ...layers, incidents: e.target.checked })}
              className="accent-rose-600 rounded"
            />
            <span className="font-medium">Disruptions & Hazards ({safeIncidents.length})</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-[#6D28D9]">
            <input 
              type="checkbox" 
              checked={layers.routes} 
              onChange={(e) => setLayers({ ...layers, routes: e.target.checked })}
              className="accent-purple-600 rounded"
            />
            <span className="font-medium">Corridors & Alternate Routes</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-700">
            <input 
              type="checkbox" 
              checked={layers.depots} 
              onChange={(e) => setLayers({ ...layers, depots: e.target.checked })}
              className="accent-indigo-600 rounded"
            />
            <span className="font-medium">Depots & Warehouses ({NER_DEPOTS.length})</span>
          </label>
        </div>
      </div>

      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapEventsHandler onMapClick={onMapClick} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Primary Route Polyline */}
        {layers.routes && safePrimary.length > 0 && (
          <Polyline 
            positions={safePrimary} 
            color={hasBlockedIncidents ? '#EF4444' : '#10B981'} 
            weight={hasBlockedIncidents ? 4 : 5} 
            dashArray={hasBlockedIncidents ? '8, 8' : undefined}
            eventHandlers={{
              click: () => onSelectAsset && onSelectAsset({
                asset_type: 'corridor',
                corridor_code: 'COR-NH27',
                name: 'NH27 Guwahati - Kohima - Imphal Corridor',
                accessibility_score: hasBlockedIncidents ? 0 : 92,
                status: hasBlockedIncidents ? 'BLOCKED' : 'OPEN',
                risk_level: hasBlockedIncidents ? 'CRITICAL' : 'LOW',
                estimated_delay_mins: hasBlockedIncidents ? 150 : 0,
                reason: hasBlockedIncidents ? 'Active landslide blockage near Senapati Pass' : 'Normal roadway clearance',
                data_source: 'INTEGRATED_ACCESSIBILITY_ENGINE',
                data_confidence: 'HIGH'
              })
            }}
          />
        )}

        {/* Alternate Route Polyline Overlay (PURPLE) */}
        {layers.routes && safeAlternate.length > 0 && (
          <Polyline 
            positions={safeAlternate} 
            color="#8B5CF6" 
            weight={5} 
            dashArray={hasBlockedIncidents ? undefined : '6, 6'}
            eventHandlers={{
              click: () => onSelectAsset && onSelectAsset({
                asset_type: 'corridor',
                corridor_code: 'COR-NH37',
                name: 'NH37 Western Bypass (Silchar - Jiribam - Imphal)',
                accessibility_score: 84,
                status: 'PASSABLE',
                risk_level: 'MEDIUM',
                estimated_delay_mins: 35,
                reason: 'Operational mountain bypass with moderate monsoon rain',
                data_source: 'INTEGRATED_ACCESSIBILITY_ENGINE',
                data_confidence: 'HIGH'
              })
            }}
          />
        )}

        {/* Strategic Bridges Layer */}
        {layers.bridges && safeBridges.map((brg) => {
          const icon = brg.status === 'CLOSED' 
            ? bridgeClosedIcon 
            : brg.status === 'RESTRICTED' || brg.status === 'DAMAGED' 
            ? bridgeRestrictedIcon 
            : bridgeOperationalIcon;

          return (
            <Marker
              key={`brg-${brg.id}`}
              position={[brg.latitude, brg.longitude]}
              icon={icon}
            >
              <Popup>
                <div className="p-2 space-y-2 min-w-[240px] text-xs font-sans text-[#172033]">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                    <span className="font-bold text-[#172033] text-xs">🌉 {brg.name}</span>
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                      brg.status === 'OPERATIONAL' 
                        ? 'bg-emerald-50 text-[#047857] border-emerald-200' 
                        : brg.status === 'CLOSED' 
                        ? 'bg-rose-50 text-[#BE123C] border-rose-200' 
                        : 'bg-amber-50 text-[#B45309] border-amber-200'
                    }`}>
                      {brg.status}
                    </span>
                  </div>
                  <div>River: <strong className="text-[#172033]">{brg.river_name || 'River Crossing'}</strong></div>
                  <div className="text-xs text-[#475467]">Corridor: <strong className="text-[#172033]">{brg.corridor_code || 'Regional Road'}</strong> ({brg.district_name}, {brg.state})</div>
                  <div className="flex items-center justify-between bg-[#F8FAFC] p-1.5 rounded border border-[#E2E8F0] text-xs">
                    <span className="text-[#475467]">Accessibility Score:</span>
                    <strong className={brg.accessibility_score < 40 ? 'text-[#BE123C] font-bold' : brg.accessibility_score < 75 ? 'text-[#B45309] font-bold' : 'text-[#047857] font-bold'}>
                      {brg.accessibility_score} / 100
                    </strong>
                  </div>
                  <p className="text-xs text-[#475467]">{brg.condition_description}</p>
                  <div className="text-xs text-[#667085]">Load Limit: {brg.load_capacity_tons}T • {brg.data_source || 'FIELD_RECORD'}</div>
                  
                  {onSelectAsset && (
                    <button
                      onClick={() => onSelectAsset({ ...brg, asset_type: 'bridge' })}
                      className="w-full mt-1.5 py-1.5 px-2 rounded-md bg-[#0F766E] hover:bg-[#115E59] text-white font-bold text-xs transition shadow-xs"
                    >
                      View Bridge Accessibility Profile
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Warehouse & Depot Markers */}
        {layers.depots && NER_DEPOTS.map((dep) => (
          <CircleMarker
            key={dep.id}
            center={[dep.lat, dep.lng]}
            radius={7}
            pathOptions={{ fillColor: '#4F46E5', color: '#FFFFFF', weight: 2, fillOpacity: 0.9 }}
          >
            <Popup>
              <div className="p-2 space-y-1 min-w-[200px] text-xs text-[#172033]">
                <div className="font-bold text-[#172033] border-b border-[#E2E8F0] pb-1">{dep.name}</div>
                <div>State: <strong className="text-[#172033]">{dep.state}</strong></div>
                <div className="text-xs text-[#475467]">{dep.type}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Vehicle Markers (BLUE) */}
        {layers.vehicles && safeVehicles.map((v) => {
          const isPhoneGps = (v.tracking_mode || '').includes('PHONE') || (v.telemetry_source || '').includes('PHONE');
          const currentIcon = isPhoneGps ? phoneGpsIcon : vehicleIcon;

          return (
            <Marker 
              key={`veh-${v.id}`} 
              position={[v.current_lat || 26.1445, v.current_lng || 91.7362]} 
              icon={currentIcon}
            >
              <Popup>
                <div className="p-2 space-y-1.5 min-w-[230px] text-xs text-[#172033]">
                  <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[#1D4ED8]">{v.vehicle_code}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${
                        isPhoneGps ? 'bg-blue-50 text-[#1D4ED8] border-blue-200' :
                        v.telemetry_health === 'LIVE' ? 'bg-emerald-50 text-[#047857] border-emerald-200' :
                        v.telemetry_health === 'STALE' ? 'bg-amber-50 text-[#B45309] border-amber-200' : 'bg-slate-100 text-[#475467] border-slate-200'
                      }`}>
                        {isPhoneGps ? 'LIVE TELEMETRY' : (v.telemetry_health || 'LIVE')}
                      </span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${v.risk_level === 'CRITICAL' ? 'bg-rose-50 text-[#BE123C] border-rose-200' : 'bg-emerald-50 text-[#047857] border-emerald-200'}`}>
                      {v.risk_level || 'LOW'} RISK
                    </span>
                  </div>
                  <div>Driver: <strong className="text-[#172033]">{v.driver_name || 'Convoy Operator'}</strong></div>
                  <div>Coordinates: <span className="font-mono text-xs text-[#172033]">[{v.current_lat?.toFixed(4)}, {v.current_lng?.toFixed(4)}]</span></div>
                  <div>Destination: <strong className="text-[#172033]">{v.destination_city || 'Regional Depot'}</strong></div>
                  <div className="text-xs text-[#475467]">Speed: <strong className="text-[#172033]">{v.speed_kmh} km/h</strong> • Mode: <span className="font-bold text-[#1D4ED8]">{v.tracking_mode || 'SIM'}</span></div>
                  <div className="text-xs text-[#667085]">Odo: {v.odometer_km ? v.odometer_km.toFixed(1) : '12450.0'} km • Source: {v.telemetry_source || 'GPS'}</div>
                  
                  {onSelectAsset && (
                    <button
                      onClick={() => onSelectAsset({ ...v, asset_type: 'vehicle', name: `Vehicle ${v.vehicle_code} (${v.driver_name})` })}
                      className="w-full mt-1 py-1.5 px-2 rounded-md bg-[#F8FAFC] hover:bg-[#F1F5F9] text-[#172033] font-bold text-xs border border-[#D9DEE7] transition"
                    >
                      Inspect Vehicle Telemetry
                    </button>
                  )}

                  {v.risk_level === 'CRITICAL' && onReroute && (
                    <button 
                      onClick={() => onReroute(v.id)}
                      className="w-full mt-1.5 py-1.5 px-2 rounded-md bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-bold text-xs transition active:scale-95"
                    >
                      Approve Reroute via Alt Route B
                    </button>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Incident Markers */}
        {layers.incidents && safeIncidents.map((inc) => (
          <Marker 
            key={`inc-${inc.id}`} 
            position={[inc.latitude, inc.longitude]} 
            icon={inc.road_status === 'BLOCKED' || inc.road_status === 'CLOSED' ? blockedIcon : incidentIcon}
          >
            <Popup>
              <div className="p-2 space-y-1.5 min-w-[230px] text-xs text-[#172033]">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
                  <span className="font-bold text-[#BE123C]">{inc.incident_type}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-50 text-[#BE123C] border border-rose-200">
                    {inc.road_status}
                  </span>
                </div>
                <p className="text-[#172033] mt-1 font-medium">{inc.description}</p>
                <div className="text-xs text-[#475467] mt-1">Location: {inc.location_name}</div>
                {inc.photo_url && (
                  <div className="mt-1 font-bold text-[#6D28D9] text-xs">📷 Geo-tagged Field Photograph Attached</div>
                )}
                <div className="text-xs text-[#667085]">Reported: {new Date(inc.created_at || Date.now()).toLocaleTimeString()}</div>

                {onSelectAsset && (
                  <button
                    onClick={() => onSelectAsset({ ...inc, asset_type: 'incident', name: `${inc.incident_type} at ${inc.location_name}` })}
                    className="w-full mt-1.5 py-1.5 px-2 rounded-md bg-rose-50 hover:bg-rose-100 text-[#BE123C] font-bold text-xs transition border border-rose-200"
                  >
                    Inspect Incident Impact
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Floating Legend (Standardized Operational Colors) */}
      <div className="absolute bottom-3 left-3 z-[500] bg-white/95 backdrop-blur-sm border border-[#D9DEE7] p-3 rounded-md text-xs space-y-1.5 shadow-sm max-w-sm">
        <div className="font-bold text-[#172033] border-b border-[#E2E8F0] pb-1 flex items-center justify-between text-xs uppercase tracking-wider">
          <span>OPERATIONAL MAP LEGEND</span>
          <span className="text-xs text-[#6D28D9] font-bold">LINK X8 GIS</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs font-semibold text-[#172033]">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981] inline-block"></span> <span>GREEN: OPEN</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block"></span> <span>YELLOW: RESTRICTED</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F97316] inline-block"></span> <span>ORANGE: HIGH RISK</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] inline-block"></span> <span>RED: BLOCKED</span></div>
          <div className="flex items-center gap-1.5"><span className="w-3.5 h-1.5 bg-[#8B5CF6] inline-block rounded"></span> <span>PURPLE: ALT ROUTE</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2563EB] inline-block animate-pulse"></span> <span>BLUE: FLEET TRUCK</span></div>
        </div>
      </div>
    </div>
  );
};

export default GISMap;
