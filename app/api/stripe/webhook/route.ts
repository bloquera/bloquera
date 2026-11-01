import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  recordConversionEvent,
  markSubscriptionCanceled,
  recordPurchaseEvent,
  upsertSubscriptionFromStripe,
} from "@/lib/billing";
import { jsonError } from "@/lib/api-route";
import { getStripe } from "@/lib/stripe";
import { getStripeServerEnv } from "@/lib/supabase/config";
import {
  claimStripeWebhookEvent,
  completeStripeWebhookEvent,
  failStripeWebhookEvent,
} from "@/server/integrations/stripe/webhook-events";
import { getRequestId, logError, logInfo } from "@/server/observability/logger";

function getInvoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscription = invoice.parent?.subscription_details?.subscription;

  return typeof subscription === "string" ? subscription : null;
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const stripe = getStripe();
  const env = getStripeServerEnv();

  if (!stripe || !env?.webhookSecret) {
    return jsonError("Stripe webhook is not configured.", 500);
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return jsonError("Missing Stripe signature.", 400);
  }

  const payload = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      env.webhookSecret,
    );
  } catch {
    return jsonError("Invalid Stripe signature.", 400);
  }

  try {
    const claimed = await claimStripeWebhookEvent(event.id, event.type);

    if (!claimed) {
      logInfo("stripe.webhook.duplicate", {
        eventId: event.id,
        eventType: event.type,
        requestId,
      });

      return NextResponse.json({ duplicate: true, received: true });
    }
  } catch (error) {
    logError("stripe.webhook.claim_failed", error, {
      eventId: event.id,
      eventType: event.type,
      requestId,
    });
    return jsonError("Unable to process Stripe webhook right now.", 503);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await recordPurchaseEvent({
          amountCents: session.amount_total,
          currency: session.currency,
          eventType: event.type,
          status: session.payment_status,
          stripeEventId: event.id,
          stripeCheckoutSessionId: session.id,
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : null,
          subscriptionId:
            typeof session.subscription === "string" ? session.subscription : null,
        });
        await recordConversionEvent({
          eventType: "checkout_complete",
          plan:
            session.metadata?.plan_slug === "pro_monthly" ||
            session.metadata?.plan_slug === "pro_yearly"
              ? session.metadata.plan_slug
              : null,
          source: "stripe_webhook",
          sourceEventId: event.id,
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : null,
          targetSlug: "/purchases",
          targetTitle:
            session.metadata?.plan_slug === "pro_yearly"
              ? "Completed Pro yearly checkout"
              : "Completed Pro monthly checkout",
        });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await upsertSubscriptionFromStripe(
          event.data.object as Stripe.Subscription,
        );
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceled(subscription.id);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await recordPurchaseEvent({
          amountCents: invoice.amount_paid ?? invoice.amount_due,
          currency: invoice.currency,
          eventType: event.type,
          status: invoice.status,
          stripeEventId: event.id,
          stripeCustomerId:
            typeof invoice.customer === "string" ? invoice.customer : null,
          stripeInvoiceId: invoice.id,
          subscriptionId: getInvoiceSubscriptionId(invoice),
        });
        break;
      }
      default:
        break;
    }

    await completeStripeWebhookEvent(event.id);
  } catch (error) {
    try {
      await failStripeWebhookEvent(event.id, error);
    } catch (trackingError) {
      logError("stripe.webhook.failure_tracking_failed", trackingError, {
        eventId: event.id,
        eventType: event.type,
        requestId,
      });
    }

    logError("stripe.webhook.processing_failed", error, {
      eventId: event.id,
      eventType: event.type,
      requestId,
    });
    return jsonError("Unable to process Stripe webhook right now.", 503);
  }

  logInfo("stripe.webhook.processed", {
    eventId: event.id,
    eventType: event.type,
    requestId,
  });
  return NextResponse.json({ received: true });
}
