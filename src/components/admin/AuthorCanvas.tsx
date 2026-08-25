"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { heroBoard } from "@/content/pcb";
import type { Hotspot, PcbModel } from "@/types/app";

/**
 * The same board geometry the public hero renders, in author mode: clicking
 * the mesh raycasts and hands the intersection point back so the coordinates
 * are captured rather than typed (spec §13.6).
 *
 * Kept separate from PcbScene so the admin bundle never loads the public
 * hero's projection/occlusion machinery, which it does not need.
 */

function BoardMesh({
  onPick,
  placing,
}: {
  onPick: (p: THREE.Vector3, n: THREE.Vector3) => void;
  placing: boolean;
}) {
  const board = heroBoard;

  const geometry = React.useMemo(() => {
    const hw = board.width / 2;
    const hd = board.depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, -hd);
    shape.lineTo(hw, -hd);
    shape.lineTo(hw, hd);
    shape.lineTo(-hw, hd);
    shape.closePath();

    for (const h of board.mountingHoles) {
      const path = new THREE.Path();
      path.absarc(h.x, h.z, h.r, 0, Math.PI * 2, true);
      shape.holes.push(path);
    }

    const geo = new THREE.ExtrudeGeometry(shape, { depth: board.thickness, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, board.thickness, 0);
    geo.computeVertexNormals();
    return geo;
  }, [board]);

  React.useEffect(() => () => geometry.dispose(), [geometry]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!placing) return;
    e.stopPropagation();
    const normal = e.face?.normal
      ? e.face.normal.clone().transformDirection(e.object.matrixWorld)
      : new THREE.Vector3(0, 1, 0);
    onPick(e.point.clone(), normal);
  };

  return (
    <group>
      <mesh geometry={geometry} onClick={handleClick}>
        <meshStandardMaterial color="#0f5163" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Component blocks, so the board reads as a board while placing */}
      {board.parts
        .filter((p) => p.kind !== "passive")
        .map((p) => (
          <mesh
            key={p.id}
            position={[p.x, board.thickness + p.h / 2, p.z]}
            rotation={[0, p.rotation ?? 0, 0]}
            onClick={handleClick}
          >
            <boxGeometry args={[p.w, p.h, p.d]} />
            <meshStandardMaterial color={p.color ?? "#161d22"} roughness={0.7} metalness={0.1} />
          </mesh>
        ))}
    </group>
  );
}

function ExistingMarkers({ hotspots }: { hotspots: Hotspot[] }) {
  return (
    <group>
      {hotspots.map((h) => (
        <mesh key={h.id} position={[h.position.x, h.position.y, h.position.z]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial color="#3e9cb5" emissive="#3e9cb5" emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Reports the live camera so "Use current view" can store it. */
function CameraReporter({
  onCamera,
}: {
  onCamera: (c: { position: [number, number, number]; target: [number, number, number]; fov: number }) => void;
}) {
  const { camera } = useThree();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controls = useThree((s) => s.controls) as any;

  React.useEffect(() => {
    const report = () => {
      const t = controls?.target ?? new THREE.Vector3();
      onCamera({
        position: [
          Math.round(camera.position.x * 1000) / 1000,
          Math.round(camera.position.y * 1000) / 1000,
          Math.round(camera.position.z * 1000) / 1000,
        ],
        target: [
          Math.round(t.x * 1000) / 1000,
          Math.round(t.y * 1000) / 1000,
          Math.round(t.z * 1000) / 1000,
        ],
        fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : 34,
      });
    };
    report();
    const interval = setInterval(report, 500);
    return () => clearInterval(interval);
  }, [camera, controls, onCamera]);

  return null;
}

export default function AuthorCanvas({
  model,
  placing,
  existing,
  onPick,
  onCamera,
}: {
  model: PcbModel;
  placing: boolean;
  existing: Hotspot[];
  onPick: (p: { x: number; y: number; z: number }, n: { x: number; y: number; z: number }) => void;
  onCamera: (c: { position: [number, number, number]; target: [number, number, number]; fov: number }) => void;
}) {
  return (
    <Canvas
      className={placing ? "cursor-crosshair" : "cursor-grab"}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: model.cameraDefault.position, fov: model.cameraDefault.fov, near: 0.1, far: 100 }}
    >
      {/* Local lighting only — see the note in PcbScene. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#cfeaf2", "#0a2129", 0.8]} />
      <directionalLight position={[4, 6, 3]} intensity={2.1} />
      <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#8fd4e6" />

      <React.Suspense fallback={null}>
        <BoardMesh
          placing={placing}
          onPick={(p, n) => onPick({ x: p.x, y: p.y, z: p.z }, { x: n.x, y: n.y, z: n.z })}
        />
        <ExistingMarkers hotspots={existing} />
      </React.Suspense>

      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} />
      <CameraReporter onCamera={onCamera} />
    </Canvas>
  );
}
