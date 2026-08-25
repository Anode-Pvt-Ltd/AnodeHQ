import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sb = await createClient();
  if (sb) await sb.auth.signOut();
  return NextResponse.redirect(new URL("/admin/login", env.siteUrl), { status: 303 });
}
