import { getSupabaseBrowserEnv, hasSupabaseEnv } from "@/lib/supabase/config";

describe("supabase config helpers", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalPublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalPublishableKey;
  });

  it("returns null when public env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    expect(getSupabaseBrowserEnv()).toBeNull();
    expect(hasSupabaseEnv()).toBe(false);
  });

  it("returns the public env vars when present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "public-key";

    expect(getSupabaseBrowserEnv()).toEqual({
      url: "https://project.supabase.co",
      anonKey: "public-key",
    });
    expect(hasSupabaseEnv()).toBe(true);
  });
});
