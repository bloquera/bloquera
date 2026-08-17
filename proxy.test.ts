const hasSupabaseEnv = vi.fn();
const updateSupabaseSession = vi.fn();
const nextResponseNext = vi.fn();
const nextResponseRedirect = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    next: (...args: unknown[]) => nextResponseNext(...args),
    redirect: (...args: unknown[]) => nextResponseRedirect(...args),
  },
}));

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseEnv: () => hasSupabaseEnv(),
}));

vi.mock("@/lib/supabase/proxy", () => ({
  updateSupabaseSession: (...args: unknown[]) => updateSupabaseSession(...args),
}));

function createRequest(pathname: string, method = "GET") {
  return {
    method,
    nextUrl: {
      pathname,
    },
    url: `https://bloquera.dev${pathname}`,
  } as never;
}

describe("proxy behavior", () => {
  beforeEach(() => {
    hasSupabaseEnv.mockReset();
    updateSupabaseSession.mockReset();
    nextResponseNext.mockReset();
    nextResponseRedirect.mockReset();

    nextResponseNext.mockImplementation(() => ({
      type: "next",
    }));
    nextResponseRedirect.mockImplementation((url: URL) => ({
      location: url.toString(),
      type: "redirect",
    }));
    hasSupabaseEnv.mockReturnValue(true);
    updateSupabaseSession.mockResolvedValue({
      response: { type: "next" },
      user: null,
    });
  });

  it("redirects unauthenticated profile requests to login with next path", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(createRequest("/profiles"));

    expect(response).toEqual({
      location: "https://bloquera.dev/auth/login?next=%2Fprofiles",
      type: "redirect",
    });
  });

  it("redirects unauthenticated purchases requests to login with next path", async () => {
    const { proxy } = await import("@/proxy");

    const response = await proxy(createRequest("/purchases"));

    expect(response).toEqual({
      location: "https://bloquera.dev/auth/login?next=%2Fpurchases",
      type: "redirect",
    });
  });

  it("redirects authenticated auth-page GET requests to learn", async () => {
    updateSupabaseSession.mockResolvedValue({
      response: { type: "next" },
      user: { id: "user-1" },
    });

    const { proxy } = await import("@/proxy");
    const response = await proxy(createRequest("/auth/login"));

    expect(response).toEqual({
      location: "https://bloquera.dev/learn",
      type: "redirect",
    });
  });

  it("allows requests through when Supabase env is unavailable", async () => {
    hasSupabaseEnv.mockReturnValue(false);

    const { proxy } = await import("@/proxy");
    const response = await proxy(createRequest("/profiles"));

    expect(updateSupabaseSession).not.toHaveBeenCalled();
    expect(response).toEqual({
      type: "next",
    });
  });

  it("refreshes the Supabase session for Stripe account routes", async () => {
    updateSupabaseSession.mockResolvedValue({
      response: { type: "next" },
      user: { id: "user-1" },
    });

    const { config, proxy } = await import("@/proxy");

    expect(config.matcher).toContain("/api/stripe/checkout");
    expect(config.matcher).toContain("/api/stripe/portal");
    expect(config.matcher).not.toContain("/api/stripe/webhook");

    const response = await proxy(
      createRequest("/api/stripe/checkout", "POST"),
    );

    expect(updateSupabaseSession).toHaveBeenCalledOnce();
    expect(response).toEqual({
      type: "next",
    });
  });
});
