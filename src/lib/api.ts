import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/service";

/* ---------------------------------------------------- response envelope */

export type ApiErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"
  | "RATE_LIMITED" | "UPSTREAM" | "INTERNAL";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404,
  RATE_LIMITED: 429, UPSTREAM: 502, INTERNAL: 500,
};

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function fail(
  code: ApiErrorCode,
  message: string,
  extra?: { fields?: Record<string, string[]>; retryAfterSeconds?: number },
) {
  const headers: Record<string, string> = {};
  if (extra?.retryAfterSeconds) headers["Retry-After"] = String(extra.retryAfterSeconds);
  return NextResponse.json({ error: { code, message, ...extra } }, { status: STATUS[code], headers });
}

export function zodFail(error: z.ZodError) {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fields[key] ??= []).push(issue.message);
  }
  return fail("VALIDATION", "Some answers need attention.", { fields });
}

/* ------------------------------------------------------------ identity */

/** Never stores a raw IP — spec §7.5. */
export function ipHash(req: NextRequest): string {
  const raw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(raw + serverEnv().ipHashPepper).digest("hex").slice(0, 40);
}

export function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/* ---------------------------------------------------------- anti-abuse */

export interface GateInput {
  website?: string;
  startedAt?: number;
  turnstileToken?: string;
}

/**
 * Guards run in a fixed order (spec §10.2): honeypot, then elapsed time, then
 * Turnstile, then the rate limit. Rate-limiting last means an attacker cannot
 * burn someone else's window with malformed junk.
 */
export async function runGate(
  req: NextRequest,
  input: GateInput,
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<NextResponse | null> {
  if (input.website && input.website.length > 0) {
    // Silent success — a bot learns nothing from being told.
    return ok({ accepted: true }, 202);
  }

  if (input.startedAt && Date.now() - input.startedAt < 4000) {
    return fail("VALIDATION", "That was submitted unusually quickly. Please try again.");
  }

  const turnstileOk = await verifyTurnstile(input.turnstileToken);
  if (!turnstileOk) {
    return fail("VALIDATION", "We could not verify that you are human. Please reload and try again.");
  }

  const allowed = await checkRateLimit(ipHash(req), bucket, limit, windowSeconds);
  if (!allowed) {
    return fail("RATE_LIMITED", "You have sent several requests recently. Please try again in an hour.", {
      retryAfterSeconds: windowSeconds,
    });
  }

  return null;
}

async function verifyTurnstile(token?: string): Promise<boolean> {
  const secret = serverEnv().turnstileSecret;
  // Not configured (development, or before keys are issued) — skip rather than block.
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const json = (await res.json()) as { success?: boolean };
    return Boolean(json.success);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------- rate limiting */

const memoryBuckets = new Map<string, number[]>();

/**
 * Uses the Postgres sliding-window function when the database is available and
 * an in-process window otherwise, so local development is still protected.
 */
export async function checkRateLimit(
  key: string, bucket: string, limit: number, windowSeconds: number,
): Promise<boolean> {
  const service = createServiceClient();
  if (service) {
    const { data, error } = await service.rpc("check_rate_limit", {
      p_key: key,
      p_bucket: bucket,
      p_limit: limit,
      p_window: `${windowSeconds} seconds`,
    });
    if (!error) return Boolean(data);
    // Fall through to the in-memory window if the RPC is missing.
  }

  const now = Date.now();
  const id = `${bucket}:${key}`;
  const hits = (memoryBuckets.get(id) ?? []).filter((t) => now - t < windowSeconds * 1000);
  if (hits.length >= limit) {
    memoryBuckets.set(id, hits);
    return false;
  }
  hits.push(now);
  memoryBuckets.set(id, hits);
  return true;
}

/* --------------------------------------------------------------- misc */

export function reference(prefix = "ANQ"): string {
  const year = new Date().getFullYear();
  const n = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${year}-${n}`;
}

export { randomUUID };
