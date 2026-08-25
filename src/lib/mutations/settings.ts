"use server";

import { revalidateTag } from "next/cache";
import { requireRole, logAudit } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { ActionResult } from "./content";

export async function saveSetting(key: string, rawValue: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("admin");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    let value: unknown;
    try {
      value = JSON.parse(rawValue);
    } catch {
      return { ok: false, fieldErrors: { [key]: "That is not valid JSON" }, message: "Invalid JSON." };
    }

    const { error } = await service.from("site_settings").update({ value }).eq("key", key);
    if (error) throw error;

    await logAudit(actor.id, "update", "site_settings", null, { key });
    // Settings appear in the header and footer, so every page is affected.
    revalidateTag("settings", "max");
    revalidateTag("nav", "max");
    return { ok: true, message: "Saved. Every page will pick this up on its next request." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save." };
  }
}
