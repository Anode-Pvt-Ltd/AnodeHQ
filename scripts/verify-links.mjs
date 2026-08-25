/**
 * Crawls every public page and follows every internal link, reporting any that
 * 404. Catches the whole class of "content was deleted but something still
 * points at it" — navigation, cards, rails, related links, sitemap, footer.
 *
 *   node scripts/verify-links.mjs [baseUrl]
 */
const BASE = (process.argv[2] ?? "http://localhost:3111").replace(/\/$/, "");

const SKIP = [/^mailto:/i, /^tel:/i, /^#/, /^https?:\/\//i, /^\/api\//, /^\/admin/];

const seen = new Set();
const queue = ["/"];
const broken = [];      // [href, status, foundOn[]]
const foundOn = new Map();
let checked = 0;

const norm = (href) => {
  try {
    const u = new URL(href, BASE);
    if (u.origin !== new URL(BASE).origin) return null;
    return u.pathname + (u.search || "");
  } catch { return null; }
};

async function crawl(path) {
  const res = await fetch(BASE + path, { redirect: "follow" });
  checked++;

  if (!res.ok) {
    broken.push([path, res.status]);
    return;
  }

  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("text/html")) return;

  const html = await res.text();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const raw = m[1];
    if (SKIP.some((re) => re.test(raw))) continue;
    const p = norm(raw);
    if (!p) continue;
    if (!foundOn.has(p)) foundOn.set(p, new Set());
    foundOn.get(p).add(path);
    if (!seen.has(p)) { seen.add(p); queue.push(p); }
  }
}

console.log(`\nCrawling ${BASE}\n`);
seen.add("/");
while (queue.length) {
  const batch = queue.splice(0, 8);
  await Promise.all(batch.map((p) => crawl(p).catch((e) => broken.push([p, String(e.message).slice(0, 40)]))));
}

// The sitemap must not advertise anything that 404s either.
console.log("── sitemap ──");
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1])).filter(Boolean);
let smBad = 0;
for (const u of urls) {
  const r = await fetch(BASE + u, { redirect: "follow" });
  if (!r.ok) { smBad++; broken.push([u, r.status]); console.log(`  ✗ ${u} -> ${r.status}`); }
}
console.log(`  ${urls.length} URLs advertised, ${smBad} broken`);

console.log("\n── crawl ──");
console.log(`  pages fetched:   ${checked}`);
console.log(`  unique links:    ${seen.size}`);

if (broken.length === 0) {
  console.log("\n  ✓ no broken internal links\n");
  process.exit(0);
}

console.log(`\n  ✗ ${broken.length} broken link(s):\n`);
for (const [href, status] of broken) {
  const sources = [...(foundOn.get(href) ?? [])].slice(0, 4);
  console.log(`    ${String(status).padEnd(5)} ${href}`);
  if (sources.length) console.log(`          linked from: ${sources.join(", ")}`);
}
console.log("");
process.exit(1);
