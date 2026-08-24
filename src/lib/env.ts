/**
 * Environment access, spec §18.3.
 *
 * Supabase is OPTIONAL at build time. When the three public vars are absent the
 * content layer falls back to the typed seed dataset in `src/content`, so the
 * site builds, renders and is fully navigable before a database exists.
 * `isSupabaseConfigured` is the single switch the query layer reads.
 */
export const env = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
} as const;

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);

/** Server-only secrets. Never import this module from a client component. */
export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    revalidateSecret: process.env.REVALIDATE_SECRET ?? "",
    previewSecret: process.env.PREVIEW_SECRET ?? "",
    ipHashPepper: process.env.IP_HASH_PEPPER ?? "anode-dev-pepper",
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? "",
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    resendFrom: process.env.RESEND_FROM_EMAIL ?? "",
    salesEmail: process.env.SALES_EMAIL ?? "",
  } as const;
}

export const hasServiceRole = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
