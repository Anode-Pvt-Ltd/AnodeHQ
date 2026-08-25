import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, zodFail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/svg+xml", "video/mp4"];
const MAX_BYTES = 10 * 1024 * 1024;

const schema = z.object({
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive().max(MAX_BYTES, "Files must be 10 MB or smaller"),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole("editor");
  } catch {
    return fail("FORBIDDEN", "You do not have permission to upload media.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "We could not read that request.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);
  const { filename, mimeType } = parsed.data;

  if (!ALLOWED.includes(mimeType)) {
    return fail("VALIDATION", `${mimeType} is not an accepted file type.`);
  }

  const service = createServiceClient();
  if (!service) return fail("UPSTREAM", "Storage is not configured.");

  const now = new Date();
  const safe = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${crypto.randomUUID()}-${safe}`;

  const { data, error } = await service.storage.from("media").createSignedUploadUrl(path);
  if (error || !data) return fail("UPSTREAM", "Could not start that upload.");

  return ok({ uploadUrl: data.signedUrl, path: data.path, token: data.token });
}
