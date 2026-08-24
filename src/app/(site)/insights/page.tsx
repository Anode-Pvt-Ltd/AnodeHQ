import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostSummaries, getSettings, getTopics } from "@/lib/queries";
import { PageHero } from "@/components/sections";
import { Section } from "@/components/primitives/Section";
import { PostCard } from "@/components/content/Cards";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { Img } from "@/components/media/Img";
import { Badge } from "@/components/primitives/Badge";
import { formatDateShort } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Practical electronics engineering write-ups: return paths and EMC, BOM risk, OTA update architecture and pre-compliance testing.",
  alternates: { canonical: "/insights", types: { "application/rss+xml": "/rss.xml" } },
};

export const revalidate = 3600;

export default async function InsightsPage() {
  const settings = await getSettings();
  if (!settings.features.insights) notFound();

  const [posts, topics] = await Promise.all([getPostSummaries(), getTopics()]);
  const [featured, ...rest] = posts;

  return (
    <>
      <PageHero
        eyebrow="Insights"
        title="Notes from the bench."
        intro="Write-ups of problems we have actually had to solve. No thought leadership, no predictions — just what worked and what it measured."
      />

      <Section>
        {featured && (
          <Link
            href={`/insights/${featured.slug}`}
            className="group mb-12 grid gap-6 overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-brand/40 lg:grid-cols-2"
          >
            <Img
              media={featured.cover}
              sizes="(max-width: 1024px) 100vw, 50vw"
              aspect="16/10"
              priority
              className="transition-transform duration-[var(--dur-slow)] group-hover:scale-[1.02]"
            />
            <div className="flex flex-col justify-center p-6 lg:p-10">
              <div className="mb-4 flex items-center gap-3">
                <Badge tone="brand">Latest</Badge>
                {featured.topic && <span className="text-body-sm text-fg-subtle">{featured.topic.name}</span>}
              </div>
              <h2 className="text-h2 mb-3 text-fg group-hover:text-brand">{featured.title}</h2>
              <p className="mb-5 text-body-lg text-fg-muted">{featured.excerpt}</p>
              <p className="flex items-center gap-2 text-body-sm text-fg-subtle">
                <time dateTime={featured.publishedAt}>
                  {formatDateShort(featured.publishedAt, settings.seo.timezone)}
                </time>
                <span aria-hidden>·</span>
                <span>{featured.readMinutes} min read</span>
              </p>
            </div>
          </Link>
        )}

        <nav aria-label="Topics" className="mb-8 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-brand bg-brand px-3 py-1.5 text-[0.8125rem] font-medium text-on-brand">
            All
          </span>
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/insights/topic/${t.slug}`}
              className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              {t.name}
            </Link>
          ))}
        </nav>

        {rest.length > 0 && (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <li key={p.slug}>
                <PostCard post={p} timezone={settings.seo.timezone} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {settings.features.newsletter && (
        <Section tone="subtle">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-h2 mb-3 text-fg">Get these by email</h2>
            <p className="mb-6 text-body-lg text-fg-muted">
              Roughly one a month. Engineering only — no sales email, unsubscribe in one click.
            </p>
            <div className="mx-auto max-w-sm text-left">
              <NewsletterForm source="insights" />
            </div>
          </div>
        </Section>
      )}
    </>
  );
}
