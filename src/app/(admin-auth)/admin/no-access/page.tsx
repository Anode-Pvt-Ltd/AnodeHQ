import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getAdminProfile } from "@/lib/auth";
import { Button } from "@/components/primitives/Button";

export const dynamic = "force-dynamic";
export const metadata = { title: "No access" };

export default async function NoAccessPage() {
  const profile = await getAdminProfile();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg-subtle p-6">
      <div className="max-w-md text-center">
        <span className="mx-auto mb-6 flex size-12 items-center justify-center rounded-xl bg-warning/12 text-warning">
          <ShieldCheck className="size-6" aria-hidden />
        </span>
        <h1 className="text-h2 mb-3 text-fg">Your account has no role yet</h1>
        <p className="mb-8 text-body-lg text-fg-muted">
          {profile?.email ? `${profile.email} can sign in, ` : "You can sign in, "}
          but an owner needs to grant a role before anything is visible. New accounts deliberately
          start with no permissions at all.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild variant="secondary">
            <Link href="/">Back to the site</Link>
          </Button>
          <form action="/admin/logout" method="post">
            <Button type="submit" variant="ghost">Sign out</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
