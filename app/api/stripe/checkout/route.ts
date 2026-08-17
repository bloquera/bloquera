import { NextResponse } from "next/server";

import {
  createStripeRouteErrorResponse,
  getAuthenticatedServerSupabaseOrError,
  jsonError,
  parseJsonBody,
} from "@/lib/api-route";
import {
  ensureStripeCustomerForUser,
  getCancelUrl,
  getPlanDetails,
  getSuccessUrl,
} from "@/lib/billing";
import { getStripe } from "@/lib/stripe";

type CheckoutBody = {
  plan?: "pro_monthly" | "pro_yearly";
};

export async function POST(request: Request) {
  const stripe = getStripe();

  if (!stripe) {
    return jsonError("Stripe billing is not configured yet.", 500);
  }

  const bodyResult = await parseJsonBody<CheckoutBody>(
    request,
    "Send a valid checkout request body.",
  );

  if ("response" in bodyResult) {
    return bodyResult.response;
  }

  const body = bodyResult.data;

  const plan = body.plan;

  if (plan !== "pro_monthly" && plan !== "pro_yearly") {
    return jsonError("Choose a valid billing plan.", 400);
  }

  const planDetails = getPlanDetails(plan);

  if (!planDetails) {
    return jsonError("Stripe billing is not configured yet.", 500);
  }

  const authResult = await getAuthenticatedServerSupabaseOrError({
    unauthorizedMessage: "You must be logged in to start checkout.",
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  let billingContext;

  try {
    billingContext = await ensureStripeCustomerForUser(authResult.user);
  } catch {
    return jsonError("Unable to prepare checkout for this account right now.", 503);
  }

  if (!billingContext) {
    return jsonError("Supabase billing administration is not configured yet.", 500);
  }

  let session;

  try {
    session = await stripe.checkout.sessions.create({
      cancel_url: getCancelUrl(),
      customer: billingContext.customerId,
      line_items: [
        {
          price: planDetails.priceId,
          quantity: 1,
        },
      ],
      metadata: {
        plan_slug: plan,
        user_id: billingContext.user.id,
      },
      mode: "subscription",
      success_url: getSuccessUrl(),
    });
  } catch (error) {
    return createStripeRouteErrorResponse(error, {
      authentication: "Stripe billing is temporarily unavailable.",
      connection: "Unable to reach Stripe right now. Please try again shortly.",
      fallback: "Unable to start checkout right now.",
      rateLimit:
        "Stripe is rate limiting checkout right now. Please try again in a minute.",
    });
  }

  if (!session.url) {
    return jsonError("Unable to start checkout right now.", 502);
  }

  return NextResponse.json({
    checkoutUrl: session.url,
  });
}
