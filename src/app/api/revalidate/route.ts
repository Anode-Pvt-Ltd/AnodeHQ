import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { fail, ok, secretMatches, zodFail } from "@/lib/api";
import { isKnownTag } from "@/lib/cache";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ tags: z.array(z.string().min(1).max(120)).min(1).max(32) });

/**
 * Called by the database trigger when content changes (spec §12.1). The secret
 * is compared with timingSafeEqual, and only tags from the known set are
 * accepted so a leaked secret cannot be used to purge arbitrary keys.
 */
export async function POST(req: NextRequest) {
  const expected = serverEnv().revalidateSecret;
  if (!expected) return fail("FORBIDDEN", "Revalidation is not configured.");

  if (!secretMatches(req.headers.get("x-revalidate-secret"), expected)) {
    return fail("FORBIDDEN", "Not permitted.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("VALIDATION", "We could not read that request.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodFail(parsed.error);

  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const tag of parsed.data.tags) {
    if (isKnownTag(tag)) {
      // Next 16 requires a cache-life profile; "max" purges the stored entry.
      revalidateTag(tag, "max");
      accepted.push(tag);
    } else {
      rejected.push(tag);
    }
  }

  return ok({ revalidated: accepted, ignored: rejected, at: Date.now() });
}
