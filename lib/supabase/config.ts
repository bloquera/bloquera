export function getSupabaseBrowserEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return {
    url,
    anonKey: publishableKey,
  };
}

export function isE2EAuthBypassEnabled() {
  return process.env.E2E_AUTH_BYPASS === "1";
}

export function hasSupabaseEnv() {
  return getSupabaseBrowserEnv() !== null;
}

export function getSupabaseServiceRoleEnv() {
  const browserEnv = getSupabaseBrowserEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!browserEnv || !serviceRoleKey) {
    return null;
  }

  return {
    url: browserEnv.url,
    serviceRoleKey,
  };
}

export function getStripeServerEnv() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const monthlyPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;
  const yearlyPriceId = process.env.STRIPE_PRO_YEARLY_PRICE_ID;

  if (!secretKey || !monthlyPriceId || !yearlyPriceId) {
    return null;
  }

  return {
    secretKey,
    webhookSecret: webhookSecret ?? null,
    monthlyPriceId,
    yearlyPriceId,
  };
}

export function getOpenAIServerEnv() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  };
}
