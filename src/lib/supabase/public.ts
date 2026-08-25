import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/lib/env";

/**
 * Session-less anon client for PUBLIC content reads.
 *
 * The cookie-bound client in `server.ts` cannot be used inside
 * `unstable_cache()` — Next refuses to let a cached scope touch `cookies()`,
 * and rightly so: a cache entry keyed on nothing must not vary by session.
 *
 * Public pages have no reason to carry one anyway. They read exactly what the
 * `anon` role is allowed to read, which is what the RLS policies define, so
 * the result is identical for every visitor and safe to cache.
 *
 * Use `server.ts` instead wherever the signed-in user matters (admin reads,
 * Draft Mode preview, anything calling auth).
 */
/*
 * Rows come back loosely typed until `npm run db:types` generates
 * src/types/database.ts from the live schema. Every query maps its result
 * through an explicit domain type in lib/queries, so nothing untyped escapes
 * that module.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = SupabaseClient<any, "public", any>;

let client: LooseClient | null = null;

export function createPublicClient(): LooseClient | null {
  if (!isSupabaseConfigured) return null;
  client ??= createSupabaseClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-client-info": "anode-public" } },
  });
  return client;
}
