import type { NextRequest } from "next/server";
import { checkRateLimit, fail, ipHash, ok, zodFail } from "@/lib/api";
import { ALLOWED_UPLOAD_EXT, uploadUrlSchema } from "@/lib/schemas";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a short-lived signed upload URL so the browser PUTs the bytes straight
 * to Storage. The file never travels through this function, which is why a
 * 25 MB schematic is possible at all — spec §9.3.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "We could not read that request.");
  }

  const parsed = uploadUrlSchema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { filename, sizeBytes, formToken } = parsed.data;

  const allowed = await checkRateLimit(ipHash(req), "upload", 15, 3600);
  if (!allowed) {
    return fail("RATE_LIMITED", "Too many uploads from this connection. Try again shortly.", {
      retryAfterSeconds: 3600,
    });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_UPLOAD_EXT.includes(ext as (typeof ALLOWED_UPLOAD_EXT)[number])) {
    return fail("VALIDATION", `We cannot accept .${ext} files. Please zip it and try again.`, {
      fields: { filename: [`.${ext} is not an accepted file type`] },
    });
  }

  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  const path = `tmp/${formToken}/${crypto.randomUUID()}-${safeName}`;

  const service = createServiceClient();
  if (!service) {
    // No storage configured: acknowledge so the flow stays testable end to end.
    // The filename is still recorded against the request.
    console.info("[upload] storage not configured; recording filename only", { filename, sizeBytes });
    return ok({ uploadUrl: null, path, storageConfigured: false });
  }

  const { data, error } = await service.storage
    .from("quote-attachments")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[upload] could not sign", error);
    return fail("UPSTREAM", "We could not start that upload. Please try again.");
  }

  return ok({ uploadUrl: data.signedUrl, path: data.path, token: data.token, storageConfigured: true });
}
