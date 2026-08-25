import type { Metadata } from "next";
import { getSettings, getTeam } from "@/lib/queries";
import { CtaBand } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { Container } from "@/components/primitives/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TeamCard } from "@/components/content/Cards";

export const metadata: Metadata = {
  title: "The Team",
  description:
    "The engineers behind Anode — analog and power, high-speed PCB layout, embedded firmware, test and compliance, and manufacturing engineering.",
  alternates: { canonical: "/about/team" },
};

export const revalidate = 3600;

export default async function TeamPage() {
  const [team, settings] = await Promise.all([getTeam(), getSettings()]);

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[{ label: "About", href: "/about" }, { label: "The Team", href: "/about/team" }]}
            />
            <p className="text-label mb-4 text-brand">The team</p>
            <h1 className="text-display-2 max-w-[16ch] text-fg">The people who do the work.</h1>
            <p className="mt-6 max-w-[56ch] text-body-lg text-fg-muted">
              Fourteen engineers in total. These are the leads you will deal with directly — there is
              no account management layer between you and the person holding the soldering iron.
            </p>
          </div>
        </Container>
      </div>

      <Section>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m) => (
            <li key={m.id}>
              <TeamCard member={m} />
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand settings={settings} />
    </>
  );
}
