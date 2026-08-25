import Link from "next/link";
import { ArrowRight, CircuitBoard } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getHeroModel } from "@/lib/queries";
import { Badge } from "@/components/primitives/Badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "PCB models" };

export default async function PcbModelsPage() {
  await requireRole("editor");
  const service = createServiceClient();

  let rows: Record<string, unknown>[] = [];
  if (service) {
    const { data } = await service
      .from("pcb_models")
      .select("id, name, slug, is_hero, status, storage_path, updated_at")
      .order("is_hero", { ascending: false });
    rows = (data ?? []) as Record<string, unknown>[];
  }

  // Before the database exists, show the procedural board the site is running on.
  const fallback = rows.length === 0 ? await getHeroModel() : null;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">PCB models</h1>
        <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">
          The interactive board in the homepage hero, and the annotations placed on it. Coordinates
          are captured by clicking the mesh — never typed.
        </p>
      </header>

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {rows.map((m) => (
            <li key={String(m.id)}>
              <Link
                href={`/admin/pcb-models/${m.id}`}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-brand/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
                  <CircuitBoard className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-h4 text-fg">{String(m.name)}</span>
                  <span className="block font-mono text-[0.75rem] text-fg-subtle">
                    {m.storage_path ? String(m.storage_path) : "procedural — generated in code, 0 bytes"}
                  </span>
                </span>
                {m.is_hero ? <Badge tone="brand">Homepage hero</Badge> : null}
                <Badge tone={m.status === "published" ? "success" : "neutral"}>{String(m.status)}</Badge>
                <ArrowRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : fallback ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center gap-4">
            <span className="flex size-11 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
              <CircuitBoard className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-h4 text-fg">{fallback.name}</p>
              <p className="font-mono text-[0.75rem] text-fg-subtle">
                procedural · {fallback.hotspots.length} hotspots · {fallback.variants.length} views
              </p>
            </div>
            <Badge tone="brand" className="ml-auto">Homepage hero</Badge>
          </div>
          <p className="text-body-sm text-fg-muted">
            This board is currently generated from the definition in{" "}
            <code className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[0.85em]">src/content/pcb.ts</code>{" "}
            and is what the homepage is rendering. Load{" "}
            <code className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[0.85em]">supabase/seed.sql</code>{" "}
            to bring it into the database, after which it becomes editable here.
          </p>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-6 py-16 text-center text-body-sm text-fg-subtle">
          No boards yet.
        </p>
      )}
    </div>
  );
}
