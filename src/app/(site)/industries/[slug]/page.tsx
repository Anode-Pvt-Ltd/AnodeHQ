import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  getIndustries, getIndustryBySlug, getProjectsByIndustry, getServiceSummaries,
  getSettings, getTestimonialForIndustry,
} from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Button } from "@/components/primitives/Button";
import { Prose } from "@/components/primitives/Prose";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProjectCard, ServiceCard } from "@/components/content/Cards";
import { CtaBand, SectionHeading, TestimonialBlock } from "@/components/sections";
import { getIcon } from "@/lib/icons";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getIndustries()).map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i = await getIndustryBySlug((await params).slug);
  if (!i) return {};
  return {
    title: i.seoTitle ?? `${i.name} Electronics Design`,
    description: i.seoDescription ?? i.summary,
    alternates: { canonical: `/industries/${i.slug}` },
    openGraph: { title: i.seoTitle ?? i.name, description: i.seoDescription ?? i.summary, url: `/industries/${i.slug}` },
  };
}

export default async function IndustryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const industry = await getIndustryBySlug(slug);
  if (!industry) notFound();

  const [projects, allServices, testimonial, settings] = await Promise.all([
    getProjectsByIndustry(slug, 6), getServiceSummaries(), getTestimonialForIndustry(slug), getSettings(),
  ]);
  const services = allServices.filter((s) => industry.serviceSlugs.includes(s.slug));
  const Icon = getIcon(industry.icon);

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[
                { label: "Industries", href: "/industries" },
                { label: industry.name, href: `/industries/${industry.slug}` },
              ]}
            />
            <span className="mb-6 inline-flex size-12 items-center justify-center rounded-xl bg-teal-50 text-brand dark:bg-teal-900/50">
              <Icon className="size-6" aria-hidden />
            </span>
            <h1 className="text-display-2 max-w-[15ch] text-fg">{industry.name}</h1>
            <p className="mt-5 max-w-[56ch] text-body-lg text-fg-muted">{industry.summary}</p>
            <div className="mt-8">
              <Button asChild size="lg" icon={ArrowRight}>
                <Link href="/quote">Discuss a {industry.name.toLowerCase()} project</Link>
              </Button>
            </div>
          </div>
        </Container>
      </div>

      {industry.standards.length > 0 && (
        <section className="border-b border-border bg-bg py-8">
          <Container>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
              <p className="text-label shrink-0 text-fg-subtle">Standards we design to</p>
              <ul className="flex flex-wrap gap-2">
                {industry.standards.map((s) => (
                  <li
                    key={s}
                    className="rounded-md border border-border bg-surface px-2.5 py-1 font-mono text-[0.75rem] text-fg-muted"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>
      )}

      {industry.bodyHtml && (
        <Section>
          <Prose html={industry.bodyHtml} />
        </Section>
      )}

      {services.length > 0 && (
        <Section tone="subtle" aria-labelledby="ind-services">
          <SectionHeading
            id="ind-services"
            eyebrow="Capabilities"
            heading={`What matters most in ${industry.name.toLowerCase()}.`}
            align="left"
          />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <li key={s.slug}>
                <ServiceCard service={s} compact />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {projects.length > 0 && (
        <Section aria-labelledby="ind-work">
          <SectionHeading id="ind-work" eyebrow="Case studies" heading="Work in this sector." align="left" />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.slug}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <TestimonialBlock testimonial={testimonial} />
      <CtaBand settings={settings} />
    </>
  );
}
