import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedServerSupabaseOrError: vi.fn(),
  hasProAccessForCurrentUser: vi.fn(),
  getLessonBySlug: vi.fn(),
  createLessonCaptionsUrl: vi.fn(),
  createLessonVideoUrl: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
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
  createLessonCaptionsUrl: mocks.createLessonCaptionsUrl,
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
    mocks.createLessonCaptionsUrl.mockReset();
    mocks.createLessonVideoUrl.mockReset();
    mocks.from.mockReset();
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.maybeSingle.mockReset();

    const videoQuery = {
      select: mocks.select,
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
    };
    mocks.from.mockReturnValue(videoQuery);
    mocks.select.mockReturnValue(videoQuery);
    mocks.eq.mockReturnValue(videoQuery);
    mocks.maybeSingle.mockResolvedValue({
      data: {
        captions_key: null,
        captions_label: "English",
        captions_language: "en",
        video_key: "lessons/what-is-money.mp4",
      },
      error: null,
    });

    mocks.getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      supabase: { from: mocks.from },
      user: { id: "user-1" },
    });
    mocks.getLessonBySlug.mockReturnValue({ slug: "what-is-money" });
    mocks.createLessonVideoUrl.mockResolvedValue("https://signed.example/video.mp4");
    mocks.createLessonCaptionsUrl.mockResolvedValue(
      "https://signed.example/captions.vtt",
    );
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
      captions: null,
      url: "https://signed.example/video.mp4",
    });
    expect(mocks.from).toHaveBeenCalledWith("lesson_videos");
    expect(mocks.createLessonVideoUrl).toHaveBeenCalledWith(
      "lessons/what-is-money.mp4",
    );
  });

  it("returns signed caption metadata when captions are configured", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        captions_key: "lessons/what-is-money.en.vtt",
        captions_label: "English",
        captions_language: "en",
        video_key: "lessons/what-is-money.mp4",
      },
      error: null,
    });

    const response = await GET(
      new Request("http://localhost"),
      context("what-is-money"),
    );

    await expect(response.json()).resolves.toEqual({
      captions: {
        label: "English",
        language: "en",
        url: "https://signed.example/captions.vtt",
      },
      url: "https://signed.example/video.mp4",
    });
    expect(mocks.createLessonCaptionsUrl).toHaveBeenCalledWith(
      "lessons/what-is-money.en.vtt",
    );
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

  it("does not sign a URL when video metadata is unavailable", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET(new Request("http://localhost"), context("what-is-money"));

    expect(response.status).toBe(404);
    expect(mocks.createLessonVideoUrl).not.toHaveBeenCalled();
  });

  it("reports video metadata query failures", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: new Error("database") });

    const response = await GET(new Request("http://localhost"), context("what-is-money"));

    expect(response.status).toBe(503);
    expect(mocks.createLessonVideoUrl).not.toHaveBeenCalled();
  });
});
