import Link from "next/link";
import { AlertTriangle, ArrowRight, Clock, ImageOff, Inbox, Mail, Send } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { getAdminProfile, hasRole } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import { RESOURCES } from "@/lib/config/resources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

interface Tile {
  label: string;
  value: number;
  href: string;
  icon: typeof Inbox;
  tone?: "warning";
  hint: string;
}

export default async function DashboardPage() {
  const profile = await getAdminProfile();
  const service = createServiceClient();

  const counts = { newQuotes: 0, unassigned: 0, messages: 0, scheduled: 0, missingAlt: 0, drafts: 0 };
  let recentQuotes: Record<string, unknown>[] = [];
  let recentAudit: Record<string, unknown>[] = [];

  if (service) {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const weekAhead = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    const [q1, q2, q3, q4, q5, q6, q7, q8] = await Promise.all([
      service.from("quote_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      service.from("quote_requests").select("id", { count: "exact", head: true })
        .is("assigned_to", null).lt("created_at", dayAgo).neq("status", "archived"),
      service.from("contact_messages").select("id", { count: "exact", head: true }).eq("status", "new"),
      service.from("posts").select("id", { count: "exact", head: true })
        .eq("status", "scheduled").lte("published_at", weekAhead),
      service.from("media").select("id", { count: "exact", head: true })
        .is("alt_text", null).eq("kind", "image"),
      service.from("projects").select("id", { count: "exact", head: true }).eq("status", "draft"),
      service.from("quote_requests")
        .select("id, reference, full_name, company, status, created_at")
        .order("created_at", { ascending: false }).limit(6),
      service.from("audit_log")
        .select("id, action, table_name, created_at")
        .order("created_at", { ascending: false }).limit(8),
    ]);

    counts.newQuotes = q1.count ?? 0;
    counts.unassigned = q2.count ?? 0;
    counts.messages = q3.count ?? 0;
    counts.scheduled = q4.count ?? 0;
    counts.missingAlt = q5.count ?? 0;
    counts.drafts = q6.count ?? 0;
    recentQuotes = (q7.data ?? []) as Record<string, unknown>[];
    recentAudit = (q8.data ?? []) as Record<string, unknown>[];
  }

  const canSales = hasRole(profile?.roles ?? [], "sales");
  const canAdmin = hasRole(profile?.roles ?? [], "admin");

  const tiles: Tile[] = [
    ...(canSales
      ? ([
          { label: "New quote requests", value: counts.newQuotes, href: "/admin/quotes", icon: Inbox, hint: "Awaiting a first response" },
          { label: "Unassigned over a day", value: counts.unassigned, href: "/admin/quotes", icon: Clock, tone: "warning" as const, hint: "Past the one business day promise" },
          { label: "Messages to reply to", value: counts.messages, href: "/admin/messages", icon: Mail, hint: "From the contact form" },
        ] satisfies Tile[])
      : []),
    { label: "Scheduled this week", value: counts.scheduled, href: "/admin/posts", icon: Send, hint: "Publishes automatically" },
    { label: "Images missing alt text", value: counts.missingAlt, href: "/admin/media", icon: ImageOff, tone: counts.missingAlt > 0 ? "warning" : undefined, hint: "Blocks the accessibility check" },
    { label: "Draft case studies", value: counts.drafts, href: "/admin/projects", icon: AlertTriangle, hint: "Not visible to the public" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-8">
        <h1 className="text-h2 text-fg">
          {greeting()}, {profile?.fullName.split(" ")[0] ?? "there"}.
        </h1>
        <p className="mt-1.5 text-body-sm text-fg-muted">
          What needs attention, and what has changed since you were last here.
        </p>
      </header>

      <ul className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link
              href={t.href}
              className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand/40"
            >
              <span
                className={
                  t.tone === "warning" && t.value > 0
                    ? "flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/12 text-warning"
                    : "flex size-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50"
                }
              >
                <t.icon className="size-[1.15rem]" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="tabular block font-display text-2xl font-bold leading-none text-fg">{t.value}</span>
                <span className="mt-1 block text-body-sm font-medium text-fg group-hover:text-brand">{t.label}</span>
                <span className="mt-0.5 block text-[0.8125rem] text-fg-subtle">{t.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        {canSales && (
          <section aria-labelledby="recent-quotes" className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 id="recent-quotes" className="text-h4 text-fg">Latest requests</h2>
              <Link href="/admin/quotes" className="inline-flex items-center gap-1 text-body-sm text-accent hover:underline">
                All <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </div>
            {recentQuotes.length ? (
              <ul className="divide-y divide-border">
                {recentQuotes.map((q) => (
                  <li key={String(q.id)}>
                    <Link href={`/admin/quotes/${q.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-bg-subtle">
                      <span className="tabular shrink-0 font-mono text-[0.75rem] text-brand">{String(q.reference ?? "—")}</span>
                      <span className="min-w-0 flex-1 truncate text-body-sm text-fg">
                        {String(q.company || q.full_name || "")}
                      </span>
                      <Badge tone={q.status === "new" ? "brand" : "neutral"}>{String(q.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-body-sm text-fg-subtle">Nothing yet.</p>
            )}
          </section>
        )}

        <section aria-labelledby="recent-activity" className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <h2 id="recent-activity" className="text-h4 text-fg">Recent changes</h2>
            {canAdmin && (
              <Link href="/admin/audit-log" className="inline-flex items-center gap-1 text-body-sm text-accent hover:underline">
                Audit log <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
          {recentAudit.length ? (
            <ul className="divide-y divide-border">
              {recentAudit.map((a) => (
                <li key={String(a.id)} className="flex items-center gap-3 px-5 py-3">
                  <Badge tone="outline">{String(a.action)}</Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-[0.8125rem] text-fg-muted">
                    {String(a.table_name)}
                  </span>
                  <span className="tabular shrink-0 text-[0.75rem] text-fg-subtle">
                    {formatDateShort(String(a.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-body-sm text-fg-subtle">No activity recorded yet.</p>
          )}
        </section>
      </div>

      <section aria-labelledby="quick-add" className="mt-10">
        <h2 id="quick-add" className="text-label mb-4 text-fg-subtle">Create</h2>
        <ul className="flex flex-wrap gap-2">
          {RESOURCES.slice(0, 6).map((r) => (
            <li key={r.key}>
              <Link
                href={`/admin/${r.key}/new`}
                className="inline-flex items-center rounded-full border border-border bg-surface px-3.5 py-2 text-[0.8125rem] font-medium text-fg-muted transition-colors hover:border-brand hover:text-brand"
              >
                New {r.label.singular.toLowerCase()}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
