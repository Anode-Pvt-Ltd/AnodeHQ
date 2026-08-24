"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env, isSupabaseConfigured } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Singleton browser client. Used only for the admin realtime subscription. */
export function getBrowserClient() {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
