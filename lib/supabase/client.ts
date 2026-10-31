"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | null = null;

export function createBrowserSupabaseClient() {
  const env = getSupabaseBrowserEnv();

  if (!env) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(env.url, env.anonKey);
  }

  return browserClient;
}
