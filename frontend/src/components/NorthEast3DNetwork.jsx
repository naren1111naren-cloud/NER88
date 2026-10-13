import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Geographic Anchor Points for the 8 North-Eastern States of India
 * Coordinates normalized to 3D terrain space [-25, 25]
 */
const NE_NODES = [
  { id: 'guwahati', name: 'Guwahati', state: 'Assam', type: 'hub', x: -4.5, z: 1.5, elevBase: 0.4 },
  { id: 'shillong', name: 'Shillong', state: 'Meghalaya', type: 'primary', x: -3.5, z: 4.8, elevBase: 1.8 },
  { id: 'siliguri', name: 'Siliguri Gateway', state: 'Sikkim Route', type: 'secondary', x: -16.0, z: -0.5, elevBase: 0.6 },
  { id: 'gangtok', name: 'Gangtok', state: 'Sikkim', type: 'secondary', x: -15.2, z: -4.2, elevBase: 2.8 },
  { id: 'itanagar', name: 'Itanagar', state: 'Arunachal Pradesh', type: 'primary', x: 6.0, z: -5.8, elevBase: 1.7 },
  { id: 'pasighat', name: 'Pasighat', state: 'Arunachal Pradesh', type: 'secondary', x: 13.5, z: -7.5, elevBase: 1.4 },
  { id: 'dibrugarh', name: 'Dibrugarh', state: 'Assam', type: 'primary', x: 14.5, z: -3.8, elevBase: 0.5 },
  { id: 'jorhat', name: 'Jorhat', state: 'Assam', type: 'secondary', x: 6.5, z: -0.8, elevBase: 0.5 },
  { id: 'tezpur', name: 'Tezpur', state: 'Assam', type: 'secondary', x: 1.2, z: -1.2, elevBase: 0.4 },
  { id: 'dimapur', name: 'Dimapur', state: 'Nagaland', type: 'secondary', x: 8.5, z: 1.8, elevBase: 0.9 },
  { id: 'kohima', name: 'Kohima', state: 'Nagaland', type: 'primary', x: 9.8, z: 4.5, elevBase: 2.1 },
  { id: 'imphal', name: 'Imphal', state: 'Manipur', type: 'primary', x: 9.2, z: 8.8, elevBase: 1.2 },
  { id: 'silchar', name: 'Silchar', state: 'Assam (Barak)', type: 'primary', x: 0.5, z: 7.2, elevBase: 0.6 },
  { id: 'aizawl', name: 'Aizawl', state: 'Mizoram', type: 'primary', x: 2.2, z: 12.8, elevBase: 1.9 },
  { id: 'agartala', name: 'Agartala', state: 'Tripura', type: 'primary', x: -6.8, z: 9.5, elevBase: 0.7 },
];

/**
 * Key Strategic Transportation Corridors (NH-27, NH-37, NH-40, NH-2, NH-54, NH-6, etc.)
 */
const CORRIDORS = [
  // West Bengal / Siliguri Corridor into Assam
  ['siliguri', 'gangtok'],
  ['siliguri', 'guwahati'],
  // Brahmaputra Valley Trunk Highway (NH-27 / NH-37)
  ['guwahati', 'tezpur'],
  ['tezpur', 'jorhat'],
  ['jorhat', 'dibrugarh'],
  ['tezpur', 'itanagar'],
  ['dibrugarh', 'pasighat'],
  ['itanagar', 'pasighat'],
  // Meghalaya Plateau Corridor (NH-40 / NH-6)
  ['guwahati', 'shillong'],
  ['shillong', 'silchar'],
  // Nagaland & Upper Hills Corridor (NH-29 / NH-2)
  ['jorhat', 'dimapur'],
  ['dimapur', 'kohima'],
  ['kohima', 'imphal'],
  // Barak Valley & Southern Arteries (NH-54 / NH-8)
  ['guwahati', 'silchar'],
  ['silchar', 'imphal'],
  ['silchar', 'aizawl'],
  ['silchar', 'agartala'],
  ['agartala', 'aizawl'],
];

/**
 * Calculate terrain elevation based on authentic North-East Indian Geomorphology:
 * 1. Brahmaputra low valley channel extending from East to West
 * 2. High Arunachal Himalayan slopes in North/NE
 * 3. Shillong Plateau elevated block in Central-South
 * 4. Patkai / Naga / Lushai north-south folded ridge chains in the East
 * 5. Cachar & Imphal valley depressions
 */
function getTerrainHeight(x, z) {
  let h = 0;

  // 1. Arunachal / Himalayan Northern Rise
  if (z < 0) {
    const northDist = Math.abs(z);
    h += Math.sin(x * 0.15 + 1.2) * 1.2 + (northDist * 0.45);
    // Extra peaks in far northwest (Sikkim / Kanchenjunga zone)
    if (x < -10) {
      h += Math.cos(x * 0.3) * 1.5 + Math.abs(z) * 0.3;
    }
  }

  // 2. Brahmaputra Valley Trough (Curve between z = -3 and z = 3, from x = -15 to x = 16)
  const valleyCenterZ = -0.15 * x + 0.5;
  const distFromValley = Math.abs(z - valleyCenterZ);
  if (distFromValley < 4.5 && x > -14 && x < 16) {
    const valleyFactor = Math.cos((distFromValley / 4.5) * (Math.PI / 2));
    h -= valleyFactor * 2.2;
  }

  // 3. Meghalaya Plateau (Elevated horst block around x: -8 to 0, z: 3 to 7)
  const distMeghalaya = Math.hypot(x - (-4.0), z - 5.0);
  if (distMeghalaya < 5.5) {
    const plateauFactor = Math.cos((distMeghalaya / 5.5) * (Math.PI / 2));
    h += plateauFactor * 2.6;
  }

  // 4. Eastern Mountain Chains: Naga, Manipur, & Mizoram parallel ridges (x: 5 to 16, z: 0 to 16)
  if (x > 3 && z > -2) {
    // Parallel north-south sinusoidal fold mountains (Lushai & Patkai hills)
    const ridgePattern = Math.sin(x * 1.1) * Math.cos(z * 0.35);
    h += Math.max(0, ridgePattern) * 2.3 + (z > 2 ? 0.8 : 0.2);

    // Imphal valley basin depression
    const distImphal = Math.hypot(x - 9.2, z - 8.8);
    if (distImphal < 3.2) {
      h -= Math.cos((distImphal / 3.2) * (Math.PI / 2)) * 1.6;
    }
  }

  // 5. High-frequency natural terrain fractal noise
  h += Math.sin(x * 0.8 + z * 0.6) * 0.35;
  h += Math.cos(x * 1.4 - z * 1.1) * 0.2;
  h += Math.sin(x * 2.5 + z * 2.2) * 0.08;

  // Base elevation clamp
  return Math.max(0.15, h + 0.8);
}

export const NorthEast3DNetwork = ({ className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene, Camera, Renderer ---
    const scene = new THREE.Scene();
    // Midnight teal deep background fog
    scene.fog = new THREE.FogExp2(0x06151c, 0.022);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 120);
    // Cinematic elevated low-angle perspective looking across NE India
    camera.position.set(-2, 22, 28);
    camera.lookAt(0, 1.5, 3.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x0f333a, 1.4);
    scene.add(ambientLight);

    // Atmospheric directional sun/moon from North-East
    const dirLight = new THREE.DirectionalLight(0x2dd4bf, 2.2);
    dirLight.position.set(15, 30, -10);
    scene.add(dirLight);

    // Accent fill light for deep valleys (cyan/teal fill)
    const fillLight = new THREE.DirectionalLight(0x14b8a6, 1.1);
    fillLight.position.set(-20, 15, 20);
    scene.add(fillLight);

    // Subtle bottom glow
    const groundLight = new THREE.HemisphereLight(0x14b8a6, 0x061116, 0.8);
    scene.add(groundLight);

    // --- 1. Realistic 3D Terrain Mesh ---
    const gridW = 54;
    const gridH = 46;
    const segmentsX = 96;
    const segmentsY = 96;
    const terrainGeo = new THREE.PlaneGeometry(gridW, gridH, segmentsX, segmentsY);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const colors = [];
    const colorLow = new THREE.Color(0x051d23);     // Deep river valley / Brahmaputra
    const colorMid = new THREE.Color(0x0a3832);     // Lush forest hills
    const colorHigh = new THREE.Color(0x136b60);    // High ridges / plateaus
    const colorPeak = new THREE.Color(0x22d3ee);    // Mountain crest telemetry highlight

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = getTerrainHeight(x, z);
      pos.setY(i, h);

      // Procedural color mapping based on elevation & terrain features
      const normH = Math.min(1, Math.max(0, h / 4.8));
      const vertexColor = new THREE.Color();

      if (normH < 0.25) {
        vertexColor.lerpColors(colorLow, colorMid, normH / 0.25);
      } else if (normH < 0.7) {
        vertexColor.lerpColors(colorMid, colorHigh, (normH - 0.25) / 0.45);
      } else {
        vertexColor.lerpColors(colorHigh, colorPeak, (normH - 0.7) / 0.3);
      }

      colors.push(vertexColor.r, vertexColor.g, vertexColor.b);
    }

    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.15,
      flatShading: false,
      wireframe: false,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrainMesh);

    // Subtle topographic wireframe contour overlay
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      wireframe: true,
      transparent: true,
      opacity: 0.07,
    });
    const wireMesh = new THREE.Mesh(terrainGeo, wireMat);
    wireMesh.position.y += 0.02;
    scene.add(wireMesh);

    // --- 2. Brahmaputra River Waterway Ribbon ---
    const riverPoints = [
      new THREE.Vector3(15.5, getTerrainHeight(15.5, -4.5) + 0.05, -4.5),
      new THREE.Vector3(11.0, getTerrainHeight(11.0, -2.8) + 0.05, -2.8),
      new THREE.Vector3(6.5, getTerrainHeight(6.5, -1.2) + 0.05, -1.2),
      new THREE.Vector3(1.2, getTerrainHeight(1.2, -0.6) + 0.05, -0.6),
      new THREE.Vector3(-4.5, getTerrainHeight(-4.5, 1.2) + 0.05, 1.2),
      new THREE.Vector3(-10.0, getTerrainHeight(-10.0, 2.5) + 0.05, 2.5),
      new THREE.Vector3(-15.0, getTerrainHeight(-15.0, 3.2) + 0.05, 3.2),
    ];
    const riverCurve = new THREE.CatmullRomCurve3(riverPoints);
    const riverGeo = new THREE.TubeGeometry(riverCurve, 64, 0.22, 8, false);
    const riverMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
    });
    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    scene.add(riverMesh);

    // --- 3. Logistics Nodes (3D Markers & Pulse Rings) ---
    const nodeMap = new Map();
    const nodeGroup = new THREE.Group();
    const pulseRings = [];

    NE_NODES.forEach((n) => {
      const terrainY = getTerrainHeight(n.x, n.z);
      const nodePos = new THREE.Vector3(n.x, terrainY + 0.15, n.z);
      nodeMap.set(n.id, nodePos);

      const isHub = n.type === 'hub';
      const isPrimary = n.type === 'primary';

      // Core sphere
      const sphereGeo = new THREE.SphereGeometry(isHub ? 0.32 : isPrimary ? 0.22 : 0.16, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: isHub ? 0x22d3ee : isPrimary ? 0x14b8a6 : 0x38bdf8,
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      sphereMesh.position.copy(nodePos);
      nodeGroup.add(sphereMesh);

      // Elevated beacon light ray for primary nodes
      if (isHub || isPrimary) {
        const beaconGeo = new THREE.CylinderGeometry(0.02, 0.04, isHub ? 3.5 : 2.0, 8);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: isHub ? 0x22d3ee : 0x14b8a6,
          transparent: true,
          opacity: isHub ? 0.5 : 0.3,
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(n.x, terrainY + (isHub ? 1.75 : 1.0), n.z);
        nodeGroup.add(beacon);
      }

      // Animated ground pulse ring
      const ringGeo = new THREE.RingGeometry(0.3, 0.5, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: isHub ? 0x22d3ee : 0x14b8a6,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(n.x, terrainY + 0.08, n.z);
      nodeGroup.add(ring);
      pulseRings.push({ mesh: ring, isHub, speed: isHub ? 1.8 : 1.2, phase: Math.random() * Math.PI });
    });

    scene.add(nodeGroup);

    // --- 4. Intelligent Logistics Corridors (Terrain-Following Curves) ---
    const corridorCurves = [];
    const routeGroup = new THREE.Group();

    CORRIDORS.forEach(([srcId, dstId]) => {
      const p1 = nodeMap.get(srcId);
      const p2 = nodeMap.get(dstId);
      if (!p1 || !p2) return;

      // Sample intermediate points that hug terrain elevation
      const segments = 12;
      const points = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const curX = THREE.MathUtils.lerp(p1.x, p2.x, t);
        const curZ = THREE.MathUtils.lerp(p1.z, p2.z, t);
        // Add a slight geographic arc curve
        const arcY = Math.sin(t * Math.PI) * 0.25;
        const elevY = getTerrainHeight(curX, curZ) + arcY + 0.12;
        points.push(new THREE.Vector3(curX, elevY, curZ));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      corridorCurves.push(curve);

      // Luminous route line
      const tubeGeo = new THREE.TubeGeometry(curve, 32, 0.045, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x14b8a6,
        transparent: true,
        opacity: 0.65,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      routeGroup.add(tubeMesh);
    });

    scene.add(routeGroup);

    // --- 5. Real-Time Data Flow Particles Traveling Along Corridors ---
    const particleCount = 75;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleData = [];

    for (let i = 0; i < particleCount; i++) {
      const curveIndex = i % corridorCurves.length;
      particleData.push({
        curveIndex,
        t: Math.random(),
        speed: 0.002 + Math.random() * 0.003,
      });
      particlePositions[i * 3] = 0;
      particlePositions[i * 3 + 1] = 0;
      particlePositions[i * 3 + 2] = 0;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    // Particle texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#22d3ee');
    grad.addColorStop(0.8, '#14b8a6');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);

    const particleTexture = new THREE.CanvasTexture(canvas);
    const particleMat = new THREE.PointsMaterial({
      size: 0.75,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffffff,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // --- 6. Atmospheric Mountain Valley Mist / Cloud Layer ---
    const mistCount = 28;
    const mistGroup = new THREE.Group();
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x14b8a6,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (let i = 0; i < mistCount; i++) {
      const mistGeo = new THREE.PlaneGeometry(8 + Math.random() * 8, 4 + Math.random() * 4);
      mistGeo.rotateX(-Math.PI / 2);
      const mistMesh = new THREE.Mesh(mistGeo, mistMat);
      const mx = (Math.random() - 0.5) * 38;
      const mz = (Math.random() - 0.5) * 32;
      mistMesh.position.set(mx, getTerrainHeight(mx, mz) + 0.4 + Math.random() * 0.8, mz);
      mistMesh.rotation.y = Math.random() * Math.PI;
      mistGroup.add(mistMesh);
    }
    scene.add(mistGroup);

    // --- Interaction & Gentle Parallax ---
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX = x * 2.5;
      mouseY = y * 1.5;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // --- Animation Loop ---
    let animationFrameId;
    let clock = new THREE.Clock();
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animate = () => {
      if (prefersReducedMotion) {
        renderer.render(scene, camera);
        return;
      }

      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Slow cinematic camera float with subtle mouse parallax
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, -2 + mouseX * 1.8 + Math.sin(elapsedTime * 0.15) * 0.8, 0.03);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, 22 - mouseY * 1.2 + Math.cos(elapsedTime * 0.18) * 0.5, 0.03);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, 28 + Math.sin(elapsedTime * 0.12) * 0.6, 0.03);
      camera.lookAt(0 + mouseX * 0.5, 1.5, 3.5);

      // Pulse node rings
      pulseRings.forEach((p) => {
        const scale = 1 + (Math.sin(elapsedTime * p.speed + p.phase) + 1) * 0.75;
        const alpha = Math.max(0, 0.85 - (scale - 1) * 0.6);
        p.mesh.scale.set(scale, scale, scale);
        p.mesh.material.opacity = alpha;
      });

      // Move data particles along corridors
      const posAttr = particleGeo.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const p = particleData[i];
        p.t += p.speed;
        if (p.t > 1) {
          p.t = 0;
          p.curveIndex = Math.floor(Math.random() * corridorCurves.length);
        }
        const curve = corridorCurves[p.curveIndex];
        if (curve) {
          const pt = curve.getPoint(p.t);
          posAttr.setXYZ(i, pt.x, pt.y + 0.08, pt.z);
        }
      }
      posAttr.needsUpdate = true;

      // Slow drift of atmospheric mist
      mistGroup.children.forEach((m, idx) => {
        m.position.x += Math.sin(elapsedTime * 0.2 + idx) * 0.003;
        m.position.z += Math.cos(elapsedTime * 0.18 + idx) * 0.003;
      });

      renderer.render(scene, camera);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      terrainGeo.dispose();
      terrainMat.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      particleTexture.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden pointer-events-none ${className}`}
      aria-label="North-East India 3D Geospatial Logistics Network Visualization"
    />
  );
};
export default NorthEast3DNetwork;
