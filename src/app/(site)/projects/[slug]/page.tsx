import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lock } from "lucide-react";
import {
  getAdjacentProjects, getProjectBySlug, getProjects, getSettings, getTestimonialForProject,
} from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Button } from "@/components/primitives/Button";
import { Prose } from "@/components/primitives/Prose";
import { Img } from "@/components/media/Img";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand, TestimonialBlock } from "@/components/sections";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getProjectBySlug((await params).slug);
  if (!p) return {};
  return {
    title: p.seoTitle ?? p.title,
    description: p.seoDescription ?? p.summary,
    alternates: { canonical: `/projects/${p.slug}` },
    openGraph: {
      type: "article",
      title: p.seoTitle ?? p.title,
      description: p.seoDescription ?? p.summary,
      url: `/projects/${p.slug}`,
      publishedTime: p.publishedAt ?? undefined,
      modifiedTime: p.updatedAt,
    },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);
  if (!project) notFound();

  const [{ prev, next }, testimonial, settings] = await Promise.all([
    getAdjacentProjects(slug), getTestimonialForProject(slug), getSettings(),
  ]);

  const facts: { label: string; value: string }[] = [
    { label: "Client", value: project.isConfidential ? "Confidential" : (project.clientName ?? "—") },
    { label: "Sector", value: project.industry?.name ?? "—" },
    { label: "Year", value: String(project.year) },
    ...(project.durationWeeks ? [{ label: "Duration", value: `${project.durationWeeks} weeks` }] : []),
    ...(project.boardSpec.layers ? [{ label: "Layers", value: `${project.boardSpec.layers}` }] : []),
    ...(project.boardSpec.sizeMm
      ? [{ label: "Board size", value: `${project.boardSpec.sizeMm[0]} × ${project.boardSpec.sizeMm[1]} mm` }]
      : []),
    ...(project.boardSpec.componentCount
      ? [{ label: "Placements", value: String(project.boardSpec.componentCount) }]
      : []),
    ...(project.boardSpec.ipcClass ? [{ label: "IPC class", value: project.boardSpec.ipcClass }] : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: project.title,
    description: project.summary,
    dateCreated: String(project.year),
    datePublished: project.publishedAt ?? undefined,
    url: absoluteUrl(`/projects/${project.slug}`),
    about: project.industry?.name,
    keywords: project.services.map((s) => s.title).join(", "),
    creator: { "@type": "Organization", name: "Anode", url: absoluteUrl("/") },
  };

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[
                { label: "Work", href: "/projects" },
                { label: project.title, href: `/projects/${project.slug}` },
              ]}
            />
            <div className="mb-4 flex flex-wrap items-center gap-2 text-body-sm text-fg-subtle">
              <span className="tabular">{project.year}</span>
              {project.industry && (
                <>
                  <span aria-hidden>·</span>
                  <Link href={`/industries/${project.industry.slug}`} className="hover:text-brand">
                    {project.industry.name}
                  </Link>
                </>
              )}
              {project.isConfidential && (
                <>
                  <span aria-hidden>·</span>
                  <span className="inline-flex items-center gap-1">
                    <Lock className="size-3.5" aria-hidden /> Confidential client
                  </span>
                </>
              )}
            </div>
            <h1 className="text-display-2 max-w-[18ch] text-fg">{project.title}</h1>
            <p className="mt-5 max-w-[58ch] text-body-lg text-fg-muted">{project.summary}</p>
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {project.services.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/services/${s.slug}`}
                    className="inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors hover:border-brand hover:text-brand"
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </div>

      <Container>
        <div className="-mt-2">
          <Img
            media={project.cover}
            sizes="(max-width: 1280px) 100vw, 1280px"
            aspect="16/9"
            priority
            wrapperClassName="rounded-xl sm:rounded-2xl"
          />
        </div>
      </Container>

      {/* fact strip */}
      <Container>
        <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="bg-surface p-5">
              <dt className="text-label mb-1.5 text-fg-subtle">{f.label}</dt>
              <dd className="tabular text-body-sm font-semibold text-fg">{f.value}</dd>
            </div>
          ))}
        </dl>
        {project.boardSpec.stackup && (
          <p className="mt-3 font-mono text-[0.75rem] text-fg-subtle">
            Stack-up: {project.boardSpec.stackup}
          </p>
        )}
      </Container>

      {/* story */}
      <Section>
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          {[
            { label: "The challenge", body: project.challenge },
            { label: "Our approach", body: project.approach },
            { label: "The outcome", body: project.outcome },
          ]
            .filter((b) => b.body)
            .map((b) => (
              <div key={b.label}>
                <h2 className="text-label mb-4 text-brand">{b.label}</h2>
                <p className="text-body-lg leading-relaxed text-fg-muted">{b.body}</p>
              </div>
            ))}
        </div>
      </Section>

      {project.metrics.length > 0 && (
        <Section tone="subtle" aria-labelledby="metrics">
          <h2 id="metrics" className="text-h2 mb-8 text-fg">Measured outcome</h2>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border lg:grid-cols-4">
            {project.metrics.map((m) => (
              <li key={m.label} className="bg-surface p-6">
                <p className="tabular font-display text-[clamp(1.75rem,3.4vw,2.5rem)] font-bold leading-none tracking-tight text-brand">
                  {m.value}
                  {m.unit && <span className="ml-1 text-[0.5em] font-semibold text-fg-muted">{m.unit}</span>}
                </p>
                <p className="mt-2.5 text-body-sm text-fg-muted">{m.label}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {project.bodyHtml && (
        <Section>
          <Prose html={project.bodyHtml} />
        </Section>
      )}

      {project.gallery.length > 0 && (
        <Section tone="subtle" aria-labelledby="gallery">
          <h2 id="gallery" className="text-h2 mb-8 text-fg">From the bench</h2>
          <ul className="grid gap-5 sm:grid-cols-2">
            {project.gallery.map((g) => (
              <li key={g.media.id}>
                <figure>
                  <Img
                    media={g.media}
                    sizes="(max-width: 640px) 100vw, 50vw"
                    aspect="4/3"
                    wrapperClassName="rounded-xl"
                  />
                  {g.caption && (
                    <figcaption className="mt-3 text-body-sm text-fg-subtle">{g.caption}</figcaption>
                  )}
                </figure>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <TestimonialBlock testimonial={testimonial} />

      {(prev || next) && (
        <Section>
          <nav aria-label="More case studies" className="grid gap-4 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/projects/${prev.slug}`}
                className="group rounded-xl border border-border bg-surface p-6 transition-colors hover:border-brand/40"
              >
                <span className="mb-2 flex items-center gap-1.5 text-label text-fg-subtle">
                  <ArrowLeft className="size-3.5" aria-hidden /> Previous
                </span>
                <span className="text-h4 block text-fg group-hover:text-brand">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/projects/${next.slug}`}
                className="group rounded-xl border border-border bg-surface p-6 text-right transition-colors hover:border-brand/40 sm:col-start-2"
              >
                <span className="mb-2 flex items-center justify-end gap-1.5 text-label text-fg-subtle">
                  Next <ArrowRight className="size-3.5" aria-hidden />
                </span>
                <span className="text-h4 block text-fg group-hover:text-brand">{next.title}</span>
              </Link>
            )}
          </nav>
          <div className="mt-8">
            <Button asChild variant="secondary" icon={ArrowRight}>
              <Link href="/projects">All case studies</Link>
            </Button>
          </div>
        </Section>
      )}

      <CtaBand settings={settings} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
