"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { getIcon } from "@/lib/icons";
import { Button } from "@/components/primitives/Button";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import type { NavItem } from "@/types/app";

export interface SiteHeaderProps {
  items: NavItem[];
  quoteLabel?: string;
}

export function SiteHeader({ items, quoteLabel = "Get a Quote" }: SiteHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);
  const [openKey, setOpenKey] = React.useState<string | null>(null);
  const [drawer, setDrawer] = React.useState(false);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setDrawer(false);
    setOpenKey(null);
  }, [pathname]);

  React.useEffect(() => {
    document.body.style.overflow = drawer ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawer]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpenKey(null); setDrawer(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = (key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenKey(key);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenKey(null), 140);
  };

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,height] duration-[var(--dur-base)] ease-[var(--ease-standard)]",
        scrolled || drawer || openKey
          ? "bg-bg/92 shadow-[0_1px_0_0_var(--color-border)] backdrop-blur-md"
          : "bg-transparent",
      )}
      data-scrolled={scrolled}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
      >
        Skip to content
      </a>

      <div className="container-page">
        <div
          className={cn(
            "flex items-center justify-between gap-6 transition-[height] duration-[var(--dur-base)]",
            scrolled ? "h-[60px]" : "h-[72px]",
          )}
        >
          <Logo />

          {/* desktop nav */}
          <nav aria-label="Main" className="hidden lg:flex lg:items-center lg:gap-1">
            {items.map((item) => {
              const hasChildren = item.children.length > 0;
              const isOpen = openKey === item.id;
              return (
                <div
                  key={item.id}
                  className="relative"
                  onMouseEnter={() => hasChildren && open(item.id)}
                  onMouseLeave={scheduleClose}
                >
                  <Link
                    href={item.href}
                    aria-expanded={hasChildren ? isOpen : undefined}
                    aria-haspopup={hasChildren || undefined}
                    onFocus={() => hasChildren && open(item.id)}
                    className={cn(
                      "inline-flex h-10 items-center gap-1 rounded-full px-3.5 text-[0.9375rem] font-medium transition-colors",
                      "hover:bg-bg-subtle",
                      isActive(item.href) ? "text-brand" : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {item.label}
                    {hasChildren && (
                      <ChevronDown
                        className={cn("size-3.5 transition-transform duration-[var(--dur-fast)]", isOpen && "rotate-180")}
                        aria-hidden
                      />
                    )}
                  </Link>

                  {hasChildren && isOpen && (
                    <MegaPanel item={item} onNavigate={() => setOpenKey(null)} />
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild size="sm" icon={ArrowRight} className="hidden sm:inline-flex">
              <Link href="/quote">{quoteLabel}</Link>
            </Button>
            <button
              type="button"
              onClick={() => setDrawer((v) => !v)}
              aria-expanded={drawer}
              aria-controls="mobile-drawer"
              aria-label={drawer ? "Close menu" : "Open menu"}
              className="inline-flex size-11 items-center justify-center rounded-full text-fg hover:bg-bg-subtle lg:hidden"
            >
              {drawer ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>
          </div>
        </div>
      </div>

      {drawer && <MobileDrawer items={items} onClose={() => setDrawer(false)} isActive={isActive} />}
    </header>
  );
}

/* ---------------------------------------------------------- mega panel */

function MegaPanel({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const wide = item.children.some((c) => c.description);
  return (
    <div
      className={cn(
        "absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2",
        wide ? "w-[min(42rem,90vw)]" : "w-[17rem]",
      )}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-surface p-2 shadow-lg">
        <ul className={cn("grid gap-0.5", wide ? "sm:grid-cols-2" : "grid-cols-1")}>
          {item.children.map((child) => {
            const Icon = getIcon(child.icon);
            return (
              <li key={child.id}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  className="group flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-bg-subtle"
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-50 text-brand dark:bg-teal-900/50">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.9375rem] font-semibold text-fg group-hover:text-brand">
                      {child.label}
                    </span>
                    {child.description && (
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-fg-muted">
                        {child.description}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {wide && (
          <div className="mt-1 rounded-lg bg-bg-subtle p-3.5">
            <p className="text-[0.8125rem] text-fg-muted">
              Not sure where your project fits?{" "}
              <Link href="/process" onClick={onNavigate} className="font-medium text-accent underline underline-offset-4">
                See how we work
              </Link>{" "}
              or{" "}
              <Link href="/quote" onClick={onNavigate} className="font-medium text-accent underline underline-offset-4">
                send us the constraints
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- mobile drawer */

function MobileDrawer({
  items, onClose, isActive,
}: { items: NavItem[]; onClose: () => void; isActive: (href: string) => boolean }) {
  return (
    <div
      id="mobile-drawer"
      className="fixed inset-x-0 bottom-0 top-[60px] z-40 overflow-y-auto overscroll-contain border-t border-border bg-bg lg:hidden"
    >
      <nav aria-label="Mobile" className="container-page py-6">
        <ul className="flex flex-col divide-y divide-border">
          {items.map((item) => (
            <li key={item.id} className="py-1">
              {item.children.length ? (
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-3 text-lg font-semibold text-fg [&::-webkit-details-marker]:hidden">
                    {item.label}
                    <ChevronDown className="size-4 text-fg-subtle transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="flex flex-col gap-0.5 pb-3 pl-1">
                    <li>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className="block rounded-md px-3 py-2.5 text-[0.9375rem] font-medium text-brand"
                      >
                        All {item.label.toLowerCase()}
                      </Link>
                    </li>
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={child.href}
                          onClick={onClose}
                          className="block rounded-md px-3 py-2.5 text-[0.9375rem] text-fg-muted hover:bg-bg-subtle hover:text-fg"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : (
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "block py-3.5 text-lg font-semibold",
                    isActive(item.href) ? "text-brand" : "text-fg",
                  )}
                >
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3">
          <Button asChild size="lg" fullWidth icon={ArrowRight}>
            <Link href="/quote" onClick={onClose}>Get a Quote</Link>
          </Button>
          <Button asChild size="lg" variant="secondary" fullWidth>
            <Link href="/contact" onClick={onClose}>Contact us</Link>
          </Button>
        </div>
      </nav>
    </div>
  );
}
