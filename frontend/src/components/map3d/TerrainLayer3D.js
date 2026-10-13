import * as THREE from 'three';
import { projectGeoTo3D } from './geoUtils';

/**
 * Builds the geographic GIS foundation plate, regional river arteries,
 * and latitude/longitude coordinate grid for Northeast India.
 */
export class TerrainLayer3D {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'NER_Terrain_Foundation_Layer';

    this.scene.add(this.group);
    this.buildBaseGrid();
    this.buildRiverChannels();
    this.buildRegionalBoundaries();
  }

  buildBaseGrid() {
    // 1. Regional Dark GIS Base Plane
    const planeGeo = new THREE.PlaneGeometry(36, 28, 48, 48);
    planeGeo.rotateX(-Math.PI / 2);

    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x051318,
      roughness: 0.9,
      metalness: 0.2
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.position.set(0, -0.05, 0.5);
    planeMesh.receiveShadow = true;
    this.group.add(planeMesh);

    // 2. Geographic Latitude & Longitude Meridians (88°E to 97°E, 22°N to 29°N)
    const gridMat = new THREE.LineBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.12
    });

    const gridLinesGroup = new THREE.Group();
    // Longitude lines
    for (let lng = 88; lng <= 98; lng += 2) {
      const p1 = projectGeoTo3D(lng, 21.5, 0.01);
      const p2 = projectGeoTo3D(lng, 29.8, 0.01);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      gridLinesGroup.add(new THREE.Line(geom, gridMat));
    }
    // Latitude lines
    for (let lat = 22; lat <= 30; lat += 2) {
      const p1 = projectGeoTo3D(87.5, lat, 0.01);
      const p2 = projectGeoTo3D(98.0, lat, 0.01);
      const geom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
      gridLinesGroup.add(new THREE.Line(geom, gridMat));
    }
    this.group.add(gridLinesGroup);
  }

  buildRiverChannels() {
    // Brahmaputra River Geographic Waypoints (Tibet/Arunachal -> Pasighat -> Dibrugarh -> Tezpur -> Guwahati -> Dhubri)
    const brahmaputraCoords = [
      [95.90, 28.50], [95.33, 28.06], [94.91, 27.47], [94.20, 26.90],
      [93.25, 26.70], [92.80, 26.65], [91.74, 26.18], [91.10, 26.15],
      [90.60, 26.10], [89.98, 26.02]
    ];
    const riverPoints = brahmaputraCoords.map(([lng, lat]) => projectGeoTo3D(lng, lat, 0.02));
    const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
    const riverGeo = new THREE.TubeGeometry(riverCurve, 40, 0.05, 6, false);
    const riverMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    riverMesh.name = 'Brahmaputra_River_Channel';
    this.group.add(riverMesh);

    // Barak River Geographic Waypoints (Manipur Hills -> Silchar -> Karimganj -> Bangladesh)
    const barakCoords = [
      [93.50, 25.10], [93.10, 24.90], [92.78, 24.83], [92.35, 24.86]
    ];
    const barakPoints = barakCoords.map(([lng, lat]) => projectGeoTo3D(lng, lat, 0.02));
    const barakCurve = new THREE.CatmullRomCurve3(barakPoints);
    const barakGeo = new THREE.TubeGeometry(barakCurve, 20, 0.035, 6, false);
    const barakMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35
    });
    this.group.add(new THREE.Mesh(barakGeo, barakMat));
  }

  buildRegionalBoundaries() {
    // Subtle outer frame border for Northeast India Regional Corridor
    const framePoints = [
      projectGeoTo3D(88.0, 21.8, 0.02),
      projectGeoTo3D(97.5, 21.8, 0.02),
      projectGeoTo3D(97.5, 29.5, 0.02),
      projectGeoTo3D(88.0, 29.5, 0.02),
      projectGeoTo3D(88.0, 21.8, 0.02)
    ];
    const frameGeo = new THREE.BufferGeometry().setFromPoints(framePoints);
    const frameMat = new THREE.LineBasicMaterial({
      color: 0x1a3a43,
      transparent: true,
      opacity: 0.6
    });
    this.group.add(new THREE.Line(frameGeo, frameMat));
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  dispose() {
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
