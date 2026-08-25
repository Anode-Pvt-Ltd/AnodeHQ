import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok, zodFail } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  path: z.string().min(1).max(400),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(160),
  sizeBytes: z.number().int().positive(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  blurhash: z.string().max(120).nullable().optional(),
});

/** Step 3 of the upload sequence: verify the object exists, then record it. */
export async function POST(req: NextRequest) {
  let actorId: string;
  try {
    const actor = await requireRole("editor");
    actorId = actor.id;
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
  const input = parsed.data;

  const service = createServiceClient();
  if (!service) return fail("UPSTREAM", "Storage is not configured.");

  // Confirm the object is really there and take its true size, rather than
  // trusting what the browser reported in step 1.
  const folder = input.path.split("/").slice(0, -1).join("/");
  const name = input.path.split("/").pop() ?? "";
  const { data: listed } = await service.storage.from("media").list(folder, { search: name, limit: 1 });
  const object = listed?.[0];
  if (!object) return fail("NOT_FOUND", "That upload did not complete. Please try again.");

  const realSize = Number(object.metadata?.size ?? input.sizeBytes);
  const kind = input.mimeType.startsWith("image/")
    ? "image"
    : input.mimeType.startsWith("video/")
      ? "video"
      : "document";

  const { data, error } = await service
    .from("media")
    .insert({
      bucket: "media",
      path: input.path,
      filename: input.filename,
      mime_type: input.mimeType,
      kind,
      size_bytes: realSize,
      width: input.width ?? null,
      height: input.height ?? null,
      blurhash: input.blurhash ?? null,
      // Alt text is required for images by a check constraint, so a new image
      // is created with a placeholder the editor must replace before use.
      alt_text: kind === "image" ? input.filename.replace(/\.[a-z0-9]+$/i, "") : null,
      uploaded_by: actorId,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[media/attach] insert failed", error);
    return fail("INTERNAL", "The file uploaded but could not be recorded.");
  }

  return ok({ id: data.id }, 201);
}
