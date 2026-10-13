import * as THREE from 'three';
import { NORTHEAST_STATES_GEOJSON } from '../../data/northeastGeoJSON';
import { projectGeoTo3D, geoRingToShape, getAccessibilityColor } from './geoUtils';

/**
 * Builds the 3D extruded state polygon meshes for Northeast India.
 */
export class StateLayer3D {
  constructor(scene, stateScores = {}, onStateClick = null) {
    this.scene = scene;
    this.stateScores = stateScores;
    this.onStateClick = onStateClick;
    this.group = new THREE.Group();
    this.group.name = 'NER_States_Layer';
    this.stateMeshes = new Map(); // id -> { mesh, line, basePosition, stateData, colorInfo }
    this.hoveredStateId = null;
    this.selectedStateId = null;

    this.scene.add(this.group);
    this.buildStates();
  }

  buildStates() {
    NORTHEAST_STATES_GEOJSON.features.forEach((feature) => {
      const props = feature.properties;
      const stateId = props.id;
      const stateName = props.name;
      const baseElev = props.base_elevation || 0.8;

      // Extract real live accessibility score for this state from LINK X8 data (defaults to 85 if not yet loaded)
      const liveScore = this.stateScores[stateName] ?? this.stateScores[stateId] ?? 85.0;
      const colorInfo = getAccessibilityColor(liveScore);

      const polygons = feature.geometry.type === 'Polygon' 
        ? [feature.geometry.coordinates] 
        : feature.geometry.coordinates;

      const stateGroup = new THREE.Group();
      stateGroup.name = `State_${stateId}_${stateName}`;

      polygons.forEach((poly) => {
        const outerRing = poly[0];
        const shape = geoRingToShape(outerRing);

        // Add holes if MultiPolygon inner rings exist
        if (poly.length > 1) {
          for (let h = 1; h < poly.length; h++) {
            const holeShape = geoRingToShape(poly[h]);
            shape.holes.push(holeShape);
          }
        }

        const extrudeDepth = baseElev * 0.55 + 0.35;
        const extrudeSettings = {
          depth: extrudeDepth,
          bevelEnabled: true,
          bevelSegments: 2,
          steps: 1,
          bevelSize: 0.03,
          bevelThickness: 0.03
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        // Rotate geometry so extruded dimension is vertical along Y
        geometry.rotateX(Math.PI / 2);

        // Compute vertex normals for rich metallic/glass lighting
        geometry.computeVertexNormals();

        // 3D Enterprise dark glass / matte material
        const material = new THREE.MeshStandardMaterial({
          color: colorInfo.ambientHex,
          emissive: colorInfo.hex,
          emissiveIntensity: 0.18,
          roughness: 0.35,
          metalness: 0.5,
          transparent: true,
          opacity: 0.92
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
          type: 'state',
          stateId,
          stateName,
          score: liveScore,
          properties: props
        };

        // Edge glowing boundary line
        const edges = new THREE.EdgesGeometry(geometry, 22);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: colorInfo.borderHex,
          transparent: true,
          opacity: 0.85,
          linewidth: 1.5
        });
        const line = new THREE.LineSegments(edges, lineMaterial);
        line.userData = { isEdge: true };

        stateGroup.add(mesh);
        stateGroup.add(line);
      });

      // Compute state 3D centroid position
      const centroid3D = projectGeoTo3D(props.centroid[0], props.centroid[1], baseElev * 0.55 + 0.4);

      this.group.add(stateGroup);
      this.stateMeshes.set(stateId, {
        id: stateId,
        name: stateName,
        group: stateGroup,
        centroid3D,
        baseElevation: 0,
        score: liveScore,
        colorInfo,
        properties: props
      });
    });
  }

  updateScores(newScores) {
    this.stateScores = newScores;
    this.stateMeshes.forEach((item, stateId) => {
      const score = this.stateScores[item.name] ?? this.stateScores[stateId] ?? item.score;
      item.score = score;
      const colorInfo = getAccessibilityColor(score);
      item.colorInfo = colorInfo;

      item.group.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.color.setHex(colorInfo.ambientHex);
          child.material.emissive.setHex(colorInfo.hex);
          child.material.emissiveIntensity = (stateId === this.hoveredStateId || stateId === this.selectedStateId) ? 0.45 : 0.18;
        } else if (child.isLineSegments && child.material) {
          child.material.color.setHex((stateId === this.hoveredStateId || stateId === this.selectedStateId) ? 0xffffff : colorInfo.borderHex);
        }
      });
    });
  }

  setHovered(stateId) {
    if (this.hoveredStateId === stateId) return;
    const prevId = this.hoveredStateId;
    this.hoveredStateId = stateId;

    if (prevId && prevId !== this.selectedStateId) {
      this.resetStateVisual(prevId);
    }
    if (stateId) {
      this.highlightStateVisual(stateId, 0.25);
    }
  }

  setSelected(stateId) {
    const prevId = this.selectedStateId;
    this.selectedStateId = stateId;

    if (prevId && prevId !== this.hoveredStateId) {
      this.resetStateVisual(prevId);
    }
    if (stateId) {
      this.highlightStateVisual(stateId, 0.4);
    }
  }

  highlightStateVisual(stateId, liftAmount = 0.25) {
    const item = this.stateMeshes.get(stateId);
    if (!item) return;

    item.group.position.y = liftAmount;
    item.group.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissiveIntensity = 0.55;
        child.material.opacity = 1.0;
      } else if (child.isLineSegments && child.material) {
        child.material.color.setHex(0xffffff);
        child.material.opacity = 1.0;
      }
    });
  }

  resetStateVisual(stateId) {
    const item = this.stateMeshes.get(stateId);
    if (!item) return;

    item.group.position.y = 0;
    item.group.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.emissiveIntensity = 0.18;
        child.material.opacity = 0.92;
      } else if (child.isLineSegments && child.material) {
        child.material.color.setHex(item.colorInfo.borderHex);
        child.material.opacity = 0.85;
      }
    });
  }

  dispose() {
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
    this.scene.remove(this.group);
    this.stateMeshes.clear();
  }
}
