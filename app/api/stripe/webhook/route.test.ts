const getStripe = vi.fn();
const getStripeServerEnv = vi.fn();
const recordPurchaseEvent = vi.fn();
const recordConversionEvent = vi.fn();
const upsertSubscriptionFromStripe = vi.fn();
const markSubscriptionCanceled = vi.fn();
const constructEvent = vi.fn();
const claimStripeWebhookEvent = vi.fn();
const completeStripeWebhookEvent = vi.fn();
const failStripeWebhookEvent = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: () => getStripe(),
}));

vi.mock("@/lib/supabase/config", () => ({
  getStripeServerEnv: () => getStripeServerEnv(),
}));

vi.mock("@/lib/billing", () => ({
  markSubscriptionCanceled: (...args: unknown[]) => markSubscriptionCanceled(...args),
  recordConversionEvent: (...args: unknown[]) => recordConversionEvent(...args),
  recordPurchaseEvent: (...args: unknown[]) => recordPurchaseEvent(...args),
  upsertSubscriptionFromStripe: (...args: unknown[]) =>
    upsertSubscriptionFromStripe(...args),
}));

vi.mock("@/server/integrations/stripe/webhook-events", () => ({
  claimStripeWebhookEvent: (...args: unknown[]) =>
    claimStripeWebhookEvent(...args),
  completeStripeWebhookEvent: (...args: unknown[]) =>
    completeStripeWebhookEvent(...args),
  failStripeWebhookEvent: (...args: unknown[]) =>
    failStripeWebhookEvent(...args),
}));

describe("stripe webhook route", () => {
  beforeEach(() => {
    getStripe.mockReset();
    getStripeServerEnv.mockReset();
    recordPurchaseEvent.mockReset();
    recordConversionEvent.mockReset();
    upsertSubscriptionFromStripe.mockReset();
    markSubscriptionCanceled.mockReset();
    constructEvent.mockReset();
    claimStripeWebhookEvent.mockReset();
    completeStripeWebhookEvent.mockReset();
    failStripeWebhookEvent.mockReset();

    getStripe.mockReturnValue({
      webhooks: {
        constructEvent,
      },
    });
    getStripeServerEnv.mockReturnValue({
      monthlyPriceId: "price_monthly",
      secretKey: "sk_test",
      webhookSecret: "whsec_test",
      yearlyPriceId: "price_yearly",
    });
    claimStripeWebhookEvent.mockResolvedValue(true);
    completeStripeWebhookEvent.mockResolvedValue(undefined);
    failStripeWebhookEvent.mockResolvedValue(undefined);
  });

  it("requires webhook configuration", async () => {
    getStripe.mockReturnValue(null);
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(500);
  });

  it("requires a stripe signature", async () => {
    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Missing Stripe signature.",
    });
  });

  it("rejects invalid webhook signatures", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("invalid");
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid Stripe signature.",
    });
  });

  it("records checkout completion purchase and conversion events", async () => {
    constructEvent.mockReturnValue({
      data: {
        object: {
          amount_total: 2_900,
          currency: "usd",
          customer: "cus_123",
          id: "cs_123",
          metadata: {
            plan_slug: "pro_yearly",
          },
          payment_status: "paid",
          subscription: "sub_123",
        },
      },
      id: "evt_checkout",
      type: "checkout.session.completed",
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(recordPurchaseEvent).toHaveBeenCalledWith({
      amountCents: 2_900,
      currency: "usd",
      eventType: "checkout.session.completed",
      status: "paid",
      stripeEventId: "evt_checkout",
      stripeCheckoutSessionId: "cs_123",
      stripeCustomerId: "cus_123",
      subscriptionId: "sub_123",
    });
    expect(recordConversionEvent).toHaveBeenCalledWith({
      eventType: "checkout_complete",
      plan: "pro_yearly",
      source: "stripe_webhook",
      sourceEventId: "evt_checkout",
      stripeCustomerId: "cus_123",
      targetSlug: "/purchases",
      targetTitle: "Completed Pro yearly checkout",
    });
    expect(response.status).toBe(200);
    expect(claimStripeWebhookEvent).toHaveBeenCalledWith(
      "evt_checkout",
      "checkout.session.completed",
    );
    expect(completeStripeWebhookEvent).toHaveBeenCalledWith("evt_checkout");
  });

  it("acknowledges an event that has already been processed", async () => {
    constructEvent.mockReturnValue({
      data: { object: {} },
      id: "evt_duplicate",
      type: "customer.subscription.updated",
    });
    claimStripeWebhookEvent.mockResolvedValue(false);

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig_123" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: true,
      received: true,
    });
    expect(upsertSubscriptionFromStripe).not.toHaveBeenCalled();
  });

  it("upserts subscription records for subscription lifecycle events", async () => {
    const subscription = {
      customer: "cus_123",
      id: "sub_123",
      items: { data: [] },
      status: "active",
    };
    constructEvent.mockReturnValue({
      data: {
        object: subscription,
      },
      id: "evt_subscription_updated",
      type: "customer.subscription.updated",
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(upsertSubscriptionFromStripe).toHaveBeenCalledWith(subscription);
    expect(response.status).toBe(200);
  });

  it("marks subscriptions canceled for delete events", async () => {
    constructEvent.mockReturnValue({
      data: {
        object: {
          id: "sub_123",
        },
      },
      id: "evt_subscription_deleted",
      type: "customer.subscription.deleted",
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(markSubscriptionCanceled).toHaveBeenCalledWith("sub_123");
    expect(response.status).toBe(200);
  });

  it("records invoice lifecycle purchase events with subscription ids", async () => {
    constructEvent.mockReturnValue({
      data: {
        object: {
          amount_due: 2_900,
          amount_paid: 2_900,
          currency: "usd",
          customer: "cus_123",
          id: "in_123",
          parent: {
            subscription_details: {
              subscription: "sub_123",
            },
          },
          status: "paid",
        },
      },
      id: "evt_invoice_paid",
      type: "invoice.paid",
    });

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(recordPurchaseEvent).toHaveBeenCalledWith({
      amountCents: 2_900,
      currency: "usd",
      eventType: "invoice.paid",
      status: "paid",
      stripeEventId: "evt_invoice_paid",
      stripeCustomerId: "cus_123",
      stripeInvoiceId: "in_123",
      subscriptionId: "sub_123",
    });
    expect(response.status).toBe(200);
  });

  it("returns a service-unavailable response when event processing fails", async () => {
    constructEvent.mockReturnValue({
      data: {
        object: {
          amount_total: 2_900,
          currency: "usd",
          customer: "cus_123",
          id: "cs_123",
          metadata: {
            plan_slug: "pro_yearly",
          },
          payment_status: "paid",
          subscription: "sub_123",
        },
      },
      id: "evt_checkout_failed",
      type: "checkout.session.completed",
    });
    recordPurchaseEvent.mockRejectedValue(new Error("db unavailable"));

    const { POST } = await import("@/app/api/stripe/webhook/route");
    const response = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_123",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(503);
    expect(failStripeWebhookEvent).toHaveBeenCalledWith(
      "evt_checkout_failed",
      expect.any(Error),
    );
    await expect(response.json()).resolves.toEqual({
      error: "Unable to process Stripe webhook right now.",
    });
  });
});
