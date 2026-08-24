"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];
const LABEL: Record<Mode, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = React.useState<Mode>("system");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("theme") as Mode | null;
      if (stored && ORDER.includes(stored)) setMode(stored);
    } catch { /* private mode — stay on system */ }
    setReady(true);
  }, []);

  const apply = (next: Mode) => {
    setMode(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch { /* ignore */ }
  };

  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]!;
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;

  return (
    <button
      type="button"
      onClick={() => apply(next)}
      title={LABEL[mode]}
      aria-label={`${LABEL[mode]}. Switch to ${LABEL[next].toLowerCase()}`}
      className={cn(
        "inline-flex size-11 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg",
        !ready && "opacity-0",
        className,
      )}
    >
      <Icon className="size-[1.05rem]" aria-hidden />
    </button>
  );
}

/** Runs before paint so the stamped theme never flashes. */
export const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`.trim();
