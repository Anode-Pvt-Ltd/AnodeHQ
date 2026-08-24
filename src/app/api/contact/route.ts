import type { NextRequest } from "next/server";
import { fail, ipHash, ok, runGate, zodFail } from "@/lib/api";
import { contactSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { sendContactEmails } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "We could not read that request.");
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const gated = await runGate(
    req,
    { website: input.website, startedAt: input.startedAt, turnstileToken: input.turnstileToken },
    "contact",
    5,
    3600,
  );
  if (gated) return gated;

  const service = createServiceClient();
  if (service) {
    const { error } = await service.from("contact_messages").insert({
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      subject: input.subject || null,
      message: input.message,
      ip_hash: ipHash(req),
    });
    if (error) {
      console.error("[contact] insert failed", error);
      return fail("INTERNAL", "We could not send that message. Please email us directly.");
    }
  } else {
    console.info("[contact] no database configured; message accepted", { email: input.email });
  }

  await sendContactEmails({ input });
  return ok({ received: true }, 201);
}
