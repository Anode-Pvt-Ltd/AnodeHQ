import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getNavigation } from "@/lib/queries";
import { Badge } from "@/components/primitives/Badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Navigation" };

export default async function NavigationPage() {
  await requireRole("admin");
  const service = createServiceClient();
  const nav = await getNavigation();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-7">
        <h1 className="text-h2 text-fg">Navigation</h1>
        <p className="mt-1.5 max-w-2xl text-body-sm text-fg-muted">
          The header menu, its mega panels and the footer columns. The Get&nbsp;a&nbsp;Quote button is
          structural rather than a navigation row — its label lives in Settings under copy.cta_band.
        </p>
      </header>

      {!service && (
        <p className="mb-6 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-body-sm text-warning">
          Read-only: navigation is currently coming from src/content/site.ts. Load the seed to edit it here.
        </p>
      )}

      <section className="mb-6 rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-3.5 text-h4 text-fg">Header</h2>
        <ul className="divide-y divide-border">
          {nav.header.map((item) => (
            <li key={item.id} className="px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="tabular w-6 font-mono text-[0.75rem] text-fg-subtle">{item.orderIndex}</span>
                <span className="flex-1 text-body-sm font-medium text-fg">{item.label}</span>
                <code className="font-mono text-[0.75rem] text-fg-subtle">{item.href}</code>
                {item.children.length > 0 && <Badge tone="neutral">{item.children.length} children</Badge>}
              </div>
              {item.children.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 border-l border-border pl-6">
                  {item.children.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 text-[0.8125rem]">
                      <span className="flex-1 text-fg-muted">{c.label}</span>
                      <code className="font-mono text-[0.75rem] text-fg-subtle">{c.href}</code>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-surface">
        <h2 className="border-b border-border px-5 py-3.5 text-h4 text-fg">Footer</h2>
        <ul className="divide-y divide-border">
          {Array.from(new Set(nav.footer.map((f) => f.columnGroup).filter(Boolean))).map((group) => (
            <li key={group} className="px-5 py-3.5">
              <p className="text-label mb-2 text-fg-subtle">{group}</p>
              <ul className="flex flex-col gap-1">
                {nav.footer.filter((f) => f.columnGroup === group).map((f) => (
                  <li key={f.id} className="flex items-center gap-3 text-[0.8125rem]">
                    <span className="flex-1 text-fg-muted">{f.label}</span>
                    <code className="font-mono text-[0.75rem] text-fg-subtle">{f.href}</code>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
