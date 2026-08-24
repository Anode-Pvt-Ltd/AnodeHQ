"use client";

import { Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import type { PcbVariant } from "@/types/app";

export interface ViewRailProps {
  variants: PcbVariant[];
  active: string;
  onSelect: (key: string) => void;
  onReset: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
}

/** The vertical control rail on the right edge of the hero, as in the reference. */
export function ViewRail({
  variants, active, onSelect, onReset, fullscreen, onToggleFullscreen,
}: ViewRailProps) {
  return (
    <div className="absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-4">
      <div
        role="group"
        aria-label="Board view"
        className="flex flex-col gap-1 rounded-full border border-border bg-surface/92 p-1.5 shadow-md backdrop-blur"
      >
        {variants.map((v) => {
          const Icon = getIcon(v.icon);
          const isActive = v.key === active;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => onSelect(v.key)}
              aria-pressed={isActive}
              title={v.displayName}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full transition-colors duration-[var(--dur-fast)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
                isActive ? "bg-brand text-on-brand" : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
              )}
            >
              <Icon className="size-[1.05rem]" aria-hidden />
              <span className="sr-only">{v.displayName}</span>
            </button>
          );
        })}

        <span className="mx-auto my-0.5 h-px w-5 bg-border" aria-hidden />

        <button
          type="button"
          onClick={onReset}
          title="Reset view"
          className="inline-flex size-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          <RotateCcw className="size-[1.05rem]" aria-hidden />
          <span className="sr-only">Reset view</span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit expanded view" : "Expand"}
          aria-pressed={fullscreen}
          className="inline-flex size-9 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
        >
          {fullscreen ? <Minimize2 className="size-[1.05rem]" aria-hidden /> : <Maximize2 className="size-[1.05rem]" aria-hidden />}
          <span className="sr-only">{fullscreen ? "Exit expanded view" : "Expand board"}</span>
        </button>
      </div>
    </div>
  );
}
