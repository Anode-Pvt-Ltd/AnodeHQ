import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/layout/Logo";
import { LoginForm } from "@/components/admin/LoginForm";
import { getAdminProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  inactive: "That account has been deactivated. Ask an owner to reactivate it.",
  expired: "Your session expired. Sign in again to continue.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  if (isSupabaseConfigured) {
    const profile = await getAdminProfile();
    if (profile?.isActive) redirect(next ?? "/admin");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-subtle p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark size={44} />
          <div>
            <h1 className="text-h3 text-fg">Anode CMS</h1>
            <p className="text-body-sm text-fg-muted">Sign in to manage the site.</p>
          </div>
        </div>

        {reason && REASONS[reason] && (
          <p role="alert" className="mb-5 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-body-sm text-warning">
            {REASONS[reason]}
          </p>
        )}

        <div className="rounded-xl border border-border bg-surface p-6">
          <LoginForm nextPath={next ?? "/admin"} configured={isSupabaseConfigured} />
        </div>

        <p className="mt-6 text-center text-body-sm text-fg-subtle">
          Accounts are invite-only.{" "}
          <Link href="/" className="font-medium text-accent underline underline-offset-4">
            Back to the site
          </Link>
        </p>
      </div>
    </div>
  );
}
