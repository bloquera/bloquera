import {
  getSupabaseBrowserEnv,
  hasSupabaseEnv,
  isE2EAuthBypassEnabled,
} from "@/lib/supabase/config";

function restoreEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("supabase config helpers", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalPublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalBypass = process.env.E2E_AUTH_BYPASS;

  afterEach(() => {
    restoreEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", originalUrl);
    restoreEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      originalPublishableKey,
    );
    restoreEnvironmentVariable("NEXT_PUBLIC_SITE_URL", originalSiteUrl);
    restoreEnvironmentVariable("VERCEL_ENV", originalVercelEnv);
    restoreEnvironmentVariable("E2E_AUTH_BYPASS", originalBypass);
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

  it("enables E2E fixtures only for a loopback test server", () => {
    process.env.E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3100";
    delete process.env.VERCEL_ENV;

    expect(isE2EAuthBypassEnabled()).toBe(true);
  });

  it("never enables E2E fixtures in Vercel Production", () => {
    process.env.E2E_AUTH_BYPASS = "1";
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3100";
    process.env.VERCEL_ENV = "production";

    expect(isE2EAuthBypassEnabled()).toBe(false);
  });
});
