import type Stripe from "stripe";
import { unstable_noStore as noStore } from "next/cache";

import { absoluteUrl } from "@/lib/seo";
import { getProfileSummary } from "@/lib/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeServerEnv, isE2EAuthBypassEnabled } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripePriceMap } from "@/lib/stripe";
import type {
  BillingPlanSlug,
  BillingSnapshot,
  BillingStatus,
  PurchaseEventRecord,
  SubscriptionRecord,
} from "@/types/billing";

export type AccountStatus = {
  billingSummary: string;
  billingStatus: string;
  canManageBilling: boolean;
  checkoutCtaLabel: string;
  ctaHref: "/purchases";
  ctaLabel: string;
  headline: string;
  includedFeatures: string[];
  upcomingFeatures: string[];
  nextStep: string;
  planLabel: string;
  planSummary: string;
};

const FREE_FEATURES = [
  "Bitcoin curriculum access",
  "Quiz progress and dashboard history",
  "Authenticated profile and account recovery",
];

const PRO_FEATURES = [
  "Everything in the free plan",
  "60 AI tutor questions per day",
  "Priority access to premium tracks and future modules",
  "Billing history and portal access",
];

const UPCOMING_FEATURES = [
  "Priority learning tracks and future premium modules",
  "Billing history, invoices, and plan management",
  "Premium account insights and deeper learning controls",
];

const PRO_ACCESS_STATUSES: BillingStatus[] = ["active", "trialing", "past_due"];
const FREE_TUTOR_REQUEST_LIMIT = 10;
const PRO_TUTOR_REQUEST_LIMIT = 60;
const ACCOUNT_STATUS_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "short",
  year: "numeric",
};
const FREE_PLAN_SUMMARY =
  "You can access the full live Bitcoin curriculum, quizzes, dashboard history, account tools, and 10 AI tutor questions per day on the free plan today.";
const PRO_PLAN_SUMMARY =
  "Your account has Pro billing access, including future premium tracks, 60 AI tutor questions per day, and purchase history in the billing hub.";

const E2E_BILLING_SNAPSHOT: BillingSnapshot = {
  configured: true,
  customerId: "cus_e2e_123",
  purchaseEvents: [
    {
      id: "evt_e2e_invoice_paid",
      user_id: "e2e-profile-id",
      subscription_id: "sub_e2e_123",
      stripe_invoice_id: "in_e2e_123",
      stripe_checkout_session_id: "cs_e2e_123",
      event_type: "invoice.paid",
      amount_cents: 1499,
      currency: "gbp",
      status: "paid",
      created_at: "2026-03-01T09:00:00.000Z",
    },
  ],
  subscription: {
    user_id: "e2e-profile-id",
    stripe_customer_id: "cus_e2e_123",
    stripe_subscription_id: "sub_e2e_123",
    stripe_price_id: "price_e2e_monthly",
    plan_slug: "pro_monthly",
    status: "active",
    current_period_start: "2026-03-01T09:00:00.000Z",
    current_period_end: "2026-04-01T09:00:00.000Z",
    cancel_at_period_end: false,
    created_at: "2026-03-01T09:00:00.000Z",
    updated_at: "2026-03-01T09:00:00.000Z",
  },
};

function toIsoTimestamp(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function getSubscriptionPeriodBounds(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];

  return {
    currentPeriodStart: toIsoTimestamp(item?.current_period_start),
    currentPeriodEnd: toIsoTimestamp(item?.current_period_end),
  };
}

export function getDefaultBillingSnapshot(): BillingSnapshot {
  return {
    configured: Boolean(getStripeServerEnv()),
    customerId: null,
    purchaseEvents: [],
    subscription: null,
  };
}

export function hasProAccess(snapshot: BillingSnapshot) {
  return Boolean(
    snapshot.subscription &&
      PRO_ACCESS_STATUSES.includes(snapshot.subscription.status),
  );
}

export function getTutorRequestLimit(snapshot: BillingSnapshot) {
  return hasProAccess(snapshot)
    ? PRO_TUTOR_REQUEST_LIMIT
    : FREE_TUTOR_REQUEST_LIMIT;
}

function formatAccountStatusDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", ACCOUNT_STATUS_DATE_FORMAT)
    : null;
}

function getSubscriptionStatusLabel(subscription: SubscriptionRecord) {
  if (subscription.status === "trialing") {
    return "Trial active";
  }

  if (subscription.status === "past_due") {
    return "Payment issue";
  }

  if (subscription.cancel_at_period_end) {
    return "Cancels at period end";
  }

  return "Active subscription";
}

function getActivePlanHeadline(subscription: SubscriptionRecord) {
  return subscription.plan_slug === "pro_yearly" ? "Pro yearly" : "Pro monthly";
}

function buildUnconfiguredAccountStatus(): AccountStatus {
  return {
    billingSummary: "Billing is not configured in this environment yet.",
    billingStatus: "Billing not configured",
    canManageBilling: false,
    checkoutCtaLabel: "Set up Stripe first",
    ctaHref: "/purchases",
    ctaLabel: "Open billing hub",
    headline: "Free plan",
    includedFeatures: FREE_FEATURES,
    upcomingFeatures: UPCOMING_FEATURES,
    nextStep:
      "Add Stripe environment variables to enable checkout, subscriptions, and invoice history.",
    planLabel: "Free",
    planSummary: FREE_PLAN_SUMMARY,
  };
}

function buildFreeAccountStatus(): AccountStatus {
  return {
    billingSummary: "Free access is active for your account.",
    billingStatus: "No active subscription",
    canManageBilling: true,
    checkoutCtaLabel: "Upgrade to Pro",
    ctaHref: "/purchases",
    ctaLabel: "Open billing hub",
    headline: "Free plan",
    includedFeatures: FREE_FEATURES,
    upcomingFeatures: UPCOMING_FEATURES,
    nextStep:
      "Choose a Pro plan to unlock future premium tracks, invoice history, and 60 AI tutor questions per day.",
    planLabel: "Free",
    planSummary: FREE_PLAN_SUMMARY,
  };
}

function buildActiveAccountStatus(subscription: SubscriptionRecord): AccountStatus {
  const headline = getActivePlanHeadline(subscription);
  const periodEnd = formatAccountStatusDate(subscription.current_period_end);

  return {
    billingSummary: periodEnd
      ? `${headline} is active${subscription.cancel_at_period_end ? " and will end" : " through"} ${periodEnd}.`
      : `${headline} is active for your account.`,
    billingStatus: getSubscriptionStatusLabel(subscription),
    canManageBilling: true,
    checkoutCtaLabel: subscription.cancel_at_period_end
      ? "Resume with a new plan"
      : "Change plan",
    ctaHref: "/purchases",
    ctaLabel: "Open billing hub",
    headline,
    includedFeatures: PRO_FEATURES,
    upcomingFeatures: subscription.cancel_at_period_end
      ? ["Subscription remains active until the current billing period ends."]
      : ["More premium tracks and usage controls will build on this plan."],
    nextStep: subscription.cancel_at_period_end
      ? "Reactivate with a new checkout session before the current billing period ends if you want uninterrupted access."
      : "Use the billing hub to review renewals, payment history, and your daily tutor allowance.",
    planLabel: "Pro",
    planSummary: PRO_PLAN_SUMMARY,
  };
}

async function resolveUserIdByStripeCustomerId(
  stripeCustomerId: string,
) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  return profile?.id ?? null;
}

export function getAccountStatus(snapshot: BillingSnapshot): AccountStatus {
  if (!snapshot.configured) {
    return buildUnconfiguredAccountStatus();
  }

  if (!snapshot.subscription) {
    return buildFreeAccountStatus();
  }

  return buildActiveAccountStatus(snapshot.subscription);
}

export async function getBillingSnapshotForCurrentUser(): Promise<BillingSnapshot> {
  noStore();

  if (isE2EAuthBypassEnabled()) {
    return E2E_BILLING_SNAPSHOT;
  }

  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();

  if (!supabase || !admin) {
    return getDefaultBillingSnapshot();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return getDefaultBillingSnapshot();
  }

  const [{ data: profile }, { data: subscription }, { data: purchaseEvents }] =
    await Promise.all([
      admin.from("profiles").select("stripe_customer_id").eq("id", user.id).single(),
      admin
        .from("subscriptions")
        .select(
          "user_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_slug, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      admin
        .from("purchase_events")
        .select(
          "id, user_id, subscription_id, stripe_invoice_id, stripe_checkout_session_id, event_type, amount_cents, currency, status, created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  return {
    configured: Boolean(getStripeServerEnv()),
    customerId: profile?.stripe_customer_id ?? null,
    purchaseEvents: (purchaseEvents ?? []) as PurchaseEventRecord[],
    subscription: (subscription ?? null) as SubscriptionRecord | null,
  };
}

export async function getAccountStatusForCurrentUser() {
  return getAccountStatus(await getBillingSnapshotForCurrentUser());
}

export async function hasProAccessForCurrentUser() {
  return hasProAccess(await getBillingSnapshotForCurrentUser());
}

export async function getBillingContextForCurrentUser() {
  const [{ profile }, snapshot] = await Promise.all([
    getProfileSummary(),
    getBillingSnapshotForCurrentUser(),
  ]);

  return {
    accountStatus: getAccountStatus(snapshot),
    billingSnapshot: snapshot,
    profile,
    priceMap: getStripePriceMap(),
  };
}

export function getSuccessUrl(path = "/purchases/success") {
  return absoluteUrl(path);
}

export function getCancelUrl(path = "/purchases/canceled") {
  return absoluteUrl(path);
}

export function getPortalReturnUrl(path = "/purchases") {
  return absoluteUrl(path);
}

type StripeCustomerUser = {
  email?: string | null;
  id: string;
};

export async function ensureStripeCustomerForUser(user: StripeCustomerUser) {
  const admin = createSupabaseAdminClient();
  const stripe = (await import("@/lib/stripe")).getStripe();

  if (!admin || !stripe) {
    return null;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, email, display_name")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_customer_id) {
    return {
      customerId: profile.stripe_customer_id,
      user,
    };
  }

  const customer = await stripe.customers.create({
    email: user.email ?? undefined,
    metadata: {
      user_id: user.id,
    },
    name: profile?.display_name ?? undefined,
  });

  await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", user.id);

  return {
    customerId: customer.id,
    user,
  };
}

export async function ensureStripeCustomerForCurrentUser() {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return ensureStripeCustomerForUser(user);
}

export async function createBillingPortalSessionForCurrentUser() {
  const stripe = (await import("@/lib/stripe")).getStripe();
  const customer = await ensureStripeCustomerForCurrentUser();

  if (!stripe || !customer) {
    return null;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.customerId,
    return_url: getPortalReturnUrl(),
  });

  return session.url;
}

export function getPlanDetails(plan: BillingPlanSlug) {
  const priceMap = getStripePriceMap();

  if (!priceMap) {
    return null;
  }

  if (plan === "pro_monthly") {
    return {
      label: "Pro monthly",
      priceId: priceMap.pro_monthly,
    };
  }

  if (plan === "pro_yearly") {
    return {
      label: "Pro yearly",
      priceId: priceMap.pro_yearly,
    };
  }

  return null;
}

export async function upsertSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  customerId?: string,
) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return;
  }

  const resolvedCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : customerId ?? null;

  if (!resolvedCustomerId) {
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", resolvedCustomerId)
    .maybeSingle();

  if (!profile) {
    return;
  }

  const priceMap = getStripePriceMap();
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const { currentPeriodStart, currentPeriodEnd } =
    getSubscriptionPeriodBounds(subscription);
  const planSlug: BillingPlanSlug =
    priceMap?.pro_yearly === priceId
      ? "pro_yearly"
      : priceMap?.pro_monthly === priceId
        ? "pro_monthly"
        : "free";

  await admin.from("subscriptions").upsert(
    {
      user_id: profile.id,
      stripe_customer_id: resolvedCustomerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan_slug: planSlug,
      status: subscription.status as BillingStatus,
      current_period_start: currentPeriodStart,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    },
    { onConflict: "user_id" },
  );
}

export async function markSubscriptionCanceled(subscriptionId: string) {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return;
  }

  await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: true,
    })
    .eq("stripe_subscription_id", subscriptionId);
}

export async function recordPurchaseEvent(input: {
  amountCents?: number | null;
  currency?: string | null;
  eventType: string;
  status?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  stripeInvoiceId?: string | null;
  subscriptionId?: string | null;
}) {
  if (!input.stripeCustomerId) {
    return;
  }

  const userId = await resolveUserIdByStripeCustomerId(input.stripeCustomerId);
  const admin = createSupabaseAdminClient();

  if (!admin || !userId) {
    return;
  }

  await admin.from("purchase_events").insert({
    amount_cents: input.amountCents ?? null,
    currency: input.currency ?? null,
    event_type: input.eventType,
    status: input.status ?? null,
    stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
    stripe_invoice_id: input.stripeInvoiceId ?? null,
    subscription_id: input.subscriptionId ?? null,
    user_id: userId,
  });
}

export async function recordConversionEvent(input: {
  eventType: "checkout_complete";
  plan?: BillingPlanSlug | null;
  source: string;
  stripeCustomerId?: string | null;
  targetSlug: string;
  targetTitle: string;
}) {
  if (!input.stripeCustomerId) {
    return;
  }

  const userId = await resolveUserIdByStripeCustomerId(input.stripeCustomerId);
  const admin = createSupabaseAdminClient();

  if (!admin || !userId) {
    return;
  }

  await admin.from("learning_activity").insert({
    activity_context: JSON.stringify({
      eventType: input.eventType,
      plan:
        input.plan === "pro_monthly" || input.plan === "pro_yearly"
          ? input.plan
          : null,
      source: input.source,
    }),
    activity_type: "conversion_event",
    created_at: new Date().toISOString(),
    lesson_slug: input.targetSlug,
    lesson_title: input.targetTitle,
    user_id: userId,
  });
}
