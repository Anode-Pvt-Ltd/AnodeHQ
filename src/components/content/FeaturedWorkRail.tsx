"use client";

import * as React from "react";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCard } from "./Cards";
import type { ProjectCardData } from "@/types/app";

/**
 * Horizontal snap rail with a circular next control, as in the reference.
 * Native scroll — the buttons are a convenience, not the only way to move.
 */
export function FeaturedWorkRail({ projects }: { projects: ProjectCardData[] }) {
  const railRef = React.useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(false);

  const sync = React.useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }, []);

  React.useEffect(() => {
    sync();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync]);

  const nudge = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    const card = el.querySelector("li");
    const step = card ? card.clientWidth + 20 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={railRef}
        className="snap-rail -mx-5 gap-5 px-5 pb-2 sm:mx-0 sm:px-0"
        aria-label="Featured case studies"
      >
        {projects.map((p, i) => (
          <li key={p.slug} className="w-[80vw] max-w-[19rem] sm:w-[19rem]">
            <ProjectCard project={p} size="sm" priority={i === 0} />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          disabled={atStart}
          aria-label="Previous projects"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg transition-all",
            "hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-border disabled:hover:text-fg",
          )}
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          disabled={atEnd}
          aria-label="More projects"
          className={cn(
            "inline-flex size-11 items-center justify-center rounded-full border border-border bg-surface text-fg transition-all",
            "hover:border-brand hover:text-brand disabled:opacity-35 disabled:hover:border-border disabled:hover:text-fg",
          )}
        >
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
