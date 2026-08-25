"use server";

import { revalidatePath } from "next/cache";
import { requireRole, logAudit } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { QuoteStatus } from "@/types/app";
import type { ActionResult } from "./content";

export async function moveQuoteStatus(
  quoteId: string,
  status: QuoteStatus,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireRole("sales");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    // Status and history land in one transaction (spec §6.10).
    const { error } = await service.rpc("move_quote_status", {
      p_id: quoteId,
      p_to: status,
      p_note: note ?? null,
    });
    if (error) {
      // Fall back to a plain update if the RPC has not been applied yet.
      const { error: updateError } = await service
        .from("quote_requests").update({ status }).eq("id", quoteId);
      if (updateError) throw updateError;
    }

    await logAudit(actor.id, "update", "quote_requests", quoteId, { status, note });
    revalidatePath(`/admin/quotes/${quoteId}`);
    revalidatePath("/admin/quotes");
    return { ok: true, message: `Moved to ${status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update the status." };
  }
}

export async function assignQuote(quoteId: string, userId: string | null): Promise<ActionResult> {
  try {
    const actor = await requireRole("sales");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { error } = await service
      .from("quote_requests").update({ assigned_to: userId }).eq("id", quoteId);
    if (error) throw error;

    await logAudit(actor.id, "update", "quote_requests", quoteId, { assigned_to: userId });
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { ok: true, message: userId ? "Assigned." : "Unassigned." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not assign." };
  }
}

export async function saveInternalNotes(quoteId: string, notes: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("sales");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { error } = await service
      .from("quote_requests").update({ internal_notes: notes }).eq("id", quoteId);
    if (error) throw error;

    await logAudit(actor.id, "update", "quote_requests", quoteId, { internal_notes: "(changed)" });
    revalidatePath(`/admin/quotes/${quoteId}`);
    return { ok: true, message: "Notes saved." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not save notes." };
  }
}

/**
 * Mints a 60-second signed URL for one private attachment, after a role check,
 * and records the download in the audit log. Spec §9.4.
 */
export async function getAttachmentUrl(attachmentId: string): Promise<ActionResult & { url?: string }> {
  try {
    const actor = await requireRole("sales");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "Storage is not configured." };

    const { data: att, error } = await service
      .from("quote_attachments")
      .select("bucket, path, filename, quote_request_id")
      .eq("id", attachmentId)
      .single();
    if (error || !att) return { ok: false, message: "That attachment no longer exists." };

    const { data, error: signError } = await service.storage
      .from(String(att.bucket))
      .createSignedUrl(String(att.path), 60, { download: String(att.filename) });
    if (signError || !data) return { ok: false, message: "Could not prepare that download." };

    await logAudit(actor.id, "download", "quote_attachments", attachmentId, {
      filename: att.filename,
      quote_request_id: att.quote_request_id,
    });

    return { ok: true, url: data.signedUrl };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not prepare that download." };
  }
}

export async function setMessageStatus(
  messageId: string,
  status: "new" | "replied" | "archived" | "spam",
): Promise<ActionResult> {
  try {
    const actor = await requireRole("sales");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { error } = await service.from("contact_messages").update({ status }).eq("id", messageId);
    if (error) throw error;

    await logAudit(actor.id, "update", "contact_messages", messageId, { status });
    revalidatePath("/admin/messages");
    return { ok: true, message: `Marked ${status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update." };
  }
}
