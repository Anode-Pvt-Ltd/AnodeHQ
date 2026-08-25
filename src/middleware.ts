import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Order is fixed and must not change (spec §2.4):
 *   1. redirects, resolved from the database
 *   2. session refresh — the ONLY auth work middleware does
 *   3. a convenience redirect for /admin without a session
 *
 * Middleware never authorises. Authorisation happens in the admin layout and
 * again in Postgres, because edge middleware can be bypassed by routing quirks
 * and must never be the only gate.
 */

interface RedirectRule { source: string; destination: string; permanent: boolean }

let redirectCache: { at: number; rules: Map<string, RedirectRule> } | null = null;
const REDIRECT_TTL = 5 * 60 * 1000;

async function getRedirects(): Promise<Map<string, RedirectRule>> {
  if (redirectCache && Date.now() - redirectCache.at < REDIRECT_TTL) return redirectCache.rules;
  const rules = new Map<string, RedirectRule>();

  if (isSupabaseConfigured) {
    try {
      const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      const { data } = await sb.from("redirects").select("source, destination, permanent").limit(500);
      for (const r of data ?? []) {
        rules.set(String(r.source), {
          source: String(r.source),
          destination: String(r.destination),
          permanent: Boolean(r.permanent),
        });
      }
    } catch {
      // A redirect lookup failure must never take the site down.
    }
  }

  redirectCache = { at: Date.now(), rules };
  return rules;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1 — redirects
  const rules = await getRedirects();
  const rule = rules.get(pathname);
  if (rule) {
    const url = request.nextUrl.clone();
    url.pathname = rule.destination;
    return NextResponse.redirect(url, rule.permanent ? 308 : 307);
  }

  const response = NextResponse.next({ request });

  // 2 — session refresh
  const { user } = await updateSession(request, response);

  // 3 — convenience redirect (NOT the gate)
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (isSupabaseConfigured && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|brand/|img/|.*\\.(?:svg|png|jpg|jpeg|webp|avif|glb|ktx2|hdr|xml|txt|webmanifest)$).*)",
  ],
};
