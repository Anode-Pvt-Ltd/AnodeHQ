export const TAGS = {
  services: "services", service: (s: string) => `service:${s}`,
  industries: "industries", industry: (s: string) => `industry:${s}`,
  projects: "projects", project: (s: string) => `project:${s}`,
  posts: "posts", post: (s: string) => `post:${s}`,
  topics: "topics", testimonials: "testimonials", clients: "clients",
  team: "team", certifications: "certifications", stats: "stats",
  faqs: "faqs", process: "process", media: "media",
  pcbHero: "pcb:hero", pcb: (s: string) => `pcb:${s}`,
  settings: "settings", nav: "nav",
} as const;

export const ALL_TAGS: string[] = [
  "services", "industries", "projects", "posts", "topics", "testimonials", "clients",
  "team", "certifications", "stats", "faqs", "process", "media", "pcb:hero", "settings", "nav",
];

/** A dynamic tag is valid if it matches one of these prefixes. */
export const TAG_PREFIXES = ["service:", "industry:", "project:", "post:", "pcb:"];

export function isKnownTag(tag: string): boolean {
  return ALL_TAGS.includes(tag) || TAG_PREFIXES.some((p) => tag.startsWith(p) && tag.length > p.length);
}
