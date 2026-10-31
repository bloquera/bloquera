import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseBrowserEnv } from "@/lib/supabase/config";
import type { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  const env = getSupabaseBrowserEnv();

  if (!env) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always write cookies. Proxy handles refreshes.
        }
      },
    },
  });
}
