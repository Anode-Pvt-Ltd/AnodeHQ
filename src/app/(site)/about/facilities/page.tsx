import type { Metadata } from "next";
import { getSettings } from "@/lib/queries";
import { CtaBand, SectionHeading } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { Container } from "@/components/primitives/Container";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Img } from "@/components/media/Img";
import { img } from "@/content/media";

export const metadata: Metadata = {
  title: "Lab & Facilities",
  description:
    "Our in-house electronics lab: EMC pre-compliance, thermal and environmental chambers, 500 MHz oscilloscopes, current analysers and rework to 0201 and BGA.",
  alternates: { canonical: "/about/facilities" },
};

export const revalidate = 3600;

const EQUIPMENT: { group: string; items: { name: string; detail: string }[] }[] = [
  {
    group: "Measurement",
    items: [
      { name: "4-channel 500 MHz oscilloscopes", detail: "×3, with differential and current probes" },
      { name: "Precision current analysers", detail: "nA to A, for duty-cycle power profiling" },
      { name: "Spectrum analyser, 9 kHz – 3 GHz", detail: "With LISN for conducted emissions" },
      { name: "Vector network analyser", detail: "Impedance and return-loss verification" },
      { name: "Programmable DC loads and supplies", detail: "Efficiency sweeps across line and load" },
    ],
  },
  {
    group: "EMC & immunity",
    items: [
      { name: "Near-field probe set", detail: "H and E field, 30 MHz – 3 GHz" },
      { name: "ESD simulator", detail: "IEC 61000-4-2, contact and air to ±15 kV" },
      { name: "EFT / surge generator", detail: "IEC 61000-4-4 and 61000-4-5" },
      { name: "TEM cell", detail: "Repeatable radiated pre-compliance on small assemblies" },
    ],
  },
  {
    group: "Environmental",
    items: [
      { name: "Thermal chamber", detail: "−40 °C to +125 °C, programmable profiles" },
      { name: "Humidity chamber", detail: "10–95 % RH, condensation cycling" },
      { name: "Vibration table", detail: "Sine and random to IEC 60068-2" },
      { name: "Thermal imaging camera", detail: "Component-level hotspot analysis under load" },
    ],
  },
  {
    group: "Build & rework",
    items: [
      { name: "Reflow oven and stencil printer", detail: "Prototype builds and process trials" },
      { name: "Hot-air and IR rework", detail: "Down to 0201 passives and BGA reball" },
      { name: "Digital inspection microscope", detail: "IPC-A-610 Class 2 and Class 3 inspection" },
      { name: "FDM and SLA 3D printing", detail: "Enclosure fit checks and test fixtures" },
    ],
  },
];

export default async function FacilitiesPage() {
  const settings = await getSettings();

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[{ label: "About", href: "/about" }, { label: "Lab & Facilities", href: "/about/facilities" }]}
            />
            <p className="text-label mb-4 text-brand">Lab &amp; facilities</p>
            <h1 className="text-display-2 max-w-[17ch] text-fg">
              A lab, so claims can be measurements.
            </h1>
            <p className="mt-6 max-w-[56ch] text-body-lg text-fg-muted">
              Pre-compliance in-house means a finding on revision A is a layout change rather than a
              rebooked chamber slot. This is the equipment that makes that possible.
            </p>
          </div>
        </Container>
      </div>

      <Container>
        <div className="grid gap-5 sm:grid-cols-2">
          <Img
            media={img("facility-lab", "Electronics laboratory bench with oscilloscopes and probes")}
            sizes="(max-width: 640px) 100vw, 50vw"
            aspect="4/3"
            priority
            wrapperClassName="rounded-xl"
          />
          <Img
            media={img("facility-bench", "Rework station with microscope and hot-air tooling")}
            sizes="(max-width: 640px) 100vw, 50vw"
            aspect="4/3"
            wrapperClassName="rounded-xl"
          />
        </div>
      </Container>

      <Section aria-labelledby="equipment">
        <SectionHeading
          id="equipment"
          eyebrow="Equipment"
          heading="What is on the bench."
          intro="Enough to characterise a design properly and to find EMC problems while the layout can still change."
        />
        <div className="grid gap-8 md:grid-cols-2">
          {EQUIPMENT.map((g) => (
            <div key={g.group}>
              <h3 className="text-label mb-4 text-fg-subtle">{g.group}</h3>
              <ul className="divide-y divide-border border-y border-border">
                {g.items.map((it) => (
                  <li key={it.name} className="py-3.5">
                    <p className="text-body-sm font-semibold text-fg">{it.name}</p>
                    <p className="text-body-sm text-fg-muted">{it.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand settings={settings} />
    </>
  );
}
