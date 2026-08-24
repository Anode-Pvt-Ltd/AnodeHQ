import type { Metadata } from "next";
import { getFaqs, getIndustrySummaries, getProcessStages, getServiceSummaries, getSettings } from "@/lib/queries";
import { CtaBand, IndustryGrid, PageHero, ProcessBand, ServiceGrid } from "@/components/sections";
import { FaqAccordion } from "@/components/content/FaqAccordion";
import { Section } from "@/components/primitives/Section";

export const metadata: Metadata = {
  title: "Electronics Design Services",
  description:
    "Circuit and schematic design, high-speed multilayer PCB layout, embedded firmware, prototyping, test and compliance, and manufacturing support — under one roof.",
  alternates: { canonical: "/services" },
};

export const revalidate = 3600;

export default async function ServicesPage() {
  const [services, industries, stages, faqs, settings] = await Promise.all([
    getServiceSummaries(), getIndustrySummaries(), getProcessStages(), getFaqs("services"), getSettings(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Services"
        title="Complete electronics design under one roof."
        intro="Six capabilities that cover a product from a first block diagram to a stable production run. Engage with all of them, or join at the stage where you need help."
      />
      <ServiceGrid heading="What we do" services={services} columns={3} />
      <ProcessBand heading={settings.copy.processHeading} stages={stages} />
      <IndustryGrid
        eyebrow="Industries"
        heading="Where these capabilities get applied."
        industries={industries}
        promoteFirstTwo={false}
      />
      <Section tone="subtle">
        <FaqAccordion faqs={faqs} />
      </Section>
      <CtaBand settings={settings} />
    </>
  );
}
