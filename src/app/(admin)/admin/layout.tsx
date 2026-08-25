import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { getAdminProfile, hasRole, isSchemaApplied } from "@/lib/auth";
import { Toaster } from "sonner";
import { AdminShell } from "@/components/admin/AdminShell";
import { Button } from "@/components/primitives/Button";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Anode Admin" },
  robots: { index: false, follow: false, nocache: true },
};

// Never served from cache; every request re-checks the session and the role.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Before a Supabase project exists the admin explains itself rather than
  // crashing — the schema and policies are all in supabase/migrations.
  if (!isSupabaseConfigured) {
    return <SetupRequired reason="no-project" />;
  }

  // Configured, but the migrations have not run yet. Show the remaining steps
  // instead of a 500 from querying tables that do not exist.
  if (!(await isSchemaApplied())) {
    return <SetupRequired reason="no-schema" />;
  }

  const profile = await getAdminProfile();
  if (!profile) redirect("/admin/login");
  if (!profile.isActive) redirect("/admin/login?reason=inactive");
  if (!hasRole(profile.roles, "viewer")) redirect("/admin/no-access");

  return (
    <>
      <AdminShell profile={profile}>{children}</AdminShell>
      <Toaster position="bottom-right" toastOptions={{ className: "font-sans" }} />
    </>
  );
}

function SetupRequired({ reason }: { reason: "no-project" | "no-schema" }) {
  const noSchema = reason === "no-schema";
  return (
    <div className="min-h-dvh bg-bg-subtle">
      <div className="mx-auto max-w-2xl px-6 py-24">
        <span className="mb-6 inline-flex size-12 items-center justify-center rounded-xl bg-warning/12 text-warning">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <h1 className="text-h2 mb-4 text-fg">
          {noSchema ? "Almost there — the schema is not applied" : "The admin needs a database"}
        </h1>
        <p className="mb-6 text-body-lg text-fg-muted">
          {noSchema ? (
            <>
              The project is connected, but its tables do not exist yet, so there is nothing to sign
              in to. Run{" "}
              <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-[0.85em]">supabase/apply-all.sql</code>{" "}
              once and this page becomes the login form.
            </>
          ) : (
            <>
              The public site is running from the typed seed dataset in{" "}
              <code className="rounded bg-bg px-1.5 py-0.5 font-mono text-[0.85em]">src/content</code>, which is
              why every page renders. The CMS needs a live Supabase project before it can save anything.
            </>
          )}
        </p>

        <ol className="mb-8 flex flex-col gap-4">
          {[
            { n: "01", t: "Create a Supabase project", d: "Any region. Note the project URL and both API keys." },
            { n: "02", t: "Add the environment variables", d: "Copy .env.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY." },
            { n: "03", t: "Apply the migrations", d: "supabase link --project-ref <ref> && supabase db push — this creates all 35 tables, the RLS policies and the storage buckets." },
            { n: "04", t: "Load the seed", d: "psql \"$DATABASE_URL\" -f supabase/seed.sql — the same content the site is showing now, generated from src/content." },
            { n: "05", t: "Invite yourself as owner", d: "Create a user in the Supabase dashboard, then insert a row into user_roles with role = 'owner'." },
          ].filter((s) => !noSchema || Number(s.n) >= 3).map((s) => (
            <li key={s.n} className="flex gap-4 rounded-xl border border-border bg-surface p-5">
              <span className="tabular shrink-0 font-mono text-[0.75rem] text-brand">{s.n}</span>
              <div>
                <p className="text-h4 mb-1 text-fg">{s.t}</p>
                <p className="text-body-sm text-fg-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <Button asChild variant="secondary">
          <Link href="/">Back to the site</Link>
        </Button>
      </div>
    </div>
  );
}
