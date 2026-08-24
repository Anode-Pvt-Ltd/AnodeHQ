import type { PcbModel } from "@/types/app";
import { img } from "./media";

/**
 * Procedural board description.
 *
 * No .glb asset exists for this build, so the hero board is generated in code
 * from this data. That keeps the payload at zero bytes instead of 3.2 MB and
 * lets the CMS edit component placement directly. `PcbModel.storagePath`
 * remains supported: set it and the renderer loads a real glTF instead.
 */

export type PartKind =
  | "qfp" | "qfn" | "bga" | "passive" | "electrolytic" | "inductor"
  | "crystal" | "usbc" | "header" | "coax" | "led" | "regulator" | "connector";

export interface BoardPart {
  id: string;
  kind: PartKind;
  /** Centre position on the board plane, board units. */
  x: number;
  z: number;
  /** Footprint size in board units. */
  w: number;
  d: number;
  h: number;
  rotation?: number;
  /** Reference designator, rendered as silkscreen. */
  ref?: string;
  pins?: number;
  color?: string;
}

export interface BoardDefinition {
  width: number;
  depth: number;
  thickness: number;
  /** Notch cut from the right edge, matching the reference image outline. */
  notch: { x: number; z: number; w: number; d: number } | null;
  mountingHoles: { x: number; z: number; r: number }[];
  parts: BoardPart[];
  /** Copper trace polylines on the top layer, in board units. */
  traces: { points: [number, number][]; width: number; layer: "top" | "inner" }[];
}

export const heroBoard: BoardDefinition = {
  width: 3.4,
  depth: 2.3,
  thickness: 0.08,
  notch: { x: 1.7, z: 0.75, w: 0.42, d: 0.5 },
  mountingHoles: [
    { x: -1.52, z: -0.98, r: 0.085 },
    { x: -1.52, z: 0.98, r: 0.085 },
    { x: 1.5, z: -0.98, r: 0.085 },
  ],
  parts: [
    // Main processor — the "Anode" marked QFP at the centre of the reference image
    { id: "u1", kind: "qfp", ref: "U1", x: 0.05, z: 0.0, w: 0.86, d: 0.86, h: 0.075, pins: 24, color: "#12181c" },
    // Secondary controller
    { id: "u2", kind: "qfn", ref: "U2", x: 0.98, z: 0.62, w: 0.44, d: 0.44, h: 0.05, pins: 12, color: "#161d22" },
    // Power regulator
    { id: "u3", kind: "regulator", ref: "U3", x: -0.82, z: -0.62, w: 0.3, d: 0.24, h: 0.055, color: "#191f24" },
    { id: "l1", kind: "inductor", ref: "L1", x: -0.5, z: -0.66, w: 0.24, d: 0.24, h: 0.13 },
    // Bulk capacitors
    { id: "c1", kind: "electrolytic", ref: "C1", x: 0.62, z: -0.72, w: 0.2, d: 0.2, h: 0.24 },
    { id: "c2", kind: "electrolytic", ref: "C2", x: 0.92, z: -0.7, w: 0.17, d: 0.17, h: 0.2 },
    { id: "c3", kind: "electrolytic", ref: "C3", x: 1.18, z: -0.68, w: 0.15, d: 0.15, h: 0.17 },
    // Crystal
    { id: "y1", kind: "crystal", ref: "Y1", x: -0.28, z: 0.52, w: 0.28, d: 0.16, h: 0.05 },
    // USB-C receptacle on the left edge
    { id: "j1", kind: "usbc", ref: "J1", x: -1.52, z: 0.3, w: 0.3, d: 0.5, h: 0.12 },
    // Pin header on the right edge
    { id: "j2", kind: "header", ref: "J2", x: 1.32, z: -0.12, w: 0.16, d: 1.1, h: 0.26, pins: 10 },
    // Gold coax / test connector, top left of the reference image
    { id: "j3", kind: "coax", ref: "J3", x: -0.62, z: 0.86, w: 0.16, d: 0.16, h: 0.3 },
    // Board-to-board connector
    { id: "j4", kind: "connector", ref: "J4", x: 0.4, z: 0.88, w: 0.72, d: 0.14, h: 0.09 },
    // Status LEDs
    { id: "d1", kind: "led", ref: "D1", x: -1.18, z: -0.3, w: 0.07, d: 0.05, h: 0.03, color: "#3ee08a" },
    { id: "d2", kind: "led", ref: "D2", x: -1.18, z: -0.16, w: 0.07, d: 0.05, h: 0.03, color: "#ffb340" },
    // Passive field — decoupling around U1 and the power stage
    ...passiveField(),
  ],
  traces: buildTraces(),
};

function passiveField(): BoardPart[] {
  const out: BoardPart[] = [];
  const seedRandom = mulberry(20260824);
  let n = 1;
  // decoupling ring around the processor
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r = 0.62 + seedRandom() * 0.1;
    out.push({
      id: `cd${i}`, kind: "passive", ref: `C${10 + n++}`,
      x: 0.05 + Math.cos(a) * r, z: Math.sin(a) * r,
      w: 0.075, d: 0.045, h: 0.022,
      rotation: i % 2 === 0 ? 0 : Math.PI / 2,
    });
  }
  // scattered passives across the free area
  const spots: [number, number][] = [
    [-1.15, 0.62], [-1.0, 0.72], [-0.9, 0.2], [-1.1, 0.05], [-1.22, 0.35],
    [-0.35, -0.9], [-0.1, -0.85], [0.18, -0.9], [1.05, 0.05], [1.02, -0.25],
    [0.62, 0.5], [0.75, 0.28], [-0.55, -0.35], [-0.3, -0.55], [1.2, 0.35],
    [0.35, -0.5], [-0.72, 0.4], [1.12, 0.78], [0.15, 0.72], [-1.35, -0.6],
  ];
  spots.forEach(([x, z], i) => {
    out.push({
      id: `cp${i}`, kind: "passive", ref: `R${n++}`,
      x, z, w: 0.08, d: 0.048, h: 0.022,
      rotation: i % 3 === 0 ? Math.PI / 2 : 0,
    });
  });
  return out;
}

function buildTraces(): BoardDefinition["traces"] {
  const t: BoardDefinition["traces"] = [];
  // fan-out from the processor to the header — length-matched serpentines
  for (let i = 0; i < 8; i++) {
    const z = -0.38 + i * 0.095;
    t.push({
      points: [
        [0.48, z], [0.72, z], [0.82, z + 0.05], [1.0, z + 0.05], [1.1, z], [1.24, z],
      ],
      width: 0.014,
      layer: "top",
    });
  }
  // differential pairs to USB-C
  for (const off of [-0.035, 0.035]) {
    t.push({
      points: [[-0.38, 0.06 + off], [-0.7, 0.06 + off], [-0.86, 0.18 + off], [-1.24, 0.18 + off], [-1.38, 0.3 + off]],
      width: 0.016,
      layer: "top",
    });
  }
  // power spine from the regulator
  t.push({ points: [[-0.68, -0.62], [-0.2, -0.62], [-0.05, -0.5], [-0.05, -0.44]], width: 0.05, layer: "top" });
  t.push({ points: [[-0.5, -0.54], [-0.5, -0.2], [-0.34, -0.06]], width: 0.045, layer: "top" });
  // signals up to the board-to-board connector
  for (let i = 0; i < 6; i++) {
    const x = 0.1 + i * 0.12;
    t.push({ points: [[x, 0.46], [x, 0.68], [x + 0.02, 0.78]], width: 0.013, layer: "top" });
  }
  // crystal to processor
  t.push({ points: [[-0.28, 0.44], [-0.28, 0.3], [-0.2, 0.24]], width: 0.013, layer: "top" });
  t.push({ points: [[-0.36, 0.44], [-0.36, 0.34], [-0.26, 0.24]], width: 0.013, layer: "top" });
  // long inner-layer routes
  t.push({ points: [[-1.4, -0.75], [0.9, -0.75], [1.25, -0.5]], width: 0.02, layer: "inner" });
  t.push({ points: [[-1.4, 0.86], [-0.9, 0.86], [-0.75, 0.92]], width: 0.02, layer: "inner" });
  return t;
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ model */

export const heroModel: PcbModel = {
  id: "pcb-hero",
  name: "Anode reference board — rev 3",
  slug: "anode-hero",
  storagePath: null,
  poster: img("hero-poster", "Anode reference PCB shown at an angle with annotated components", 1200, 900),
  cameraDefault: { position: [2.6, 2.35, 3.0], target: [0, 0, 0], fov: 34 },
  cameraLimits: { minPolar: 12, maxPolar: 82, minZoom: 0.55, maxZoom: 2.2 },
  scale: 1,
  isHero: true,
  variants: [
    {
      key: "components", displayName: "Components", icon: "cpu", orderIndex: 1,
      config: {
        camera: { position: [2.6, 2.35, 3.0], target: [0, 0, 0], fov: 34 },
        showHotspots: ["*"],
        annotation: { text: "214 placements · 0.4 mm pitch BGA fan-out", position: "bottom-left" },
        autoRotate: true,
      },
    },
    {
      key: "layers", displayName: "Layer stack", icon: "layers", orderIndex: 2,
      config: {
        camera: { position: [0.6, 1.5, 4.2], target: [0, 0, 0], fov: 30 },
        materials: { solderMask: { opacity: 0.28 }, components: { visible: false } },
        showHotspots: ["layer-4"],
        annotation: { text: "6 layers · 1.6 mm · signal / GND / power / signal", position: "bottom-left" },
        autoRotate: false,
      },
    },
    {
      key: "grid", displayName: "Dimensions", icon: "grid-3x3", orderIndex: 3,
      config: {
        camera: { position: [0, 4.4, 0.01], target: [0, 0, 0], fov: 28 },
        showHotspots: [],
        annotation: { text: "78 × 52 mm · IPC-6012 Class 2 · ENIG finish", position: "bottom-left" },
        autoRotate: false,
      },
    },
  ],
  hotspots: [
    {
      id: "hs-mcu", orderIndex: 1, variantKey: null, anchor: "right", icon: "cpu",
      label: "Component", value: "MCU", detail: "STM32H743",
      position: { x: 0.05, y: 0.12, z: 0.0 },
      normal: { x: 0, y: 1, z: 0 },
      body: "480 MHz Cortex-M7 with 2 MB flash and 1 MB SRAM. Chosen for the DSP throughput the sensor fusion needs and for its 15-year longevity commitment.",
      linkUrl: "/services/embedded-systems-and-firmware",
    },
    {
      id: "layer-4", orderIndex: 2, variantKey: null, anchor: "left", icon: "layers",
      label: "Layer 4", value: "Signal", detail: "50 Ω ±10 %",
      position: { x: -1.35, y: 0.06, z: -0.86 },
      normal: { x: -0.6, y: 0.6, z: -0.5 },
      body: "Inner signal layer referenced to a solid ground plane on layer 3, giving controlled impedance and a continuous return path under every high-speed net.",
      linkUrl: "/services/pcb-layout-and-high-speed-design",
    },
    {
      id: "hs-temp", orderIndex: 3, variantKey: null, anchor: "bottom", icon: "thermometer",
      label: "Temperature", value: "42 °C", detail: "ΔT 21 °C",
      position: { x: -0.66, y: 0.12, z: -0.64 },
      normal: { x: 0, y: 1, z: -0.3 },
      body: "Measured at the regulator case at full load in 25 °C ambient. The via field beneath carries heat into the inner planes rather than into the sensor zone.",
      linkUrl: "/projects/iot-environmental-monitor",
    },
    {
      id: "hs-power", orderIndex: 4, variantKey: null, anchor: "right", icon: "zap",
      label: "Power", value: "3.3 V", detail: "1.2 A · 94 %",
      position: { x: 1.32, y: 0.2, z: -0.12 },
      normal: { x: 0.7, y: 0.7, z: 0 },
      body: "Synchronous buck at 2.2 MHz, synchronised to the ADC conversion clock so its switching residual falls outside the measurement band.",
      linkUrl: "/services/circuit-and-schematic-design",
    },
  ],
};
