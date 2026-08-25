"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";
import { requireRole, logAudit } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { ActionResult } from "./content";

const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() });

const hotspotSchema = z.object({
  id: z.string().uuid().optional(),
  model_id: z.string().uuid(),
  label: z.string().trim().min(1, "Label is required").max(40),
  value: z.string().trim().min(1, "Value is required").max(40),
  detail: z.string().trim().max(60).nullable().optional(),
  icon: z.string().trim().max(60).nullable().optional(),
  position: vec3,
  normal: vec3,
  anchor: z.enum(["left", "right", "top", "bottom"]),
  body: z.string().trim().max(600).nullable().optional(),
  link_url: z.string().trim().max(300).nullable().optional(),
  variant_key: z.string().trim().max(40).nullable().optional(),
  order_index: z.number().int().min(0).max(99),
  is_active: z.boolean(),
});

export type HotspotInput = z.infer<typeof hotspotSchema>;

/**
 * Writes a hotspot and purges the homepage hero. Coordinates arrive from a
 * raycast against the actual mesh, never typed — spec §13.6.
 */
export async function saveHotspot(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole("editor");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const parsed = hotspotSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      return { ok: false, fieldErrors, message: "Check the highlighted fields." };
    }

    const { id, ...values } = parsed.data;

    if (id) {
      const { error } = await service.from("pcb_hotspots").update(values).eq("id", id);
      if (error) throw error;
      await logAudit(actor.id, "update", "pcb_hotspots", id, values);
    } else {
      const { data, error } = await service
        .from("pcb_hotspots").insert(values).select("id").single();
      if (error) throw error;
      await logAudit(actor.id, "insert", "pcb_hotspots", String(data.id), values);
    }

    revalidateTag("pcb:hero", "max");
    return { ok: true, message: "Hotspot saved. The homepage hero updates on the next request." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save the hotspot." };
  }
}

export async function deleteHotspot(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("editor");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { error } = await service.from("pcb_hotspots").delete().eq("id", id);
    if (error) throw error;

    await logAudit(actor.id, "delete", "pcb_hotspots", id);
    revalidateTag("pcb:hero", "max");
    return { ok: true, message: "Hotspot deleted." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not delete." };
  }
}

const cameraSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  fov: z.number().min(10).max(90),
});

/** "Use current view" — writes the live camera into camera_default. */
export async function saveCameraDefault(modelId: string, camera: unknown): Promise<ActionResult> {
  try {
    const actor = await requireRole("editor");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const parsed = cameraSchema.safeParse(camera);
    if (!parsed.success) return { ok: false, message: "That camera position is not valid." };

    const { error } = await service
      .from("pcb_models").update({ camera_default: parsed.data }).eq("id", modelId);
    if (error) throw error;

    await logAudit(actor.id, "update", "pcb_models", modelId, { camera_default: parsed.data });
    revalidateTag("pcb:hero", "max");
    return { ok: true, message: "Default view saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save the view." };
  }
}

export async function setHeroModel(modelId: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("editor");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    // A unique index guarantees only one hero; demote the incumbent first.
    await service.from("pcb_models").update({ is_hero: false }).eq("is_hero", true);
    const { error } = await service.from("pcb_models").update({ is_hero: true }).eq("id", modelId);
    if (error) throw error;

    await logAudit(actor.id, "update", "pcb_models", modelId, { is_hero: true });
    revalidateTag("pcb:hero", "max");
    return { ok: true, message: "This board is now the homepage hero." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not promote the board." };
  }
}
