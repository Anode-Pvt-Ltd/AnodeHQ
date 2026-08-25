import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import { QuoteControls } from "@/components/admin/QuoteControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote request" };

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("sales");
  const { id } = await params;
  const service = createServiceClient();
  if (!service) notFound();

  const { data: quote } = await service
    .from("quote_requests").select("*").eq("id", id).maybeSingle();
  if (!quote) notFound();

  const [{ data: attachments }, { data: history }, { data: staff }, { data: services }] =
    await Promise.all([
      service.from("quote_attachments").select("id, filename, size_bytes, mime_type").eq("quote_request_id", id),
      service.from("quote_status_history")
        .select("id, from_status, to_status, note, created_at")
        .eq("quote_request_id", id).order("created_at", { ascending: false }),
      service.from("profiles").select("id, full_name").eq("is_active", true).order("full_name"),
      service.from("quote_request_services")
        .select("service_id, services(title)").eq("quote_request_id", id),
    ]);

  const q = quote as Record<string, unknown>;
  const serviceTitles = (services ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => r.services?.title)
    .filter(Boolean) as string[];

  const facts: [string, string][] = [
    ["Project type", String(q.project_type ?? "—")],
    ["Stage", String(q.stage ?? "—")],
    ["Timeline", String(q.timeline ?? "—")],
    ["Volume", String(q.quantity_estimate ?? "not stated")],
    ["Budget", String(q.budget_range ?? "not stated")],
    ["NDA required", q.nda_required ? "Yes" : "No"],
    ["Heard via", String(q.how_heard ?? "—")],
    ["Country", String(q.country ?? "—")],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/quotes"
        className="mb-6 inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden /> Pipeline
      </Link>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="tabular mb-1 font-mono text-[0.8125rem] text-brand">{String(q.reference ?? "")}</p>
          <h1 className="text-h2 text-fg">{String(q.company || q.full_name || "Request")}</h1>
          <p className="mt-1.5 text-body-sm text-fg-muted">
            Received {formatDate(String(q.created_at))}
          </p>
        </div>
        <Badge tone={q.status === "new" ? "brand" : "neutral"}>{String(q.status)}</Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-h4 mb-4 text-fg">What they asked for</h2>
            <p className="mb-6 whitespace-pre-wrap text-body-lg leading-relaxed text-fg-muted">
              {String(q.description ?? "")}
            </p>
            {serviceTitles.length > 0 && (
              <>
                <h3 className="text-label mb-2 text-fg-subtle">Services requested</h3>
                <ul className="mb-6 flex flex-wrap gap-1.5">
                  {serviceTitles.map((t) => (
                    <li key={t}>
                      <Badge tone="brand">{t}</Badge>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-4">
              {facts.map(([label, value]) => (
                <div key={label} className="bg-surface p-3.5">
                  <dt className="text-label mb-1 text-fg-subtle">{label}</dt>
                  <dd className="text-body-sm text-fg">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <QuoteControls
            quoteId={id}
            status={String(q.status)}
            assignedTo={q.assigned_to ? String(q.assigned_to) : null}
            internalNotes={String(q.internal_notes ?? "")}
            staff={(staff ?? []).map((s) => ({ id: String(s.id), name: String(s.full_name) }))}
            attachments={(attachments ?? []).map((a) => ({
              id: String(a.id),
              filename: String(a.filename),
              sizeBytes: Number(a.size_bytes),
            }))}
          />
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-h4 mb-4 text-fg">Contact</h2>
            <dl className="flex flex-col gap-3 text-body-sm">
              <div>
                <dt className="text-label mb-0.5 text-fg-subtle">Name</dt>
                <dd className="text-fg">{String(q.full_name ?? "")}</dd>
              </div>
              <div>
                <dt className="text-label mb-0.5 text-fg-subtle">Email</dt>
                <dd>
                  <a href={`mailto:${q.email}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                    <Mail className="size-3.5" aria-hidden /> {String(q.email ?? "")}
                  </a>
                </dd>
              </div>
              {q.phone ? (
                <div>
                  <dt className="text-label mb-0.5 text-fg-subtle">Phone</dt>
                  <dd>
                    <a href={`tel:${String(q.phone).replace(/\s/g, "")}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                      <Phone className="size-3.5" aria-hidden /> {String(q.phone)}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>

            <a
              href={`mailto:${q.email}?subject=${encodeURIComponent(`Re: your enquiry ${String(q.reference ?? "")}`)}`}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-full bg-brand px-4 font-display text-[0.875rem] font-semibold text-on-brand hover:bg-brand-hover"
            >
              Reply by email
            </a>
          </section>

          {history && history.length > 0 && (
            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="text-h4 mb-4 text-fg">History</h2>
              <ol className="flex flex-col gap-3">
                {history.map((h) => (
                  <li key={String(h.id)} className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
                    <span className="text-body-sm text-fg">
                      {h.from_status ? `${h.from_status} → ` : ""}{String(h.to_status)}
                    </span>
                    <span className="tabular text-[0.75rem] text-fg-subtle">
                      {formatDate(String(h.created_at))}
                    </span>
                    {h.note ? <span className="text-[0.8125rem] text-fg-muted">{String(h.note)}</span> : null}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="text-h4 mb-3 text-fg">Source</h2>
            <pre className="overflow-x-auto rounded-lg bg-bg-subtle p-3 font-mono text-[0.75rem] text-fg-muted">
              {JSON.stringify(q.source ?? {}, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
