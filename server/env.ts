const productionRequiredVariables = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

const variableGroups = [
  ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
  [
    "STRIPE_SECRET_KEY",
    "STRIPE_PRO_MONTHLY_PRICE_ID",
    "STRIPE_PRO_YEARLY_PRICE_ID",
  ],
  ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
  [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ],
] as const;

type Environment = NodeJS.ProcessEnv;

function hasValue(env: Environment, name: string) {
  return Boolean(env[name]?.trim());
}

function validateUrl(env: Environment, name: string, errors: string[]) {
  const value = env[name]?.trim();

  if (!value) {
    return;
  }

  try {
    const url = new URL(value);

    if (env.VERCEL_ENV === "production" && url.protocol !== "https:") {
      errors.push(`${name} must use HTTPS in Production.`);
    }
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
  }
}

export function getServerEnvironmentErrors(env: Environment = process.env) {
  const errors: string[] = [];
  const isProduction = env.VERCEL_ENV === "production";

  for (const group of variableGroups) {
    const configured = group.filter((name) => hasValue(env, name));

    if (configured.length > 0 && configured.length < group.length) {
      const missing = group.filter((name) => !hasValue(env, name));
      errors.push(`Incomplete environment group; missing: ${missing.join(", ")}.`);
    }
  }

  if (
    hasValue(env, "SUPABASE_SERVICE_ROLE_KEY") &&
    (!hasValue(env, "NEXT_PUBLIC_SUPABASE_URL") ||
      !hasValue(env, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"))
  ) {
    errors.push(
      "SUPABASE_SERVICE_ROLE_KEY requires the public Supabase URL and publishable key.",
    );
  }

  validateUrl(env, "NEXT_PUBLIC_SITE_URL", errors);
  validateUrl(env, "NEXT_PUBLIC_SUPABASE_URL", errors);

  if (isProduction) {
    const missing = productionRequiredVariables.filter(
      (name) => !hasValue(env, name),
    );

    if (missing.length > 0) {
      errors.push(`Production environment is missing: ${missing.join(", ")}.`);
    }

    if (
      hasValue(env, "STRIPE_SECRET_KEY") &&
      !hasValue(env, "STRIPE_WEBHOOK_SECRET")
    ) {
      errors.push(
        "STRIPE_WEBHOOK_SECRET is required when Stripe is enabled in Production.",
      );
    }
  }

  if (hasValue(env, "E2E_AUTH_BYPASS")) {
    const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim();
    let isLoopback = false;

    try {
      const hostname = new URL(siteUrl ?? "").hostname;
      isLoopback = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    } catch {
      isLoopback = false;
    }

    if (env.E2E_AUTH_BYPASS !== "1" || isProduction || !isLoopback) {
      errors.push(
        "E2E_AUTH_BYPASS is allowed only for a loopback test server and never in Vercel Production.",
      );
    }
  }

  return errors;
}

export function validateServerEnvironment(env: Environment = process.env) {
  const errors = getServerEnvironmentErrors(env);

  if (errors.length > 0) {
    throw new Error(`Invalid server environment:\n- ${errors.join("\n- ")}`);
  }
}
