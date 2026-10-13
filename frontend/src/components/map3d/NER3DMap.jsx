import React from 'react';
import { SatelliteGISMap } from '../map/SatelliteGISMap';

/**
 * LINK X8 Official Real Satellite GIS Command Map
 * Primary map component across LINK X8 Command Center & Network Map pages.
 * Displays authentic high-resolution satellite raster imagery of North-East India (Esri World Imagery)
 * with real-time operational overlays for State boundaries, accessibility heatmaps, 
 * strategic corridors, monitored bridges, live fleet vehicles, and hazard alerts.
 */
export const NER3DMap = ({
  vehicles = [],
  incidents = [],
  bridges = [],
  corridors = [],
  districts = [],
  primaryRoute = [],
  alternateRoute = [],
  liveVehicleOverrides = {},
  selectedAsset = null,
  isFocusMode = false,
  onSelectVehicle,
  onSelectAsset,
  onSelectIncident,
  onViewRoute,
  onToggleFocus,
  onReroute,
  onMapClick,
  className = ''
}) => {
  return (
    <SatelliteGISMap
      vehicles={vehicles}
      incidents={incidents}
      bridges={bridges}
      corridors={corridors}
      districts={districts}
      primaryRoute={primaryRoute}
      alternateRoute={alternateRoute}
      liveVehicleOverrides={liveVehicleOverrides}
      selectedAsset={selectedAsset}
      isFocusMode={isFocusMode}
      onSelectVehicle={onSelectVehicle}
      onSelectAsset={onSelectAsset}
      onSelectIncident={onSelectIncident}
      onViewRoute={onViewRoute}
      onToggleFocus={onToggleFocus}
      onReroute={onReroute}
      onMapClick={onMapClick}
      className={className}
    />
  );
};

export default NER3DMap;
