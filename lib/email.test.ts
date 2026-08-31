const createSupabaseAdminClient = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => createSupabaseAdminClient(),
}));

describe("welcome email", () => {
  const originalEnv = {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  };
  const fetchMock = vi.fn();
  const rpc = vi.fn();
  const eq = vi.fn();
  const is = vi.fn();
  const update = vi.fn();
  const from = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    rpc.mockReset();
    eq.mockReset();
    is.mockReset();
    update.mockReset();
    from.mockReset();
    createSupabaseAdminClient.mockReset();

    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "Bloquera <hello@bloquera.io>";
    process.env.NEXT_PUBLIC_SITE_URL = "https://bloquera.io/";

    vi.stubGlobal("fetch", fetchMock);
    rpc.mockResolvedValue({ data: true, error: null });
    is.mockResolvedValue({ error: null });
    eq.mockReturnValue({ error: null, is });
    update.mockReturnValue({ eq });
    from.mockReturnValue({ update });
    createSupabaseAdminClient.mockReturnValue({ from, rpc });
    fetchMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.env.RESEND_API_KEY = originalEnv.apiKey;
    process.env.RESEND_FROM_EMAIL = originalEnv.fromEmail;
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv.siteUrl;
    vi.unstubAllGlobals();
  });

  it("sends and records a one-time welcome email", async () => {
    const { sendWelcomeEmailForUser } = await import("@/lib/email");

    const result = await sendWelcomeEmailForUser({
      email: "learner@example.com",
      id: "user-1",
      user_metadata: { full_name: "Ada Learner" },
    } as never);

    expect(rpc).toHaveBeenCalledWith("claim_welcome_email", {
      target_user_id: "user-1",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual(
      expect.objectContaining({
        subject: "Welcome to Bloquera",
        to: ["learner@example.com"],
      }),
    );
    expect(result).toBe("sent");
  });

  it("does not send when another request already claimed the email", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { sendWelcomeEmailForUser } = await import("@/lib/email");

    const result = await sendWelcomeEmailForUser({
      email: "learner@example.com",
      id: "user-1",
      user_metadata: {},
    } as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBe("already-claimed");
  });

  it("releases the claim when delivery fails", async () => {
    fetchMock.mockResolvedValue({ ok: false });
    const { sendWelcomeEmailForUser } = await import("@/lib/email");

    const result = await sendWelcomeEmailForUser({
      email: "learner@example.com",
      id: "user-1",
      user_metadata: {},
    } as never);

    expect(update).toHaveBeenCalledWith({ welcome_email_claimed_at: null });
    expect(is).toHaveBeenCalledWith("welcome_email_sent_at", null);
    expect(result).toBe("failed");
  });

  it("stays inactive until Resend is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendWelcomeEmailForUser } = await import("@/lib/email");

    const result = await sendWelcomeEmailForUser({
      email: "learner@example.com",
      id: "user-1",
      user_metadata: {},
    } as never);

    expect(rpc).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toBe("not-configured");
  });
});
