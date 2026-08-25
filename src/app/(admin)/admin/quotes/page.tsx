import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import { QuoteRealtime } from "@/components/admin/QuoteRealtime";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quotes" };

const PIPELINE = ["new", "reviewing", "quoted", "won", "lost", "archived"] as const;

const TONE: Record<string, "brand" | "warning" | "success" | "neutral" | "outline"> = {
  new: "brand", reviewing: "warning", quoted: "warning",
  won: "success", lost: "outline", archived: "neutral",
};

export default async function QuotesPage() {
  await requireRole("sales");
  const service = createServiceClient();

  let rows: Record<string, unknown>[] = [];
  if (service) {
    const { data } = await service
      .from("quote_requests")
      .select("id, reference, full_name, company, email, status, timeline, budget_range, assigned_to, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    rows = (data ?? []) as Record<string, unknown>[];
  }

  const byStatus = (s: string) => rows.filter((r) => r.status === s);

  return (
    <div className="mx-auto max-w-7xl">
      <QuoteRealtime />

      <header className="mb-7">
        <h1 className="text-h2 text-fg">Quote requests</h1>
        <p className="mt-1.5 text-body-sm text-fg-muted">
          Every request from the four-step form, with the answers that let you reply substantively.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
          <h2 className="text-h3 mb-2 text-fg">No requests yet</h2>
          <p className="mx-auto max-w-md text-body-sm text-fg-muted">
            Submissions from <Link href="/quote" className="text-accent underline underline-offset-4">/quote</Link>{" "}
            arrive here, with a live toast when one lands.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 overflow-x-auto pb-4 lg:grid-flow-col lg:auto-cols-[minmax(17rem,1fr)]">
          {PIPELINE.map((status) => {
            const items = byStatus(status);
            return (
              <section key={status} aria-labelledby={`col-${status}`} className="min-w-[16rem]">
                <div className="mb-3 flex items-center gap-2">
                  <h2 id={`col-${status}`} className="text-label text-fg-subtle">{status}</h2>
                  <span className="tabular text-[0.75rem] text-fg-subtle">{items.length}</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {items.map((q) => (
                    <li key={String(q.id)}>
                      <Link
                        href={`/admin/quotes/${q.id}`}
                        className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="tabular font-mono text-[0.6875rem] text-brand">
                            {String(q.reference ?? "—")}
                          </span>
                          <Badge tone={TONE[String(q.status)] ?? "neutral"}>{String(q.status)}</Badge>
                        </div>
                        <p className="truncate text-body-sm font-semibold text-fg">
                          {String(q.company || q.full_name || "")}
                        </p>
                        <p className="truncate text-[0.8125rem] text-fg-muted">{String(q.email ?? "")}</p>
                        <div className="mt-3 flex items-center justify-between gap-2 text-[0.75rem] text-fg-subtle">
                          <span className="truncate">{String(q.timeline ?? "")}</span>
                          <span className="tabular shrink-0">{formatDateShort(String(q.created_at))}</span>
                        </div>
                        {!q.assigned_to && (
                          <p className="mt-2 text-[0.75rem] font-medium text-warning">Unassigned</p>
                        )}
                      </Link>
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[0.8125rem] text-fg-subtle">
                      Empty
                    </li>
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
