import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { checkRateLimit, fail, ipHash, ok, zodFail } from "@/lib/api";
import { newsletterSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { sendNewsletterConfirm } from "@/lib/notify";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "We could not read that request.");
  }

  const parsed = newsletterSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { email, source, website } = parsed.data;

  if (website) return ok({ subscribed: true }, 202); // honeypot: silent success

  const allowed = await checkRateLimit(ipHash(req), "newsletter", 3, 3600);
  if (!allowed) {
    return fail("RATE_LIMITED", "Too many sign-ups from this connection. Try again later.", {
      retryAfterSeconds: 3600,
    });
  }

  const token = randomUUID();
  const service = createServiceClient();

  if (service) {
    const { error } = await service
      .from("newsletter_subscribers")
      .upsert(
        { email, status: "pending", confirm_token: token, source: { from: source ?? "site" } },
        { onConflict: "email", ignoreDuplicates: false },
      );
    if (error) {
      console.error("[newsletter] upsert failed", error);
      // Deliberately still a 200 — never reveal whether an address is on the list.
      return ok({ subscribed: true }, 202);
    }
  } else {
    console.info("[newsletter] no database configured; would subscribe", { email });
  }

  await sendNewsletterConfirm(email, token, env.siteUrl);
  return ok({ subscribed: true }, 202);
}
