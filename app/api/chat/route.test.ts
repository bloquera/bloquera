import { POST } from "@/app/api/chat/route";

const createTutorReply = vi.fn();
const getUser = vi.fn();
const createServerSupabaseClient = vi.fn();
const createSupabaseAdminClient = vi.fn();
const getBillingSnapshotForCurrentUser = vi.fn();
const insert = vi.fn();
const from = vi.fn();
const activityUsageLt = vi.fn();
const activityUsageGte = vi.fn();
const activityUsageEqType = vi.fn();
const activityUsageEqUser = vi.fn();
const activityUsageSelect = vi.fn();
const cookies = vi.fn();
const cookieGet = vi.fn();
const consumeDistributedRateLimit = vi.fn();

vi.mock("@/lib/openai", () => ({
  createTutorReply: (message: string) => createTutorReply(message),
  inferTutorTopic: () => "Bitcoin foundations",
}));

vi.mock("@/lib/billing", () => ({
  getBillingSnapshotForCurrentUser: () => getBillingSnapshotForCurrentUser(),
  getTutorRequestLimit: (snapshot: {
    configured: boolean;
    customerId: string | null;
    purchaseEvents: unknown[];
    subscription: { status: string } | null;
  }) => (snapshot.subscription ? 30 : 10),
  hasProAccess: (snapshot: {
    subscription: { status: string } | null;
  }) => Boolean(snapshot.subscription),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

vi.mock("next/headers", () => ({
  cookies: () => cookies(),
}));

vi.mock("@/server/security/distributed-rate-limit", () => ({
  consumeDistributedRateLimit: (...args: unknown[]) =>
    consumeDistributedRateLimit(...args),
  getFixedWindow: () => ({
    end: new Date("2026-12-01T00:00:00.000Z"),
    start: new Date("2026-11-01T00:00:00.000Z"),
  }),
  getRequestClientIdentifier: (_request: Request, fallback: string) => fallback,
  getUtcDayWindow: () => ({
    end: new Date("2026-11-02T00:00:00.000Z"),
    start: new Date("2026-11-01T00:00:00.000Z"),
  }),
}));

describe("chat route", () => {
  beforeEach(() => {
    createTutorReply.mockReset();
    getUser.mockReset();
    createServerSupabaseClient.mockReset();
    createSupabaseAdminClient.mockReset();
    getBillingSnapshotForCurrentUser.mockReset();
    insert.mockReset();
    from.mockReset();
    activityUsageLt.mockReset();
    activityUsageGte.mockReset();
    activityUsageEqType.mockReset();
    activityUsageEqUser.mockReset();
    activityUsageSelect.mockReset();
    cookies.mockReset();
    cookieGet.mockReset();
    consumeDistributedRateLimit.mockReset();
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser,
      },
      from,
    });
    createSupabaseAdminClient.mockReturnValue({
      from,
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
        },
      },
    });
    getBillingSnapshotForCurrentUser.mockResolvedValue({
      configured: true,
      customerId: null,
      purchaseEvents: [],
      subscription: null,
    });
    activityUsageLt.mockResolvedValue({ count: 0 });
    activityUsageGte.mockReturnValue({
      lt: activityUsageLt,
    });
    activityUsageEqType.mockReturnValue({
      gte: activityUsageGte,
    });
    activityUsageEqUser.mockReturnValue({
      eq: activityUsageEqType,
    });
    activityUsageSelect.mockReturnValue({
      eq: activityUsageEqUser,
    });
    from.mockImplementation((table: string) => {
      if (table === "learning_activity") {
        return {
          insert,
          select: activityUsageSelect,
        };
      }

      return {
        insert,
      };
    });
    cookies.mockResolvedValue({
      get: cookieGet,
    });
    cookieGet.mockReturnValue(undefined);
    insert.mockResolvedValue({ error: null });
    consumeDistributedRateLimit.mockResolvedValue(null);
  });

  it("rejects empty messages", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "   " }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please enter a question before submitting.",
    });
  });

  it("rejects malformed request bodies", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please enter a valid tutor question.",
    });
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?", source: "lesson" }),
      }),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Log in to use the AI tutor.",
    });
  });

  it("allows a limited guest demo on the home page", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });
    createTutorReply.mockResolvedValue("Bitcoin reply");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?", source: "home" }),
      }),
    );

    expect(from).not.toHaveBeenCalledWith("learning_activity");
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("bloquera_guest_tutor_id=");
    expect(response.headers.get("set-cookie")).toContain("bloquera_guest_tutor_usage=");
    await expect(response.json()).resolves.toEqual({
      reply: "Bitcoin reply",
      recordedAt: expect.any(String),
      topic: "Bitcoin foundations",
      usage: {
        limit: 3,
        remaining: 2,
        plan: "free",
        resetAt: expect.any(Number),
      },
    });
  });

  it("rate limits the guest home-page demo", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });
    cookieGet.mockImplementation((name: string) => {
      if (name === "bloquera_guest_tutor_id") {
        return {
          value: "guest-1",
        };
      }

      if (name === "bloquera_guest_tutor_usage") {
        return {
          value: JSON.stringify({
            count: 3,
            resetAt: Date.now() + 60_000,
          }),
        };
      }

      return undefined;
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?", source: "home" }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "You have used the guest AI demo for now. Log in to keep chatting.",
      usage: {
        limit: 3,
        plan: "free",
        remaining: 0,
        resetAt: expect.any(Number),
      },
    });
  });

  it("rate limits the guest home-page demo from the usage cookie", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });
    cookieGet.mockImplementation((name: string) => {
      if (name === "bloquera_guest_tutor_id") {
        return {
          value: "guest-1",
        };
      }

      if (name === "bloquera_guest_tutor_usage") {
        return {
          value: JSON.stringify({
            count: 3,
          }),
        };
      }

      return undefined;
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?", source: "home" }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "You have used the guest AI demo for now. Log in to keep chatting.",
      usage: {
        limit: 3,
        plan: "free",
        remaining: 0,
        resetAt: expect.any(Number),
      },
    });
  });

  it("increments the guest home-page usage cookie up to the limit", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });
    createTutorReply.mockResolvedValue("Bitcoin reply");
    cookieGet.mockImplementation((name: string) => {
      if (name === "bloquera_guest_tutor_usage") {
        return {
          value: JSON.stringify({
            count: 2,
          }),
        };
      }

      return undefined;
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?", source: "home" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("bloquera_guest_tutor_usage=");
    await expect(response.json()).resolves.toEqual({
      reply: "Bitcoin reply",
      recordedAt: expect.any(String),
      topic: "Bitcoin foundations",
      usage: {
        limit: 3,
        remaining: 0,
        plan: "free",
        resetAt: expect.any(Number),
      },
    });
  });

  it("returns a service-unavailable response when auth verification fails", async () => {
    getUser.mockRejectedValue(new Error("auth unavailable"));

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to verify your account right now.",
    });
  });

  it("returns the tutor reply for valid input", async () => {
    createTutorReply.mockResolvedValue("Bitcoin reply");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(createTutorReply).toHaveBeenCalledWith("What is Bitcoin?");
    expect(from).toHaveBeenCalledWith("learning_activity");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_type: "tutor_prompt",
        lesson_slug: "ai-tutor",
        lesson_title: "What is Bitcoin?",
      }),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reply: "Bitcoin reply",
      recordedAt: expect.any(String),
      topic: "Bitcoin foundations",
      usage: {
        limit: 10,
        remaining: 9,
        plan: "free",
        resetAt: expect.any(Number),
      },
    });
  });

  it("returns a larger tutor limit for pro users", async () => {
    getBillingSnapshotForCurrentUser.mockResolvedValue({
      configured: true,
      customerId: "cus_123",
      purchaseEvents: [],
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
    activityUsageLt.mockResolvedValue({ count: 0 });
    createTutorReply.mockResolvedValue("Bitcoin reply");

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(activityUsageSelect).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(activityUsageEqUser).toHaveBeenCalledWith(
      "user_id",
      "user-1",
    );
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        usage: expect.objectContaining({
          limit: 30,
          remaining: 29,
          plan: "pro",
        }),
      }),
    );
  });

  it("rate limits tutor requests once the daily allowance is exhausted", async () => {
    activityUsageLt.mockResolvedValue({ count: 10 });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    await expect(response.json()).resolves.toEqual({
      error: "You have reached your tutor limit for today. Please come back tomorrow.",
    });
  });

  it("returns a service-unavailable response when daily usage cannot be loaded", async () => {
    activityUsageLt.mockRejectedValue(new Error("usage unavailable"));

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to load tutor usage right now.",
    });
  });

  it("returns a service-unavailable response when the tutor fails", async () => {
    createTutorReply.mockRejectedValue(new Error("boom"));

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "The tutor is temporarily unavailable. Please try again shortly.",
    });
  });

  it("returns a service-unavailable response when tutor activity cannot be saved", async () => {
    createTutorReply.mockResolvedValue("Bitcoin reply");
    insert.mockRejectedValue(new Error("write failed"));

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "What is Bitcoin?" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to save tutor activity right now.",
    });
  });

  it("rejects oversized messages", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: "a".repeat(501) }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Please keep tutor questions under 500 characters.",
    });
  });
});
