const createServerSupabaseClient = vi.fn();
const sendWelcomeEmailForUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClient(),
}));

vi.mock("@/lib/email", () => ({
  sendWelcomeEmailForUser: (...args: unknown[]) =>
    sendWelcomeEmailForUser(...args),
}));

describe("profile sync", () => {
  const user = {
    created_at: "2026-08-31T10:00:00.000Z",
    email: "learner@example.com",
    id: "user-1",
    user_metadata: {},
  };
  const profile = {
    avatar_url: null,
    bio: null,
    created_at: "2026-08-31T10:00:00.000Z",
    display_name: null,
    email: "learner@example.com",
    id: "user-1",
    timezone: null,
  };

  beforeEach(() => {
    vi.resetModules();
    createServerSupabaseClient.mockReset();
    sendWelcomeEmailForUser.mockReset();
    sendWelcomeEmailForUser.mockResolvedValue("sent");
  });

  function mockProfileClient(existingProfile: { id: string } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: existingProfile,
      error: null,
    });
    const lookupEq = vi.fn().mockReturnValue({ maybeSingle });
    const lookupSelect = vi.fn().mockReturnValue({ eq: lookupEq });
    const single = vi.fn().mockResolvedValue({ data: profile, error: null });
    const resultSelect = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select: resultSelect });
    const from = vi.fn().mockReturnValue({
      select: lookupSelect,
      upsert,
    });

    createServerSupabaseClient.mockResolvedValue({ from });

    return { upsert };
  }

  it("sends a welcome email when the user gets their first profile", async () => {
    const { upsert } = mockProfileClient(null);
    const { syncProfileForUser } = await import("@/lib/profile");

    await expect(syncProfileForUser(user as never)).resolves.toEqual(profile);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        welcome_email_eligible_at: expect.any(String),
      }),
      { onConflict: "id" },
    );
    expect(sendWelcomeEmailForUser).toHaveBeenCalledWith(user);
  });

  it("retries delivery safely without making an existing profile newly eligible", async () => {
    const { upsert } = mockProfileClient({ id: "user-1" });
    const { syncProfileForUser } = await import("@/lib/profile");

    await expect(syncProfileForUser(user as never)).resolves.toEqual(profile);
    expect(upsert).toHaveBeenCalledWith(
      {
        email: "learner@example.com",
        id: "user-1",
      },
      { onConflict: "id" },
    );
    expect(sendWelcomeEmailForUser).toHaveBeenCalledWith(user);
  });
});
