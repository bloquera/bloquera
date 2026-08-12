import { describe, expect, it } from "vitest";

import {
  getLessonCaptionsKey,
  getLessonVideoKey,
  getR2UploadConfig,
  getSupabaseUploadConfig,
  parseUploadArguments,
} from "./upload-lesson-video.mjs";

describe("lesson video uploader", () => {
  it("builds the course-aware object key used by lesson playback", () => {
    expect(
      getLessonVideoKey("bitcoin", "foundations", "what-is-money"),
    ).toBe("courses/bitcoin/foundations/what-is-money.mp4");
  });

  it("builds a caption key inside the module captions folder", () => {
    expect(
      getLessonCaptionsKey("bitcoin", "foundations", "what-is-money", "en-GB"),
    ).toBe("courses/bitcoin/foundations/captions/what-is-money.en-gb.vtt");
  });

  it("rejects unsafe destination slugs and caption languages", () => {
    expect(() =>
      getLessonVideoKey("../private", "foundations", "what-is-money"),
    ).toThrow(/course slug/i);
    expect(() =>
      getLessonVideoKey("bitcoin", "Foundations", "what-is-money"),
    ).toThrow(/module slug/i);
    expect(() =>
      getLessonVideoKey("bitcoin", "foundations", "What-Is-Money"),
    ).toThrow(/lesson slug/i);
    expect(() =>
      getLessonCaptionsKey(
        "bitcoin",
        "foundations",
        "what-is-money",
        "../en",
      ),
    ).toThrow(/language/i);
  });

  it("parses captions metadata and the optional overwrite flag", () => {
    expect(
      parseUploadArguments([
        "bitcoin",
        "foundations",
        "what-is-money",
        "./video.mp4",
        "--captions",
        "./captions.vtt",
        "--language",
        "en-GB",
        "--label",
        "English (UK)",
        "--force",
      ]),
    ).toEqual({
      captionsPath: "./captions.vtt",
      courseSlug: "bitcoin",
      force: true,
      label: "English (UK)",
      language: "en-GB",
      lessonSlug: "what-is-money",
      moduleSlug: "foundations",
      videoPath: "./video.mp4",
    });
  });

  it("uses English caption defaults when only a caption path is supplied", () => {
    expect(
      parseUploadArguments([
        "bitcoin",
        "foundations",
        "what-is-money",
        "./video.mp4",
        "--captions",
        "./captions.vtt",
      ]),
    ).toMatchObject({ language: "en", label: "English" });
  });

  it("requires every destination slug and a video path", () => {
    expect(() => parseUploadArguments(["what-is-money"])).toThrow(/usage/i);
  });

  it("rejects caption metadata without a caption file", () => {
    expect(() =>
      parseUploadArguments([
        "bitcoin",
        "foundations",
        "what-is-money",
        "./video.mp4",
        "--language",
        "en-GB",
      ]),
    ).toThrow(/captions/i);
  });

  it("requires every R2 credential", () => {
    expect(() =>
      getR2UploadConfig({
        ...process.env,
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
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow(/supabase is not configured/i);
  });
});
