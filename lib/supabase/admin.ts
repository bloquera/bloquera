import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export function createSupabaseAdminClient() {
  const env = getSupabaseServiceRoleEnv();

  if (!env) {
    return null;
  }

  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
