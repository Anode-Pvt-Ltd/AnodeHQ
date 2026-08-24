import type { Metadata } from "next";
import { Suspense } from "react";
import { getIndustrySummaries, getProjectCards, getServiceSummaries, getSettings } from "@/lib/queries";
import { CtaBand, PageHero } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { Skeleton } from "@/components/primitives/Skeleton";
import { ProjectFilter } from "@/components/content/ProjectFilter";

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "Electronics design case studies across medical, industrial, automotive, energy and agritech — each with the problem, the approach and the measured outcome.",
  // Filtered views canonicalise to the bare index (spec §16.1).
  alternates: { canonical: "/projects" },
};

export const revalidate = 3600;

export default async function ProjectsPage() {
  const [projects, services, industries, settings] = await Promise.all([
    getProjectCards(), getServiceSummaries(), getIndustrySummaries(), getSettings(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Work"
        title="Ideas we have brought to life."
        intro="Each case study states the constraint we were given, what we changed and what it measured afterwards. Where a client is under NDA the engineering is described without naming them."
      />
      <Section>
        <Suspense fallback={<GridSkeleton />}>
          <ProjectFilter projects={projects} services={services} industries={industries} />
        </Suspense>
      </Section>
      <CtaBand settings={settings} />
    </>
  );
}

function GridSkeleton() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className="mt-4 h-4 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full" />
        </li>
      ))}
    </ul>
  );
}
