import Stripe from "stripe";

import { getStripeServerEnv } from "@/lib/supabase/config";

let stripeClient: Stripe | null | undefined;

export function getStripe() {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  const env = getStripeServerEnv();

  if (!env) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(env.secretKey, {
    apiVersion: "2026-06-24.dahlia",
  });

  return stripeClient;
}

export function getStripePriceMap() {
  const env = getStripeServerEnv();

  if (!env) {
    return null;
  }

  return {
    pro_monthly: env.monthlyPriceId,
    pro_yearly: env.yearlyPriceId,
  } as const;
}
