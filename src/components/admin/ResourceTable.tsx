"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpDown, ExternalLink, Search, Trash2 } from "lucide-react";
import { cn, formatDateShort } from "@/lib/utils";
import { Badge } from "@/components/primitives/Badge";
import { Input } from "@/components/primitives/Field";
import { deleteContent, setStatus } from "@/lib/mutations/content";
import type { ResourceConfig } from "@/lib/config/resources";

const STATUS_TONE = {
  published: "success",
  draft: "neutral",
  scheduled: "warning",
  archived: "outline",
} as const;

export function ResourceTable({
  config,
  rows,
}: {
  config: ResourceConfig;
  rows: Record<string, unknown>[];
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState(config.defaultSort.key);
  const [sortDir, setSortDir] = React.useState(config.defaultSort.dir);
  const [pending, startTransition] = React.useTransition();

  const primaryKey = config.columns.find((c) => c.primary)?.key ?? "id";

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? rows.filter((r) =>
          config.columns.some((c) => String(r[c.key] ?? "").toLowerCase().includes(q)),
        )
      : rows;

    return [...base].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, query, sortKey, sortDir, config.columns]);

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const onDelete = (id: string, label: string) => {
    if (!confirm(`Delete “${label}”? This cannot be undone, though the audit log keeps a copy.`)) return;
    startTransition(async () => {
      const res = await deleteContent(config.key, id);
      toast[res.ok ? "success" : "error"](res.message ?? (res.ok ? "Deleted." : "Failed."));
      if (res.ok) router.refresh();
    });
  };

  const onPublish = (id: string) => {
    startTransition(async () => {
      const res = await setStatus(config.key, id, "published");
      toast[res.ok ? "success" : "error"](res.message ?? "");
      if (res.ok) router.refresh();
    });
  };

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
        <h2 className="text-h3 mb-2 text-fg">No {config.label.plural.toLowerCase()} yet</h2>
        <p className="mx-auto mb-6 max-w-md text-body-sm text-fg-muted">{config.description}</p>
        <Link
          href={`/admin/${config.key}/new`}
          className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-display text-[0.9375rem] font-semibold text-on-brand hover:bg-brand-hover"
        >
          New {config.label.singular.toLowerCase()}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <label htmlFor="res-search" className="sr-only">Filter {config.label.plural}</label>
          <Input
            id="res-search"
            type="search"
            placeholder="Filter…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            className="pl-9"
          />
        </div>
        <p className="tabular text-body-sm text-fg-muted" aria-live="polite">
          {filtered.length} of {rows.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[46rem] border-collapse text-[0.875rem]">
          <thead>
            <tr className="border-b border-border bg-bg-subtle">
              {config.columns.map((c) => (
                <th key={c.key} scope="col" className="p-0 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="flex w-full items-center gap-1.5 px-4 py-3 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-fg-subtle hover:text-fg"
                  >
                    {c.header}
                    <ArrowUpDown className={cn("size-3", sortKey === c.key ? "text-brand" : "opacity-40")} aria-hidden />
                  </button>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right font-mono text-[0.625rem] uppercase tracking-[0.12em] text-fg-subtle">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const id = String(row.id);
              const label = String(row[primaryKey] ?? id);
              return (
                <tr key={id} className="border-b border-border last:border-0 hover:bg-bg-subtle/60">
                  {config.columns.map((c) => (
                    <td key={c.key} className="px-4 py-3 align-middle">
                      {c.primary ? (
                        <Link href={`/admin/${config.key}/${id}`} className="font-medium text-fg hover:text-brand">
                          {label}
                        </Link>
                      ) : (
                        <Cell value={row[c.key]} render={c.render} />
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {config.hasStatus && row.status !== "published" && (
                        <button
                          type="button"
                          onClick={() => onPublish(id)}
                          disabled={pending}
                          className="rounded-md px-2 py-1 text-[0.75rem] font-medium text-brand hover:bg-teal-50 disabled:opacity-50 dark:hover:bg-teal-900/40"
                        >
                          Publish
                        </button>
                      )}
                      {config.previewPath && row.slug ? (
                        <Link
                          href={config.previewPath(row)}
                          target="_blank"
                          aria-label={`Preview ${label}`}
                          className="rounded-md p-1.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg"
                        >
                          <ExternalLink className="size-3.5" aria-hidden />
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDelete(id, label)}
                        disabled={pending}
                        aria-label={`Delete ${label}`}
                        className="rounded-md p-1.5 text-fg-subtle hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ value, render }: { value: unknown; render?: string }) {
  if (value == null || value === "") return <span className="text-fg-subtle">—</span>;

  switch (render) {
    case "statusPill": {
      const s = String(value) as keyof typeof STATUS_TONE;
      return <Badge tone={STATUS_TONE[s] ?? "neutral"}>{s}</Badge>;
    }
    case "boolean":
      return value ? <Badge tone="brand">Yes</Badge> : <span className="text-fg-subtle">No</span>;
    case "relativeTime":
      return <span className="tabular text-fg-muted">{formatDateShort(String(value))}</span>;
    case "number":
      return <span className="tabular text-fg-muted">{String(value)}</span>;
    default:
      return <span className="text-fg-muted">{String(value).slice(0, 80)}</span>;
  }
}
