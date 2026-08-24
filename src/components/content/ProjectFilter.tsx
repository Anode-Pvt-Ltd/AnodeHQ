"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/primitives/Button";
import { ProjectCard } from "./Cards";
import type { IndustrySummary, ProjectCardData, ServiceSummary } from "@/types/app";

/**
 * Filtering happens client-side over the full published set — no refetch —
 * and the URL is the state, so a filtered view is shareable. Spec §5.4.
 */
export function ProjectFilter({
  projects, services, industries,
}: {
  projects: ProjectCardData[];
  services: ServiceSummary[];
  industries: IndustrySummary[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const service = params.get("service") ?? "";
  const industry = params.get("industry") ?? "";
  const year = params.get("year") ?? "";

  const years = React.useMemo(
    () => Array.from(new Set(projects.map((p) => p.year))).sort((a, b) => b - a),
    [projects],
  );

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (!value || next.get(key) === value) next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      router.replace(qs ? `/projects?${qs}` : "/projects", { scroll: false });
    },
    [params, router],
  );

  const clear = () => router.replace("/projects", { scroll: false });

  const filtered = React.useMemo(
    () =>
      projects.filter(
        (p) =>
          (!service || p.services.some((s) => s.slug === service)) &&
          (!industry || p.industry?.slug === industry) &&
          (!year || String(p.year) === year),
      ),
    [projects, service, industry, year],
  );

  const activeCount = [service, industry, year].filter(Boolean).length;

  const facets = (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
      <Facet
        label="Service"
        options={services.map((s) => ({ value: s.slug, label: s.title }))}
        active={service}
        onSelect={(v) => setParam("service", v)}
      />
      <Facet
        label="Industry"
        options={industries.map((i) => ({ value: i.slug, label: i.name }))}
        active={industry}
        onSelect={(v) => setParam("industry", v)}
      />
      <Facet
        label="Year"
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
        active={year}
        onSelect={(v) => setParam("year", v)}
      />
    </div>
  );

  return (
    <div>
      {/* mobile trigger */}
      <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          icon={SlidersHorizontal}
          iconPosition="start"
          onClick={() => setSheetOpen(true)}
        >
          Filter{activeCount ? ` (${activeCount})` : ""}
        </Button>
        <p className="tabular text-body-sm text-fg-muted" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "project" : "projects"}
        </p>
      </div>

      {/* desktop bar */}
      <div className="mb-10 hidden lg:block">
        {facets}
        <div className="mt-5 flex items-center gap-4 border-t border-border pt-4">
          <p className="tabular text-body-sm text-fg-muted" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "project" : "projects"}
          </p>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 text-body-sm font-medium text-accent hover:underline"
            >
              <X className="size-3.5" aria-hidden /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* mobile sheet */}
      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filter projects"
          className="fixed inset-0 z-50 flex flex-col bg-bg p-5 lg:hidden"
        >
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-h3 text-fg">Filter</h2>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="Close filters"
              className="inline-flex size-11 items-center justify-center rounded-full hover:bg-bg-subtle"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">{facets}</div>
          <div className="mt-6 flex gap-3">
            <Button variant="secondary" fullWidth onClick={clear}>Clear</Button>
            <Button fullWidth onClick={() => setSheetOpen(false)}>
              Show {filtered.length}
            </Button>
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <li key={p.slug}>
              <ProjectCard project={p} priority={i < 3} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-6 py-16 text-center">
          <h2 className="text-h3 mb-2 text-fg">No projects match those filters</h2>
          <p className="mx-auto mb-6 max-w-md text-body-sm text-fg-muted">
            Roughly a third of our work is under NDA and never appears here. Tell us what you are
            building and we will point you at the closest comparable project.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" onClick={clear}>Clear filters</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Facet({
  label, options, active, onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  active: string;
  onSelect: (v: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-label mb-2.5 text-fg-subtle">{label}</legend>
      <ul className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const isActive = active === o.value;
          return (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => onSelect(o.value)}
                aria-pressed={isActive}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[0.8125rem] font-medium transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                  isActive
                    ? "border-brand bg-brand text-on-brand"
                    : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
                )}
              >
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
