import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Search } from "lucide-react";
import { getSettings, searchAll } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Badge } from "@/components/primitives/Badge";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  service: "Service",
  project: "Case study",
  post: "Insight",
  industry: "Industry",
} as const;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const settings = await getSettings();
  if (!settings.features.search) notFound();

  const { q = "" } = await searchParams;
  const results = q ? await searchAll(q) : [];

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14">
            <h1 className="text-display-2 mb-6 text-fg">Search</h1>
            <form action="/search" method="get" role="search" className="flex max-w-xl gap-2">
              <label htmlFor="q" className="sr-only">Search the site</label>
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle"
                  aria-hidden
                />
                <input
                  id="q"
                  name="q"
                  type="search"
                  defaultValue={q}
                  autoFocus
                  placeholder="Impedance, DFM, BLE, medical…"
                  className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-[0.9375rem] text-fg placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-ring)]"
                />
              </div>
              <button
                type="submit"
                className="h-12 rounded-full bg-brand px-6 font-display text-[0.9375rem] font-semibold text-on-brand transition-colors hover:bg-brand-hover"
              >
                Search
              </button>
            </form>
          </div>
        </Container>
      </div>

      <Section>
        {q && (
          <p className="tabular mb-8 text-body-sm text-fg-muted" aria-live="polite">
            {results.length} {results.length === 1 ? "result" : "results"} for “{q}”
          </p>
        )}

        {results.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {results.map((r) => (
              <li key={`${r.kind}-${r.slug}`}>
                <Link href={r.href} className="group block py-5 transition-colors">
                  <Badge tone="neutral" className="mb-2">{KIND_LABEL[r.kind]}</Badge>
                  <h2 className="text-h4 mb-1 text-fg group-hover:text-brand">{r.title}</h2>
                  <p className="measure text-body-sm text-fg-muted">{r.excerpt}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : q ? (
          <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-6 py-16 text-center">
            <h2 className="text-h3 mb-2 text-fg">Nothing matched “{q}”</h2>
            <p className="mx-auto max-w-md text-body-sm text-fg-muted">
              Try a broader term, or{" "}
              <Link href="/contact" className="font-medium text-accent underline underline-offset-4">
                ask us directly
              </Link>{" "}
              — a lot of our work is under NDA and never appears on this site.
            </p>
          </div>
        ) : (
          <p className="text-body-lg text-fg-muted">
            Search across services, case studies, industries and insights.
          </p>
        )}
      </Section>
    </>
  );
}
