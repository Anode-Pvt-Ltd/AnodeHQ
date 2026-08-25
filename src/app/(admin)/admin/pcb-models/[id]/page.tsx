import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getHeroModel } from "@/lib/queries";
import { HotspotEditor } from "@/components/admin/HotspotEditor";
import { Badge } from "@/components/primitives/Badge";
import type { Hotspot, PcbModel, PcbVariant } from "@/types/app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Board editor" };

export default async function PcbModelEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("editor");
  const { id } = await params;
  const service = createServiceClient();

  let model: PcbModel | null = null;

  if (service) {
    const { data: row } = await service
      .from("pcb_models")
      .select("id, name, slug, storage_path, camera_default, camera_limits, scale, is_hero")
      .eq("id", id)
      .maybeSingle();

    if (row) {
      const [{ data: hotspots }, { data: variants }] = await Promise.all([
        service.from("pcb_hotspots").select("*").eq("model_id", id).order("order_index"),
        service.from("pcb_model_variants").select("*").eq("model_id", id).order("order_index"),
      ]);

      model = {
        id: String(row.id),
        name: String(row.name),
        slug: String(row.slug),
        storagePath: row.storage_path ? String(row.storage_path) : null,
        poster: null,
        cameraDefault: row.camera_default as PcbModel["cameraDefault"],
        cameraLimits: row.camera_limits as PcbModel["cameraLimits"],
        scale: Number(row.scale ?? 1),
        isHero: Boolean(row.is_hero),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hotspots: (hotspots ?? []).map((h: any): Hotspot => ({
          id: String(h.id), label: h.label, value: h.value, detail: h.detail,
          icon: h.icon ?? "cpu", position: h.position, normal: h.normal,
          anchor: h.anchor, body: h.body, linkUrl: h.link_url,
          variantKey: h.variant_key, orderIndex: Number(h.order_index ?? 0),
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        variants: (variants ?? []).map((v: any): PcbVariant => ({
          key: v.key, displayName: v.display_name, icon: v.icon,
          config: v.config ?? {}, orderIndex: Number(v.order_index ?? 0),
        })),
      };
    }
  }

  // No database yet — open the procedural board read-only so the editor is
  // still demonstrable end to end.
  const databaseReady = Boolean(service && model);
  if (!model) {
    model = await getHeroModel();
    if (!model) notFound();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Link
        href="/admin/pcb-models"
        className="mb-6 inline-flex items-center gap-1.5 text-body-sm text-fg-muted hover:text-brand"
      >
        <ArrowLeft className="size-4" aria-hidden /> All boards
      </Link>

      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h2 text-fg">{model.name}</h1>
          <p className="mt-1.5 text-body-sm text-fg-muted">
            Click the board to capture an anchor point, then describe what sits there.
          </p>
        </div>
        {model.isHero && <Badge tone="brand">Homepage hero</Badge>}
      </header>

      {!databaseReady && (
        <p className="mb-6 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-body-sm text-warning">
          Read-only: this board is currently generated in code. Apply the migrations and load
          <code className="mx-1 rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-[0.85em]">supabase/seed.sql</code>
          to make it editable.
        </p>
      )}

      <HotspotEditor model={model} databaseReady={databaseReady} />
    </div>
  );
}
