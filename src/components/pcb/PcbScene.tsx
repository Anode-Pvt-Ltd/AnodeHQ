"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerformanceMonitor } from "@react-three/drei";
import { heroBoard, type BoardDefinition, type BoardPart } from "@/content/pcb";
import type { Hotspot, PcbModel, PcbVariant } from "@/types/app";
import type { ProjectionSink } from "./PcbStage";

/**
 * The board is generated from `heroBoard` rather than loaded from a .glb:
 * zero asset bytes, editable from the CMS, and the copper artwork is drawn
 * into a canvas texture instead of geometry so the whole board is 3 draw calls.
 */

const MASK = "#0f5163";
const MASK_DARK = "#0a3947";
const COPPER = "#c99a3f";
const GOLD = "#e3bd6a";
const SILK = "#e8f2f4";

/* ------------------------------------------------------------- artwork */

function drawArtwork(board: BoardDefinition, layerMode: boolean): HTMLCanvasElement {
  const PX = 1024;
  const aspect = board.depth / board.width;
  const c = document.createElement("canvas");
  c.width = PX;
  c.height = Math.round(PX * aspect);
  const g = c.getContext("2d")!;

  const toX = (x: number) => ((x + board.width / 2) / board.width) * c.width;
  const toY = (z: number) => ((z + board.depth / 2) / board.depth) * c.height;
  const toS = (v: number) => (v / board.width) * c.width;

  // solder mask
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, layerMode ? MASK_DARK : MASK);
  grad.addColorStop(1, layerMode ? "#062a36" : MASK_DARK);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);

  // subtle weave texture
  g.globalAlpha = 0.05;
  g.strokeStyle = "#ffffff";
  g.lineWidth = 1;
  for (let x = 0; x < c.width; x += 7) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); }
  for (let y = 0; y < c.height; y += 7) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
  g.globalAlpha = 1;

  // inner-layer ghosting, stronger when the layer view is active
  for (const t of board.traces) {
    if (t.layer !== "inner") continue;
    g.globalAlpha = layerMode ? 0.75 : 0.22;
    g.strokeStyle = layerMode ? "#5fc2d8" : "#7fd4e8";
    g.lineWidth = Math.max(1.5, toS(t.width));
    g.lineCap = "round";
    g.lineJoin = "round";
    g.beginPath();
    t.points.forEach(([x, z], i) => (i ? g.lineTo(toX(x), toY(z)) : g.moveTo(toX(x), toY(z))));
    g.stroke();
  }
  g.globalAlpha = 1;

  // top-layer copper
  for (const t of board.traces) {
    if (t.layer !== "top") continue;
    g.strokeStyle = COPPER;
    g.lineWidth = Math.max(1.5, toS(t.width));
    g.lineCap = "round";
    g.lineJoin = "round";
    g.globalAlpha = layerMode ? 0.35 : 0.92;
    g.beginPath();
    t.points.forEach(([x, z], i) => (i ? g.lineTo(toX(x), toY(z)) : g.moveTo(toX(x), toY(z))));
    g.stroke();
    // via at the end of the run
    const last = t.points.at(-1);
    if (last) {
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(toX(last[0]), toY(last[1]), Math.max(2, toS(t.width) * 1.1), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  // pads + silkscreen outlines under each part
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (const p of board.parts) {
    const px = toX(p.x);
    const py = toY(p.z);
    const pw = toS(p.w);
    const pd = toS(p.d);

    if (p.kind === "passive") {
      g.fillStyle = GOLD;
      const rot = p.rotation ?? 0;
      const w = rot ? pd : pw;
      const h = rot ? pw : pd;
      g.fillRect(px - w / 2 - 2, py - h / 2, 4, h);
      g.fillRect(px + w / 2 - 2, py - h / 2, 4, h);
      continue;
    }

    // silkscreen courtyard
    g.strokeStyle = SILK;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.5;
    g.strokeRect(px - pw / 2 - 3, py - pd / 2 - 3, pw + 6, pd + 6);
    g.globalAlpha = 1;

    if (p.ref && pw > 26) {
      g.fillStyle = SILK;
      g.globalAlpha = 0.75;
      g.font = `600 ${Math.max(9, pw * 0.13)}px ui-monospace, monospace`;
      g.fillText(p.ref, px, py - pd / 2 - 11);
      g.globalAlpha = 1;
    }

    // pin pads for the leaded packages
    if ((p.kind === "qfp" || p.kind === "qfn") && p.pins) {
      g.fillStyle = GOLD;
      const per = p.pins;
      for (let i = 0; i < per; i++) {
        const t = (i + 0.5) / per;
        const off = 5;
        g.fillRect(px - pw / 2 + t * pw - 2, py - pd / 2 - off, 4, off);
        g.fillRect(px - pw / 2 + t * pw - 2, py + pd / 2, 4, off);
        g.fillRect(px - pw / 2 - off, py - pd / 2 + t * pd - 2, off, 4);
        g.fillRect(px + pw / 2, py - pd / 2 + t * pd - 2, off, 4);
      }
    }
  }

  // board identity mark
  g.fillStyle = SILK;
  g.globalAlpha = 0.8;
  g.font = `700 ${c.width * 0.022}px ui-sans-serif, system-ui`;
  g.textAlign = "left";
  g.fillText("ANODE", toX(-board.width / 2) + 16, toY(board.depth / 2) - 22);
  g.globalAlpha = 0.5;
  g.font = `500 ${c.width * 0.014}px ui-monospace, monospace`;
  g.fillText("REF-6L  REV 3", toX(-board.width / 2) + 16, toY(board.depth / 2) - 8);
  g.globalAlpha = 1;

  return c;
}

/* ------------------------------------------------------------ geometry */

function useBoardGeometry(board: BoardDefinition) {
  return React.useMemo(() => {
    const hw = board.width / 2;
    const hd = board.depth / 2;
    const r = 0.09;

    const shape = new THREE.Shape();
    shape.moveTo(-hw + r, -hd);
    shape.lineTo(hw - r, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + r);

    if (board.notch) {
      const { z: nz, d: nd } = board.notch;
      shape.lineTo(hw, nz - nd / 2);
      shape.lineTo(hw - board.notch.w, nz - nd / 2 + 0.12);
      shape.lineTo(hw - board.notch.w, nz + nd / 2 - 0.12);
      shape.lineTo(hw, nz + nd / 2);
    }

    shape.lineTo(hw, hd - r);
    shape.quadraticCurveTo(hw, hd, hw - r, hd);
    shape.lineTo(-hw + r, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    shape.lineTo(-hw, -hd + r);
    shape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    for (const h of board.mountingHoles) {
      const path = new THREE.Path();
      path.absarc(h.x, h.z, h.r, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: board.thickness,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 1,
      curveSegments: 8,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, board.thickness, 0);
    geo.computeVertexNormals();

    // Planar UVs so the artwork texture lands square on the top face.
    const pos = geo.attributes.position!;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + hw) / board.width;
      uv[i * 2 + 1] = 1 - (pos.getZ(i) + hd) / board.depth;
    }
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    return geo;
  }, [board]);
}

/* --------------------------------------------------------------- parts */

const PART_COLOR: Record<string, string> = {
  qfp: "#14191d", qfn: "#171e23", regulator: "#1a2126", crystal: "#c8ccd0",
  usbc: "#b9c0c6", header: "#12171b", coax: GOLD, connector: "#14191d",
  inductor: "#2a2f34", electrolytic: "#1e2429", led: "#3ee08a",
};

function Parts({ board, hidden }: { board: BoardDefinition; hidden: boolean }) {
  const passives = React.useMemo(() => board.parts.filter((p) => p.kind === "passive"), [board]);
  const named = React.useMemo(() => board.parts.filter((p) => p.kind !== "passive"), [board]);
  const y = board.thickness;

  const passiveRef = React.useRef<THREE.InstancedMesh>(null);
  React.useEffect(() => {
    const mesh = passiveRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    passives.forEach((p, i) => {
      dummy.position.set(p.x, y + p.h / 2, p.z);
      dummy.rotation.set(0, p.rotation ?? 0, 0);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(i % 3 === 0 ? 0x22282d : i % 3 === 1 ? 0x2c3238 : 0x8a6a3a);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [passives, y]);

  if (hidden) return null;

  return (
    <group>
      <instancedMesh
        ref={passiveRef}
        args={[undefined, undefined, passives.length]}
        castShadow={false}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.6} metalness={0.15} />
      </instancedMesh>

      {named.map((p) => (
        <Part key={p.id} part={p} baseY={y} />
      ))}
    </group>
  );
}

function Part({ part, baseY }: { part: BoardPart; baseY: number }) {
  const color = part.color ?? PART_COLOR[part.kind] ?? "#1a2126";
  const y = baseY + part.h / 2;

  if (part.kind === "electrolytic") {
    return (
      <group position={[part.x, y, part.z]}>
        <mesh>
          <cylinderGeometry args={[part.w / 2, part.w / 2, part.h, 20]} />
          <meshStandardMaterial color={color} roughness={0.45} metalness={0.5} />
        </mesh>
        <mesh position={[0, part.h / 2 + 0.001, 0]}>
          <cylinderGeometry args={[part.w / 2.1, part.w / 2.1, 0.004, 20]} />
          <meshStandardMaterial color="#0d1114" roughness={0.8} />
        </mesh>
      </group>
    );
  }

  if (part.kind === "coax") {
    return (
      <group position={[part.x, y, part.z]}>
        <mesh>
          <cylinderGeometry args={[part.w / 2, part.w / 2, part.h, 16]} />
          <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.95} />
        </mesh>
        <mesh position={[0, part.h / 2, 0]}>
          <cylinderGeometry args={[part.w / 5, part.w / 5, 0.05, 12]} />
          <meshStandardMaterial color="#f0d79a" roughness={0.2} metalness={1} />
        </mesh>
      </group>
    );
  }

  if (part.kind === "header" && part.pins) {
    const pinCount = part.pins;
    return (
      <group position={[part.x, baseY, part.z]}>
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[part.w, 0.04, part.d]} />
          <meshStandardMaterial color="#0f1417" roughness={0.85} />
        </mesh>
        {Array.from({ length: pinCount }).map((_, i) => {
          const t = (i + 0.5) / pinCount - 0.5;
          return (
            <mesh key={i} position={[0, part.h / 2 + 0.02, t * part.d]}>
              <boxGeometry args={[0.028, part.h, 0.028]} />
              <meshStandardMaterial color={GOLD} roughness={0.25} metalness={0.95} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (part.kind === "led") {
    return (
      <mesh position={[part.x, y, part.z]}>
        <boxGeometry args={[part.w, part.h, part.d]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} toneMapped={false} />
      </mesh>
    );
  }

  const metal = part.kind === "usbc" || part.kind === "crystal";

  return (
    <group position={[part.x, y, part.z]} rotation={[0, part.rotation ?? 0, 0]}>
      <mesh>
        <boxGeometry args={[part.w, part.h, part.d]} />
        <meshStandardMaterial
          color={color}
          roughness={metal ? 0.3 : 0.72}
          metalness={metal ? 0.85 : 0.1}
        />
      </mesh>
      {/* pin-1 dot on the processor packages */}
      {(part.kind === "qfp" || part.kind === "qfn") && (
        <mesh position={[-part.w / 2 + 0.07, part.h / 2 + 0.002, -part.d / 2 + 0.07]}>
          <cylinderGeometry args={[0.022, 0.022, 0.004, 12]} />
          <meshStandardMaterial color="#4a5259" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

/* ------------------------------------------------------------ hotspots */

function HotspotProjector({
  hotspots, sink, boardRef,
}: {
  hotspots: Hotspot[];
  sink: ProjectionSink;
  boardRef: React.RefObject<THREE.Group | null>;
}) {
  const { camera, size } = useThree();
  const v = React.useMemo(() => new THREE.Vector3(), []);
  const world = React.useMemo(() => new THREE.Vector3(), []);
  const ray = React.useMemo(() => new THREE.Raycaster(), []);
  const dir = React.useMemo(() => new THREE.Vector3(), []);
  const acc = React.useRef(0);

  useFrame((_, delta) => {
    // 30 Hz is plenty for chip placement and halves the raycast cost.
    acc.current += delta;
    if (acc.current < 1 / 30) return;
    acc.current = 0;

    for (const h of hotspots) {
      const n = new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z).normalize();
      world.set(h.position.x, h.position.y, h.position.z).addScaledVector(n, 0.06);
      v.copy(world).project(camera);

      const behind = v.z > 1;
      let occluded = false;

      if (!behind && boardRef.current) {
        dir.copy(world).sub(camera.position).normalize();
        ray.set(camera.position, dir);
        const hits = ray.intersectObject(boardRef.current, true);
        const target = camera.position.distanceTo(world);
        occluded = Boolean(hits[0] && hits[0].distance < target - 0.05);
      }

      sink.update(h.id, (v.x * 0.5 + 0.5) * 100, (-v.y * 0.5 + 0.5) * 100, occluded, behind);
    }
    void size;
  });

  return null;
}

/* --------------------------------------------------------- camera rig */

function CameraRig({
  variant, model, reducedMotion,
}: { variant: PcbVariant | undefined; model: PcbModel; reducedMotion: boolean }) {
  const { camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;
  const target = variant?.config.camera ?? model.cameraDefault;
  const from = React.useRef(new THREE.Vector3().copy(camera.position));
  const t = React.useRef(1);

  React.useEffect(() => {
    from.current.copy(camera.position);
    t.current = 0;
  }, [target, camera]);

  React.useEffect(() => {
    const onReset = () => {
      from.current.copy(camera.position);
      t.current = 0;
    };
    window.addEventListener("anode:pcb-reset", onReset);
    return () => window.removeEventListener("anode:pcb-reset", onReset);
  }, [camera]);

  useFrame((_, delta) => {
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + delta * (reducedMotion ? 6 : 1.9));
    const e = 1 - Math.pow(1 - t.current, 3);
    camera.position.lerpVectors(
      from.current,
      new THREE.Vector3(...target.position),
      e,
    );
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (target.fov - camera.fov) * e * 0.25;
      camera.updateProjectionMatrix();
    }
    if (controls?.target) {
      controls.target.lerp(new THREE.Vector3(...target.target), e * 0.3);
      controls.update?.();
    }
  });

  return null;
}

/* ---------------------------------------------------------------- board */

function Board({
  model, variant, hotspots, sink, reducedMotion,
}: {
  model: PcbModel;
  variant: PcbVariant | undefined;
  hotspots: Hotspot[];
  sink: ProjectionSink;
  reducedMotion: boolean;
}) {
  const board = heroBoard;
  const geometry = useBoardGeometry(board);
  const groupRef = React.useRef<THREE.Group>(null);
  const layerMode = variant?.key === "layers";

  const texture = React.useMemo(() => {
    const tex = new THREE.CanvasTexture(drawArtwork(board, layerMode));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [board, layerMode]);

  React.useEffect(() => () => { texture.dispose(); }, [texture]);
  React.useEffect(() => () => { geometry.dispose(); }, [geometry]);

  const maskOpacity = variant?.config.materials?.solderMask?.opacity ?? 1;
  const hideParts = variant?.config.materials?.components?.visible === false;

  return (
    <group ref={groupRef} scale={model.scale}>
      <mesh geometry={geometry} castShadow={false} receiveShadow={false}>
        <meshStandardMaterial
          map={texture}
          roughness={0.55}
          metalness={0.12}
          transparent={maskOpacity < 1}
          opacity={maskOpacity}
        />
      </mesh>

      {/* edge / substrate colour under the mask */}
      <mesh position={[0, board.thickness / 2, 0]}>
        <boxGeometry args={[board.width - 0.004, board.thickness * 0.98, board.depth - 0.004]} />
        <meshStandardMaterial color={layerMode ? "#0a3040" : "#0c4152"} roughness={0.85} />
      </mesh>

      <Parts board={board} hidden={hideParts} />
      <HotspotProjector hotspots={hotspots} sink={sink} boardRef={groupRef} />
      <CameraRig variant={variant} model={model} reducedMotion={reducedMotion} />
    </group>
  );
}

/* --------------------------------------------------------------- scene */

export interface PcbSceneProps {
  model: PcbModel;
  variant: PcbVariant | undefined;
  hotspots: Hotspot[];
  sink: ProjectionSink;
  reducedMotion: boolean;
  onFail: () => void;
}

export default function PcbScene({
  model, variant, hotspots, sink, reducedMotion, onFail,
}: PcbSceneProps) {
  const [dpr, setDpr] = React.useState(1.5);
  const [interacted, setInteracted] = React.useState(false);
  const lowFrames = React.useRef(0);
  const limits = model.cameraLimits;

  const autoRotate =
    !reducedMotion && !interacted && (variant?.config.autoRotate ?? true);

  return (
    <Canvas
      className="absolute inset-0"
      dpr={dpr}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
      camera={{
        position: model.cameraDefault.position,
        fov: model.cameraDefault.fov,
        near: 0.1,
        far: 100,
      }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); onFail(); });
      }}
      onPointerDown={() => setInteracted(true)}
      onWheel={() => setInteracted(true)}
      aria-hidden
      tabIndex={-1}
    >
      <PerformanceMonitor
        onDecline={() => {
          setDpr(1);
          lowFrames.current += 1;
          // Two consecutive declines: give up and hand the hero back to the poster.
          if (lowFrames.current >= 2) onFail();
        }}
        onIncline={() => setDpr(Math.min(2, window.devicePixelRatio))}
      />

      {/*
        Lighting is entirely local. drei's <Environment preset> fetches an HDR
        from raw.githack.com, which the CSP blocks — correctly, since the whole
        board is meant to be self-contained. A hemisphere fill plus a rim light
        replaces the image-based lighting without a network request.
      */}
      <ambientLight intensity={0.5} />
      <hemisphereLight args={["#cfeaf2", "#0a2129", 0.85]} />
      <directionalLight position={[4, 6, 3]} intensity={2.2} />
      <directionalLight position={[-4, 3, -2]} intensity={0.6} color="#8fd4e6" />
      <directionalLight position={[0, 2, -5]} intensity={0.35} color="#ffe9c2" />

      <React.Suspense fallback={null}>
        <Board
          model={model}
          variant={variant}
          hotspots={hotspots}
          sink={sink}
          reducedMotion={reducedMotion}
        />
      </React.Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.55}
        minPolarAngle={(limits.minPolar * Math.PI) / 180}
        maxPolarAngle={(limits.maxPolar * Math.PI) / 180}
        minDistance={2.4 / limits.maxZoom}
        maxDistance={4.6 / limits.minZoom}
        target={model.cameraDefault.target}
      />
    </Canvas>
  );
}
