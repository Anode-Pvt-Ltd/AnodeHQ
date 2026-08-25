import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
// Public reads use the session-less client: these functions run inside
// unstable_cache(), which cannot touch cookies(), and a cached public page
// must not vary by visitor anyway.
import { createPublicClient } from "@/lib/supabase/public";
import { QueryError } from "@/lib/errors";
import * as seed from "@/content";
import type {
  Certification, Client, Faq, HomepagePayload, Industry, IndustrySummary, PcbModel, Post,
  PostSummary, ProcessStage, Project, ProjectCardData, Service, ServiceSummary, SiteSettings,
  StatValue, TeamMember, Testimonial, NavItem,
} from "@/types/app";

/**
 * Read layer — spec §2.6.
 *
 * Each function resolves from Supabase when it is configured and from the typed
 * seed dataset otherwise. Components see the same domain types either way, so
 * connecting a database is a configuration change, not a code change.
 */

const isLive = () => isSupabaseConfigured;

/**
 * PostgREST / Postgres codes that mean "the schema has not been applied yet"
 * rather than "this query is wrong":
 *   PGRST205 unknown table · PGRST202 unknown function
 *   42P01 undefined_table  · 42883 undefined_function
 *
 * In that one case we fall back to the seed dataset and warn loudly, so a
 * half-configured project still builds instead of failing on every page. Any
 * other error throws — a genuine query fault must never be masked.
 */
const SCHEMA_MISSING = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

let warned = false;
function schemaMissing(error: { code?: string } | null | undefined): boolean {
  if (!error?.code || !SCHEMA_MISSING.has(error.code)) return false;
  if (!warned) {
    warned = true;
    console.warn(
      [
        "",
        "[anode] Supabase is configured but the schema has not been applied.",
        "        Serving seed content instead.",
        "        Fix: run supabase/apply-all.sql against the project, then rebuild.",
        "",
      ].join("\n"),
    );
  }
  return true;
}

const toSummary = (s: Service): ServiceSummary => ({
  slug: s.slug, title: s.title, summary: s.summary, icon: s.icon,
});

const publishedOnly = <T extends { status: string; publishedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.status === "published" && r.publishedAt && new Date(r.publishedAt) <= new Date());

/* ------------------------------------------------------------- settings */

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    if (!isLive()) return seed.settings;
    const sb = createPublicClient();
    if (!sb) return seed.settings;
    const { data, error } = await sb.from("site_settings").select("key, value, group_name");
    if (error) { if (schemaMissing(error)) return seed.settings; throw new QueryError("site_settings", error); }
    if (!data?.length) return seed.settings;
    return mapSettings(data as { key: string; value: unknown }[]);
  },
  ["settings"],
  { tags: [TAGS.settings], revalidate: 3600 },
);

/**
 * site_settings is a key/value table using snake_case keys; SiteSettings is a
 * camelCase domain type. Map every field explicitly rather than spreading the
 * rows — a blind spread replaces whole groups with the wrong shape and the
 * mismatch only surfaces at render, as `undefined.map is not a function`.
 *
 * Any key absent from the database falls back to the seed value, so a
 * partially-populated table still renders a complete site.
 */
function mapSettings(rows: { key: string; value: unknown }[]): SiteSettings {
  const v = new Map(rows.map((r) => [r.key, r.value]));
  const pick = <T,>(key: string, fallback: T): T => (v.has(key) ? (v.get(key) as T) : fallback);
  const s = seed.settings;

  return {
    hero: {
      eyebrow: pick("hero.eyebrow", s.hero.eyebrow),
      headlineLines: pick("hero.headline_lines", s.hero.headlineLines),
      accentWord: pick("hero.accent_word", s.hero.accentWord),
      subcopy: pick("hero.subcopy", s.hero.subcopy),
      ctaPrimary: pick("hero.cta_primary", s.hero.ctaPrimary),
      ctaSecondary: pick("hero.cta_secondary", s.hero.ctaSecondary),
      proofCaption: pick("hero.proof_caption", s.hero.proofCaption),
    },
    copy: {
      processHeading: pick("copy.process_heading", s.copy.processHeading),
      sectionHeadings: pick("copy.section_headings", s.copy.sectionHeadings),
      ctaBand: pick("copy.cta_band", s.copy.ctaBand),
      differentiators: pick("copy.differentiators", s.copy.differentiators),
      comparison: pick("copy.comparison", s.copy.comparison),
    },
    contact: {
      companyName: pick("contact.company_name", s.contact.companyName),
      legalName: pick("contact.legal_name", s.contact.legalName),
      email: pick("contact.email", s.contact.email),
      salesEmail: pick("contact.sales_email", s.contact.salesEmail),
      phone: pick("contact.phone", s.contact.phone),
      addressLines: pick("contact.address_lines", s.contact.addressLines),
      hours: pick("contact.hours", s.contact.hours),
      responsePromise: pick("contact.response_promise", s.contact.responsePromise),
      geo: pick("contact.geo", s.contact.geo),
    },
    social: pick("social.links", s.social),
    seo: {
      titleTemplate: pick("seo.title_template", s.seo.titleTemplate),
      defaultTitle: pick("seo.default_title", s.seo.defaultTitle),
      description: pick("seo.description", s.seo.description),
      timezone: pick("seo.timezone", s.seo.timezone),
    },
    // The features group is staff-only, so the anon key never sees it —
    // fall back to the seed flags rather than disabling every feature.
    features: pick("features.flags", s.features),
  };
}

export const getNavigation = unstable_cache(
  async (): Promise<{ header: NavItem[]; footer: NavItem[] }> => {
    if (!isLive()) return { header: seed.navigation, footer: seed.footerNavigation };
    const sb = createPublicClient();
    if (!sb) return { header: seed.navigation, footer: seed.footerNavigation };
    const { data, error } = await sb
      .from("navigation_items")
      .select("id, parent_id, label, href, description, icon, location, column_group, order_index, is_external, is_active")
      .eq("is_active", true)
      .order("order_index");
    if (error) { if (schemaMissing(error)) return { header: seed.navigation, footer: seed.footerNavigation }; throw new QueryError("navigation_items", error); }
    if (!data?.length) return { header: seed.navigation, footer: seed.footerNavigation };

    const map = new Map<string, NavItem>();
    for (const r of data) {
      map.set(r.id as string, {
        id: r.id as string, label: r.label as string, href: r.href as string,
        description: (r.description as string) ?? null, icon: (r.icon as string) ?? null,
        location: r.location as NavItem["location"], columnGroup: (r.column_group as string) ?? null,
        children: [], isExternal: Boolean(r.is_external), orderIndex: Number(r.order_index),
      });
    }
    const roots: NavItem[] = [];
    for (const r of data) {
      const node = map.get(r.id as string)!;
      const parent = r.parent_id ? map.get(r.parent_id as string) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return {
      header: roots.filter((r) => r.location === "header"),
      footer: roots.filter((r) => r.location === "footer"),
    };
  },
  ["navigation"],
  { tags: [TAGS.nav], revalidate: 3600 },
);

/**
 * Navigation that cannot go stale.
 *
 * `navigation_items` stores the menu structure, but its child rows for Services
 * and Industries duplicated content that lives elsewhere — so deleting an
 * industry left a menu entry pointing at a 404, and adding one never appeared.
 * Those two branches are now DERIVED from the published content on every read;
 * the stored rows still supply structure, labels and ordering for everything
 * else.
 *
 * Any remaining stored link is checked against the content that backs it, so a
 * deleted service or article can never survive in a menu either.
 */
export async function getResolvedNavigation(): Promise<{ header: NavItem[]; footer: NavItem[] }> {
  const [nav, services, industries] = await Promise.all([
    getNavigation(), getServices(), getIndustries(),
  ]);

  const serviceChildren: NavItem[] = services.map((s, i) => ({
    id: `svc-${s.slug}`,
    label: s.title,
    href: `/services/${s.slug}`,
    description: s.summary,
    icon: s.icon,
    location: "header",
    columnGroup: null,
    children: [],
    isExternal: false,
    orderIndex: i + 1,
  }));

  const industryChildren: NavItem[] = industries.map((n, i) => ({
    id: `ind-${n.slug}`,
    label: n.name,
    href: `/industries/${n.slug}`,
    description: null,
    icon: n.icon,
    location: "header",
    columnGroup: null,
    children: [],
    isExternal: false,
    orderIndex: i + 1,
  }));

  // Every path the menus are allowed to point at, for the leaf check below.
  const live = new Set<string>([
    ...services.map((s) => `/services/${s.slug}`),
    ...industries.map((n) => `/industries/${n.slug}`),
  ]);
  const isDeadContentLink = (href: string) =>
    (href.startsWith("/services/") || href.startsWith("/industries/") || href.startsWith("/insights/")) &&
    !live.has(href);

  const resolve = (items: NavItem[]): NavItem[] =>
    items
      .filter((item) => !isDeadContentLink(item.href))
      .map((item) => {
        if (item.href === "/services") return { ...item, children: serviceChildren };
        if (item.href === "/industries") return { ...item, children: industryChildren };
        return { ...item, children: resolve(item.children) };
      });

  return { header: resolve(nav.header), footer: resolve(nav.footer) };
}

/* ------------------------------------------------------------- services */

export const getServices = unstable_cache(
  async (): Promise<Service[]> => {
    if (!isLive()) return publishedOnly(seed.services).sort((a, b) => a.orderIndex - b.orderIndex);
    const sb = createPublicClient();
    if (!sb) return publishedOnly(seed.services);
    const { data, error } = await sb
      .from("services")
      .select("id, slug, title, tagline, summary, body_html, icon, order_index, status, published_at, updated_at, seo_title, seo_description")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("order_index");
    if (error) { if (schemaMissing(error)) return publishedOnly(seed.services); throw new QueryError("services.list", error); }
    return (data ?? []).map(mapService);
  },
  ["services:list"],
  { tags: [TAGS.services], revalidate: 3600 },
);

export async function getServiceSummaries(): Promise<ServiceSummary[]> {
  return (await getServices()).map(toSummary);
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  if (!isLive()) return seed.serviceBySlug(slug) ?? null;
  return (await getServices()).find((s) => s.slug === slug) ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapService(r: any): Service {
  const fallback = seed.serviceBySlug(r.slug);
  return {
    id: r.id, slug: r.slug, title: r.title, tagline: r.tagline ?? "", summary: r.summary,
    icon: r.icon ?? "cpu", bodyHtml: r.body_html ?? "", heroImage: fallback?.heroImage ?? null,
    features: fallback?.features ?? [], deliverables: fallback?.deliverables ?? [],
    tooling: fallback?.tooling ?? [], orderIndex: r.order_index ?? 0, status: r.status,
    publishedAt: r.published_at, updatedAt: r.updated_at,
    seoTitle: r.seo_title ?? null, seoDescription: r.seo_description ?? null,
  };
}

/* ----------------------------------------------------------- industries */

export const getIndustries = unstable_cache(
  async (): Promise<Industry[]> => {
    if (!isLive()) return publishedOnly(seed.industries).sort((a, b) => a.orderIndex - b.orderIndex);
    const sb = createPublicClient();
    if (!sb) return publishedOnly(seed.industries);
    const { data, error } = await sb.rpc("industries_with_counts");
    if (error) { if (schemaMissing(error)) return publishedOnly(seed.industries); throw new QueryError("industries_with_counts", error); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => {
      const fb = seed.industryBySlug(r.slug);
      return {
        ...(fb ?? ({} as Industry)),
        id: r.id, slug: r.slug, name: r.name, summary: r.summary,
        icon: r.icon ?? "factory", projectCount: Number(r.project_count ?? 0),
        standards: r.standards ?? fb?.standards ?? [],
        orderIndex: r.order_index ?? 0, status: r.status, publishedAt: r.published_at,
      } as Industry;
    });
  },
  ["industries:list"],
  { tags: [TAGS.industries, TAGS.projects], revalidate: 3600 },
);

export async function getIndustrySummaries(): Promise<IndustrySummary[]> {
  return (await getIndustries()).map((i) => ({
    slug: i.slug, name: i.name, summary: i.summary, icon: i.icon, projectCount: i.projectCount,
  }));
}

export async function getIndustryBySlug(slug: string): Promise<Industry | null> {
  if (!isLive()) return seed.industryBySlug(slug) ?? null;
  return (await getIndustries()).find((i) => i.slug === slug) ?? null;
}

/* ------------------------------------------------------------- projects */

export const getProjects = unstable_cache(
  async (): Promise<Project[]> => {
    if (!isLive()) return publishedOnly(seed.projects).sort((a, b) => a.orderIndex - b.orderIndex);
    const sb = createPublicClient();
    if (!sb) return publishedOnly(seed.projects);
    const { data, error } = await sb
      .from("projects")
      .select("id, slug, title, summary, year, client_name, is_confidential, featured, order_index, status, published_at, updated_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("order_index");
    if (error) { if (schemaMissing(error)) return publishedOnly(seed.projects); throw new QueryError("projects.list", error); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({ ...(seed.projectBySlug(r.slug) ?? ({} as Project)), ...r })) as Project[];
  },
  ["projects:list"],
  { tags: [TAGS.projects], revalidate: 3600 },
);

export async function getProjectCards(): Promise<ProjectCardData[]> {
  return (await getProjects()).map(toProjectCard);
}

export function toProjectCard(p: Project): ProjectCardData {
  return {
    slug: p.slug, title: p.title, summary: p.summary, year: p.year,
    clientName: p.isConfidential ? null : p.clientName, isConfidential: p.isConfidential,
    cover: p.cover, industry: p.industry, services: p.services,
  };
}

export async function getFeaturedProjects(limit = 8): Promise<ProjectCardData[]> {
  return (await getProjects()).filter((p) => p.featured).slice(0, limit).map(toProjectCard);
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  return (await getProjects()).find((p) => p.slug === slug) ?? null;
}

export async function getProjectsByService(slug: string, limit = 3): Promise<ProjectCardData[]> {
  return (await getProjects())
    .filter((p) => p.services.some((s) => s.slug === slug))
    .slice(0, limit)
    .map(toProjectCard);
}

export async function getProjectsByIndustry(slug: string, limit = 6): Promise<ProjectCardData[]> {
  return (await getProjects())
    .filter((p) => p.industry?.slug === slug)
    .slice(0, limit)
    .map(toProjectCard);
}

export async function getAdjacentProjects(slug: string) {
  const all = await getProjects();
  const i = all.findIndex((p) => p.slug === slug);
  return {
    prev: i > 0 ? toProjectCard(all[i - 1]!) : null,
    next: i >= 0 && i < all.length - 1 ? toProjectCard(all[i + 1]!) : null,
  };
}

/* ---------------------------------------------------------------- posts */

export const getPosts = unstable_cache(
  async (): Promise<Post[]> => {
    if (!isLive()) {
      return seed.posts
        .filter((p) => p.status === "published" && new Date(p.publishedAt) <= new Date())
        .sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
    }
    const sb = createPublicClient();
    if (!sb) return seed.posts;
    const { data, error } = await sb
      .from("posts")
      .select("id, slug, title, excerpt, body_html, read_minutes, status, published_at, updated_at, seo_title, seo_description")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (error) { if (schemaMissing(error)) return seed.posts.filter((x) => x.status === "published"); throw new QueryError("posts.list", error); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((r: any) => ({ ...(seed.postBySlug(r.slug) ?? ({} as Post)), ...r })) as Post[];
  },
  ["posts:list"],
  { tags: [TAGS.posts], revalidate: 3600 },
);

export async function getPostSummaries(limit?: number): Promise<PostSummary[]> {
  const all = (await getPosts()).map(
    ({ slug, title, excerpt, cover, topic, readMinutes, publishedAt }): PostSummary => ({
      slug, title, excerpt, cover, topic, readMinutes, publishedAt,
    }),
  );
  return limit ? all.slice(0, limit) : all;
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  return (await getPosts()).find((p) => p.slug === slug) ?? null;
}

export async function getPostsByTopic(topicSlug: string): Promise<PostSummary[]> {
  return (await getPostSummaries()).filter((p) => p.topic?.slug === topicSlug);
}

export async function getRelatedPosts(slug: string, limit = 3): Promise<PostSummary[]> {
  const all = await getPostSummaries();
  const current = all.find((p) => p.slug === slug);
  const sameTopic = all.filter((p) => p.slug !== slug && p.topic?.slug === current?.topic?.slug);
  const rest = all.filter((p) => p.slug !== slug && !sameTopic.includes(p));
  return [...sameTopic, ...rest].slice(0, limit);
}

export async function getTopics() {
  return seed.topics;
}

/* --------------------------------------------------- supporting content */

export const getProcessStages = unstable_cache(
  async (): Promise<ProcessStage[]> => seed.processStages,
  ["process"], { tags: [TAGS.process], revalidate: 3600 },
);

export const getTeam = unstable_cache(
  async (): Promise<TeamMember[]> => [...seed.team].sort((a, b) => a.orderIndex - b.orderIndex),
  ["team"], { tags: [TAGS.team], revalidate: 3600 },
);

export const getTestimonials = unstable_cache(
  async (): Promise<Testimonial[]> => seed.testimonials,
  ["testimonials"], { tags: [TAGS.testimonials], revalidate: 3600 },
);

export async function getFeaturedTestimonial(): Promise<Testimonial | null> {
  return (await getTestimonials()).find((t) => t.featured) ?? null;
}

export async function getTestimonialForIndustry(slug: string): Promise<Testimonial | null> {
  return (await getTestimonials()).find((t) => t.industrySlug === slug) ?? null;
}

export async function getTestimonialForProject(slug: string): Promise<Testimonial | null> {
  return (await getTestimonials()).find((t) => t.projectSlug === slug) ?? null;
}

export const getClients = unstable_cache(
  async (): Promise<Client[]> => [...seed.clients].sort((a, b) => a.orderIndex - b.orderIndex),
  ["clients"], { tags: [TAGS.clients], revalidate: 3600 },
);

export const getCertifications = unstable_cache(
  async (): Promise<Certification[]> => seed.certifications,
  ["certifications"], { tags: [TAGS.certifications], revalidate: 3600 },
);

export const getStats = unstable_cache(
  async (): Promise<StatValue[]> => seed.stats,
  ["stats"], { tags: [TAGS.stats], revalidate: 3600 },
);

export async function getStatsFor(context: StatValue["context"]): Promise<StatValue[]> {
  return (await getStats()).filter((s) => s.context === context).sort((a, b) => a.orderIndex - b.orderIndex);
}

export const getFaqs = unstable_cache(
  async (scope: string): Promise<Faq[]> =>
    seed.faqs.filter((f) => f.scope === scope).sort((a, b) => a.orderIndex - b.orderIndex),
  ["faqs"], { tags: [TAGS.faqs], revalidate: 3600 },
);

/* ------------------------------------------------------------------ 3D */

export const getHeroModel = unstable_cache(
  async (): Promise<PcbModel | null> => {
    const s = await getSettings();
    if (!s.features.pcb3d) return null;
    return seed.heroModel;
  },
  ["pcb:hero"], { tags: [TAGS.pcbHero, TAGS.settings], revalidate: 3600 },
);

/* ----------------------------------------------------------- homepage */

export async function getHomepage(): Promise<HomepagePayload> {
  const [
    settings, services, stages, featuredProjects, clients, industries, stats, testimonial, posts, heroModel, team,
  ] = await Promise.all([
    getSettings(), getServiceSummaries(), getProcessStages(), getFeaturedProjects(6), getClients(),
    getIndustrySummaries(), getStatsFor("home"), getFeaturedTestimonial(), getPostSummaries(3),
    getHeroModel(), getTeam(),
  ]);

  return {
    settings,
    services: services.slice(0, 5),
    stages,
    featuredProjects,
    clients: clients.filter((c) => c.featured).slice(0, 6),
    industries,
    stats,
    testimonial,
    posts,
    heroModel,
    teamAvatars: team.slice(0, 4).map((t) => t.photo).filter((m): m is NonNullable<typeof m> => Boolean(m)),
  };
}

/* -------------------------------------------------------------- search */

export interface SearchResult {
  kind: "service" | "project" | "post" | "industry";
  slug: string;
  href: string;
  title: string;
  excerpt: string;
}

export async function searchAll(q: string, limit = 20): Promise<SearchResult[]> {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const [services, projects, posts, industries] = await Promise.all([
    getServices(), getProjects(), getPosts(), getIndustries(),
  ]);
  const hit = (hay: string) => hay.toLowerCase().includes(term);
  const out: SearchResult[] = [];

  for (const s of services) {
    if (hit(s.title) || hit(s.summary) || hit(s.bodyHtml) || hit(s.tagline)) {
      out.push({ kind: "service", slug: s.slug, href: `/services/${s.slug}`, title: s.title, excerpt: s.summary });
    }
  }
  for (const i of industries) {
    if (hit(i.name) || hit(i.summary) || hit(i.bodyHtml) || i.standards.some(hit)) {
      out.push({ kind: "industry", slug: i.slug, href: `/industries/${i.slug}`, title: i.name, excerpt: i.summary });
    }
  }
  for (const p of projects) {
    if (hit(p.title) || hit(p.summary) || hit(p.challenge) || hit(p.approach) || hit(p.outcome)) {
      out.push({ kind: "project", slug: p.slug, href: `/projects/${p.slug}`, title: p.title, excerpt: p.summary });
    }
  }
  for (const p of posts) {
    if (hit(p.title) || hit(p.excerpt) || hit(p.bodyHtml)) {
      out.push({ kind: "post", slug: p.slug, href: `/insights/${p.slug}`, title: p.title, excerpt: p.excerpt });
    }
  }
  return out.slice(0, limit);
}
