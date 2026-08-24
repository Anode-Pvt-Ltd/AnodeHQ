import { getPosts, getSettings } from "@/lib/queries";
import { absoluteUrl } from "@/lib/utils";

export const revalidate = 3600;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const [posts, settings] = await Promise.all([getPosts(), getSettings()]);
  const latest = posts.slice(0, 20);

  const items = latest
    .map(
      (p) => `    <item>
      <title>${esc(p.title)}</title>
      <link>${absoluteUrl(`/insights/${p.slug}`)}</link>
      <guid isPermaLink="true">${absoluteUrl(`/insights/${p.slug}`)}</guid>
      <description>${esc(p.excerpt)}</description>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      ${p.topic ? `<category>${esc(p.topic.name)}</category>` : ""}
      ${p.author ? `<dc:creator>${esc(p.author.name)}</dc:creator>` : ""}
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Anode — Insights</title>
    <link>${absoluteUrl("/insights")}</link>
    <description>${esc(settings.seo.description)}</description>
    <language>en-GB</language>
    <lastBuildDate>${new Date(latest[0]?.publishedAt ?? Date.now()).toUTCString()}</lastBuildDate>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
