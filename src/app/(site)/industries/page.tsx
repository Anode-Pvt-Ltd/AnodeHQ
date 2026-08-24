import type { Metadata } from "next";
import { getIndustrySummaries, getSettings } from "@/lib/queries";
import { CtaBand, IndustryGrid, PageHero } from "@/components/sections";

export const metadata: Metadata = {
  title: "Industries We Design For",
  description:
    "Medical devices, industrial and IIoT, automotive and EV, consumer, energy and power, agritech and aerospace — each with its own compliance regime and environment.",
  alternates: { canonical: "/industries" },
};

export const revalidate = 3600;

export default async function IndustriesPage() {
  const [industries, settings] = await Promise.all([getIndustrySummaries(), getSettings()]);

  return (
    <>
      <PageHero
        eyebrow="Industries"
        title="Every sector imposes its own constraints."
        intro="Compliance regime, operating environment, expected lifetime and volume all change how a board should be designed. We work to those constraints from the first schematic sheet rather than discovering them at certification."
      />
      <IndustryGrid heading="Sectors we build for" industries={industries} promoteFirstTwo={false} />
      <CtaBand settings={settings} />
    </>
  );
}
