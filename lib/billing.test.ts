import type { BillingSnapshot } from "@/types/billing";

const createSupabaseAdminClient = vi.fn();
const getStripePriceMap = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripePriceMap: () => getStripePriceMap(),
}));

function createSnapshot(overrides: Partial<BillingSnapshot> = {}): BillingSnapshot {
  return {
    configured: true,
    customerId: null,
    purchaseEvents: [],
    subscription: null,
    ...overrides,
  };
}

function configureAdminClient(options?: {
  profileByCustomerId?: { id: string } | null;
  profileForSubscription?: { id: string } | null;
}) {
  const profileByCustomerId =
    options?.profileByCustomerId === undefined
      ? { id: "user-1" }
      : options.profileByCustomerId;
  const profileForSubscription =
    options?.profileForSubscription === undefined
      ? { id: "user-1" }
      : options.profileForSubscription;

  const maybeSingle = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const upsert = vi.fn();
  const insert = vi.fn();
  const updateEq = vi.fn();
  const update = vi.fn();
  const from = vi.fn();

  maybeSingle.mockImplementation(() =>
    Promise.resolve({
      data:
        profileForSubscription !== undefined ? profileForSubscription : profileByCustomerId,
      error: null,
    }),
  );

  eq.mockReturnValue({
    maybeSingle,
  });

  select.mockReturnValue({
    eq,
  });

  update.mockReturnValue({
    eq: updateEq,
  });

  upsert.mockResolvedValue({ error: null });
  insert.mockResolvedValue({ error: null });
  updateEq.mockResolvedValue({ error: null });

  from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return {
        select,
      };
    }

    if (table === "subscriptions") {
      return {
        update,
        upsert,
      };
    }

    if (table === "purchase_events" || table === "learning_activity") {
      return {
        insert,
        upsert,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  createSupabaseAdminClient.mockReturnValue({
    from,
  });

  return { eq, from, insert, maybeSingle, select, updateEq, upsert };
}

describe("billing helpers", () => {
  beforeEach(() => {
    createSupabaseAdminClient.mockReset();
    getStripePriceMap.mockReset();
    getStripePriceMap.mockReturnValue({
      pro_monthly: "price_monthly",
      pro_yearly: "price_yearly",
    });
  });

  it("returns a free plan status when no subscription exists", async () => {
    const { getAccountStatus } = await import("@/lib/billing");
    const status = getAccountStatus(createSnapshot());

    expect(status.planLabel).toBe("Free");
    expect(status.billingStatus).toBe("No active subscription");
    expect(status.checkoutCtaLabel).toBe("Upgrade to Pro");
  });

  it("returns a configured warning when billing is not configured", async () => {
    const { getAccountStatus } = await import("@/lib/billing");
    const status = getAccountStatus(
      createSnapshot({
        configured: false,
      }),
    );

    expect(status.billingStatus).toBe("Billing not configured");
    expect(status.canManageBilling).toBe(false);
  });

  it("returns a pro status when an active subscription exists", async () => {
    const { getAccountStatus, getTutorRequestLimit, hasProAccess } =
      await import("@/lib/billing");
    const snapshot = createSnapshot({
      subscription: {
        user_id: "user-1",
        stripe_customer_id: "cus_123",
        stripe_subscription_id: "sub_123",
        stripe_price_id: "price_123",
        plan_slug: "pro_monthly",
        status: "active",
        current_period_start: "2026-03-01T00:00:00.000Z",
        current_period_end: "2026-04-01T00:00:00.000Z",
        cancel_at_period_end: false,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    });
    const status = getAccountStatus(snapshot);

    expect(status.planLabel).toBe("Pro");
    expect(status.headline).toBe("Pro monthly");
    expect(status.billingStatus).toBe("Active subscription");
    expect(status.checkoutCtaLabel).toBe("Change plan");
    expect(hasProAccess(snapshot)).toBe(true);
    expect(getTutorRequestLimit(snapshot)).toBe(60);
  });

  it("keeps free users on the lower tutor limit", async () => {
    const { getAccountStatus, getTutorRequestLimit, hasProAccess } =
      await import("@/lib/billing");
    const status = getAccountStatus(createSnapshot());

    expect(status.planLabel).toBe("Free");
    expect(hasProAccess(createSnapshot())).toBe(false);
    expect(getTutorRequestLimit(createSnapshot())).toBe(10);
  });

  it("upserts subscription records using the resolved customer profile", async () => {
    const { upsert } = configureAdminClient({
      profileForSubscription: { id: "user-1" },
    });
    const { upsertSubscriptionFromStripe } = await import("@/lib/billing");

    await upsertSubscriptionFromStripe({
      cancel_at_period_end: false,
      customer: "cus_123",
      id: "sub_123",
      items: {
        data: [
          {
            current_period_end: 1_775_347_200,
            current_period_start: 1_772_668_800,
            price: { id: "price_yearly" },
          },
        ],
      },
      status: "active",
    } as never);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_at_period_end: false,
        current_period_end: "2026-04-05T00:00:00.000Z",
        current_period_start: "2026-03-05T00:00:00.000Z",
        plan_slug: "pro_yearly",
        stripe_customer_id: "cus_123",
        stripe_price_id: "price_yearly",
        stripe_subscription_id: "sub_123",
        user_id: "user-1",
      }),
      { onConflict: "user_id" },
    );
  });

  it("marks subscriptions canceled in Supabase", async () => {
    const { updateEq } = configureAdminClient();
    const { markSubscriptionCanceled } = await import("@/lib/billing");

    await markSubscriptionCanceled("sub_123");

    expect(updateEq).toHaveBeenCalledWith("stripe_subscription_id", "sub_123");
  });

  it("records purchase events for the resolved customer profile", async () => {
    const { upsert } = configureAdminClient({
      profileByCustomerId: { id: "user-1" },
    });
    const { recordPurchaseEvent } = await import("@/lib/billing");

    await recordPurchaseEvent({
      amountCents: 2_900,
      currency: "usd",
      eventType: "invoice.paid",
      status: "paid",
      stripeEventId: "evt_invoice_paid",
      stripeCustomerId: "cus_123",
      stripeInvoiceId: "in_123",
      subscriptionId: "sub_123",
    });

    expect(upsert).toHaveBeenCalledWith(
      {
        amount_cents: 2_900,
        currency: "usd",
        event_type: "invoice.paid",
        status: "paid",
        stripe_checkout_session_id: null,
        stripe_event_id: "evt_invoice_paid",
        stripe_invoice_id: "in_123",
        subscription_id: "sub_123",
        user_id: "user-1",
      },
      { onConflict: "stripe_event_id" },
    );
  });

  it("records conversion events with normalized plan data", async () => {
    const { upsert } = configureAdminClient({
      profileByCustomerId: { id: "user-1" },
    });
    const { recordConversionEvent } = await import("@/lib/billing");

    await recordConversionEvent({
      eventType: "checkout_complete",
      plan: "pro_monthly",
      source: "stripe_webhook",
      sourceEventId: "evt_checkout",
      stripeCustomerId: "cus_123",
      targetSlug: "/purchases",
      targetTitle: "Completed Pro monthly checkout",
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_type: "conversion_event",
        lesson_slug: "/purchases",
        lesson_title: "Completed Pro monthly checkout",
        source_event_id: "evt_checkout",
        user_id: "user-1",
      }),
      { onConflict: "source_event_id" },
    );
    expect(upsert.mock.calls[0][0].activity_context).toContain('"plan":"pro_monthly"');
  });
});
