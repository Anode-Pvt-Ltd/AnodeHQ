import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, getPosts, getRelatedPosts, getSettings } from "@/lib/queries";
import { Container } from "@/components/primitives/Container";
import { Section } from "@/components/primitives/Section";
import { Prose } from "@/components/primitives/Prose";
import { Badge } from "@/components/primitives/Badge";
import { Img } from "@/components/media/Img";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PostCard } from "@/components/content/Cards";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { SectionHeading } from "@/components/sections";
import { absoluteUrl, formatDate } from "@/lib/utils";

export const revalidate = 3600;
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = await getPostBySlug((await params).slug);
  if (!p) return {};
  return {
    title: p.seoTitle ?? p.title,
    description: p.seoDescription ?? p.excerpt,
    alternates: { canonical: `/insights/${p.slug}` },
    openGraph: {
      type: "article",
      title: p.seoTitle ?? p.title,
      description: p.seoDescription ?? p.excerpt,
      url: `/insights/${p.slug}`,
      publishedTime: p.publishedAt,
      modifiedTime: p.updatedAt,
      authors: p.author ? [p.author.name] : undefined,
    },
  };
}

/** Builds a table of contents from the h3s in the rendered body. */
function extractHeadings(html: string) {
  const out: { id: string; text: string }[] = [];
  const re = /<h3[^>]*>(.*?)<\/h3>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = (m[1] ?? "").replace(/<[^>]+>/g, "").trim();
    if (text) out.push({ id: text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), text });
  }
  return out;
}

function addHeadingIds(html: string) {
  return html.replace(/<h3([^>]*)>(.*?)<\/h3>/g, (_full, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `<h3 id="${id}"${attrs}>${inner}</h3>`;
  });
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const [related, settings] = await Promise.all([getRelatedPosts(slug, 3), getSettings()]);
  const headings = extractHeadings(post.bodyHtml);
  const body = addHeadingIds(post.bodyHtml);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: absoluteUrl(post.cover.localSrc ?? "/img/og-default.svg"),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: post.author
      ? { "@type": "Person", name: post.author.name, jobTitle: post.author.role }
      : { "@type": "Organization", name: "Anode" },
    publisher: {
      "@type": "Organization",
      name: "Anode",
      logo: { "@type": "ImageObject", url: absoluteUrl("/brand/icon-512.png") },
    },
    mainEntityOfPage: absoluteUrl(`/insights/${post.slug}`),
  };

  return (
    <>
      <div className="bg-bg-subtle pt-[72px]">
        <Container>
          <div className="py-14 lg:py-20">
            <Breadcrumbs
              items={[{ label: "Insights", href: "/insights" }, { label: post.title, href: `/insights/${post.slug}` }]}
            />
            {post.topic && (
              <Link href={`/insights/topic/${post.topic.slug}`} className="mb-5 inline-block">
                <Badge tone="brand">{post.topic.name}</Badge>
              </Link>
            )}
            <h1 className="text-display-2 max-w-[20ch] text-fg">{post.title}</h1>
            <p className="mt-5 max-w-[58ch] text-body-lg text-fg-muted">{post.excerpt}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3 text-body-sm text-fg-subtle">
              {post.author?.photo && (
                <Img media={post.author.photo} sizes="36px" aspect="1/1" wrapperClassName="size-9 rounded-full" />
              )}
              {post.author && <span className="font-medium text-fg">{post.author.name}</span>}
              <span aria-hidden>·</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, settings.seo.timezone)}</time>
              <span aria-hidden>·</span>
              <span>{post.readMinutes} min read</span>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <div className="-mt-2">
          <Img
            media={post.cover}
            sizes="(max-width: 768px) 100vw, 900px"
            aspect="16/9"
            priority
            wrapperClassName="mx-auto max-w-4xl rounded-xl sm:rounded-2xl"
          />
        </div>
      </Container>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-16">
          {headings.length > 1 && (
            <nav aria-label="On this page" className="lg:sticky lg:top-28 lg:self-start">
              <details className="lg:open" open>
                <summary className="text-label mb-3 cursor-pointer list-none text-fg-subtle lg:pointer-events-none">
                  On this page
                </summary>
                <ul className="flex flex-col gap-2 border-l border-border pl-4">
                  {headings.map((h) => (
                    <li key={h.id}>
                      <a href={`#${h.id}`} className="text-body-sm text-fg-muted transition-colors hover:text-brand">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </nav>
          )}

          <article className="min-w-0">
            <Prose html={body} />

            {post.author && (
              <aside className="mt-14 flex flex-col gap-4 rounded-xl border border-border bg-bg-subtle p-6 sm:flex-row">
                {post.author.photo && (
                  <Img
                    media={post.author.photo}
                    sizes="72px"
                    aspect="1/1"
                    wrapperClassName="size-18 shrink-0 rounded-full sm:size-[4.5rem]"
                  />
                )}
                <div>
                  <p className="text-h4 text-fg">{post.author.name}</p>
                  <p className="mb-2 font-mono text-[0.6875rem] uppercase tracking-wide text-brand">
                    {post.author.role}
                  </p>
                  <p className="text-body-sm text-fg-muted">{post.author.bio}</p>
                </div>
              </aside>
            )}
          </article>
        </div>
      </Section>

      {related.length > 0 && (
        <Section tone="subtle" aria-labelledby="related-posts">
          <SectionHeading id="related-posts" eyebrow="Keep reading" heading="Related notes." align="left" />
          <ul className="grid gap-5 md:grid-cols-3">
            {related.map((p) => (
              <li key={p.slug}>
                <PostCard post={p} timezone={settings.seo.timezone} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {settings.features.newsletter && (
        <Section>
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-h2 mb-3 text-fg">Get the next one by email</h2>
            <div className="mx-auto mt-6 max-w-sm text-left">
              <NewsletterForm source={`post:${post.slug}`} />
            </div>
          </div>
        </Section>
      )}

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
