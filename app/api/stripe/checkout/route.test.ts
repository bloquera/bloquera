import { POST } from "@/app/api/stripe/checkout/route";

const getStripe = vi.fn();
const getPlanDetails = vi.fn();
const ensureStripeCustomerForUser = vi.fn();
const getAuthenticatedServerSupabaseOrError = vi.fn();
const createSession = vi.fn();

vi.mock("@/lib/api-route", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-route")>()),
  getAuthenticatedServerSupabaseOrError: (...args: unknown[]) =>
    getAuthenticatedServerSupabaseOrError(...args),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => getStripe(),
}));

vi.mock("@/lib/billing", () => ({
  ensureStripeCustomerForUser: (user: unknown) => ensureStripeCustomerForUser(user),
  getCancelUrl: () => "http://localhost:3000/purchases/canceled",
  getPlanDetails: (plan: string) => getPlanDetails(plan),
  getSuccessUrl: () => "http://localhost:3000/purchases/success",
}));

describe("stripe checkout route", () => {
  beforeEach(() => {
    getStripe.mockReset();
    getPlanDetails.mockReset();
    ensureStripeCustomerForUser.mockReset();
    getAuthenticatedServerSupabaseOrError.mockReset();
    createSession.mockReset();

    getStripe.mockReturnValue({
      checkout: {
        sessions: {
          create: createSession,
        },
      },
    });
    getPlanDetails.mockReturnValue({
      label: "Pro monthly",
      priceId: "price_monthly",
    });
    getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      supabase: {},
      user: {
        email: "learner@example.com",
        id: "user-1",
      },
    });
    ensureStripeCustomerForUser.mockResolvedValue({
      customerId: "cus_123",
      user: {
        id: "user-1",
      },
    });
    createSession.mockResolvedValue({
      url: "https://checkout.stripe.com/session/test",
    });
  });

  it("requires stripe to be configured", async () => {
    getStripe.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(response.status).toBe(500);
  });

  it("rejects invalid plans", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "wrong" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("rejects malformed request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Send a valid checkout request body.",
    });
  });

  it("returns a configuration error when plan details are unavailable", async () => {
    getPlanDetails.mockReturnValue(null);

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(createSession).not.toHaveBeenCalled();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Stripe billing is not configured yet.",
    });
  });

  it("requires an authenticated user", async () => {
    getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      response: Response.json(
        { error: "You must be logged in to start checkout." },
        { status: 401 },
      ),
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(ensureStripeCustomerForUser).not.toHaveBeenCalled();
  });

  it("passes the verified user to billing customer setup", async () => {
    await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(ensureStripeCustomerForUser).toHaveBeenCalledWith({
      email: "learner@example.com",
      id: "user-1",
    });
  });

  it("reports missing billing administration separately from authentication", async () => {
    ensureStripeCustomerForUser.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Supabase billing administration is not configured yet.",
    });
  });

  it("returns a checkout URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: "http://localhost:3000/purchases/canceled",
        customer: "cus_123",
        mode: "subscription",
        success_url: "http://localhost:3000/purchases/success",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.com/session/test",
    });
  });

  it("fails when stripe does not return a checkout URL", async () => {
    createSession.mockResolvedValue({
      url: null,
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to start checkout right now.",
    });
  });

  it("returns a rate-limit response when Stripe rejects checkout creation", async () => {
    createSession.mockRejectedValue({
      type: "StripeRateLimitError",
    });

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Stripe is rate limiting checkout right now. Please try again in a minute.",
    });
  });

  it("returns a service-unavailable response when customer setup throws", async () => {
    ensureStripeCustomerForUser.mockRejectedValue(new Error("network"));

    const response = await POST(
      new Request("http://localhost/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro_monthly" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to prepare checkout for this account right now.",
    });
  });
});
