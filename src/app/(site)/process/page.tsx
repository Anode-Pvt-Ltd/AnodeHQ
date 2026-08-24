import type { Metadata } from "next";
import { getFaqs, getProcessStages, getSettings } from "@/lib/queries";
import { CtaBand, PageHero, ProcessBand } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { FaqAccordion } from "@/components/content/FaqAccordion";
import { Reveal } from "@/components/primitives/Reveal";
import { getIcon } from "@/lib/icons";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "How We Work",
  description:
    "Discover, Design, Develop, Deliver — four stages with defined inputs, activities, outputs and a review gate that must close before the next one starts.",
  alternates: { canonical: "/process" },
};

export const revalidate = 3600;

export default async function ProcessPage() {
  const [stages, faqs, settings] = await Promise.all([
    getProcessStages(), getFaqs("process"), getSettings(),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Our Process"
        title="Four stages, each with a gate that has to close."
        intro="Every stage has defined inputs, a set of activities, named outputs and a review that must pass before the next begins. It is what keeps a project at two prototype revisions rather than five."
      />

      <ProcessBand heading={settings.copy.processHeading} stages={stages} />

      <Section aria-labelledby="stage-detail">
        <h2 id="stage-detail" className="text-h2 mb-12 max-w-[16ch] text-fg">
          What happens in each stage.
        </h2>
        <ol className="flex flex-col gap-6">
          {stages.map((stage, i) => {
            const Icon = getIcon(stage.icon);
            return (
              <li key={stage.id}>
                <Reveal delay={i * 60}>
                  <article className="rounded-xl border border-border bg-surface p-6 lg:p-8">
                    <div className="mb-6 flex flex-wrap items-center gap-4">
                      <span className="flex size-12 items-center justify-center rounded-xl bg-teal-50 text-brand dark:bg-teal-900/50">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <div>
                        <p className="tabular font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-fg-subtle">
                          Stage {String(stage.stepNumber).padStart(2, "0")} · {stage.detail.duration}
                        </p>
                        <h3 className="text-h3 text-fg">{stage.title}</h3>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                      {(
                        [
                          ["Inputs", stage.detail.inputs],
                          ["Activities", stage.detail.activities],
                          ["Outputs", stage.detail.outputs],
                        ] as const
                      ).map(([label, list]) => (
                        <div key={label}>
                          <h4 className="text-label mb-3 text-fg-subtle">{label}</h4>
                          <ul className="flex flex-col gap-2">
                            {list.map((item) => (
                              <li key={item} className="flex gap-2 text-body-sm text-fg-muted">
                                <span className="mt-[0.55em] size-1 shrink-0 rounded-full bg-brand" aria-hidden />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex items-start gap-3 rounded-lg border-l-2 border-brand bg-bg-subtle p-4">
                      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                      <p className="text-body-sm text-fg-muted">
                        <span className="font-semibold text-fg">Gate: </span>
                        {stage.detail.gate}
                      </p>
                    </div>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section tone="subtle">
        <FaqAccordion faqs={faqs} />
      </Section>

      <CtaBand settings={settings} />
    </>
  );
}
