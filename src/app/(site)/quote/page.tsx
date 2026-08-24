import type { Metadata } from "next";
import { Clock, FileCheck, ShieldCheck } from "lucide-react";
import { getFaqs, getIndustrySummaries, getServiceSummaries, getSettings } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { QuoteWizard } from "@/components/forms/QuoteWizard";
import { FaqAccordion } from "@/components/content/FaqAccordion";

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Tell us what you are building — scope, volume, timeline and any files. You will get a considered response from an engineer within one business day.",
  alternates: { canonical: "/quote" },
  robots: { index: true, follow: true },
};

export const revalidate = 3600;

const TRUST = [
  { icon: Clock, title: "One business day", body: "Every request gets a real answer from an engineer, not an autoresponder." },
  { icon: ShieldCheck, title: "NDA first, if you need one", body: "Send us yours and we will sign it before any technical discussion." },
  { icon: FileCheck, title: "You own the output", body: "All IP transfers to you. Source files, not a PDF and a dependency." },
];

export default async function QuotePage() {
  const [services, industries, faqs, settings] = await Promise.all([
    getServiceSummaries(), getIndustrySummaries(), getFaqs("quote"), getSettings(),
  ]);

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-16">
            <p className="text-label mb-4 text-brand">Request a Quote</p>
            <h1 className="text-display-2 max-w-[16ch] text-fg">Tell us the constraints.</h1>
            <p className="mt-5 max-w-[56ch] text-body-lg text-fg-muted">
              Four short steps. The more you can tell us about the environment, volume and timeline,
              the more useful the reply — and if you only have a concept, say so and we will quote
              discovery first.
            </p>
          </div>
        </Container>
      </div>

      <Section>
        <QuoteWizard
          services={services}
          industries={industries}
          responsePromise={settings.contact.responsePromise}
        />
      </Section>

      <Section tone="subtle">
        <ul className="mb-14 grid gap-5 md:grid-cols-3">
          {TRUST.map((t) => (
            <li key={t.title} className="rounded-xl border border-border bg-surface p-6">
              <span className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
                <t.icon className="size-[1.15rem]" aria-hidden />
              </span>
              <h2 className="text-h4 mb-1.5 text-fg">{t.title}</h2>
              <p className="text-body-sm text-fg-muted">{t.body}</p>
            </li>
          ))}
        </ul>
        <FaqAccordion faqs={faqs} heading="Before you send" />
      </Section>
    </>
  );
}
