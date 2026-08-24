import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostsByTopic, getSettings, getTopics } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PostCard } from "@/components/content/Cards";
import { cn } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getTopics()).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = (await getTopics()).find((t) => t.slug === slug);
  if (!topic) return {};
  return {
    title: `${topic.name} — Insights`,
    description: `Electronics engineering write-ups on ${topic.name.toLowerCase()} from the Anode team.`,
    alternates: { canonical: `/insights/topic/${topic.slug}` },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topics = await getTopics();
  const topic = topics.find((t) => t.slug === slug);
  if (!topic) notFound();

  const [posts, settings] = await Promise.all([getPostsByTopic(slug), getSettings()]);

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[
                { label: "Insights", href: "/insights" },
                { label: topic.name, href: `/insights/topic/${topic.slug}` },
              ]}
            />
            <p className="text-label mb-4 text-brand">Topic</p>
            <h1 className="text-display-2 text-fg">{topic.name}</h1>
            <p className="mt-5 tabular text-body-lg text-fg-muted">
              {posts.length} {posts.length === 1 ? "article" : "articles"}
            </p>
          </div>
        </Container>
      </div>

      <Section>
        <nav aria-label="Topics" className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/insights"
            className="inline-flex items-center rounded-full border border-border bg-surface px-3 py-1.5 text-[0.8125rem] font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
          >
            All
          </Link>
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/insights/topic/${t.slug}`}
              aria-current={t.slug === slug ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                t.slug === slug
                  ? "border-brand bg-brand text-on-brand"
                  : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
              )}
            >
              {t.name}
            </Link>
          ))}
        </nav>

        {posts.length > 0 ? (
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <li key={p.slug}>
                <PostCard post={p} timezone={settings.seo.timezone} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-lg text-fg-muted">Nothing published under this topic yet.</p>
        )}
      </Section>
    </>
  );
}
