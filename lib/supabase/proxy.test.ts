const createServerClient = vi.fn();
const getSupabaseBrowserEnv = vi.fn();
const nextResponseNext = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    next: (...args: unknown[]) => nextResponseNext(...args),
  },
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseBrowserEnv: () => getSupabaseBrowserEnv(),
}));

describe("updateSupabaseSession", () => {
  beforeEach(() => {
    createServerClient.mockReset();
    getSupabaseBrowserEnv.mockReset();
    nextResponseNext.mockReset();

    getSupabaseBrowserEnv.mockReturnValue({
      anonKey: "publishable-key",
      url: "https://test.supabase.co",
    });
  });

  it("passes refreshed cookies to the route request and browser response", async () => {
    const requestCookieSet = vi.fn();
    const responseCookieSet = vi.fn();
    const responseHeaderSet = vi.fn();
    const request = {
      cookies: {
        getAll: vi.fn().mockReturnValue([]),
        set: requestCookieSet,
      },
    } as never;
    const initialResponse = {
      cookies: { set: vi.fn() },
      headers: { set: vi.fn() },
    } as never;
    const refreshedResponse = {
      cookies: { set: responseCookieSet },
      headers: { set: responseHeaderSet },
    };

    nextResponseNext.mockReturnValue(refreshedResponse);
    createServerClient.mockImplementation(
      (_url: string, _key: string, options: {
        cookies: {
          setAll: (
            cookies: Array<{
              name: string;
              options: { path: string };
              value: string;
            }>,
            headers: Record<string, string>,
          ) => void;
        };
      }) => ({
        auth: {
          getUser: async () => {
            options.cookies.setAll(
              [
                {
                  name: "sb-test-auth-token",
                  value: "refreshed-token",
                  options: { path: "/" },
                },
              ],
              { "Cache-Control": "private, no-store" },
            );

            return {
              data: {
                user: { id: "user-1" },
              },
            };
          },
        },
      }),
    );

    const { updateSupabaseSession } = await import("@/lib/supabase/proxy");
    const result = await updateSupabaseSession(request, initialResponse);

    expect(requestCookieSet).toHaveBeenCalledWith(
      "sb-test-auth-token",
      "refreshed-token",
    );
    expect(nextResponseNext).toHaveBeenCalledWith({ request });
    expect(responseCookieSet).toHaveBeenCalledWith(
      "sb-test-auth-token",
      "refreshed-token",
      { path: "/" },
    );
    expect(responseHeaderSet).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(result).toEqual({
      response: refreshedResponse,
      user: { id: "user-1" },
    });
  });
});
