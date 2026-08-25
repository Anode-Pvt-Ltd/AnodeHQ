import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { AuthError, QueryError } from "@/lib/errors";
import { isSupabaseConfigured } from "@/lib/env";
import type { AppRole } from "@/types/app";
import { hasRole } from "@/lib/roles";

export { ROLE_RANK, hasRole } from "@/lib/roles";


export interface AdminProfile {
  id: string;
  email: string;
  fullName: string;
  roles: AppRole[];
  isActive: boolean;
  aal: string | null;
}

/**
 * The authorisation gate. Uses getUser(), which verifies against the auth
 * server — getSession() only decodes the cookie and would accept a forged or
 * revoked token (spec §8.3).
 */
/**
 * True when the identity tables exist. A configured project whose migrations
 * have not been applied is a normal setup state, not an error — the admin
 * shows instructions rather than a 500.
 */
export const isSchemaApplied = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured) return false;
  const admin = createServiceClient();
  if (!admin) return false;
  const { error } = await admin.from("profiles").select("id").limit(1);
  if (!error) return true;
  const code = (error as { code?: string }).code;
  if (code && ["PGRST205", "PGRST202", "42P01", "42883"].includes(code)) return false;
  // Anything else is a real fault; surface it rather than hiding it.
  throw new QueryError("profiles.probe", error);
});

export const getAdminProfile = cache(async (): Promise<AdminProfile | null> => {
  if (!isSupabaseConfigured) return null;
  if (!(await isSchemaApplied())) return null;

  const sb = await createClient();
  if (!sb) return null;

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  // Read through the service client so a profile with no role yet is still
  // visible to the layout, which needs to redirect it to /admin/no-access.
  const admin = createServiceClient() ?? sb;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    admin.from("profiles").select("id, full_name, is_active").eq("id", user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!profile) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aal = (user as any).aal ?? null;

  return {
    id: profile.id as string,
    email: user.email ?? "",
    fullName: (profile.full_name as string) ?? user.email ?? "",
    roles: (roleRows ?? []).map((r) => r.role as AppRole),
    isActive: Boolean(profile.is_active),
    aal,
  };
});

/** First line of every mutation. RLS is bypassed on the service path, so this is the gate. */
export async function requireRole(required: AppRole): Promise<AdminProfile> {
  const profile = await getAdminProfile();
  if (!profile) throw new AuthError("You need to sign in.");
  if (!profile.isActive) throw new AuthError("This account is deactivated.");
  if (!hasRole(profile.roles, required)) throw new AuthError("You do not have access to this.");
  return profile;
}

export async function logAudit(
  actorId: string | null,
  action: string,
  table: string,
  recordId: string | null,
  diff?: unknown,
) {
  const service = createServiceClient();
  if (!service) return;
  await service.from("audit_log").insert({
    actor_id: actorId,
    action,
    table_name: table,
    record_id: recordId,
    diff: diff ? (diff as Record<string, unknown>) : null,
  });
}
