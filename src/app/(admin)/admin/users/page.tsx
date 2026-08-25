import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { UserManager } from "@/components/admin/UserManager";
import type { AppRole } from "@/types/app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireRole("owner");
  const service = createServiceClient();

  let people: { id: string; name: string; isActive: boolean; roles: AppRole[] }[] = [];

  if (service) {
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      service.from("profiles").select("id, full_name, is_active").order("full_name"),
      service.from("user_roles").select("user_id, role"),
    ]);

    const byUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const list = byUser.get(String(r.user_id)) ?? [];
      list.push(r.role as AppRole);
      byUser.set(String(r.user_id), list);
    }

    people = (profiles ?? []).map((p) => ({
      id: String(p.id),
      name: String(p.full_name),
      isActive: Boolean(p.is_active),
      roles: byUser.get(String(p.id)) ?? [],
    }));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">Users</h1>
        <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">
          Accounts are invite-only, and a new one starts with no role at all. An owner cannot alter
          their own grants — that door is closed in the policy, not just in this screen.
        </p>
      </header>

      <UserManager people={people} currentUserId={me.id} databaseReady={Boolean(service)} />
    </div>
  );
}
