"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { FieldRow, Input, Select } from "@/components/primitives/Field";
import { Badge } from "@/components/primitives/Badge";
import { deleteUser, inviteUser, setUserActive, setUserRole } from "@/lib/mutations/users";
import type { AppRole } from "@/types/app";

const ROLES: AppRole[] = ["viewer", "sales", "editor", "admin", "owner"];

const ROLE_HELP: Record<AppRole, string> = {
  viewer: "Reads drafts and previews. Changes nothing.",
  sales: "Quotes and messages: read, assign, move status, download attachments.",
  editor: "Creates, edits and publishes content and media. Cannot delete.",
  admin: "Everything an editor can do, plus deletes, settings, navigation and the audit log.",
  owner: "Everything, plus inviting users and granting roles.",
};

export function UserManager({
  people, currentUserId, databaseReady,
}: {
  people: { id: string; name: string; isActive: boolean; roles: AppRole[] }[];
  currentUserId: string;
  databaseReady: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<AppRole>("editor");
  const [pending, startTransition] = React.useTransition();

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await inviteUser(email, role);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) { setEmail(""); router.refresh(); }
    });
  };

  const changeRole = (userId: string, next: AppRole) => {
    startTransition(async () => {
      const res = await setUserRole(userId, next);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  const remove = (userId: string, name: string) => {
    // Deliberately a two-step confirm: this cannot be undone, and deactivating
    // is the reversible option sitting right beside it.
    if (!confirm(`Permanently delete "${name}"?

This removes the account, its profile and its roles. It cannot be undone — Deactivate is the reversible option.`)) return;
    if (!confirm(`Last check: delete "${name}" for good?`)) return;
    startTransition(async () => {
      const res = await deleteUser(userId);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  const toggleActive = (userId: string, isActive: boolean) => {
    startTransition(async () => {
      const res = await setUserActive(userId, isActive);
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-7">
      <section className="rounded-xl border border-border bg-surface p-5 lg:p-6">
        <h2 className="text-h4 mb-4 text-fg">Invite someone</h2>
        <form onSubmit={invite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <FieldRow label="Email" htmlFor="invite-email" required className="flex-1">
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
              placeholder="engineer@anode.example"
              required
            />
          </FieldRow>
          <FieldRow label="Role" htmlFor="invite-role" required className="sm:w-48">
            <Select id="invite-role" value={role} onChange={(e) => setRole(e.currentTarget.value as AppRole)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </FieldRow>
          <Button type="submit" icon={UserPlus} iconPosition="start" loading={pending} disabled={!databaseReady}>
            Send invitation
          </Button>
        </form>
        <p className="mt-3 text-[0.8125rem] text-fg-subtle">{ROLE_HELP[role]}</p>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-3.5 text-h4 text-fg">
          People <span className="tabular font-normal text-fg-subtle">({people.length})</span>
        </h2>

        {people.length === 0 ? (
          <p className="px-5 py-12 text-center text-body-sm text-fg-subtle">
            {databaseReady
              ? "No accounts yet. Invite the first one above."
              : "User management needs a database."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {people.map((p) => {
              const isMe = p.id === currentUserId;
              const topRole = p.roles.length
                ? ROLES.filter((r) => p.roles.includes(r)).at(-1)!
                : null;
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-sm font-medium text-fg">
                      {p.name}
                      {isMe && <span className="ml-2 text-fg-subtle">(you)</span>}
                    </p>
                    <p className="font-mono text-[0.75rem] text-fg-subtle">{p.id.slice(0, 8)}</p>
                  </div>

                  {!p.isActive && <Badge tone="outline">Deactivated</Badge>}
                  {!topRole && <Badge tone="warning">No role</Badge>}

                  <Select
                    aria-label={`Role for ${p.name}`}
                    value={topRole ?? ""}
                    disabled={isMe || pending || !databaseReady}
                    onChange={(e) => changeRole(p.id, e.currentTarget.value as AppRole)}
                    className="w-36"
                  >
                    <option value="" disabled>No role</option>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>

                  <button
                    type="button"
                    onClick={() => toggleActive(p.id, !p.isActive)}
                    disabled={isMe || pending || !databaseReady}
                    className="h-11 rounded-full border border-border px-3.5 text-[0.8125rem] font-medium text-fg-muted hover:border-warning hover:text-warning disabled:opacity-40"
                  >
                    {p.isActive ? "Deactivate" : "Reactivate"}
                  </button>

                  <button
                    type="button"
                    onClick={() => remove(p.id, p.name)}
                    disabled={isMe || pending || !databaseReady}
                    aria-label={`Permanently delete ${p.name}`}
                    title="Permanently delete"
                    className="inline-flex size-11 items-center justify-center rounded-full border border-border text-fg-subtle hover:border-danger hover:bg-danger/10 hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-bg-subtle p-5">
        <h2 className="text-label mb-3 text-fg-subtle">Deactivate or delete?</h2>
        <p className="mb-5 text-body-sm text-fg-muted">
          <strong className="text-fg">Deactivate</strong> is reversible: it revokes every role and
          blocks access on the next request, but keeps the account so it can be restored.{" "}
          <strong className="text-fg">Delete</strong> removes the account, its profile and its roles
          permanently. Either way the audit log keeps the record of what that person did.
        </p>
        <h2 className="text-label mb-3 text-fg-subtle">What each role can do</h2>
        <dl className="flex flex-col gap-2.5">
          {ROLES.map((r) => (
            <div key={r} className="flex gap-3 text-body-sm">
              <dt className="w-16 shrink-0 font-mono text-[0.75rem] uppercase tracking-wide text-brand">{r}</dt>
              <dd className="text-fg-muted">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
