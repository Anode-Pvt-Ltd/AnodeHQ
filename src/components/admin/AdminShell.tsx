"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ExternalLink, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { LogoMark } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { RESOURCES } from "@/lib/config/resources";
import { ROLE_RANK, hasRole } from "@/lib/roles";
import type { AppRole } from "@/types/app";

interface NavEntry {
  href: string;
  label: string;
  icon: string;
  minRole: AppRole;
  group: string;
}

const FIXED: NavEntry[] = [
  { href: "/admin", label: "Dashboard", icon: "layout-grid", minRole: "viewer", group: "Inbox" },
  { href: "/admin/quotes", label: "Quotes", icon: "receipt", minRole: "sales", group: "Inbox" },
  { href: "/admin/messages", label: "Messages", icon: "mail", minRole: "sales", group: "Inbox" },
  { href: "/admin/media", label: "Media", icon: "package", minRole: "editor", group: "Assets" },
  { href: "/admin/pcb-models", label: "PCB models", icon: "circuit-board", minRole: "editor", group: "Assets" },
  { href: "/admin/navigation", label: "Navigation", icon: "list-checks", minRole: "admin", group: "Site" },
  { href: "/admin/settings", label: "Settings", icon: "settings-2", minRole: "admin", group: "Site" },
  { href: "/admin/users", label: "Users", icon: "users", minRole: "owner", group: "Admin" },
  { href: "/admin/audit-log", label: "Audit log", icon: "file-text", minRole: "admin", group: "Admin" },
];

const GROUP_ORDER = ["Inbox", "Content", "Proof", "Assets", "Site", "Admin"];

export function AdminShell({
  profile,
  children,
}: {
  profile: { fullName: string; email: string; roles: AppRole[] };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("admin:sidebar") === "collapsed");
    } catch { /* ignore */ }
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("admin:sidebar", next ? "collapsed" : "open"); } catch { /* ignore */ }
      return next;
    });
  };

  const topRole = profile.roles.reduce<AppRole>(
    (best, r) => (ROLE_RANK[r] > ROLE_RANK[best] ? r : best),
    "viewer",
  );
  // Via hasRole, so the sidebar matches the RLS policy: `sales` is a sibling
  // of `editor`, not a rung below it.
  const can = (min: AppRole) => hasRole(profile.roles, min);

  const entries: NavEntry[] = [
    ...FIXED,
    ...RESOURCES.map((r) => ({
      href: `/admin/${r.key}`,
      label: r.label.plural,
      icon: r.icon,
      minRole: r.minRole,
      group: r.group as string,
    })),
  ].filter((e) => can(e.minRole));

  const grouped = GROUP_ORDER.map((g) => ({
    group: g,
    items: entries.filter((e) => e.group === g),
  })).filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-dvh bg-bg-subtle">
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-[var(--dur-base)] lg:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <LogoMark size={26} />
          {!collapsed && <span className="font-display text-[0.9375rem] font-bold tracking-tight">Anode CMS</span>}
        </div>

        <nav aria-label="Admin" className="flex-1 overflow-y-auto px-2.5 py-4">
          {grouped.map((g) => (
            <div key={g.group} className="mb-5">
              {!collapsed && (
                <p className="mb-1.5 px-2.5 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-fg-subtle">
                  {g.group}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {g.items.map((e) => {
                  const Icon = getIcon(e.icon);
                  const active = isActive(e.href);
                  return (
                    <li key={e.href}>
                      <Link
                        href={e.href}
                        title={collapsed ? e.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.875rem] transition-colors",
                          active
                            ? "bg-teal-50 font-semibold text-brand dark:bg-teal-900/40"
                            : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {!collapsed && <span className="truncate">{e.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2.5">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.875rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
          >
            <ChevronLeft className={cn("size-4 transition-transform", collapsed && "rotate-180")} aria-hidden />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-surface/92 px-4 backdrop-blur">
          <Breadcrumb pathname={pathname} />
          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/"
              target="_blank"
              className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
            >
              View site <ExternalLink className="size-3.5" aria-hidden />
            </Link>
            <ThemeToggle />
            <div className="hidden items-center gap-2.5 border-l border-border pl-3 sm:flex">
              <div className="text-right leading-tight">
                <p className="text-[0.8125rem] font-medium text-fg">{profile.fullName}</p>
                <p className="font-mono text-[0.625rem] uppercase tracking-wide text-brand">{topRole}</p>
              </div>
              <form action="/admin/logout" method="post">
                <button
                  type="submit"
                  aria-label="Sign out"
                  className="inline-flex size-9 items-center justify-center rounded-full text-fg-muted hover:bg-bg-subtle hover:text-danger"
                >
                  <LogOut className="size-4" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean).slice(1);
  if (parts.length === 0) return <span className="text-[0.875rem] font-semibold text-fg">Dashboard</span>;
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[0.875rem]">
        <li>
          <Link href="/admin" className="text-fg-subtle hover:text-brand">Admin</Link>
        </li>
        {parts.map((p, i) => (
          <li key={p + i} className="flex min-w-0 items-center gap-1.5">
            <span className="text-fg-subtle" aria-hidden>/</span>
            <span className={cn("truncate", i === parts.length - 1 ? "font-semibold text-fg" : "text-fg-subtle")}>
              {p.length > 24 ? `${p.slice(0, 8)}…` : p.replace(/-/g, " ")}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
