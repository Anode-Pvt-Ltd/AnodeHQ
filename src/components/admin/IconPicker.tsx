"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getIcon, iconKeys } from "@/lib/icons";
import { Input } from "@/components/primitives/Field";

/** Searchable grid, previewed at the size the site renders it. */
export function IconPicker({
  name,
  defaultValue,
  id,
}: {
  name: string;
  defaultValue: string;
  id: string;
}) {
  const [value, setValue] = React.useState(defaultValue || "circuit-board");
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const Current = getIcon(value);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? iconKeys.filter((k) => k.includes(q)).slice(0, 60) : iconKeys.slice(0, 60);
  }, [query]);

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand dark:bg-teal-900/50">
          <Current className="size-5" aria-hidden />
        </span>
        <code className="flex-1 truncate rounded-lg border border-border bg-bg-subtle px-3 py-2.5 font-mono text-[0.8125rem] text-fg">
          {value}
        </code>
        <button
          type="button"
          id={id}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="h-11 shrink-0 rounded-lg border border-border px-4 text-[0.875rem] font-medium text-fg hover:bg-bg-subtle"
        >
          {open ? "Close" : "Change"}
        </button>
      </div>

      {open && (
        <div className="mt-3 rounded-lg border border-border bg-surface p-3">
          <Input
            type="search"
            placeholder="Search icons…"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            aria-label="Search icons"
            className="mb-3"
          />
          <ul className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-10">
            {matches.map((key) => {
              const Icon = getIcon(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    title={key}
                    onClick={() => { setValue(key); setOpen(false); }}
                    aria-pressed={key === value}
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-md transition-colors",
                      key === value ? "bg-brand text-on-brand" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    <span className="sr-only">{key}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {matches.length === 0 && (
            <p className="py-6 text-center text-body-sm text-fg-subtle">No icon matches “{query}”.</p>
          )}
        </div>
      )}
    </div>
  );
}
