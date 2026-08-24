import {
  Activity, Anchor, ArrowLeft, ArrowRight, ArrowUpRight, Award, BadgeCheck, BatteryCharging,
  BatteryLow, Boxes, Box, Bug, Building2, Cable, CarFront, Check, ChevronDown, ChevronRight,
  CircleDot, CircuitBoard, ClipboardCheck, Cog, Cpu, Diamond, ExternalLink, Factory, FileCheck,
  FileText, FlaskConical, GitBranch, Grid2x2, Grid3x3, Handshake, HeartPulse, Hexagon,
  LayoutGrid, Layers, Lightbulb, LineChart, ListChecks, Loader2, Mail, MapPin, Menu,
  MessageSquare, Microchip, Minus, Moon, Package, PenTool, Phone, Plane, Plus, Radar, Radio,
  RadioTower, RefreshCw, Receipt, Rocket, Ruler, ScanLine, Search, SearchCheck, Settings2,
  ShieldCheck, Sigma, Smartphone, Sprout, SquareDashed, Sun, Table2, Target, Thermometer,
  ThermometerSnowflake, Truck, Users, Waves, Wind, Wrench, X, Zap, CircleAlert, AtSign, Globe, Code2, Video,
  type LucideIcon,
} from "lucide-react";

/**
 * CMS `icon` strings resolve here. An unknown key falls back to a neutral glyph
 * rather than throwing — a bad icon name must never break a build (spec §5.5).
 */
const REGISTRY: Record<string, LucideIcon> = {
  activity: Activity, anchor: Anchor, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
  "arrow-up-right": ArrowUpRight, award: Award, "badge-check": BadgeCheck,
  "battery-charging": BatteryCharging, "battery-low": BatteryLow, box: Box, boxes: Boxes,
  bug: Bug, "building-2": Building2, cable: Cable, "car-front": CarFront, check: Check,
  "chevron-down": ChevronDown, "chevron-right": ChevronRight, "circle-alert": CircleAlert,
  "circle-dot": CircleDot, "circuit-board": CircuitBoard, "clipboard-check": ClipboardCheck,
  cog: Cog, cpu: Cpu, diamond: Diamond, "external-link": ExternalLink, factory: Factory,
  "file-check": FileCheck, "file-text": FileText, "flask-conical": FlaskConical,
  "git-branch": GitBranch, github: Code2, "grid-2x2": Grid2x2, "grid-3x3": Grid3x3,
  handshake: Handshake, "heart-pulse": HeartPulse, hexagon: Hexagon, layers: Layers,
  "layout-grid": LayoutGrid, lightbulb: Lightbulb, "line-chart": LineChart, linkedin: AtSign,
  "list-checks": ListChecks, loader: Loader2, mail: Mail, "map-pin": MapPin, menu: Menu,
  "message-square": MessageSquare, microchip: Microchip, minus: Minus, moon: Moon,
  package: Package, "pen-tool": PenTool, phone: Phone, plane: Plane, plus: Plus, radar: Radar,
  radio: Radio, "radio-tower": RadioTower, receipt: Receipt, "refresh-cw": RefreshCw,
  rocket: Rocket, ruler: Ruler, "scan-line": ScanLine, search: Search, "search-check": SearchCheck,
  "settings-2": Settings2, "shield-check": ShieldCheck, sigma: Sigma, smartphone: Smartphone,
  sprout: Sprout, "square-dashed": SquareDashed, sun: Sun, "table-2": Table2, target: Target,
  thermometer: Thermometer, "thermometer-snowflake": ThermometerSnowflake, truck: Truck,
  users: Users, waves: Waves, wind: Wind, wrench: Wrench, x: X, youtube: Video, zap: Zap, globe: Globe,
};

export function getIcon(key: string | null | undefined): LucideIcon {
  if (!key) return CircuitBoard;
  return REGISTRY[key] ?? REGISTRY[key.toLowerCase()] ?? CircuitBoard;
}

export const iconKeys = Object.keys(REGISTRY).sort();
export type { LucideIcon };
