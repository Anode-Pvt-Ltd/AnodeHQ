import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { Section } from "@/components/primitives/Section";
import { Container } from "@/components/primitives/Container";
import { Button } from "@/components/primitives/Button";
import { Reveal } from "@/components/primitives/Reveal";
import { Img } from "@/components/media/Img";
import { ServiceCard, IndustryCard, PostCard } from "@/components/content/Cards";
import { FeaturedWorkRail } from "@/components/content/FeaturedWorkRail";
import type {
  Client, IndustrySummary, PostSummary, ProcessStage, ProjectCardData, ServiceSummary,
  SiteSettings, StatValue, Testimonial as TestimonialType,
} from "@/types/app";

/* ------------------------------------------------------ section heading */

export function SectionHeading({
  eyebrow, heading, intro, align = "split", className, id,
}: {
  eyebrow?: string;
  heading: string;
  intro?: string;
  align?: "split" | "left" | "center";
  className?: string;
  id?: string;
}) {
  if (align === "split") {
    return (
      <div className={cn("mb-12 grid gap-6 lg:grid-cols-2 lg:gap-16", className)}>
        <div>
          {eyebrow && <p className="text-label mb-4 text-brand">{eyebrow}</p>}
          <h2 id={id} className="text-h2 max-w-[18ch] text-fg">{heading}</h2>
        </div>
        {intro && <p className="max-w-[46ch] self-end text-body-lg text-fg-muted">{intro}</p>}
      </div>
    );
  }
  return (
    <div className={cn("mb-12", align === "center" && "text-center", className)}>
      {eyebrow && <p className="text-label mb-4 text-brand">{eyebrow}</p>}
      <h2 id={id} className={cn("text-h2 text-fg", align === "center" ? "mx-auto max-w-[22ch]" : "max-w-[20ch]")}>
        {heading}
      </h2>
      {intro && (
        <p className={cn("mt-5 text-body-lg text-fg-muted", align === "center" ? "mx-auto max-w-[52ch]" : "max-w-[52ch]")}>
          {intro}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ page hero */

export function PageHero({
  eyebrow, title, intro, children, align = "left",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("bg-bg-subtle pt-[72px]", align === "center" && "text-center")}>
      <Container>
        <div className={cn("py-14 lg:py-20", align === "center" && "mx-auto max-w-3xl")}>
          {eyebrow && <p className="text-label mb-4 text-brand">{eyebrow}</p>}
          <h1 className={cn("text-display-2 text-fg", align === "left" && "max-w-[16ch]")}>{title}</h1>
          {intro && (
            <p className={cn("mt-6 text-body-lg text-fg-muted", align === "left" ? "max-w-[54ch]" : "mx-auto max-w-[54ch]")}>
              {intro}
            </p>
          )}
          {children}
        </div>
      </Container>
    </div>
  );
}

/* --------------------------------------------------------- service grid */

export function ServiceGrid({
  heading, eyebrow, intro, services, columns = 3, tone = "default",
}: {
  heading: string;
  eyebrow?: string;
  intro?: string;
  services: ServiceSummary[];
  columns?: 3 | 5;
  tone?: "default" | "subtle";
}) {
  if (!services.length) return null;
  return (
    <Section tone={tone} aria-labelledby="services-heading">
      <SectionHeading id="services-heading" eyebrow={eyebrow} heading={heading} intro={intro} />
      {/* snap-scroll on small screens, grid from sm up */}
      <ul
        className={cn(
          "snap-rail -mx-5 gap-4 px-5 sm:mx-0 sm:grid sm:overflow-visible sm:px-0",
          columns === 5 ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {services.map((s, i) => (
          <li key={s.slug} className="w-[78vw] max-w-xs sm:w-auto sm:max-w-none">
            <Reveal delay={i * 60} className="h-full">
              <ServiceCard service={s} compact={columns === 5} className="h-full" />
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* --------------------------------------------------------- process band */

export function ProcessBand({ heading, stages }: { heading: string; stages: ProcessStage[] }) {
  if (!stages.length) return null;
  return (
    <section className="section-y bg-bg" aria-labelledby="process-heading">
      <Container>
        <div className="trace-pattern relative overflow-hidden rounded-xl bg-brand p-8 text-white sm:rounded-2xl sm:p-12 lg:p-14">
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,2fr)] lg:gap-14">
            <div>
              <p className="text-label mb-4 text-white/70">Our Process</p>
              <h2 id="process-heading" className="text-h2 whitespace-pre-line text-white">{heading}</h2>
              <Button asChild variant="onBrand" size="sm" icon={ArrowRight} className="mt-6">
                <Link href="/process">How we work</Link>
              </Button>
            </div>

            <ol className="grid gap-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-5">
              {stages.map((stage, i) => {
                const Icon = getIcon(stage.icon);
                return (
                  <li key={stage.id} className="relative">
                    {/* dotted connector between stages */}
                    {i < stages.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-12 right-0 top-6 hidden border-t border-dashed border-white/25 xl:block"
                      />
                    )}
                    <div className="relative flex items-center gap-3">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="tabular font-mono text-[0.6875rem] text-white/55 xl:absolute xl:right-0 xl:top-4">
                        {String(stage.stepNumber).padStart(2, "0")}
                      </span>
                    </div>
                    <h3 className="text-h4 mb-1.5 mt-4 text-white">{stage.title}</h3>
                    <p className="text-body-sm text-white/75">{stage.shortDescription}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* -------------------------------------------------------- featured work */

export function FeaturedWork({
  heading, eyebrow, projects,
}: { heading: string; eyebrow?: string; projects: ProjectCardData[] }) {
  if (!projects.length) return null;
  return (
    <Section tone="subtle" aria-labelledby="work-heading">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.5fr)_minmax(0,2fr)] lg:gap-12">
        <div className="lg:sticky lg:top-28 lg:self-start">
          {eyebrow && <p className="text-label mb-4 text-brand">{eyebrow}</p>}
          <h2 id="work-heading" className="text-h2 max-w-[10ch] text-fg">{heading}</h2>
          <Button asChild variant="secondary" size="md" icon={ArrowRight} className="mt-7">
            <Link href="/projects">View All Projects</Link>
          </Button>
        </div>
        <FeaturedWorkRail projects={projects} />
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------- client logos */

export function ClientLogos({ clients, label }: { clients: Client[]; label: string }) {
  if (!clients.length) return null;
  return (
    <section className="border-y border-border bg-bg py-10" aria-label="Clients">
      <Container>
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-12">
          <p className="text-label shrink-0 text-fg-subtle">{label}</p>
          <ul className="flex flex-1 flex-wrap items-center justify-center gap-x-10 gap-y-6 lg:justify-between">
            {clients.map((c) => {
              const Icon = getIcon(c.logoMark);
              return (
                <li key={c.id}>
                  <span className="flex items-center gap-2 text-fg-muted opacity-65 transition-opacity duration-[var(--dur-base)] hover:opacity-100">
                    <Icon className="size-[1.15rem]" aria-hidden />
                    <span className="font-display text-[1.0625rem] font-semibold tracking-tight">{c.name}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}

/* --------------------------------------------------------- industry grid */

export function IndustryGrid({
  heading, eyebrow, intro, industries, promoteFirstTwo = true,
}: {
  heading: string;
  eyebrow?: string;
  intro?: string;
  industries: IndustrySummary[];
  promoteFirstTwo?: boolean;
}) {
  if (!industries.length) return null;
  return (
    <Section aria-labelledby="industries-heading">
      <SectionHeading id="industries-heading" eyebrow={eyebrow} heading={heading} intro={intro} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {industries.map((ind, i) => (
          <li key={ind.slug} className={cn(promoteFirstTwo && i < 2 && "sm:col-span-2 lg:col-span-2")}>
            <Reveal delay={i * 50} className="h-full">
              <IndustryCard industry={ind} wide={promoteFirstTwo && i < 2} />
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* -------------------------------------------------------------- stat row */

export function StatRow({ stats, className }: { stats: StatValue[]; className?: string }) {
  if (!stats.length) return null;
  return (
    <ul className={cn("grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border lg:grid-cols-4", className)}>
      {stats.map((s) => (
        <li key={s.id} className="bg-surface p-6">
          <p className="tabular font-display text-[clamp(2rem,4vw,2.75rem)] font-bold leading-none tracking-tight text-brand">
            {s.prefix}{s.value.toLocaleString("en-GB")}{s.suffix}
          </p>
          <p className="mt-2.5 text-body-sm text-fg-muted">{s.label}</p>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------- testimonial */

export function TestimonialBlock({ testimonial }: { testimonial: TestimonialType | null }) {
  if (!testimonial) return null;
  return (
    <Section tone="subtle" aria-label="Client testimonial">
      <figure className="mx-auto max-w-3xl text-center">
        <svg viewBox="0 0 32 24" className="mx-auto mb-7 h-7 text-brand" fill="currentColor" aria-hidden>
          <path d="M0 24V13.2C0 5.9 4.2.9 12 0v5.3c-3.6.8-5.6 3-5.6 5.8H12V24H0Zm20 0V13.2C20 5.9 24.2.9 32 0v5.3c-3.6.8-5.6 3-5.6 5.8H32V24H20Z" />
        </svg>
        <blockquote className="text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium leading-snug tracking-tight text-fg">
          {testimonial.quote}
        </blockquote>
        <figcaption className="mt-8 flex items-center justify-center gap-3">
          {testimonial.avatar && (
            <Img
              media={testimonial.avatar}
              sizes="44px"
              aspect="1/1"
              wrapperClassName="size-11 rounded-full"
            />
          )}
          <span className="text-left text-body-sm">
            <span className="block font-semibold text-fg">{testimonial.authorName}</span>
            <span className="block text-fg-muted">
              {testimonial.authorRole}, {testimonial.company}
            </span>
          </span>
        </figcaption>
        {testimonial.projectSlug && (
          <Button asChild variant="link" size="sm" icon={ArrowRight} className="mt-6">
            <Link href={`/projects/${testimonial.projectSlug}`}>Read the case study</Link>
          </Button>
        )}
      </figure>
    </Section>
  );
}

/* ---------------------------------------------------------- insights rail */

export function InsightsRail({
  posts, heading, eyebrow, intro, timezone,
}: { posts: PostSummary[]; heading: string; eyebrow?: string; intro?: string; timezone: string }) {
  // Renders nothing until there are three — never a half-empty band.
  if (posts.length < 3) return null;
  return (
    <Section aria-labelledby="insights-heading">
      <SectionHeading id="insights-heading" eyebrow={eyebrow} heading={heading} intro={intro} />
      <ul className="grid gap-5 md:grid-cols-3">
        {posts.slice(0, 3).map((p, i) => (
          <li key={p.slug}>
            <Reveal delay={i * 70} className="h-full">
              <PostCard post={p} timezone={timezone} />
            </Reveal>
          </li>
        ))}
      </ul>
      <Button asChild variant="secondary" size="md" icon={ArrowRight} className="mt-10">
        <Link href="/insights">All insights</Link>
      </Button>
    </Section>
  );
}

/* ---------------------------------------------------------------- CTA */

export function CtaBand({ settings, tone = "brand" }: { settings: SiteSettings; tone?: "brand" | "deep" }) {
  const cta = settings.copy.ctaBand;
  return (
    <section className="section-y bg-bg" aria-labelledby="cta-heading">
      <Container>
        <div
          className={cn(
            "trace-pattern relative overflow-hidden rounded-xl px-8 py-14 text-center sm:rounded-2xl sm:px-12 lg:py-20",
            tone === "brand" ? "bg-teal-800 text-white" : "bg-teal-900 text-white",
          )}
        >
          <h2 id="cta-heading" className="text-display-2 mx-auto max-w-[18ch] text-white">{cta.heading}</h2>
          {cta.body && <p className="mx-auto mt-6 max-w-[54ch] text-body-lg text-white/80">{cta.body}</p>}
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="onBrandSolid" icon={ArrowRight}>
              <Link href={cta.primary.href}>{cta.primary.label}</Link>
            </Button>
            <Button asChild size="lg" variant="onBrand">
              <Link href={cta.secondary.href}>{cta.secondary.label}</Link>
            </Button>
          </div>
          <p className="mt-7 font-mono text-[0.75rem] text-white/55">{settings.contact.responsePromise}</p>
        </div>
      </Container>
    </section>
  );
}
