import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const done = new URL("/newsletter/confirmed", env.siteUrl);

  if (!token) {
    done.searchParams.set("status", "invalid");
    return NextResponse.redirect(done);
  }

  const service = createServiceClient();
  if (!service) {
    done.searchParams.set("status", "ok");
    return NextResponse.redirect(done);
  }

  const { data, error } = await service
    .from("newsletter_subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("confirm_token", token)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  done.searchParams.set("status", error || !data ? "invalid" : "ok");
  return NextResponse.redirect(done);
}
