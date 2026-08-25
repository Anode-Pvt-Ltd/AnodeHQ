import type { Metadata } from "next";

/**
 * Un-gated admin routes.
 *
 * /admin/login and /admin/no-access must NOT sit under the gating layout in
 * the (admin) group: that layout redirects anyone without a session to
 * /admin/login, so hosting the login page inside it makes the page redirect
 * to itself forever. Same for /admin/no-access, which is where a signed-in
 * user with no role is sent.
 *
 * Route groups do not affect the URL, so these still serve from /admin/*.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
