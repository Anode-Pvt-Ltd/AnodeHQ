"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, Plus, Save, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/primitives/Button";
import { FieldRow, Input, Select, Textarea } from "@/components/primitives/Field";
import { IconPicker } from "./IconPicker";
import { deleteHotspot, saveCameraDefault, saveHotspot } from "@/lib/mutations/pcb";
import type { Hotspot, PcbModel } from "@/types/app";

const AuthorCanvas = React.lazy(() => import("./AuthorCanvas"));

export interface DraftHotspot {
  id?: string;
  label: string;
  value: string;
  detail: string;
  icon: string;
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  anchor: Hotspot["anchor"];
  body: string;
  link_url: string;
  variant_key: string;
  order_index: number;
  is_active: boolean;
}

const EMPTY: DraftHotspot = {
  label: "", value: "", detail: "", icon: "cpu",
  position: { x: 0, y: 0.1, z: 0 }, normal: { x: 0, y: 1, z: 0 },
  anchor: "right", body: "", link_url: "", variant_key: "",
  order_index: 0, is_active: true,
};

const toDraft = (h: Hotspot): DraftHotspot => ({
  id: h.id,
  label: h.label, value: h.value, detail: h.detail ?? "", icon: h.icon,
  position: h.position, normal: h.normal, anchor: h.anchor,
  body: h.body ?? "", link_url: h.linkUrl ?? "", variant_key: h.variantKey ?? "",
  order_index: h.orderIndex, is_active: true,
});

/**
 * Split view: the same R3F scene the public hero uses, in author mode, beside
 * the hotspot table. Clicking the mesh captures an intersection point — the
 * numeric fields are read-only because coordinates are never typed (§13.6).
 */
export function HotspotEditor({
  model,
  databaseReady,
}: {
  model: PcbModel;
  databaseReady: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = React.useState<DraftHotspot | null>(null);
  const [placing, setPlacing] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();
  const cameraRef = React.useRef<{ position: [number, number, number]; target: [number, number, number]; fov: number } | null>(null);

  const onPick = React.useCallback(
    (point: { x: number; y: number; z: number }, normal: { x: number; y: number; z: number }) => {
      const round = (n: number) => Math.round(n * 1000) / 1000;
      const pos = { x: round(point.x), y: round(point.y), z: round(point.z) };
      const nor = { x: round(normal.x), y: round(normal.y), z: round(normal.z) };

      setDraft((d) => (d ? { ...d, position: pos, normal: nor } : { ...EMPTY, position: pos, normal: nor, order_index: model.hotspots.length + 1 }));
      setPlacing(false);
      toast.success("Point captured from the board");
    },
    [model.hotspots.length],
  );

  const save = () => {
    if (!draft) return;
    setErrors({});
    startTransition(async () => {
      const res = await saveHotspot({
        id: draft.id,
        model_id: model.id,
        label: draft.label,
        value: draft.value,
        detail: draft.detail || null,
        icon: draft.icon || null,
        position: draft.position,
        normal: draft.normal,
        anchor: draft.anchor,
        body: draft.body || null,
        link_url: draft.link_url || null,
        variant_key: draft.variant_key || null,
        order_index: draft.order_index,
        is_active: draft.is_active,
      });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.message ?? "Could not save.");
        return;
      }
      toast.success(res.message ?? "Saved.");
      setDraft(null);
      router.refresh();
    });
  };

  const remove = (id: string, label: string) => {
    if (!confirm(`Delete the “${label}” hotspot?`)) return;
    startTransition(async () => {
      const res = await deleteHotspot(id);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) { setDraft(null); router.refresh(); }
    });
  };

  const useCurrentView = () => {
    const cam = cameraRef.current;
    if (!cam) { toast.error("Move the board first, then save the view."); return; }
    startTransition(async () => {
      const res = await saveCameraDefault(model.id, cam);
      toast[res.ok ? "success" : "error"](res.message ?? "");
    });
  };

  const set = <K extends keyof DraftHotspot>(k: K, v: DraftHotspot[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
      {/* ---------------------------------------------------- canvas */}
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-border bg-bg-subtle">
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-body-sm text-fg-subtle">
                Loading the board…
              </div>
            }
          >
            <AuthorCanvas
              model={model}
              placing={placing}
              existing={model.hotspots}
              onPick={onPick}
              onCamera={(c) => { cameraRef.current = c; }}
            />
          </React.Suspense>

          {placing && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
              <p className="rounded-full bg-brand px-3.5 py-1.5 text-[0.8125rem] font-semibold text-on-brand shadow-md">
                Click anywhere on the board to place the point
              </p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={placing ? "primary" : "secondary"}
            icon={Crosshair}
            iconPosition="start"
            onClick={() => { setPlacing((p) => !p); if (!draft) setDraft({ ...EMPTY, order_index: model.hotspots.length + 1 }); }}
          >
            {placing ? "Cancel placement" : "Place a point"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={useCurrentView} loading={pending}>
            Use current view as default
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={Plus}
            iconPosition="start"
            onClick={() => { setDraft({ ...EMPTY, order_index: model.hotspots.length + 1 }); setPlacing(true); }}
          >
            New hotspot
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------- panel */}
      <div className="flex flex-col gap-5">
        <section className="rounded-xl border border-border bg-surface">
          <h2 className="border-b border-border px-5 py-3.5 text-h4 text-fg">
            Hotspots <span className="tabular font-normal text-fg-subtle">({model.hotspots.length})</span>
          </h2>
          <ul className="divide-y divide-border">
            {model.hotspots.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-5 py-3">
                <button
                  type="button"
                  onClick={() => { setDraft(toDraft(h)); setPlacing(false); }}
                  className={cn(
                    "min-w-0 flex-1 text-left",
                    draft?.id === h.id && "text-brand",
                  )}
                >
                  <span className="block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-subtle">
                    {h.label}
                  </span>
                  <span className="block truncate text-body-sm font-medium text-fg">{h.value}</span>
                </button>
                <span className="tabular shrink-0 font-mono text-[0.6875rem] text-fg-subtle">
                  {h.position.x.toFixed(2)}, {h.position.y.toFixed(2)}, {h.position.z.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => remove(h.id, h.value)}
                  disabled={pending || !databaseReady}
                  aria-label={`Delete ${h.value}`}
                  className="rounded-md p-1.5 text-fg-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
            {model.hotspots.length === 0 && (
              <li className="px-5 py-8 text-center text-body-sm text-fg-subtle">
                No hotspots yet. Place a point on the board to add one.
              </li>
            )}
          </ul>
        </section>

        {draft && (
          <section className="rounded-xl border border-brand/40 bg-surface p-5">
            <h2 className="text-h4 mb-4 text-fg">{draft.id ? "Edit hotspot" : "New hotspot"}</h2>

            <div className="mb-4 rounded-lg bg-bg-subtle p-3">
              <p className="text-label mb-1.5 text-fg-subtle">Anchor point — captured from the mesh</p>
              <p className="tabular font-mono text-[0.8125rem] text-fg">
                x {draft.position.x} &nbsp; y {draft.position.y} &nbsp; z {draft.position.z}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Label" htmlFor="h-label" required error={errors.label}
                  help="The small caps eyebrow — COMPONENT, POWER">
                  <Input id="h-label" value={draft.label} onChange={(e) => set("label", e.currentTarget.value)} />
                </FieldRow>
                <FieldRow label="Value" htmlFor="h-value" required error={errors.value}
                  help="The bold line — MCU, 3.3 V">
                  <Input id="h-value" value={draft.value} onChange={(e) => set("value", e.currentTarget.value)} />
                </FieldRow>
              </div>

              <FieldRow label="Detail" htmlFor="h-detail" optionalLabel error={errors.detail}
                help="The monospace third line — STM32H743. Omitted renders a two-line chip.">
                <Input id="h-detail" value={draft.detail} onChange={(e) => set("detail", e.currentTarget.value)} />
              </FieldRow>

              <FieldRow label="Icon" htmlFor="h-icon" help="Leading glyph inside the chip.">
                <IconPicker id="h-icon" name="__icon" defaultValue={draft.icon} />
              </FieldRow>

              <div className="grid gap-4 sm:grid-cols-2">
                <FieldRow label="Anchor side" htmlFor="h-anchor"
                  help="Which side of the point the card floats to.">
                  <Select id="h-anchor" value={draft.anchor}
                    onChange={(e) => set("anchor", e.currentTarget.value as Hotspot["anchor"])}>
                    {["right", "left", "top", "bottom"].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </Select>
                </FieldRow>
                <FieldRow label="Shown in view" htmlFor="h-variant" optionalLabel
                  help="Empty means always visible.">
                  <Select id="h-variant" value={draft.variant_key}
                    onChange={(e) => set("variant_key", e.currentTarget.value)}>
                    <option value="">Always visible</option>
                    {model.variants.map((v) => (
                      <option key={v.key} value={v.key}>{v.displayName}</option>
                    ))}
                  </Select>
                </FieldRow>
              </div>

              <FieldRow label="Body" htmlFor="h-body" optionalLabel error={errors.body}
                help="The expanded card contents when the chip is opened.">
                <Textarea id="h-body" rows={4} value={draft.body}
                  onChange={(e) => set("body", e.currentTarget.value)} />
              </FieldRow>

              <FieldRow label="Learn more link" htmlFor="h-link" optionalLabel error={errors.link_url}
                help="Where the chip's link goes — for example /services/embedded-systems-and-firmware">
                <Input id="h-link" value={draft.link_url}
                  onChange={(e) => set("link_url", e.currentTarget.value)} />
              </FieldRow>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" icon={Save} iconPosition="start" loading={pending}
                onClick={save} disabled={!databaseReady}>
                Save hotspot
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setDraft(null); setPlacing(false); }}>
                Cancel
              </Button>
            </div>

            {/* The icon picker writes to a hidden input; mirror it into state. */}
            <IconMirror onChange={(v) => set("icon", v)} />
          </section>
        )}
      </div>
    </div>
  );
}

/** Reads the IconPicker's hidden input so its value reaches the draft state. */
function IconMirror({ onChange }: { onChange: (value: string) => void }) {
  React.useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('input[name="__icon"]');
    if (!input) return;
    const observer = new MutationObserver(() => onChange(input.value));
    observer.observe(input, { attributes: true, attributeFilter: ["value"] });
    onChange(input.value);
    return () => observer.disconnect();
  }, [onChange]);
  return null;
}
