import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCertifications, getSettings, getStatsFor, getTeam } from "@/lib/queries";
import { CtaBand, PageHero, SectionHeading, StatRow } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { Button } from "@/components/primitives/Button";
import { TeamCard } from "@/components/content/Cards";

export const metadata: Metadata = {
  title: "About Anode",
  description:
    "An electronics design consultancy of fourteen engineers covering analog, power, high-speed PCB, firmware, test and manufacturing — with the lab to prove the work.",
  alternates: { canonical: "/about" },
};

export const revalidate = 3600;

export default async function AboutPage() {
  const [stats, certifications, team, settings] = await Promise.all([
    getStatsFor("about"), getCertifications(), getTeam(), getSettings(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="About"
        title="Engineers who stay until it measures right."
        intro="Anode is an electronics design consultancy. We were founded because too many products were being handed over as a folder of Gerbers and a promise, and someone had to own the gap between a schematic and a product that ships."
      />

      <Section>
        <StatRow stats={stats} className="mb-14" />
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="measure text-body-lg text-fg-muted">
            <h2 className="text-h2 mb-6 text-fg">How we got here</h2>
            <p className="mb-5">
              The company started in 2014 with two engineers, a reflow oven and a conviction that the
              handover between hardware and firmware was where most product schedules quietly died.
              Doing both under one roof was not a business plan so much as an irritation with how the
              alternative worked.
            </p>
            <p className="mb-5">
              Twelve years later that is still the organising idea. Fourteen engineers cover analog
              and power, high-speed and HDI layout, embedded firmware, test and manufacturing
              transfer — and they sit close enough that a routing decision and a peripheral
              assignment get made in the same conversation.
            </p>
            <p>
              We are deliberately not a body shop. We take a bounded number of projects, we write
              down what we measured, and we hand over source files rather than dependencies.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-h2 mb-2 text-fg">What we hold ourselves to</h2>
            {settings.copy.differentiators.map((d) => (
              <div key={d.title} className="rounded-xl border border-border bg-surface p-5">
                <h3 className="text-h4 mb-1.5 text-fg">{d.title}</h3>
                <p className="mb-2 text-body-sm font-medium text-brand">{d.claim}</p>
                <p className="text-body-sm text-fg-muted">{d.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="subtle" aria-labelledby="accreditation">
        <SectionHeading
          id="accreditation"
          eyebrow="Accreditation"
          heading="Certified where it matters."
          intro="Quality and medical device management systems, plus IPC-certified specialists on the layout and inspection side."
        />
        <ul className="grid gap-px overflow-hidden rounded-xl bg-border sm:grid-cols-2 lg:grid-cols-4">
          {certifications.map((c) => (
            <li key={c.id} className="bg-surface p-6">
              <h3 className="font-mono text-[0.9375rem] font-semibold text-fg">{c.name}</h3>
              <p className="mb-3 font-mono text-[0.6875rem] uppercase tracking-wide text-brand">{c.issuer}</p>
              <p className="text-body-sm text-fg-muted">{c.description}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section aria-labelledby="team-preview">
        <SectionHeading
          id="team-preview"
          eyebrow="The team"
          heading="Who you will actually work with."
          intro="No account managers between you and the engineer doing the work."
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {team.slice(0, 3).map((m) => (
            <li key={m.id}>
              <TeamCard member={m} />
            </li>
          ))}
        </ul>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="secondary" icon={ArrowRight}>
            <Link href="/about/team">Meet the whole team</Link>
          </Button>
          <Button asChild variant="ghost" icon={ArrowRight}>
            <Link href="/about/facilities">See the lab</Link>
          </Button>
        </div>
      </Section>

      <CtaBand settings={settings} />
    </>
  );
}
