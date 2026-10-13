import * as THREE from 'three';
import { projectGeoTo3D } from './geoUtils';
import { MAJOR_LOGISTICS_CITIES } from '../../data/northeastGeoJSON';

/**
 * Builds and manages 3D interactive markers for:
 * - Fleet Vehicles
 * - Strategic Bridges
 * - Disruptions & Incidents
 * - Depots & Warehouses
 * - Major Logistics Cities
 */
export class MarkerLayer3D {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'NER_Markers_Layer';

    this.vehicles = options.vehicles || [];
    this.bridges = options.bridges || [];
    this.incidents = options.incidents || [];
    this.depots = options.depots || [];

    this.subgroups = {
      vehicles: new THREE.Group(),
      bridges: new THREE.Group(),
      incidents: new THREE.Group(),
      depots: new THREE.Group(),
      cities: new THREE.Group()
    };

    Object.values(this.subgroups).forEach(g => this.group.add(g));
    this.scene.add(this.group);

    this.pulseItems = [];
    this.clickableObjects = [];

    this.buildAll();
  }

  buildAll() {
    this.buildCities();
    this.buildDepots();
    this.buildBridges();
    this.buildVehicles();
    this.buildIncidents();
  }

  buildCities() {
    MAJOR_LOGISTICS_CITIES.forEach((city) => {
      const pos = projectGeoTo3D(city.coords[0], city.coords[1], 0.65);
      
      // Node Cylinder Base
      const baseGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.1, 16);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x091c23,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.6,
        roughness: 0.3
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.copy(pos);

      // Light Beacon Sphere
      const sphereGeo = new THREE.SphereGeometry(0.12, 12, 12);
      const sphereMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.set(pos.x, pos.y + 0.15, pos.z);

      baseMesh.userData = {
        type: 'city',
        data: city,
        name: city.name
      };
      sphereMesh.userData = baseMesh.userData;

      this.subgroups.cities.add(baseMesh);
      this.subgroups.cities.add(sphereMesh);
      this.clickableObjects.push(baseMesh, sphereMesh);
    });
  }

  buildDepots() {
    const NER_DEPOTS = [
      { id: 'dep-1', name: 'Guwahati Regional Logistics Depot', lat: 26.1445, lng: 91.7362, state: 'Assam', type: 'Primary Distribution Hub' },
      { id: 'dep-2', name: 'Shillong Medical Cold Chain Hub', lat: 25.5788, lng: 91.8933, state: 'Meghalaya', type: 'Vaccine & Medical Depot' },
      { id: 'dep-3', name: 'Silchar Junction Warehouse', lat: 24.8333, lng: 92.7789, state: 'Assam', type: 'Barak Valley Transit Depot' },
      { id: 'dep-4', name: 'Imphal Valley Relief Station', lat: 24.8170, lng: 93.9368, state: 'Manipur', type: 'Emergency Cargo Destination' },
      { id: 'dep-5', name: 'Kohima Supply Depot', lat: 25.6751, lng: 94.1086, state: 'Nagaland', type: 'High-Altitude Depot' }
    ];

    NER_DEPOTS.forEach((dep) => {
      const pos = projectGeoTo3D(dep.lng, dep.lat, 0.7);
      
      const pinGeo = new THREE.ConeGeometry(0.18, 0.45, 16);
      pinGeo.rotateX(Math.PI); // Point downwards
      const pinMat = new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        emissive: 0x2dd4bf,
        emissiveIntensity: 0.7,
        metalness: 0.6
      });
      const pinMesh = new THREE.Mesh(pinGeo, pinMat);
      pinMesh.position.set(pos.x, pos.y + 0.35, pos.z);

      pinMesh.userData = {
        type: 'depot',
        data: dep,
        name: dep.name
      };

      this.subgroups.depots.add(pinMesh);
      this.clickableObjects.push(pinMesh);
    });
  }

  buildBridges() {
    this.bridges.forEach((brg) => {
      const lat = brg.latitude || 26.0;
      const lng = brg.longitude || 92.0;
      const pos = projectGeoTo3D(lng, lat, 0.75);

      const colorHex = brg.status === 'OPERATIONAL' ? 0x10b981 :
                       brg.status === 'CLOSED' ? 0xf43f5e : 0xf59e0b;

      // 3D Bridge Arch Token
      const archGeo = new THREE.TorusGeometry(0.2, 0.06, 8, 16, Math.PI);
      archGeo.rotateX(-Math.PI / 2);
      const archMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.75,
        metalness: 0.7
      });
      const archMesh = new THREE.Mesh(archGeo, archMat);
      archMesh.position.set(pos.x, pos.y + 0.1, pos.z);

      archMesh.userData = {
        type: 'bridge',
        data: brg,
        name: brg.name || 'Strategic Bridge',
        score: brg.accessibility_score
      };

      this.subgroups.bridges.add(archMesh);
      this.clickableObjects.push(archMesh);
    });
  }

  buildVehicles() {
    this.vehicles.forEach((veh) => {
      const lat = veh.current_lat || 26.1445;
      const lng = veh.current_lng || 91.7362;
      const pos = projectGeoTo3D(lng, lat, 0.82);

      const isHighRisk = veh.risk_level === 'CRITICAL' || veh.risk_level === 'HIGH';
      const colorHex = isHighRisk ? 0xf43f5e : 0x38bdf8;

      // 3D Vehicle Marker Box + Beacon Top
      const boxGeo = new THREE.BoxGeometry(0.25, 0.18, 0.35);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0x091c23,
        emissive: colorHex,
        emissiveIntensity: 0.85,
        metalness: 0.8
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      boxMesh.position.set(pos.x, pos.y + 0.15, pos.z);

      // Beacon Ring
      const ringGeo = new THREE.RingGeometry(0.18, 0.28, 16);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.set(pos.x, pos.y + 0.05, pos.z);

      boxMesh.userData = {
        type: 'vehicle',
        data: veh,
        name: `Fleet Unit ${veh.vehicle_code || 'V01'}`
      };
      ringMesh.userData = boxMesh.userData;

      this.subgroups.vehicles.add(boxMesh);
      this.subgroups.vehicles.add(ringMesh);
      this.clickableObjects.push(boxMesh);
      this.pulseItems.push({ ringMesh, baseScale: 1.0, speed: 0.04 });
    });
  }

  buildIncidents() {
    this.incidents.forEach((inc) => {
      const lat = inc.latitude || 25.5;
      const lng = inc.longitude || 93.0;
      const pos = projectGeoTo3D(lng, lat, 0.8);

      const isBlocked = inc.road_status === 'BLOCKED' || inc.road_status === 'CLOSED';
      const colorHex = isBlocked ? 0xf43f5e : 0xf59e0b;

      // 3D Hazard Octahedron Diamond
      const diamondGeo = new THREE.OctahedronGeometry(0.22, 0);
      const diamondMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        emissive: colorHex,
        emissiveIntensity: 0.9,
        metalness: 0.9
      });
      const diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
      diamondMesh.position.set(pos.x, pos.y + 0.25, pos.z);

      diamondMesh.userData = {
        type: 'incident',
        data: inc,
        name: `${inc.incident_type || 'Disruption'}: ${inc.location_name || ''}`
      };

      this.subgroups.incidents.add(diamondMesh);
      this.clickableObjects.push(diamondMesh);
      this.pulseItems.push({ diamondMesh, baseScale: 1.0, speed: 0.05 });
    });
  }

  animate() {
    const time = performance.now() * 0.003;
    this.pulseItems.forEach((item) => {
      if (item.ringMesh) {
        const s = 1.0 + Math.sin(time * 3) * 0.25;
        item.ringMesh.scale.set(s, s, s);
      }
      if (item.diamondMesh) {
        item.diamondMesh.rotation.y += 0.02;
        item.diamondMesh.position.y = (item.diamondMesh.userData.baseY || 0.8) + Math.sin(time * 4) * 0.06;
      }
    });
  }

  updateData({ vehicles, bridges, incidents }) {
    this.vehicles = vehicles || this.vehicles;
    this.bridges = bridges || this.bridges;
    this.incidents = incidents || this.incidents;

    // Dispose and rebuild dynamic layers
    ['vehicles', 'bridges', 'incidents'].forEach((key) => {
      const g = this.subgroups[key];
      while (g.children.length > 0) {
        const c = g.children[0];
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
        g.remove(c);
      }
    });

    this.clickableObjects = this.clickableObjects.filter(obj => 
      obj.userData.type === 'city' || obj.userData.type === 'depot'
    );
    this.pulseItems = [];

    this.buildBridges();
    this.buildVehicles();
    this.buildIncidents();
  }

  setLayerVisibility(layerKey, visible) {
    if (this.subgroups[layerKey]) {
      this.subgroups[layerKey].visible = visible;
    }
  }

  dispose() {
    this.pulseItems = [];
    this.clickableObjects = [];
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
    this.scene.remove(this.group);
  }
}
