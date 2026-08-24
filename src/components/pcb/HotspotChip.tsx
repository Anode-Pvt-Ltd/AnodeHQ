"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import type { Hotspot } from "@/types/app";

export interface HotspotChipProps {
  hotspot: Hotspot;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  registerRef: (id: string, el: HTMLElement | null) => void;
  /** Supplied in poster mode; in canvas mode the scene positions the chip. */
  staticPosition?: { leftPct: number; topPct: number };
}

const ANCHOR_TRANSLATE: Record<Hotspot["anchor"], string> = {
  right: "translate(-6%, -50%)",
  left: "translate(-94%, -50%)",
  top: "translate(-50%, -110%)",
  bottom: "translate(-50%, 10%)",
};

export function HotspotChip({
  hotspot, open, onToggle, onClose, registerRef, staticPosition,
}: HotspotChipProps) {
  const Icon = getIcon(hotspot.icon);
  const liRef = React.useRef<HTMLLIElement>(null);
  const panelId = `hotspot-panel-${hotspot.id}`;

  React.useEffect(() => {
    registerRef(hotspot.id, liRef.current);
    return () => registerRef(hotspot.id, null);
  }, [hotspot.id, registerRef]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <li
      ref={liRef}
      className="pointer-events-auto absolute z-10"
      style={{
        left: `${staticPosition?.leftPct ?? 50}%`,
        top: `${staticPosition?.topPct ?? 50}%`,
        transform: ANCHOR_TRANSLATE[hotspot.anchor],
        transition: "opacity 200ms var(--ease-standard)",
      }}
    >
      <div className="relative">
        {/* anchor dot */}
        <span
          aria-hidden
          className={cn(
            "absolute top-1/2 size-2 -translate-y-1/2 rounded-full bg-brand ring-4 ring-brand/20",
            hotspot.anchor === "right" && "-left-1.5",
            hotspot.anchor === "left" && "-right-1.5",
            hotspot.anchor === "top" && "left-1/2 top-full -translate-x-1/2 translate-y-1",
            hotspot.anchor === "bottom" && "left-1/2 top-0 -translate-x-1/2 -translate-y-3",
          )}
        />

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex items-center gap-2.5 rounded-lg border border-border bg-surface/95 px-3 py-2 text-left shadow-chip backdrop-blur-sm",
            "transition-[transform,border-color] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
            "hover:-translate-y-0.5 hover:border-brand",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
            open && "border-brand",
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-teal-50 text-brand dark:bg-teal-900/60">
            <Icon className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[0.5625rem] uppercase tracking-[0.14em] text-fg-subtle">
              {hotspot.label}
            </span>
            <span className="block text-[0.8125rem] font-semibold leading-tight text-fg">
              {hotspot.value}
            </span>
            {hotspot.detail && (
              <span className="block font-mono text-[0.6875rem] leading-tight text-fg-muted">
                {hotspot.detail}
              </span>
            )}
          </span>
        </button>

        {open && (
          <div
            id={panelId}
            role="group"
            aria-label={`${hotspot.label} — ${hotspot.value}`}
            className={cn(
              "absolute z-20 mt-2 w-64 rounded-xl border border-border bg-surface p-4 shadow-lg",
              hotspot.anchor === "left" ? "right-0" : "left-0",
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-brand">
                {hotspot.label} · {hotspot.value}
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-m-1 rounded p-1 text-fg-subtle hover:bg-bg-subtle hover:text-fg"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
            {hotspot.body && <p className="text-[0.8125rem] leading-relaxed text-fg-muted">{hotspot.body}</p>}
            {hotspot.linkUrl && (
              <Link
                href={hotspot.linkUrl}
                className="mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-accent hover:underline"
              >
                Learn more <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
