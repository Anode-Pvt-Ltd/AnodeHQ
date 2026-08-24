import "server-only";
import { unstable_cache } from "next/cache";
import { TAGS } from "@/lib/cache";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
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

const toSummary = (s: Service): ServiceSummary => ({
  slug: s.slug, title: s.title, summary: s.summary, icon: s.icon,
});

const publishedOnly = <T extends { status: string; publishedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.status === "published" && r.publishedAt && new Date(r.publishedAt) <= new Date());

/* ------------------------------------------------------------- settings */

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    if (!isLive()) return seed.settings;
    const sb = await createClient();
    if (!sb) return seed.settings;
    const { data, error } = await sb.from("site_settings").select("key, value, group_name");
    if (error) throw new QueryError("site_settings", error);
    if (!data?.length) return seed.settings;
    const merged: Record<string, unknown> = {};
    for (const row of data) {
      const [group, ...rest] = String(row.key).split(".");
      if (!group) continue;
      if (rest.length === 0) merged[group] = row.value;
      else {
        const g = (merged[group] ??= {}) as Record<string, unknown>;
        g[rest.join(".")] = row.value;
      }
    }
    return { ...seed.settings, ...(merged as Partial<SiteSettings>) } as SiteSettings;
  },
  ["settings"],
  { tags: [TAGS.settings], revalidate: 3600 },
);

export const getNavigation = unstable_cache(
  async (): Promise<{ header: NavItem[]; footer: NavItem[] }> => {
    if (!isLive()) return { header: seed.navigation, footer: seed.footerNavigation };
    const sb = await createClient();
    if (!sb) return { header: seed.navigation, footer: seed.footerNavigation };
    const { data, error } = await sb
      .from("navigation_items")
      .select("id, parent_id, label, href, description, icon, location, column_group, order_index, is_external, is_active")
      .eq("is_active", true)
      .order("order_index");
    if (error) throw new QueryError("navigation_items", error);
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

/* ------------------------------------------------------------- services */

export const getServices = unstable_cache(
  async (): Promise<Service[]> => {
    if (!isLive()) return publishedOnly(seed.services).sort((a, b) => a.orderIndex - b.orderIndex);
    const sb = await createClient();
    if (!sb) return publishedOnly(seed.services);
    const { data, error } = await sb
      .from("services")
      .select("id, slug, title, tagline, summary, body_html, icon, order_index, status, published_at, updated_at, seo_title, seo_description")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("order_index");
    if (error) throw new QueryError("services.list", error);
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
    const sb = await createClient();
    if (!sb) return publishedOnly(seed.industries);
    const { data, error } = await sb.rpc("industries_with_counts");
    if (error) throw new QueryError("industries_with_counts", error);
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
    const sb = await createClient();
    if (!sb) return publishedOnly(seed.projects);
    const { data, error } = await sb
      .from("projects")
      .select("id, slug, title, summary, year, client_name, is_confidential, featured, order_index, status, published_at, updated_at")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("order_index");
    if (error) throw new QueryError("projects.list", error);
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
    const sb = await createClient();
    if (!sb) return seed.posts;
    const { data, error } = await sb
      .from("posts")
      .select("id, slug, title, excerpt, body_html, read_minutes, status, published_at, updated_at, seo_title, seo_description")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false });
    if (error) throw new QueryError("posts.list", error);
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
