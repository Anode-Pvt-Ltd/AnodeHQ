/**
 * Domain types — the shape components receive.
 * Query mappers convert PostgREST rows (or seed rows) into these; no component
 * ever sees a raw database row. Spec §2.6.
 */

export type ContentStatus = "draft" | "scheduled" | "published" | "archived";
export type AppRole = "viewer" | "sales" | "editor" | "admin" | "owner";
export type QuoteStatus = "new" | "reviewing" | "quoted" | "won" | "lost" | "archived";
export type ProjectStage = "idea" | "schematic" | "prototype" | "production";
export type MediaKind = "image" | "video" | "document" | "model";

export interface MediaRef {
  id: string;
  path: string;
  altText: string;
  width: number;
  height: number;
  blurhash: string | null;
  focalX: number;
  focalY: number;
  /** Set for seed/local assets served straight from /public. */
  localSrc?: string;
}

export interface ServiceFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ServiceSummary {
  slug: string;
  title: string;
  summary: string;
  icon: string;
}

export interface Service extends ServiceSummary {
  id: string;
  tagline: string;
  bodyHtml: string;
  heroImage: MediaRef | null;
  features: ServiceFeature[];
  deliverables: string[];
  tooling: { label: string; items: string[] }[];
  orderIndex: number;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface IndustrySummary {
  slug: string;
  name: string;
  summary: string;
  icon: string;
  projectCount: number;
}

export interface Industry extends IndustrySummary {
  id: string;
  bodyHtml: string;
  standards: string[];
  serviceSlugs: string[];
  orderIndex: number;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ProjectMetric {
  label: string;
  value: string;
  unit: string | null;
}

export interface BoardSpec {
  layers: number | null;
  sizeMm: [number, number] | null;
  componentCount: number | null;
  ipcClass: string | null;
  stackup: string | null;
}

export interface ProjectCardData {
  slug: string;
  title: string;
  summary: string;
  year: number;
  clientName: string | null;
  isConfidential: boolean;
  cover: MediaRef;
  industry: { slug: string; name: string } | null;
  services: ServiceSummary[];
}

export interface Project extends ProjectCardData {
  id: string;
  challenge: string;
  approach: string;
  outcome: string;
  bodyHtml: string;
  durationWeeks: number | null;
  boardSpec: BoardSpec;
  metrics: ProjectMetric[];
  gallery: { media: MediaRef; caption: string | null }[];
  featured: boolean;
  orderIndex: number;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface ProcessStage {
  id: string;
  stepNumber: number;
  title: string;
  shortDescription: string;
  icon: string;
  detail: {
    inputs: string[];
    activities: string[];
    outputs: string[];
    duration: string;
    gate: string;
  };
}

export interface PostSummary {
  slug: string;
  title: string;
  excerpt: string;
  cover: MediaRef;
  topic: { slug: string; name: string } | null;
  readMinutes: number;
  publishedAt: string;
}

export interface Post extends PostSummary {
  id: string;
  bodyHtml: string;
  author: TeamMember | null;
  updatedAt: string;
  status: ContentStatus;
  seoTitle: string | null;
  seoDescription: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photo: MediaRef | null;
  linkedinUrl: string | null;
  orderIndex: number;
}

export interface Testimonial {
  id: string;
  quote: string;
  authorName: string;
  authorRole: string;
  company: string;
  avatar: MediaRef | null;
  projectSlug: string | null;
  industrySlug: string | null;
  featured: boolean;
}

export interface Client {
  id: string;
  name: string;
  logoMark: string;
  websiteUrl: string | null;
  featured: boolean;
  orderIndex: number;
}

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  description: string;
  validUntil: string | null;
}

export interface StatValue {
  id: string;
  label: string;
  value: number;
  prefix: string;
  suffix: string;
  context: "home" | "about" | "why";
  orderIndex: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  scope: string;
  orderIndex: number;
}

export interface Differentiator {
  icon: string;
  title: string;
  claim: string;
  evidence: string;
}

/* ---------- 3D ---------- */

export interface Hotspot {
  id: string;
  label: string;
  value: string;
  detail: string | null;
  icon: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  anchor: "left" | "right" | "top" | "bottom";
  body: string | null;
  linkUrl: string | null;
  variantKey: string | null;
  orderIndex: number;
}

export interface PcbVariant {
  key: string;
  displayName: string;
  icon: string;
  config: {
    camera?: { position: [number, number, number]; target: [number, number, number]; fov: number };
    materials?: Record<string, { opacity?: number; visible?: boolean; emissiveIntensity?: number }>;
    showHotspots?: string[];
    annotation?: { text: string; position: string };
    autoRotate?: boolean;
  };
  orderIndex: number;
}

export interface PcbModel {
  id: string;
  name: string;
  slug: string;
  /** Storage path to a .glb. Null means render the procedural board. */
  storagePath: string | null;
  poster: MediaRef | null;
  cameraDefault: { position: [number, number, number]; target: [number, number, number]; fov: number };
  cameraLimits: { minPolar: number; maxPolar: number; minZoom: number; maxZoom: number };
  scale: number;
  isHero: boolean;
  hotspots: Hotspot[];
  variants: PcbVariant[];
}

/* ---------- navigation & settings ---------- */

export interface NavItem {
  id: string;
  label: string;
  href: string;
  description: string | null;
  icon: string | null;
  location: "header" | "footer" | "mobile";
  columnGroup: string | null;
  children: NavItem[];
  isExternal: boolean;
  orderIndex: number;
}

export interface SiteSettings {
  hero: {
    eyebrow: string;
    headlineLines: string[];
    accentWord: string;
    subcopy: string;
    ctaPrimary: { label: string; href: string };
    ctaSecondary: { label: string; href: string };
    proofCaption: string;
  };
  copy: {
    processHeading: string;
    ctaBand: { heading: string; body: string; primary: { label: string; href: string }; secondary: { label: string; href: string } };
    sectionHeadings: Record<string, { eyebrow: string; heading: string; intro?: string }>;
    differentiators: Differentiator[];
    comparison: { columns: string[]; rows: { label: string; cells: string[] }[] };
  };
  contact: {
    companyName: string;
    legalName: string;
    email: string;
    salesEmail: string;
    phone: string;
    addressLines: string[];
    hours: { day: string; hours: string }[];
    responsePromise: string;
    geo: { lat: number; lng: number; zoom: number };
  };
  social: { label: string; href: string; icon: string }[];
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
    timezone: string;
  };
  features: {
    pcb3d: boolean;
    newsletter: boolean;
    search: boolean;
    insights: boolean;
  };
}

export interface HomepagePayload {
  settings: SiteSettings;
  services: ServiceSummary[];
  stages: ProcessStage[];
  featuredProjects: ProjectCardData[];
  clients: Client[];
  industries: IndustrySummary[];
  stats: StatValue[];
  testimonial: Testimonial | null;
  posts: PostSummary[];
  heroModel: PcbModel | null;
  teamAvatars: MediaRef[];
}
