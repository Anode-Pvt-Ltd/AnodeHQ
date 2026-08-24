import type { NextRequest } from "next/server";
import { fail, ok, ipHash, reference, runGate, zodFail } from "@/lib/api";
import { quoteSubmitSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";
import { sendQuoteEmails } from "@/lib/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only writer of quote_requests. There is deliberately no anon INSERT
 * policy on that table — see spec §7.3 — so a row can only be created here,
 * after the gate in §10.2 has passed.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "We could not read that request.");
  }

  const parsed = quoteSubmitSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const input = parsed.data;

  const gated = await runGate(
    req,
    { website: input.website, startedAt: input.startedAt, turnstileToken: input.turnstileToken },
    "quote",
    5,
    3600,
  );
  if (gated) return gated;

  const service = createServiceClient();

  // No database configured yet: accept, notify and return a reference so the
  // flow is complete and testable. Nothing is silently dropped — the payload
  // is logged for the operator.
  if (!service) {
    const ref = reference();
    console.info("[quote] no database configured; request accepted", {
      reference: ref,
      email: input.email,
      company: input.company,
      services: input.serviceSlugs,
      attachments: input.attachments.length,
    });
    await sendQuoteEmails({ reference: ref, input });
    return ok({ reference: ref }, 201);
  }

  try {
    const { data: row, error } = await service
      .from("quote_requests")
      .insert({
        full_name: input.fullName,
        email: input.email,
        phone: input.phone || null,
        company: input.company || null,
        country: input.country || null,
        how_heard: input.howHeard || null,
        project_type: input.projectType,
        stage: input.stage,
        quantity_estimate: input.quantityEstimate ?? null,
        timeline: input.timeline,
        budget_range: input.budgetRange ?? null,
        description: input.description,
        nda_required: input.ndaRequired,
        source: input.source ?? {},
        ip_hash: ipHash(req),
        user_agent: req.headers.get("user-agent")?.slice(0, 400) ?? null,
      })
      .select("id, reference")
      .single();

    if (error || !row) throw error ?? new Error("insert failed");

    // Join rows: services requested, and any files already uploaded.
    if (input.serviceSlugs.length) {
      const { data: services } = await service
        .from("services")
        .select("id, slug")
        .in("slug", input.serviceSlugs);
      if (services?.length) {
        await service.from("quote_request_services").insert(
          services.map((s) => ({ quote_request_id: row.id, service_id: s.id })),
        );
      }
    }

    if (input.attachments.length) {
      await service.from("quote_attachments").insert(
        input.attachments.map((a) => ({
          quote_request_id: row.id,
          bucket: "quote-attachments",
          path: a.path,
          filename: a.filename,
          mime_type: a.mimeType,
          size_bytes: a.sizeBytes,
        })),
      );
    }

    await sendQuoteEmails({ reference: row.reference as string, input });
    return ok({ reference: row.reference }, 201);
  } catch (err) {
    console.error("[quote] insert failed", err);
    return fail("INTERNAL", "We could not save your request. Please try again, or email us directly.");
  }
}
