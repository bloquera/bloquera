import {
  getServerEnvironmentErrors,
  validateServerEnvironment,
} from "@/server/env";

const productionEnvironment = {
  VERCEL_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://bloquera.io",
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  STRIPE_SECRET_KEY: "sk_live_key",
  STRIPE_WEBHOOK_SECRET: "whsec_key",
  STRIPE_PRO_MONTHLY_PRICE_ID: "price_monthly",
  STRIPE_PRO_YEARLY_PRICE_ID: "price_yearly",
  OPENAI_API_KEY: "openai-key",
  RATE_LIMIT_SECRET: "rate-limit-secret-with-at-least-32-characters",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM_EMAIL: "Bloquera <hello@bloquera.io>",
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key-id",
  R2_SECRET_ACCESS_KEY: "secret-access-key",
  R2_BUCKET: "bloquera-videos",
} satisfies NodeJS.ProcessEnv;

describe("server environment validation", () => {
  it("allows an empty local environment", () => {
    expect(getServerEnvironmentErrors({ NODE_ENV: "development" })).toEqual(
      [],
    );
  });

  it("rejects partially configured integrations", () => {
    expect(
      getServerEnvironmentErrors({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      }),
    ).toContain(
      "Incomplete environment group; missing: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  });

  it("requires complete Production configuration", () => {
    expect(() =>
      validateServerEnvironment({ VERCEL_ENV: "production" }),
    ).toThrow(/Production environment is missing/);
  });

  it("allows optional integrations to remain disabled in Production", () => {
    expect(
      getServerEnvironmentErrors({
        VERCEL_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "https://bloquera.io",
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      }),
    ).toEqual([]);
  });

  it("requires the webhook secret when Stripe is enabled in Production", () => {
    expect(
      getServerEnvironmentErrors({
        ...productionEnvironment,
        STRIPE_WEBHOOK_SECRET: "",
      }),
    ).toContain(
      "STRIPE_WEBHOOK_SECRET is required when Stripe is enabled in Production.",
    );
  });

  it("requires a rate-limit secret when OpenAI is enabled in Production", () => {
    expect(
      getServerEnvironmentErrors({
        ...productionEnvironment,
        RATE_LIMIT_SECRET: "",
      }),
    ).toContain(
      "RATE_LIMIT_SECRET is required when OpenAI is enabled in Production.",
    );
  });

  it("rejects a weak rate-limit secret", () => {
    expect(
      getServerEnvironmentErrors({
        RATE_LIMIT_SECRET: "too-short",
      }),
    ).toContain("RATE_LIMIT_SECRET must contain at least 32 characters.");
  });

  it("accepts complete Production configuration", () => {
    expect(() => validateServerEnvironment(productionEnvironment)).not.toThrow();
  });

  it("requires HTTPS URLs in Production", () => {
    expect(
      getServerEnvironmentErrors({
        ...productionEnvironment,
        NEXT_PUBLIC_SITE_URL: "http://bloquera.io",
      }),
    ).toContain("NEXT_PUBLIC_SITE_URL must use HTTPS in Production.");
  });

  it("allows the E2E authentication bypass only on a loopback server", () => {
    expect(
      getServerEnvironmentErrors({
        NODE_ENV: "production",
        NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
        E2E_AUTH_BYPASS: "1",
      }),
    ).toEqual([]);
  });

  it("rejects the E2E authentication bypass in Vercel Production", () => {
    expect(
      getServerEnvironmentErrors({
        ...productionEnvironment,
        E2E_AUTH_BYPASS: "1",
      }),
    ).toContain(
      "E2E_AUTH_BYPASS is allowed only for a loopback test server and never in Vercel Production.",
    );
  });
});
