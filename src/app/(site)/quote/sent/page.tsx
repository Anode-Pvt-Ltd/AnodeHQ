import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { getPostSummaries, getSettings } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Button } from "@/components/primitives/Button";
import { PostCard } from "@/components/content/Cards";
import { SectionHeading } from "@/components/sections";

export const metadata: Metadata = {
  title: "Request received",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const NEXT_STEPS = [
  { n: "01", title: "An engineer reads it", body: "Not a sales team. Whoever picks it up has actually built something comparable." },
  { n: "02", title: "We reply within one business day", body: "Either with a proposal, or with the two or three questions we need answered to write one." },
  { n: "03", title: "A 30-minute technical call", body: "Optional, and usually the fastest way to turn a rough scope into a fixed price." },
];

export default async function QuoteSentPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const [settings, posts] = await Promise.all([getSettings(), getPostSummaries(3)]);

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-16 text-center lg:py-24">
            <span className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-success/12 text-success">
              <Check className="size-7" aria-hidden />
            </span>
            <h1 className="text-display-2 mx-auto max-w-[16ch] text-fg">Request received.</h1>
            <p className="mx-auto mt-5 max-w-[48ch] text-body-lg text-fg-muted">
              {settings.contact.responsePromise} A confirmation is on its way to your inbox.
            </p>

            {ref && (
              <div className="mx-auto mt-8 inline-flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-8 py-5">
                <span className="text-label text-fg-subtle">Your reference</span>
                <span className="tabular font-mono text-xl font-semibold text-brand">{ref}</span>
              </div>
            )}

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary" icon={ArrowRight}>
                <Link href="/projects">Browse case studies</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" icon={ArrowRight}>
                <Link href="/process">See how we work</Link>
              </Button>
            </div>
          </div>
        </Container>
      </div>

      <Section>
        <SectionHeading eyebrow="What happens next" heading="Three steps, no chasing." align="left" />
        <ol className="grid gap-5 md:grid-cols-3">
          {NEXT_STEPS.map((s) => (
            <li key={s.n} className="rounded-xl border border-border bg-surface p-6">
              <span className="tabular mb-3 block font-mono text-[0.75rem] text-brand">{s.n}</span>
              <h3 className="text-h4 mb-1.5 text-fg">{s.title}</h3>
              <p className="text-body-sm text-fg-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-body-sm text-fg-muted">
          Something urgent in the meantime?{" "}
          <a href={`mailto:${settings.contact.email}`} className="font-medium text-accent underline underline-offset-4">
            {settings.contact.email}
          </a>{" "}
          or{" "}
          <a href={`tel:${settings.contact.phone.replace(/\s/g, "")}`} className="font-medium text-accent underline underline-offset-4">
            {settings.contact.phone}
          </a>
          .
        </p>
      </Section>

      {posts.length >= 3 && (
        <Section tone="subtle">
          <SectionHeading eyebrow="While you wait" heading="Notes from the bench." align="left" />
          <ul className="grid gap-5 md:grid-cols-3">
            {posts.map((p) => (
              <li key={p.slug}>
                <PostCard post={p} timezone={settings.seo.timezone} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
