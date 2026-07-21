import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getSignedUrl: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

import {
  createLessonVideoUrl,
  getLessonVideoKey,
  R2ConfigurationError,
} from "@/lib/r2";

describe("R2 lesson videos", () => {
  beforeEach(() => {
    vi.stubEnv("R2_ACCOUNT_ID", "account-id");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("R2_BUCKET", "bloquera-videos");
    mocks.getSignedUrl.mockReset();
    mocks.getSignedUrl.mockResolvedValue("https://signed.example/video.mp4");
  });

  it("uses a deterministic lesson object key", () => {
    expect(getLessonVideoKey("what-is-money")).toBe("lessons/what-is-money.mp4");
  });

  it("creates a 15-minute signed read URL", async () => {
    await expect(createLessonVideoUrl("what-is-money")).resolves.toBe(
      "https://signed.example/video.mp4",
    );

    expect(mocks.getSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        input: expect.objectContaining({
          Bucket: "bloquera-videos",
          Key: "lessons/what-is-money.mp4",
        }),
      }),
      { expiresIn: 900 },
    );
  });

  it("fails closed when credentials are missing", async () => {
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");

    await expect(createLessonVideoUrl("what-is-money")).rejects.toBeInstanceOf(
      R2ConfigurationError,
    );
    expect(mocks.getSignedUrl).not.toHaveBeenCalled();
  });
});
