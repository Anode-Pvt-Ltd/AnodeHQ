import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { getCertifications, getSettings, getStatsFor, getTestimonials } from "@/lib/queries";
import { CtaBand, PageHero, SectionHeading, StatRow } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { Reveal } from "@/components/primitives/Reveal";
import { Img } from "@/components/media/Img";
import { getIcon } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Why Anode",
  description:
    "Four differentiators, each argued with evidence: measured claims, hardware and firmware in one team, source files as deliverables, and compliance designed in.",
  alternates: { canonical: "/why-anode" },
};

export const revalidate = 3600;

export default async function WhyAnodePage() {
  const [settings, stats, certifications, testimonials] = await Promise.all([
    getSettings(), getStatsFor("why"), getCertifications(), getTestimonials(),
  ]);
  const { differentiators, comparison } = settings.copy;

  return (
    <>
      <PageHero
        eyebrow="Why Anode"
        title="Adjectives are cheap. Here is the evidence."
        intro="Every design consultancy claims rigour. These are the four things clients tell us actually make the difference, each stated as something you could check."
      />

      <Section>
        <StatRow stats={stats} className="mb-14" />
        <ol className="flex flex-col gap-5">
          {differentiators.map((d, i) => {
            const Icon = getIcon(d.icon);
            return (
              <li key={d.title}>
                <Reveal delay={i * 60}>
                  <article className="grid gap-6 rounded-xl border border-border bg-surface p-6 lg:grid-cols-[auto_1fr_1.2fr] lg:items-start lg:gap-10 lg:p-8">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-brand dark:bg-teal-900/50">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h2 className="text-h3 mb-2 text-fg">{d.title}</h2>
                      <p className="text-body-lg font-medium text-brand">{d.claim}</p>
                    </div>
                    <p className="text-body-lg text-fg-muted">{d.evidence}</p>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section tone="subtle" aria-labelledby="comparison">
        <SectionHeading
          id="comparison"
          eyebrow="Honestly compared"
          heading="Against the alternatives."
          intro="There are cases where an in-house hire or a freelancer is the right answer. These are the axes that usually decide it."
        />
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[38rem] border-collapse text-body-sm">
            <caption className="sr-only">
              Comparison of in-house hire, freelance contractor and Anode across seven criteria
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="p-4 text-left text-label font-medium text-fg-subtle">
                  Criterion
                </th>
                {comparison.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={
                      i === comparison.columns.length - 1
                        ? "bg-teal-50 p-4 text-left text-body-sm font-semibold text-brand dark:bg-teal-900/40"
                        : "p-4 text-left text-body-sm font-semibold text-fg"
                    }
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th scope="row" className="p-4 text-left font-medium text-fg">
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td
                      key={i}
                      className={
                        i === row.cells.length - 1
                          ? "bg-teal-50/60 p-4 font-medium text-fg dark:bg-teal-900/25"
                          : "p-4 text-fg-muted"
                      }
                    >
                      <span className="flex items-center gap-2">
                        {cell === "Yes" ? (
                          <Check className="size-4 text-success" aria-hidden />
                        ) : cell === "None" ? (
                          <Minus className="size-4 text-fg-subtle" aria-hidden />
                        ) : null}
                        {cell}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section aria-labelledby="quality">
        <SectionHeading
          id="quality"
          eyebrow="Quality & IP"
          heading="Where you stand, in writing."
          align="left"
        />
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-h4 mb-2 text-fg">You own everything</h3>
            <p className="text-body-sm text-fg-muted">
              All IP created on your project transfers to you on payment. You receive the Altium or
              KiCad source project, firmware repositories, build systems and test procedures — not a
              PDF and a dependency on us.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-h4 mb-2 text-fg">NDA before the first call</h3>
            <p className="text-body-sm text-fg-muted">
              We sign yours rather than insisting on ours. Roughly a third of our work is
              confidential and never appears in a case study, on this site or in a pitch.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-6">
            <h3 className="text-h4 mb-2 text-fg">Accredited systems</h3>
            <ul className="flex flex-col gap-2">
              {certifications.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-body-sm text-fg-muted">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                  <span>
                    <span className="font-medium text-fg">{c.name}</span> — {c.issuer}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section tone="subtle" aria-labelledby="voices">
        <SectionHeading id="voices" eyebrow="In their words" heading="What clients say." align="left" />
        <ul className="grid gap-5 md:grid-cols-2">
          {testimonials.map((t) => (
            <li key={t.id}>
              <figure className="flex h-full flex-col rounded-xl border border-border bg-surface p-6">
                <blockquote className="mb-5 text-body-lg leading-relaxed text-fg-muted">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-auto flex items-center gap-3">
                  {t.avatar && (
                    <Img media={t.avatar} sizes="40px" aspect="1/1" wrapperClassName="size-10 rounded-full" />
                  )}
                  <span className="text-body-sm">
                    <span className="block font-semibold text-fg">{t.authorName}</span>
                    <span className="block text-fg-muted">{t.authorRole}, {t.company}</span>
                  </span>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand settings={settings} tone="deep" />
    </>
  );
}
