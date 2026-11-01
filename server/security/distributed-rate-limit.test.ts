import { createHmac } from "node:crypto";

import {
  consumeDistributedRateLimit,
  getFixedWindow,
  getRequestClientIdentifier,
  getUtcDayWindow,
} from "@/server/security/distributed-rate-limit";

const rpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ rpc }),
}));

describe("distributed rate limiting", () => {
  beforeEach(() => {
    rpc.mockReset();
    process.env.RATE_LIMIT_SECRET =
      "test-rate-limit-secret-with-at-least-32-characters";
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_SECRET;
  });

  it("uses UTC calendar-day boundaries", () => {
    const window = getUtcDayWindow(new Date("2026-11-01T15:30:00.000Z"));

    expect(window.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("uses stable fixed windows", () => {
    const window = getFixedWindow(
      60_000,
      new Date("2026-11-01T00:01:30.000Z"),
    );

    expect(window.start.toISOString()).toBe("2026-11-01T00:01:00.000Z");
    expect(window.end.toISOString()).toBe("2026-11-01T00:02:00.000Z");
  });

  it("prefers the trusted request address over the cookie fallback", () => {
    const request = new Request("https://bloquera.io/api/chat", {
      headers: { "x-forwarded-for": "203.0.113.10, 10.0.0.1" },
    });

    expect(getRequestClientIdentifier(request, "guest-id")).toBe(
      "client:203.0.113.10",
    );
  });

  it("stores only an HMAC subject and returns the database result", async () => {
    rpc.mockResolvedValue({
      data: [
        {
          allowed: true,
          remaining: 2,
          reset_at: "2026-11-02T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const window = getUtcDayWindow(new Date("2026-11-01T15:30:00.000Z"));

    await expect(
      consumeDistributedRateLimit({
        limit: 3,
        scope: "tutor:user",
        subject: "user:private-id",
        window,
      }),
    ).resolves.toEqual({
      allowed: true,
      remaining: 2,
      resetAt: Date.parse("2026-11-02T00:00:00.000Z"),
    });
    expect(rpc).toHaveBeenCalledWith("consume_api_rate_limit", {
      target_limit: 3,
      target_scope: "tutor:user",
      target_subject_hash: createHmac(
        "sha256",
        process.env.RATE_LIMIT_SECRET!,
      )
        .update("user:private-id")
        .digest("hex"),
      target_window_end: "2026-11-02T00:00:00.000Z",
      target_window_start: "2026-11-01T00:00:00.000Z",
    });
  });
});
