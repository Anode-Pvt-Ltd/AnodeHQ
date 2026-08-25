import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const TONE: Record<string, "brand" | "success" | "danger" | "neutral" | "outline"> = {
  insert: "success", update: "brand", delete: "danger", publish: "success", download: "outline",
};

export default async function AuditLogPage() {
  await requireRole("admin");
  const service = createServiceClient();

  let rows: Record<string, unknown>[] = [];
  if (service) {
    const { data } = await service
      .from("audit_log")
      .select("id, action, table_name, record_id, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(200);
    rows = (data ?? []) as Record<string, unknown>[];
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">Audit log</h1>
        <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">
          Append-only. No role has an update or delete policy on this table, including owner — rows
          arrive only through a database trigger, so the log cannot be edited from the application.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-body-sm text-fg-subtle">
          Nothing recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[40rem] border-collapse text-[0.875rem]">
            <thead>
              <tr className="border-b border-border bg-bg-subtle">
                {["When", "Who", "Action", "Table", "Record"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-left font-mono text-[0.625rem] uppercase tracking-[0.12em] text-fg-subtle">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const actor = r.profiles as { full_name?: string } | null;
                return (
                  <tr key={String(r.id)} className="border-b border-border last:border-0">
                    <td className="tabular whitespace-nowrap px-4 py-3 text-fg-muted">
                      {formatDate(String(r.created_at))}
                    </td>
                    <td className="px-4 py-3 text-fg">{actor?.full_name ?? "system"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={TONE[String(r.action)] ?? "neutral"}>{String(r.action)}</Badge>
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.8125rem] text-fg-muted">{String(r.table_name)}</td>
                    <td className="px-4 py-3 font-mono text-[0.75rem] text-fg-subtle">
                      {r.record_id ? String(r.record_id).slice(0, 8) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
