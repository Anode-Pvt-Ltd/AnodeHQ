"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll reveal. The revealed state is the CSS default, so with reduced motion,
 * without JS, or before hydration the content is already in its final position.
 */
export function Reveal({
  children, delay = 0, className, as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "li" | "section" | "article";
}) {
  const ref = React.useRef<HTMLElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // @ts-expect-error -- polymorphic ref across the allowed tag union
    <Tag ref={ref} data-reveal data-revealed={shown} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties} className={className}>
      {children}
    </Tag>
  );
}

/** Staggers children by index without each one needing its own delay prop. */
export function RevealGroup({
  children, step = 70, className, as,
}: { children: React.ReactNode[]; step?: number; className?: string; as?: "div" | "li" }) {
  return (
    <>
      {React.Children.map(children, (child, i) => (
        <Reveal delay={i * step} className={cn(className)} as={as}>{child}</Reveal>
      ))}
    </>
  );
}
