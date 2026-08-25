import type { AppRole } from "@/types/app";

/**
 * Pure role logic — safe on both sides of the client boundary.
 * Kept out of lib/auth.ts so a client component importing ROLE_RANK does not
 * drag the service-role client into the browser bundle.
 */
export const ROLE_RANK: Record<AppRole, number> = {
  viewer: 0, sales: 1, editor: 2, admin: 3, owner: 4,
};

export const ROLES: AppRole[] = ["viewer", "sales", "editor", "admin", "owner"];

/**
 * The hierarchy is NOT purely linear.
 *
 * `sales` and `editor` are sibling capabilities: one handles commercial
 * records (quotes, messages, attachments), the other handles content. Only
 * `admin` and `owner` hold both. A plain rank comparison would let an editor
 * read every quote request, which the role matrix explicitly forbids.
 *
 * This mirrors `public.is_sales()` in the database, so the application check
 * and the RLS policy can never disagree.
 */
export function hasRole(roles: AppRole[], required: AppRole): boolean {
  if (required === "sales") {
    return roles.some((r) => r === "sales" || ROLE_RANK[r] >= ROLE_RANK.admin);
  }
  return roles.some((r) => ROLE_RANK[r] >= ROLE_RANK[required]);
}

export function topRole(roles: AppRole[]): AppRole {
  return roles.reduce<AppRole>((best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best), "viewer");
}
