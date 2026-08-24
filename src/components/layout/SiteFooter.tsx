import Link from "next/link";
import { Container } from "@/components/primitives/Container";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { Logo } from "./Logo";
import type { Certification, NavItem, SiteSettings } from "@/types/app";

/** Real brand marks — lucide v1 dropped them, so they are drawn inline. */
const BRAND_PATHS: Record<string, string> = {
  linkedin:
    "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C21.4 8.65 22 11.1 22 14.3V21h-4v-5.9c0-1.4-.03-3.2-1.95-3.2-1.96 0-2.26 1.53-2.26 3.1V21h-4V9Z",
  github:
    "M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z",
  youtube:
    "M21.6 7.2s-.2-1.4-.8-2c-.76-.8-1.6-.8-2-.85C16 4.2 12 4.2 12 4.2h-.01s-4 0-6.8.15c-.4.05-1.24.05-2 .85-.6.6-.79 2-.79 2S2.2 8.84 2.2 10.5v1.54c0 1.65.2 3.3.2 3.3s.2 1.4.79 2c.76.8 1.76.78 2.21.86 1.6.15 6.6.2 6.6.2s4 0 6.8-.16c.4-.05 1.24-.05 2-.85.6-.6.8-2 .8-2s.2-1.65.2-3.3V10.5c0-1.66-.2-3.3-.2-3.3ZM9.94 14.4V8.9l5.15 2.76-5.15 2.74Z",
};

function BrandIcon({ icon }: { icon: string }) {
  const d = BRAND_PATHS[icon];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" className="size-[1.05rem]" fill="currentColor" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export interface SiteFooterProps {
  settings: SiteSettings;
  items: NavItem[];
  certifications: Certification[];
}

export function SiteFooter({ settings, items, certifications }: SiteFooterProps) {
  const groups = Array.from(new Set(items.map((i) => i.columnGroup).filter(Boolean) as string[]));
  const { contact, social, features } = settings;

  return (
    <footer className="border-t border-border bg-bg-subtle">
      <Container>
        <div className="grid gap-12 py-16 lg:grid-cols-[1.1fr_2fr] lg:gap-16 lg:py-20">
          {/* identity + newsletter */}
          <div className="flex flex-col gap-6">
            <Logo />
            <p className="max-w-sm text-body-sm text-fg-muted">
              End-to-end electronics design — circuit and schematic, high-speed PCB layout, embedded
              firmware, prototyping, test and manufacturing support.
            </p>

            {features.newsletter && (
              <div className="max-w-sm">
                <h2 className="text-label mb-2 text-fg-subtle">Notes from the bench</h2>
                <NewsletterForm />
              </div>
            )}

            {social.length > 0 && (
              <ul className="flex items-center gap-2">
                {social.map((s) => (
                  <li key={s.label}>
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="inline-flex size-10 items-center justify-center rounded-full border border-border text-fg-muted transition-colors hover:border-brand hover:text-brand"
                    >
                      <BrandIcon icon={s.icon} />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* link columns */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {groups.map((group) => (
              <nav key={group} aria-label={group}>
                <h2 className="text-label mb-4 text-fg-subtle">{group}</h2>
                <ul className="flex flex-col gap-2.5">
                  {items
                    .filter((i) => i.columnGroup === group)
                    .sort((a, b) => a.orderIndex - b.orderIndex)
                    .map((i) => (
                      <li key={i.id}>
                        <Link
                          href={i.href}
                          className="text-body-sm text-fg-muted transition-colors hover:text-brand"
                        >
                          {i.label}
                        </Link>
                      </li>
                    ))}
                </ul>
              </nav>
            ))}

            <div className="col-span-2 sm:col-span-1">
              <h2 className="text-label mb-4 text-fg-subtle">Contact</h2>
              <address className="flex flex-col gap-2.5 not-italic text-body-sm text-fg-muted">
                <a href={`mailto:${contact.email}`} className="transition-colors hover:text-brand">{contact.email}</a>
                <a href={`tel:${contact.phone.replace(/\s/g, "")}`} className="transition-colors hover:text-brand">{contact.phone}</a>
                <span className="mt-1 block leading-relaxed">
                  {contact.addressLines.map((l) => <span key={l} className="block">{l}</span>)}
                </span>
              </address>
            </div>
          </div>
        </div>

        {/* certifications */}
        {certifications.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border py-6">
            <span className="text-label text-fg-subtle">Accredited</span>
            {certifications.map((c) => (
              <span key={c.id} className="font-mono text-[0.75rem] tracking-wide text-fg-muted" title={c.description}>
                {c.name}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border py-6 text-[0.8125rem] text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {contact.legalName}. All rights reserved.</p>
          <p className="font-mono text-[0.75rem]">{contact.responsePromise}</p>
        </div>
      </Container>
    </footer>
  );
}
