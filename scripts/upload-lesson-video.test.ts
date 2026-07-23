import { describe, expect, it } from "vitest";

import {
  getLessonVideoKey,
  getR2UploadConfig,
  getSupabaseUploadConfig,
  parseUploadArguments,
} from "./upload-lesson-video.mjs";

describe("lesson video uploader", () => {
  it("builds the object key used by lesson playback", () => {
    expect(getLessonVideoKey("what-is-money")).toBe("lessons/what-is-money.mp4");
  });

  it("rejects unsafe lesson slugs", () => {
    expect(() => getLessonVideoKey("../private/video")).toThrow(/slug/i);
    expect(() => getLessonVideoKey("What-Is-Money")).toThrow(/slug/i);
  });

  it("parses the optional overwrite flag", () => {
    expect(
      parseUploadArguments(["what-is-money", "./video.mp4", "--force"]),
    ).toEqual({
      force: true,
      slug: "what-is-money",
      videoPath: "./video.mp4",
    });
  });

  it("requires exactly a slug and a path", () => {
    expect(() => parseUploadArguments(["what-is-money"])).toThrow(/usage/i);
  });

  it("requires every R2 credential", () => {
    expect(() =>
      getR2UploadConfig({
        R2_ACCOUNT_ID: "account-id",
        R2_ACCESS_KEY_ID: "access-key",
        R2_SECRET_ACCESS_KEY: "",
        R2_BUCKET: "bloquera-videos",
      }),
    ).toThrow(/not configured/i);
  });

  it("requires server-side Supabase credentials for metadata", () => {
    expect(() =>
      getSupabaseUploadConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow(/supabase is not configured/i);
  });
});
