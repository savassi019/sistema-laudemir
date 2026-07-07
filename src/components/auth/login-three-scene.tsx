"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

type FloatingObject = {
  mesh: THREE.Object3D;
  baseY: number;
  baseX: number;
  baseZ: number;
  speed: number;
  amplitude: number;
  spin?: { x: number; y: number; z: number };
  layer: number; // parallax layer 1=near 2=mid 3=far
};

export function LoginThreeScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const motionFactor = reduceMotion ? 0.3 : 1;
    const isMobile = window.innerWidth < 760;

    // Mouse tracking
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);

    const disposableGeometries: THREE.BufferGeometry[] = [];
    const disposableMaterials: THREE.Material[] = [];
    const floatingObjects: FloatingObject[] = [];

    const stage = new THREE.Group();
    const nearGroup = new THREE.Group();  // layer 1 - close, moves most
    const midGroup = new THREE.Group();   // layer 2 - medium
    const farGroup = new THREE.Group();   // layer 3 - background
    const particleGroup = new THREE.Group();
    scene.add(stage);
    stage.add(farGroup, midGroup, nearGroup, particleGroup);

    // ─── Materials ───────────────────────────────────────────────
    const edgeMat = (opacity: number) => {
      const m = new THREE.LineBasicMaterial({ color: 0xd8d0bf, transparent: true, opacity });
      disposableMaterials.push(m);
      return m;
    };

    function glassMat(color: number, opacity: number, emissiveStrength = 0.3) {
      const m = new THREE.MeshPhysicalMaterial({
        color,
        emissive: new THREE.Color(color).multiplyScalar(emissiveStrength),
        emissiveIntensity: 0.5,
        metalness: 0.1,
        roughness: 0.18,
        transmission: 0.12,
        thickness: 1.0,
        transparent: true,
        opacity,
        clearcoat: 1.0,
        clearcoatRoughness: 0.15,
        envMapIntensity: 1.2,
      });
      disposableMaterials.push(m);
      return m;
    }

    // ─── Helper: add mesh + edges ────────────────────────────────
    function addObject({
      geometry,
      material,
      position,
      rotation,
      group,
      float,
      layer,
      edgeOpacity = 0.22,
    }: {
      geometry: THREE.BufferGeometry;
      material: THREE.Material;
      position: [number, number, number];
      rotation: [number, number, number];
      group: THREE.Group;
      float: { speed: number; amplitude: number; spinX?: number; spinY?: number; spinZ?: number };
      layer: number;
      edgeOpacity?: number;
    }) {
      const edgesGeo = new THREE.EdgesGeometry(geometry);
      disposableGeometries.push(geometry, edgesGeo);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      group.add(mesh);

      const edges = new THREE.LineSegments(edgesGeo, edgeMat(edgeOpacity));
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      group.add(edges);

      const fo: FloatingObject = {
        mesh,
        baseY: position[1],
        baseX: position[0],
        baseZ: position[2],
        speed: float.speed,
        amplitude: float.amplitude,
        layer,
        spin: { x: float.spinX ?? 0, y: float.spinY ?? 0, z: float.spinZ ?? 0 },
      };
      const foEdge: FloatingObject = { ...fo, mesh: edges };
      floatingObjects.push(fo, foEdge);
    }

    // ─── FAR layer: large flat panels ───────────────────────────
    const panelConfigs = [
      { w: 2.6, h: 0.08, d: 1.3, pos: [0, 0, 0] as [number,number,number], rot: [-0.7, 0.3, -0.16] as [number,number,number], color: 0x1e3830, opacity: 0.28 },
      { w: 1.9, h: 0.07, d: 0.9, pos: [-0.2, 0.48, -0.22] as [number,number,number], rot: [-0.7, 0.3, -0.16] as [number,number,number], color: 0x3d5c4c, opacity: 0.3 },
      { w: 1.2, h: 0.065, d: 0.58, pos: [0.24, 0.88, -0.36] as [number,number,number], rot: [-0.7, 0.3, -0.16] as [number,number,number], color: 0xb5813a, opacity: 0.26 },
    ];
    for (const p of panelConfigs) {
      addObject({
        geometry: new RoundedBoxGeometry(p.w, p.h, p.d, 5, 0.04),
        material: glassMat(p.color, p.opacity, 0.25),
        position: p.pos,
        rotation: p.rot,
        group: farGroup,
        float: { speed: 0.9 + Math.random() * 0.3, amplitude: 0.04 },
        layer: 3,
        edgeOpacity: 0.18,
      });
    }

    // ─── MID layer: orbiting cubes ───────────────────────────────
    const cubeGeo = new RoundedBoxGeometry(0.34, 0.34, 0.34, 4, 0.04);
    const cubeMats = [
      glassMat(0x4a6855, 0.46),
      glassMat(0x3d5248, 0.42),
      glassMat(0xb07a38, 0.4),
      glassMat(0x2e4a5c, 0.44),
      glassMat(0x5c4a2e, 0.42),
    ];
    disposableGeometries.push(cubeGeo);

    const cubeCount = isMobile ? 5 : 10;
    for (let i = 0; i < cubeCount; i++) {
      const angle = (i / cubeCount) * Math.PI * 2;
      const radius = i % 2 === 0 ? 2.0 : 1.6;
      const mat = cubeMats[i % cubeMats.length];
      addObject({
        geometry: cubeGeo,
        material: mat,
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle * 1.4) * 0.65,
          Math.sin(angle) * radius,
        ],
        rotation: [angle * 0.3, angle, angle * 0.2],
        group: midGroup,
        float: {
          speed: 1.0 + i * 0.09,
          amplitude: 0.1,
          spinX: (0.7 + i * 0.07) * (i % 2 === 0 ? 1 : -1),
          spinY: 0.9 + i * 0.06,
          spinZ: 0.3,
        },
        layer: 2,
        edgeOpacity: 0.25,
      });
    }

    // ─── NEAR layer: varied shapes close to camera ──────────────
    // Icosahedron (gem-like)
    const icoGeo = new THREE.IcosahedronGeometry(0.22, 0);
    addObject({
      geometry: icoGeo,
      material: glassMat(0xd1a04f, 0.52, 0.45),
      position: [-1.4, -0.5, 1.2],
      rotation: [0.4, 0.8, 0.2],
      group: nearGroup,
      float: { speed: 1.3, amplitude: 0.14, spinX: 1.2, spinY: 0.8, spinZ: 0.4 },
      layer: 1,
      edgeOpacity: 0.35,
    });

    // Octahedron
    const octGeo = new THREE.OctahedronGeometry(0.2, 0);
    addObject({
      geometry: octGeo,
      material: glassMat(0x5f7667, 0.5, 0.38),
      position: [1.6, 0.8, 0.9],
      rotation: [0.6, 1.2, 0.3],
      group: nearGroup,
      float: { speed: 1.5, amplitude: 0.12, spinX: -0.9, spinY: 1.1, spinZ: 0.5 },
      layer: 1,
      edgeOpacity: 0.3,
    });

    // Small rounded cube near
    addObject({
      geometry: new RoundedBoxGeometry(0.28, 0.28, 0.28, 4, 0.05),
      material: glassMat(0x3d6b7a, 0.48, 0.35),
      position: [2.2, -0.9, 0.4],
      rotation: [0.9, 0.5, 1.1],
      group: nearGroup,
      float: { speed: 1.1, amplitude: 0.16, spinX: 0.6, spinY: -1.2, spinZ: 0.8 },
      layer: 1,
      edgeOpacity: 0.28,
    });

    // Tetrahedron
    const tetraGeo = new THREE.TetrahedronGeometry(0.24, 0);
    addObject({
      geometry: tetraGeo,
      material: glassMat(0x7a5c3d, 0.44, 0.4),
      position: [-2.1, 1.0, 0.6],
      rotation: [1.2, 0.4, 0.7],
      group: nearGroup,
      float: { speed: 0.9, amplitude: 0.13, spinX: -0.7, spinY: 0.9, spinZ: -0.5 },
      layer: 1,
      edgeOpacity: 0.3,
    });

    // ─── Rings ────────────────────────────────────────────────────
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd1a04f, transparent: true, opacity: 0.12, side: THREE.DoubleSide });
    disposableMaterials.push(ringMat);
    const ringGeo = new THREE.TorusGeometry(2.05, 0.008, 12, 180);
    disposableGeometries.push(ringGeo);

    const ringAngles = [0, Math.PI / 2.2, -Math.PI / 3.0, Math.PI / 1.5];
    const rings = ringAngles.map((angle, i) => {
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.set(angle, i === 1 ? Math.PI / 2 : 0, i === 2 ? Math.PI / 3 : i === 3 ? Math.PI / 5 : 0);
      midGroup.add(ring);
      return ring;
    });

    // Second thinner ring set
    const ring2Mat = new THREE.MeshBasicMaterial({ color: 0x8aa17c, transparent: true, opacity: 0.08 });
    disposableMaterials.push(ring2Mat);
    const ring2Geo = new THREE.TorusGeometry(1.5, 0.005, 8, 120);
    disposableGeometries.push(ring2Geo);
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.set(Math.PI / 4, Math.PI / 3, 0);
    farGroup.add(ring2);

    // ─── Particles ───────────────────────────────────────────────
    const particleCount = isMobile ? 90 : 180;
    const positions = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      const r = 1.2 + Math.random() * 2.2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.008 + Math.random() * 0.018;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    disposableGeometries.push(particleGeo);

    const particleMat = new THREE.PointsMaterial({
      color: 0xd8cfc0,
      size: 0.016,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      sizeAttenuation: true,
    });
    disposableMaterials.push(particleMat);
    particleGroup.add(new THREE.Points(particleGeo, particleMat));

    // Second particle field (golden tint)
    const goldenParticleCount = isMobile ? 30 : 60;
    const gPositions = new Float32Array(goldenParticleCount * 3);
    for (let i = 0; i < goldenParticleCount; i++) {
      const r = 0.8 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      gPositions[i * 3] = Math.cos(theta) * r;
      gPositions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      gPositions[i * 3 + 2] = Math.sin(theta) * r;
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute("position", new THREE.BufferAttribute(gPositions, 3));
    disposableGeometries.push(gGeo);
    const gMat = new THREE.PointsMaterial({ color: 0xd1a04f, size: 0.022, transparent: true, opacity: 0.35, depthWrite: false });
    disposableMaterials.push(gMat);
    particleGroup.add(new THREE.Points(gGeo, gMat));

    // ─── Lights ───────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    const key = new THREE.DirectionalLight(0xd8d0bf, 2.4);
    key.position.set(3, 4, 5);
    const warm = new THREE.PointLight(0xd1a04f, 3.5, 10);
    warm.position.set(-2, -0.5, 3);
    const teal = new THREE.PointLight(0x4a8f70, 2.8, 9);
    teal.position.set(2, 1.5, -3);
    const rim = new THREE.PointLight(0x7090b0, 1.8, 8);
    rim.position.set(-3, 2, -1);
    scene.add(ambient, key, warm, teal, rim);

    // ─── Resize ───────────────────────────────────────────────────
    function resize() {
      const w = Math.max(host!.clientWidth, 1);
      const h = Math.max(host!.clientHeight, 1);
      const isWide = w >= 760;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.set(isWide ? 0.3 : 0, isWide ? 0.1 : 0.3, isWide ? 5.5 : 6.5);
      camera.updateProjectionMatrix();
      stage.position.set(isWide ? -1.55 : 0, isWide ? 0 : 1.8, 0);
      stage.scale.setScalar(isWide ? 0.82 : 0.52);
    }

    // ─── Mouse handler ────────────────────────────────────────────
    function onMouseMove(e: MouseEvent) {
      const rect = host!.getBoundingClientRect();
      mouse.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouse.targetY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
    }

    function onDeviceOrientation(e: DeviceOrientationEvent) {
      if (e.beta !== null && e.gamma !== null) {
        mouse.targetX = (e.gamma / 45) * 0.5;
        mouse.targetY = ((e.beta - 45) / 45) * 0.5;
      }
    }

    host.addEventListener("mousemove", onMouseMove);
    window.addEventListener("deviceorientation", onDeviceOrientation);

    // ─── Animate ─────────────────────────────────────────────────
    function tick() {
      const t = (performance.now() / 1000) * motionFactor;

      // Smooth mouse follow
      mouse.x += (mouse.targetX - mouse.x) * 0.045;
      mouse.y += (mouse.targetY - mouse.y) * 0.045;

      // Stage gentle sway + mouse tilt
      stage.rotation.y = Math.sin(t * 0.9) * 0.12 + mouse.x * 0.18;
      stage.rotation.x = Math.sin(t * 0.6) * 0.06 + mouse.y * 0.12;

      // Groups rotate at different speeds
      farGroup.rotation.y = t * 0.55;
      farGroup.rotation.x = Math.sin(t * 0.8) * 0.06;

      midGroup.rotation.y = t * 1.2;
      midGroup.rotation.z = Math.sin(t * 0.7) * 0.08;

      nearGroup.rotation.y = -t * 0.35;
      nearGroup.rotation.x = Math.sin(t * 0.5) * 0.05;

      particleGroup.rotation.y = -t * 0.28;
      particleGroup.rotation.x = Math.sin(t * 0.4) * 0.04;

      // Parallax: near objects react more to mouse
      const parallaxFactors = [0, 0.14, 0.08, 0.04]; // index = layer

      // Float each object
      floatingObjects.forEach((obj, i) => {
        const pf = parallaxFactors[obj.layer] ?? 0;
        obj.mesh.position.y =
          obj.baseY + Math.sin(t * obj.speed + i * 0.7) * obj.amplitude * (reduceMotion ? 0.4 : 1)
          + mouse.y * pf;
        obj.mesh.position.x =
          obj.baseX + mouse.x * pf * 0.6;

        if (obj.spin) {
          obj.mesh.rotation.x += 0.007 * obj.spin.x * motionFactor;
          obj.mesh.rotation.y += 0.010 * obj.spin.y * motionFactor;
          obj.mesh.rotation.z += 0.004 * obj.spin.z * motionFactor;
        }
      });

      // Rings spin
      rings.forEach((ring, i) => {
        ring.rotation.z += (0.008 + i * 0.003) * motionFactor;
        ring.rotation.x += 0.002 * motionFactor;
      });
      ring2.rotation.y += 0.006 * motionFactor;

      // Warm light follows mouse slightly
      warm.position.x = -2 + mouse.x * 0.8;
      warm.position.y = -0.5 + mouse.y * 0.6;

      renderer.render(scene, camera);
    }

    function handleVisibility() {
      renderer.setAnimationLoop(document.hidden ? null : tick);
    }

    resize();
    renderer.setAnimationLoop(tick);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      host!.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("deviceorientation", onDeviceOrientation);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.setAnimationLoop(null);
      host!.removeChild(renderer.domElement);
      disposableGeometries.forEach((g) => g.dispose());
      disposableMaterials.forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ pointerEvents: "auto", opacity: 0.62 }}
    />
  );
}