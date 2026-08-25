"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { offsetAlongNormal, projectPoint, type Vec3 } from "@/lib/project3d";
import type { PcbModel, PcbVariant } from "@/types/app";
import { HotspotChip } from "./HotspotChip";
import { ViewRail } from "./ViewRail";

/**
 * Capability gate + poster + hotspot overlay. The only 3D code in the initial
 * bundle is the dynamic import below; everything else here is plain DOM, so the
 * hero is complete and interactive whether or not the canvas ever loads.
 */

const PcbScene = React.lazy(() => import("./PcbScene"));

export interface ProjectionSink {
  update(id: string, leftPct: number, topPct: number, occluded: boolean, behind: boolean): void;
}

function canRender3D(): boolean {
  if (typeof window === "undefined") return false;
  // Phones get the poster — a 3D context costs more than the interaction returns.
  if (!window.matchMedia("(min-width: 768px)").matches) return false;

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData) return false;
  if (nav.connection?.effectiveType && ["slow-2g", "2g", "3g"].includes(nav.connection.effectiveType)) return false;
  if ((nav.deviceMemory ?? 4) < 4) return false;
  if ((navigator.hardwareConcurrency ?? 4) < 4) return false;

  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function PcbStage({ model }: { model: PcbModel | null }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const chipRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const [mode, setMode] = React.useState<"poster" | "loading" | "canvas">("poster");
  const [variantKey, setVariantKey] = React.useState<string>(model?.variants[0]?.key ?? "components");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const inView = React.useRef(false);

  const activeVariant: PcbVariant | undefined =
    model?.variants.find((v) => v.key === variantKey) ?? model?.variants[0];

  /* ---- decide whether to load 3D, after paint, and only while in view ---- */
  React.useEffect(() => {
    if (!model) return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);

    const el = containerRef.current;
    if (!el) return;

    const io = new IntersectionObserver(([e]) => { inView.current = Boolean(e?.isIntersecting); });
    io.observe(el);

    let cancelled = false;
    const start = () => {
      if (cancelled || !inView.current || !canRender3D()) return;
      setMode("loading");
      import("./PcbScene")
        .then(() => { if (!cancelled) setMode("canvas"); })
        .catch(() => { if (!cancelled) { setMode("poster"); setFailed(true); } });
    };

    const schedule = () => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      if (ric) ric(start, { timeout: 2500 });
      else setTimeout(start, 400);
    };

    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });

    return () => { cancelled = true; io.disconnect(); };
  }, [model]);

  /* ---- poster-mode chip placement, using the same maths as the canvas ---- */
  const posterPositions = React.useMemo(() => {
    if (!model) return new Map<string, { leftPct: number; topPct: number }>();
    const cam = activeVariant?.config.camera ?? model.cameraDefault;
    const out = new Map<string, { leftPct: number; topPct: number }>();
    for (const h of model.hotspots) {
      const p = offsetAlongNormal(h.position, h.normal, 0.12);
      const r = projectPoint(p, cam.position as Vec3, cam.target as Vec3, cam.fov, 4 / 3);
      out.set(h.id, { leftPct: r.leftPct, topPct: r.topPct });
    }
    return out;
  }, [model, activeVariant]);

  /* ---- the sink the scene writes to each frame, bypassing React state ---- */
  const sink = React.useMemo<ProjectionSink>(
    () => ({
      update(id, leftPct, topPct, occluded, behind) {
        const el = chipRefs.current.get(id);
        if (!el) return;
        el.style.left = `${leftPct}%`;
        el.style.top = `${topPct}%`;
        el.style.opacity = behind ? "0" : occluded ? "0.35" : "1";
        el.style.pointerEvents = behind ? "none" : "auto";
        // Keeps focus from landing on a chip facing away from the viewer.
        (el as HTMLElement & { inert?: boolean }).inert = behind;
      },
    }),
    [],
  );

  const registerChip = React.useCallback((id: string, el: HTMLElement | null) => {
    if (el) chipRefs.current.set(id, el);
    else chipRefs.current.delete(id);
  }, []);

  const visibleHotspots = React.useMemo(() => {
    if (!model) return [];
    const show = activeVariant?.config.showHotspots;
    if (!show || show.includes("*")) return model.hotspots;
    return model.hotspots.filter((h) => show.includes(h.id));
  }, [model, activeVariant]);

  const reset = React.useCallback(() => {
    setVariantKey(model?.variants[0]?.key ?? "components");
    setOpenId(null);
    window.dispatchEvent(new CustomEvent("anode:pcb-reset"));
  }, [model]);

  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [fullscreen]);

  if (!model) return null;

  const stage = (
    <div
      ref={containerRef}
      className={cn(
        "group/stage relative w-full overflow-hidden rounded-2xl",
        fullscreen ? "h-full" : "aspect-[4/3]",
      )}
    >
      {/* Poster — the LCP element, always painted first */}
      {model.poster && (
        <Image
          src={model.poster.localSrc ?? "/img/hero-poster.svg"}
          alt={model.poster.altText}
          fill
          priority
          unoptimized
          sizes="(max-width: 768px) 100vw, 58vw"
          className={cn(
            "object-cover transition-opacity duration-500",
            mode === "canvas" ? "opacity-0" : "opacity-100",
          )}
        />
      )}

      {/* Canvas */}
      {mode === "canvas" && (
        <React.Suspense fallback={null}>
          <PcbScene
            model={model}
            variant={activeVariant}
            sink={sink}
            hotspots={visibleHotspots}
            reducedMotion={reducedMotion}
            onFail={() => { setMode("poster"); setFailed(true); }}
          />
        </React.Suspense>
      )}

      {/* Loading state */}
      {mode === "loading" && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center" role="status" aria-live="polite">
          <span className="inline-flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 font-mono text-[0.6875rem] tracking-wide text-fg-muted shadow-sm backdrop-blur">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" />
            Loading interactive board
          </span>
        </div>
      )}

      {/* Hotspot overlay — real buttons, in both modes */}
      <ul
        className="pointer-events-none absolute inset-0 m-0 list-none p-0"
        aria-label="Board annotations"
      >
        {visibleHotspots.map((h) => (
          <HotspotChip
            key={h.id}
            hotspot={h}
            open={openId === h.id}
            onToggle={() => setOpenId((v) => (v === h.id ? null : h.id))}
            onClose={() => setOpenId(null)}
            registerRef={registerChip}
            staticPosition={mode === "canvas" ? undefined : posterPositions.get(h.id)}
          />
        ))}
      </ul>

      {/* View rail */}
      <ViewRail
        variants={model.variants}
        active={variantKey}
        onSelect={setVariantKey}
        onReset={reset}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
      />

      {/* Annotation + interaction hint */}
      <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-end justify-between gap-4">
        {activeVariant?.config.annotation && (
          <p className="max-w-[60%] rounded-md bg-surface/85 px-2.5 py-1.5 font-mono text-[0.6875rem] leading-snug text-fg-muted shadow-xs backdrop-blur">
            {activeVariant.config.annotation.text}
          </p>
        )}
        {mode === "canvas" && (
          <p className="ml-auto font-mono text-[0.6875rem] text-fg-subtle">
            Click and drag to rotate · Scroll to zoom
          </p>
        )}
      </div>

      {failed && (
        <p className="sr-only" role="status">
          The interactive 3D board is unavailable on this device. A still image with the same
          annotations is shown instead.
        </p>
      )}
    </div>
  );

  if (!fullscreen) return stage;

  return (
    <>
      <div className="aspect-[4/3] w-full rounded-2xl bg-bg-subtle" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Board — expanded view"
        className="fixed inset-0 z-[60] flex flex-col bg-bg/98 p-4 backdrop-blur-sm sm:p-8"
      >
        <div className="min-h-0 flex-1">{stage}</div>
        <p className="mt-3 text-center font-mono text-[0.6875rem] text-fg-subtle">Press Escape to close</p>
      </div>
    </>
  );
}

export { getIcon };
