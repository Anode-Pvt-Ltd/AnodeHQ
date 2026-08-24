import { getHomepage } from "@/lib/queries";
import { Hero } from "@/components/sections/Hero";
import {
  ClientLogos, CtaBand, FeaturedWork, IndustryGrid, InsightsRail, ProcessBand,
  SectionHeading, ServiceGrid, StatRow, TestimonialBlock,
} from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { Reveal } from "@/components/primitives/Reveal";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const revalidate = 3600;

export default async function HomePage() {
  const data = await getHomepage();
  const h = data.settings.copy.sectionHeadings;

  return (
    <>
      <Hero
        settings={data.settings}
        heroModel={data.heroModel}
        stats={data.stats}
        teamAvatars={data.teamAvatars}
      />

      <ServiceGrid
        eyebrow={h.services?.eyebrow}
        heading={h.services?.heading ?? "What we do"}
        intro={h.services?.intro}
        services={data.services}
        columns={5}
      />

      <ProcessBand heading={data.settings.copy.processHeading} stages={data.stages} />

      <FeaturedWork
        eyebrow={h.work?.eyebrow}
        heading={h.work?.heading ?? "Ideas we've brought to life."}
        projects={data.featuredProjects}
      />

      <ClientLogos clients={data.clients} label={h.clients?.eyebrow ?? "Trusted by innovators"} />

      <IndustryGrid
        eyebrow={h.industries?.eyebrow}
        heading={h.industries?.heading ?? "Sectors we build for."}
        intro={h.industries?.intro}
        industries={data.industries}
      />

      {/* Why Anode */}
      <Section tone="subtle" aria-labelledby="why-heading">
        <SectionHeading
          id="why-heading"
          eyebrow={h.why?.eyebrow}
          heading={h.why?.heading ?? "Why Anode"}
          intro={h.why?.intro}
        />
        <StatRow stats={data.stats} className="mb-12" />
        <ul className="grid gap-6 md:grid-cols-3">
          {data.settings.copy.differentiators.slice(0, 3).map((d, i) => {
            const Icon = getIcon(d.icon);
            return (
              <li key={d.title}>
                <Reveal delay={i * 70}>
                  <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-6">
                    <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
                      <Icon className="size-[1.15rem]" aria-hidden />
                    </span>
                    <h3 className="text-h4 mb-2 text-fg">{d.title}</h3>
                    <p className="mb-3 text-body-sm font-medium text-brand">{d.claim}</p>
                    <p className="text-body-sm text-fg-muted">{d.evidence}</p>
                  </div>
                </Reveal>
              </li>
            );
          })}
        </ul>
        <Button asChild variant="secondary" size="md" icon={ArrowRight} className="mt-10">
          <Link href="/why-anode">The full argument</Link>
        </Button>
      </Section>

      <TestimonialBlock testimonial={data.testimonial} />

      {data.settings.features.insights && (
        <InsightsRail
          posts={data.posts}
          eyebrow={h.insights?.eyebrow}
          heading={h.insights?.heading ?? "Notes from the bench."}
          intro={h.insights?.intro}
          timezone={data.settings.seo.timezone}
        />
      )}

      <CtaBand settings={data.settings} />
    </>
  );
}
