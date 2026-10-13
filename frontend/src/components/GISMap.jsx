import React from 'react';
import { NER3DMap } from './map3d/NER3DMap';

/**
 * LINK X8 Unified 3D GIS Command Map
 * Primary map visualization in the LINK X8 Command Center
 * Displays authentic extruded 3D state boundaries across all 8 North Eastern States,
 * with live accessibility score rendering, real-time fleet telemetry, strategic bridges,
 * disruptions, and dynamic corridor routing.
 */
export const GISMap = ({ 
  vehicles = [], 
  incidents = [], 
  bridges = [],
  corridors = [],
  districts = [],
  primaryRoute = [], 
  alternateRoute = [],
  liveVehicleOverrides = {},
  onSelectVehicle,
  onSelectAsset,
  onReroute,
  onMapClick,
  className = ''
}) => {
  return (
    <NER3DMap
      vehicles={vehicles}
      incidents={incidents}
      bridges={bridges}
      corridors={corridors}
      districts={districts}
      primaryRoute={primaryRoute}
      alternateRoute={alternateRoute}
      liveVehicleOverrides={liveVehicleOverrides}
      onSelectVehicle={onSelectVehicle}
      onSelectAsset={onSelectAsset}
      onReroute={onReroute}
      onMapClick={onMapClick}
      className={className}
    />
  );
};

export default GISMap;
