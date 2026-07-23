import { NextResponse } from "next/server";

import { getAuthenticatedServerSupabaseOrError, jsonError } from "@/lib/api-route";
import { hasProAccessForCurrentUser } from "@/lib/account-status";
import { getLessonBySlug } from "@/lib/lessons";
import {
  createLessonCaptionsUrl,
  createLessonVideoUrl,
  R2ConfigurationError,
} from "@/lib/r2";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const authResult = await getAuthenticatedServerSupabaseOrError({
    unauthorizedMessage: "You must be logged in to watch lesson videos.",
  });

  if ("response" in authResult) {
    return authResult.response;
  }

  const { slug } = await params;
  const lesson = getLessonBySlug(slug);

  if (!lesson) {
    return jsonError("Lesson not found.", 404);
  }

  if (lesson.requiresPro && !(await hasProAccessForCurrentUser())) {
    return jsonError("Upgrade to Pro to watch this lesson video.", 403);
  }

  const { data: video, error: videoError } = await authResult.supabase
    .from("lesson_videos")
    .select("video_key, captions_key, captions_language, captions_label")
    .eq("lesson_slug", lesson.slug)
    .eq("is_available", true)
    .maybeSingle();

  if (videoError) {
    return jsonError("Unable to load this lesson video right now.", 503);
  }

  if (!video?.video_key) {
    return jsonError("This lesson video is not available yet.", 404);
  }

  try {
    const [url, captionsUrl] = await Promise.all([
      createLessonVideoUrl(video.video_key),
      video.captions_key
        ? createLessonCaptionsUrl(video.captions_key)
        : Promise.resolve(null),
    ]);

    return NextResponse.json(
      {
        captions: captionsUrl
          ? {
              label: video.captions_label || "English",
              language: video.captions_language || "en",
              url: captionsUrl,
            }
          : null,
        url,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    if (error instanceof R2ConfigurationError) {
      return jsonError("Lesson video storage is not configured.", 503);
    }

    return jsonError("Unable to prepare this lesson video right now.", 503);
  }
}
