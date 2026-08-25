"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, logAudit } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import type { AppRole } from "@/types/app";
import type { ActionResult } from "./content";

const ROLES = ["viewer", "sales", "editor", "admin", "owner"] as const;

export async function inviteUser(email: string, role: AppRole): Promise<ActionResult> {
  try {
    const actor = await requireRole("owner");
    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const parsed = z.object({
      email: z.string().email("Enter a valid email address"),
      role: z.enum(ROLES),
    }).safeParse({ email, role });
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
    }

    const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${env.siteUrl.replace(/\/$/, "")}/admin`,
    });
    if (error || !data.user) {
      return { ok: false, message: error?.message ?? "Could not send that invitation." };
    }

    // The auth trigger creates the profile; the role is granted here.
    await service.from("user_roles").insert({
      user_id: data.user.id,
      role: parsed.data.role,
      granted_by: actor.id,
    });

    await logAudit(actor.id, "insert", "user_roles", data.user.id, { email, role });
    revalidatePath("/admin/users");
    return { ok: true, message: `Invitation sent to ${email}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not invite." };
  }
}

export async function setUserRole(userId: string, role: AppRole): Promise<ActionResult> {
  try {
    const actor = await requireRole("owner");
    if (userId === actor.id) {
      return { ok: false, message: "You cannot change your own role." };
    }

    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    await service.from("user_roles").delete().eq("user_id", userId);
    const { error } = await service
      .from("user_roles").insert({ user_id: userId, role, granted_by: actor.id });
    if (error) throw error;

    await logAudit(actor.id, "update", "user_roles", userId, { role });
    revalidatePath("/admin/users");
    return { ok: true, message: `Role set to ${role}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not set the role." };
  }
}

/**
 * Permanently deletes an account.
 *
 * Deactivating is the reversible option and should be the default; this exists
 * for accounts that were created in error or never used. Deleting the auth
 * user cascades to `profiles` and then to `user_roles`, while `audit_log`
 * keeps its history because `actor_id` is `on delete set null` — so the record
 * of what that person did survives them.
 */
export async function deleteUser(userId: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("owner");
    if (userId === actor.id) {
      return { ok: false, message: "You cannot delete your own account." };
    }

    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    // Refuse to remove the last remaining owner — that would lock everyone out
    // of role management, and only an owner can grant roles.
    const { data: owners } = await service
      .from("user_roles").select("user_id").eq("role", "owner");
    const ownerIds = (owners ?? []).map((r) => String(r.user_id));
    if (ownerIds.includes(userId) && ownerIds.length <= 1) {
      return { ok: false, message: "That is the only owner. Promote someone else first." };
    }

    const { data: profile } = await service
      .from("profiles").select("full_name").eq("id", userId).maybeSingle();

    // Record it before the row disappears.
    await logAudit(actor.id, "delete", "profiles", userId, {
      full_name: profile?.full_name ?? null,
    });

    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) throw error;

    revalidatePath("/admin/users");
    return { ok: true, message: `${profile?.full_name ?? "Account"} permanently deleted.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not delete the account." };
  }
}

export async function setUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  try {
    const actor = await requireRole("owner");
    if (userId === actor.id) {
      return { ok: false, message: "You cannot deactivate your own account." };
    }

    const service = createServiceClient();
    if (!service) return { ok: false, message: "The database is not configured." };

    const { error } = await service.from("profiles").update({ is_active: isActive }).eq("id", userId);
    if (error) throw error;

    // has_role() joins profiles.is_active, so access ends at the next request
    // rather than at the next token refresh.
    if (!isActive) await service.from("user_roles").delete().eq("user_id", userId);

    await logAudit(actor.id, "update", "profiles", userId, { is_active: isActive });
    revalidatePath("/admin/users");
    return { ok: true, message: isActive ? "Reactivated." : "Deactivated." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Could not update." };
  }
}
