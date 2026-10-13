import * as THREE from 'three';
import { projectGeoTo3D } from './geoUtils';

/**
 * Builds 3D illuminated corridors and alternate routes with pulse animations.
 */
export class RouteLayer3D {
  constructor(scene, primaryRoute = [], alternateRoute = [], isBlocked = false) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'NER_Routes_Layer';
    this.primaryRoute = primaryRoute;
    this.alternateRoute = alternateRoute;
    this.isBlocked = isBlocked;
    this.particles = [];

    this.scene.add(this.group);
    this.buildRoutes();
  }

  buildRoutes() {
    // 1. Primary Corridor (e.g. NH27 Guwahati - Imphal)
    if (this.primaryRoute && this.primaryRoute.length > 1) {
      const primaryPoints = this.primaryRoute.map(([lat, lng]) => 
        projectGeoTo3D(lng, lat, 0.7)
      );
      const primaryColor = this.isBlocked ? 0xf43f5e : 0x14b8a6;
      this.createRouteTube(primaryPoints, primaryColor, 0.08, 'primary_corridor');
      this.createFlowParticles(primaryPoints, primaryColor, 8);
    }

    // 2. Alternate Detour Route (e.g. NH37 Western Bypass via Silchar)
    if (this.alternateRoute && this.alternateRoute.length > 1) {
      const altPoints = this.alternateRoute.map(([lat, lng]) => 
        projectGeoTo3D(lng, lat, 0.72)
      );
      const altColor = 0x8b5cf6; // Purple / Violet
      this.createRouteTube(altPoints, altColor, 0.06, 'alternate_corridor', true);
      this.createFlowParticles(altPoints, altColor, 6);
    }
  }

  createRouteTube(points, colorHex, radius = 0.08, name = 'route', isDashed = false) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geometry = new THREE.TubeGeometry(curve, 64, radius, 8, false);

    const material = new THREE.MeshStandardMaterial({
      color: colorHex,
      emissive: colorHex,
      emissiveIntensity: 0.8,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: isDashed ? 0.75 : 0.95
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.userData = { type: 'corridor', name };
    this.group.add(mesh);
  }

  createFlowParticles(points, colorHex, count = 6) {
    const curve = new THREE.CatmullRomCurve3(points);
    const particleGeo = new THREE.SphereGeometry(0.12, 12, 12);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95
    });

    for (let i = 0; i < count; i++) {
      const pMesh = new THREE.Mesh(particleGeo, particleMat);
      pMesh.userData = {
        curve,
        progress: (i / count),
        speed: 0.0018 + (i % 2) * 0.0005
      };
      this.group.add(pMesh);
      this.particles.push(pMesh);
    }
  }

  animate() {
    this.particles.forEach((p) => {
      p.userData.progress = (p.userData.progress + p.userData.speed) % 1.0;
      const pos = p.userData.curve.getPoint(p.userData.progress);
      p.position.copy(pos);
    });
  }

  updateRoutes(primaryRoute, alternateRoute, isBlocked) {
    this.dispose();
    this.primaryRoute = primaryRoute;
    this.alternateRoute = alternateRoute;
    this.isBlocked = isBlocked;
    this.buildRoutes();
  }

  setVisible(visible) {
    this.group.visible = visible;
  }

  dispose() {
    this.particles = [];
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0]);
    }
  }
}
