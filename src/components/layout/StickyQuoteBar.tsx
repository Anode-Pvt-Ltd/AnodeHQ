"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/utils";

/** Appears once the hero has left the viewport. Never rendered at lg and above. */
export function StickyQuoteBar({ responsePromise }: { responsePromise: string }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-md lg:hidden",
        "pb-[env(safe-area-inset-bottom)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-standard)]",
        show ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!show}
    >
      <div className="container-page flex items-center justify-between gap-4 py-3">
        <p className="min-w-0 truncate text-[0.8125rem] text-fg-muted">{responsePromise}</p>
        <Button asChild size="sm" icon={ArrowRight} className="shrink-0" tabIndex={show ? 0 : -1}>
          <Link href="/quote">Get a Quote</Link>
        </Button>
      </div>
    </div>
  );
}
