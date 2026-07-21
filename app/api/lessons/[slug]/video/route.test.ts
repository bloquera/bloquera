import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedServerSupabaseOrError: vi.fn(),
  hasProAccessForCurrentUser: vi.fn(),
  getLessonBySlug: vi.fn(),
  createLessonVideoUrl: vi.fn(),
}));

vi.mock("@/lib/api-route", async () => {
  const { NextResponse } = await import("next/server");

  return {
    getAuthenticatedServerSupabaseOrError: mocks.getAuthenticatedServerSupabaseOrError,
    jsonError: (message: string, status: number) =>
      NextResponse.json({ error: message }, { status }),
  };
});

vi.mock("@/lib/account-status", () => ({
  hasProAccessForCurrentUser: mocks.hasProAccessForCurrentUser,
}));
vi.mock("@/lib/lessons", () => ({ getLessonBySlug: mocks.getLessonBySlug }));
vi.mock("@/lib/r2", () => ({
  createLessonVideoUrl: mocks.createLessonVideoUrl,
  R2ConfigurationError: class R2ConfigurationError extends Error {},
}));

import { GET } from "./route";

const context = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/lessons/[slug]/video", () => {
  beforeEach(() => {
    mocks.getAuthenticatedServerSupabaseOrError.mockReset();
    mocks.hasProAccessForCurrentUser.mockReset();
    mocks.getLessonBySlug.mockReset();
    mocks.createLessonVideoUrl.mockReset();

    mocks.getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      supabase: {},
      user: { id: "user-1" },
    });
    mocks.getLessonBySlug.mockReturnValue({ slug: "what-is-money" });
    mocks.createLessonVideoUrl.mockResolvedValue("https://signed.example/video.mp4");
  });

  it("requires an authenticated user", async () => {
    mocks.getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      response: new Response(null, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost"), context("what-is-money"));

    expect(response.status).toBe(401);
    expect(mocks.createLessonVideoUrl).not.toHaveBeenCalled();
  });

  it("returns a private non-cacheable signed URL", async () => {
    const response = await GET(new Request("http://localhost"), context("what-is-money"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      url: "https://signed.example/video.mp4",
    });
    expect(mocks.createLessonVideoUrl).toHaveBeenCalledWith("what-is-money");
  });

  it("does not sign an unknown lesson", async () => {
    mocks.getLessonBySlug.mockReturnValue(null);

    const response = await GET(new Request("http://localhost"), context("unknown"));

    expect(response.status).toBe(404);
    expect(mocks.createLessonVideoUrl).not.toHaveBeenCalled();
  });

  it("requires Pro access for premium lessons", async () => {
    mocks.getLessonBySlug.mockReturnValue({ slug: "premium", requiresPro: true });
    mocks.hasProAccessForCurrentUser.mockResolvedValue(false);

    const response = await GET(new Request("http://localhost"), context("premium"));

    expect(response.status).toBe(403);
    expect(mocks.createLessonVideoUrl).not.toHaveBeenCalled();
  });
});
