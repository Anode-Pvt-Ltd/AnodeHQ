import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import {
  getFaqs, getProjectsByService, getServiceBySlug, getServiceSummaries, getServices, getSettings,
} from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Button } from "@/components/primitives/Button";
import { Prose } from "@/components/primitives/Prose";
import { Reveal } from "@/components/primitives/Reveal";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FaqAccordion } from "@/components/content/FaqAccordion";
import { ProjectCard, ServiceCard } from "@/components/content/Cards";
import { CtaBand, SectionHeading } from "@/components/sections";
import { getIcon } from "@/lib/icons";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getServices()).map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const s = await getServiceBySlug((await params).slug);
  if (!s) return {};
  return {
    title: s.seoTitle ?? s.title,
    description: s.seoDescription ?? s.summary,
    alternates: { canonical: `/services/${s.slug}` },
    openGraph: { title: s.seoTitle ?? s.title, description: s.seoDescription ?? s.summary, url: `/services/${s.slug}` },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const [projects, allServices, scopedFaqs, generalFaqs, settings] = await Promise.all([
    getProjectsByService(slug, 3), getServiceSummaries(), getFaqs(slug), getFaqs("services"), getSettings(),
  ]);
  const related = allServices.filter((s) => s.slug !== slug).slice(0, 3);
  const faqs = scopedFaqs.length ? scopedFaqs : generalFaqs;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.summary,
    serviceType: service.title,
    provider: { "@type": "Organization", name: "Anode", url: absoluteUrl("/") },
    areaServed: "Worldwide",
    url: absoluteUrl(`/services/${service.slug}`),
  };

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[
                { label: "Services", href: "/services" },
                { label: service.title, href: `/services/${service.slug}` },
              ]}
            />
            <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
              <div>
                <h1 className="text-display-2 max-w-[15ch] text-fg">{service.title}</h1>
                <p className="mt-5 max-w-[52ch] text-body-lg text-fg-muted">{service.tagline}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild size="lg" icon={ArrowRight}>
                    <Link href="/quote">Request a Quote</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/projects">See related work</Link>
                  </Button>
                </div>
              </div>

              {service.deliverables.length > 0 && (
                <div className="rounded-xl border border-border bg-surface p-6">
                  <h2 className="text-label mb-4 text-fg-subtle">What you receive</h2>
                  <ul className="flex flex-col gap-2.5">
                    {service.deliverables.map((d) => (
                      <li key={d} className="flex items-start gap-2.5 text-body-sm text-fg-muted">
                        <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Container>
      </div>

      {service.features.length > 0 && (
        <Section aria-labelledby="capabilities">
          <SectionHeading id="capabilities" eyebrow="Capabilities" heading="How we approach it." align="left" />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {service.features.map((f, i) => {
              const Icon = getIcon(f.icon);
              return (
                <li key={f.id}>
                  <Reveal delay={i * 50} className="h-full">
                    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-6">
                      <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
                        <Icon className="size-[1.15rem]" aria-hidden />
                      </span>
                      <h3 className="text-h4 mb-2 text-fg">{f.title}</h3>
                      <p className="text-body-sm text-fg-muted">{f.description}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {service.bodyHtml && (
        <Section tone="subtle">
          <Prose html={service.bodyHtml} />
        </Section>
      )}

      {service.tooling.length > 0 && (
        <Section aria-labelledby="tooling">
          <SectionHeading id="tooling" eyebrow="Tooling &amp; standards" heading="What we work with." align="left" />
          <dl className="grid gap-px overflow-hidden rounded-xl bg-border md:grid-cols-3">
            {service.tooling.map((t) => (
              <div key={t.label} className="bg-surface p-6">
                <dt className="text-label mb-4 text-fg-subtle">{t.label}</dt>
                <dd>
                  <ul className="flex flex-wrap gap-1.5">
                    {t.items.map((item) => (
                      <li key={item} className="rounded-md bg-bg-subtle px-2.5 py-1 font-mono text-[0.75rem] text-fg-muted">
                        {item}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {projects.length > 0 && (
        <Section tone="subtle" aria-labelledby="related-work">
          <SectionHeading id="related-work" eyebrow="Related work" heading="Where we have applied it." align="left" />
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <li key={p.slug}>
                <ProjectCard project={p} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {related.length > 0 && (
        <Section aria-labelledby="adjacent">
          <SectionHeading id="adjacent" eyebrow="Adjacent services" heading="Often needed alongside." align="left" />
          <ul className="grid gap-5 md:grid-cols-3">
            {related.map((s) => (
              <li key={s.slug}>
                <ServiceCard service={s} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section tone="subtle">
        <FaqAccordion faqs={faqs} />
      </Section>

      <CtaBand settings={settings} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
