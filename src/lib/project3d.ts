/**
 * Minimal perspective projection, matching three.js `Vector3.project()`.
 *
 * Exists so the poster fallback can place its hotspot chips at exactly the
 * coordinates the canvas would use, without pulling three.js into the initial
 * bundle. Spec §13.1 — layout is identical in both paths.
 */

export type Vec3 = [number, number, number];

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface ProjectedPoint {
  /** 0–100, percentage across the viewport. */
  leftPct: number;
  topPct: number;
  /** True when the point sits behind the camera. */
  behind: boolean;
  /** Distance from the camera, for depth ordering. */
  depth: number;
}

export function projectPoint(
  point: Vec3,
  camPos: Vec3,
  target: Vec3,
  fovDeg: number,
  aspect: number,
): ProjectedPoint {
  // Camera basis — three.js convention: the camera looks down its own -Z.
  const zAxis = norm(sub(camPos, target));
  const worldUp: Vec3 = Math.abs(zAxis[1]) > 0.999 ? [0, 0, 1] : [0, 1, 0];
  const xAxis = norm(cross(worldUp, zAxis));
  const yAxis = cross(zAxis, xAxis);

  const v = sub(point, camPos);
  const vx = dot(v, xAxis);
  const vy = dot(v, yAxis);
  const vz = dot(v, zAxis);

  const depth = -vz; // positive in front of the camera
  if (depth <= 0.0001) {
    return { leftPct: 50, topPct: 50, behind: true, depth: 0 };
  }

  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const ndcX = (f / aspect) * (vx / depth);
  const ndcY = f * (vy / depth);

  return {
    leftPct: (ndcX * 0.5 + 0.5) * 100,
    topPct: (-ndcY * 0.5 + 0.5) * 100,
    behind: false,
    depth,
  };
}

/** Lifts a hotspot off the board surface along its normal so the chip never z-fights. */
export function offsetAlongNormal(
  position: { x: number; y: number; z: number },
  normal: { x: number; y: number; z: number },
  distance = 0.06,
): Vec3 {
  const n = norm([normal.x, normal.y, normal.z]);
  return [position.x + n[0] * distance, position.y + n[1] * distance, position.z + n[2] * distance];
}
