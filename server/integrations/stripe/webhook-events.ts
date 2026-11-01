import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function getAdminClient() {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    throw new Error("Supabase billing administration is not configured.");
  }

  return admin;
}

export async function claimStripeWebhookEvent(eventId: string, eventType: string) {
  const { data, error } = await getAdminClient().rpc(
    "claim_stripe_webhook_event",
    {
      target_event_id: eventId,
      target_event_type: eventType,
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function completeStripeWebhookEvent(eventId: string) {
  const { error } = await getAdminClient().rpc(
    "complete_stripe_webhook_event",
    { target_event_id: eventId },
  );

  if (error) {
    throw error;
  }
}

export async function failStripeWebhookEvent(eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown processing error";
  const { error: updateError } = await getAdminClient().rpc(
    "fail_stripe_webhook_event",
    {
      target_error: message,
      target_event_id: eventId,
    },
  );

  if (updateError) {
    throw updateError;
  }
}
