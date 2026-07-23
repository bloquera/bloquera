import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eq: vi.fn(),
  getAuthenticatedServerSupabaseOrError: vi.fn(),
  getLessonBySlug: vi.fn(),
  hasProAccessForCurrentUser: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/api-route", async () => {
  const { NextResponse } = await import("next/server");

  return {
    getAuthenticatedServerSupabaseOrError:
      mocks.getAuthenticatedServerSupabaseOrError,
    jsonError: (message: string, status: number) =>
      NextResponse.json({ error: message }, { status }),
    parseJsonBody: async <T,>(request: Request, invalidMessage: string) => {
      try {
        return { data: (await request.json()) as T };
      } catch {
        return {
          response: NextResponse.json(
            { error: invalidMessage },
            { status: 400 },
          ),
        };
      }
    },
  };
});

vi.mock("@/lib/account-status", () => ({
  hasProAccessForCurrentUser: mocks.hasProAccessForCurrentUser,
}));
vi.mock("@/lib/lessons", () => ({ getLessonBySlug: mocks.getLessonBySlug }));

import { GET, PUT } from "./route";

const context = (slug = "what-is-money") => ({
  params: Promise.resolve({ slug }),
});

function putRequest(positionSeconds: number, durationSeconds: number) {
  return new Request("http://localhost/api/lessons/what-is-money/video-progress", {
    body: JSON.stringify({ durationSeconds, positionSeconds }),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
}

describe("lesson video progress route", () => {
  let savedPayload: Record<string, unknown> | null;

  beforeEach(() => {
    savedPayload = null;
    Object.values(mocks).forEach((mock) => mock.mockReset());

    const query = {
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
      select: mocks.select,
      single: mocks.single,
      upsert: mocks.upsert,
    };
    mocks.eq.mockReturnValue(query);
    mocks.select.mockReturnValue(query);
    mocks.upsert.mockImplementation((payload: Record<string, unknown>) => {
      savedPayload = payload;
      return query;
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.single.mockImplementation(async () => ({
      data: savedPayload
        ? {
            completed_at: savedPayload.completed_at,
            duration_seconds: savedPayload.duration_seconds,
            position_seconds: savedPayload.position_seconds,
            updated_at: savedPayload.updated_at,
          }
        : null,
      error: null,
    }));
    mocks.getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      supabase: { from: vi.fn().mockReturnValue(query) },
      user: { id: "user-1" },
    });
    mocks.getLessonBySlug.mockReturnValue({ slug: "what-is-money" });
  });

  it("requires authentication", async () => {
    mocks.getAuthenticatedServerSupabaseOrError.mockResolvedValue({
      response: new Response(null, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost"), context());

    expect(response.status).toBe(401);
  });

  it("returns empty progress before playback starts", async () => {
    const response = await GET(new Request("http://localhost"), context());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      completed: false,
      completedAt: null,
      durationSeconds: 0,
      positionSeconds: 0,
      updatedAt: null,
    });
  });

  it("rejects invalid progress values", async () => {
    const response = await PUT(putRequest(-1, 100), context());

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("stores position without marking an early view complete", async () => {
    const response = await PUT(putRequest(45, 100), context());

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: null,
        duration_seconds: 100,
        lesson_slug: "what-is-money",
        position_seconds: 45,
        user_id: "user-1",
      }),
      { onConflict: "user_id,lesson_slug" },
    );
  });

  it("marks the video complete at ninety percent", async () => {
    const response = await PUT(putRequest(90, 100), context());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.completed).toBe(true);
    expect(payload.completedAt).toEqual(expect.any(String));
  });

  it("preserves an existing completion timestamp", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { completed_at: "2026-07-22T12:00:00.000Z" },
      error: null,
    });

    const response = await PUT(putRequest(20, 100), context());

    expect(response.status).toBe(200);
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        completed_at: "2026-07-22T12:00:00.000Z",
      }),
      expect.anything(),
    );
  });
});
