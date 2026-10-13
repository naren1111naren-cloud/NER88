import * as THREE from 'three';

// Geographic center for Northeast India projection (centered on Assam / Meghalaya / Nagaland junction)
export const NER_CENTER_LNG = 93.1;
export const NER_CENTER_LAT = 25.8;
export const NER_PROJECTION_SCALE = 2.45;

/**
 * Projects real Longitude/Latitude coordinates into 3D Cartesian space (X, Y, Z).
 * - X corresponds to East-West axis
 * - Z corresponds to North-South axis (North is negative Z)
 * - Y corresponds to vertical Elevation
 */
export const projectGeoTo3D = (lng, lat, elevation = 0) => {
  if (lng === undefined || lat === undefined || isNaN(lng) || isNaN(lat)) {
    return new THREE.Vector3(0, elevation, 0);
  }
  const radLat = (NER_CENTER_LAT * Math.PI) / 180;
  const x = (lng - NER_CENTER_LNG) * NER_PROJECTION_SCALE * Math.cos(radLat);
  const z = -(lat - NER_CENTER_LAT) * NER_PROJECTION_SCALE;
  return new THREE.Vector3(x, elevation, z);
};

/**
 * Maps an accessibility score (0 - 100) to authentic LINK X8 enterprise color tokens:
 * - 75 - 100: Higher accessibility (#14B8A6 / #10B981)
 * - 50 - 74: Moderate accessibility (#F59E0B / #D97706)
 * - 0 - 49: Lower / Critical accessibility (#F43F5E / #E11D48)
 */
export const getAccessibilityColor = (score) => {
  const s = typeof score === 'number' ? score : 80;
  if (s >= 75) {
    return {
      hex: 0x14b8a6,
      css: '#14B8A6',
      ambientHex: 0x093838,
      borderHex: 0x2dd4bf,
      label: 'Higher Accessibility',
      status: 'HIGH'
    };
  } else if (s >= 50) {
    return {
      hex: 0xf59e0b,
      css: '#F59E0B',
      ambientHex: 0x3d2906,
      borderHex: 0xfbbf24,
      label: 'Moderate Accessibility',
      status: 'MODERATE'
    };
  } else {
    return {
      hex: 0xf43f5e,
      css: '#F43F5E',
      ambientHex: 0x3f0a14,
      borderHex: 0xfb7185,
      label: 'Lower Accessibility',
      status: 'LOWER'
    };
  }
};

/**
 * Converts a GeoJSON ring coordinates [[lng, lat], ...] to a Three.js Shape.
 */
export const geoRingToShape = (ring) => {
  const shape = new THREE.Shape();
  if (!ring || ring.length === 0) return shape;

  const [startLng, startLat] = ring[0];
  const p0 = projectGeoTo3D(startLng, startLat);
  // Shape coordinates in X/Y plane before extrusion along Z
  shape.moveTo(p0.x, -p0.z);

  for (let i = 1; i < ring.length; i++) {
    const [lng, lat] = ring[i];
    const p = projectGeoTo3D(lng, lat);
    shape.lineTo(p.x, -p.z);
  }

  return shape;
};

/**
 * Projects a 3D point (Vector3) to 2D screen coordinates relative to a container.
 */
export const toScreenPosition = (vector3, camera, width, height) => {
  const p = vector3.clone().project(camera);
  return {
    x: ((p.x + 1) * width) / 2,
    y: ((-p.y + 1) * height) / 2,
    visible: p.z < 1 // check if in front of camera
  };
};
