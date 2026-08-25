"use server";

import { revalidateTag } from "next/cache";
import { requireRole, logAudit } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { ActionResult } from "./content";

export async function updateMedia(
  id: string,
  patch: { alt_text?: string | null; caption?: string | null; focal_x?: number; focal_y?: number },
): Promise<ActionResult> {
  try {
    const actor = await requireRole("editor");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { error } = await service.from("media").update(patch).eq("id", id);
    if (error) {
      // The alt-text check constraint is the most likely rejection.
      if (error.message.includes("media_alt_required")) {
        return { ok: false, message: "Images must have alt text. Describe what the image shows." };
      }
      throw error;
    }

    await logAudit(actor.id, "update", "media", id, patch);
    revalidateTag("media", "max");
    return { ok: true, message: "Saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save." };
  }
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("admin");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { data: row } = await service
      .from("media").select("bucket, path, filename").eq("id", id).maybeSingle();

    // Row first: every content FK is `on delete set null`, so a delete breaks
    // an image, never a page (spec §14.5).
    const { error } = await service.from("media").delete().eq("id", id);
    if (error) throw error;

    if (row) {
      await service.storage.from(String(row.bucket)).remove([String(row.path)]);
    }

    await logAudit(actor.id, "delete", "media", id, row);
    revalidateTag("media", "max");
    return { ok: true, message: "Deleted." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not delete." };
  }
}
