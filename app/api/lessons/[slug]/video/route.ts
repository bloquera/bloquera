import { NextResponse } from "next/server";

import { getAuthenticatedServerSupabaseOrError, jsonError } from "@/lib/api-route";
import { hasProAccessForCurrentUser } from "@/lib/account-status";
import { getLessonBySlug } from "@/lib/lessons";
import { createLessonVideoUrl, R2ConfigurationError } from "@/lib/r2";

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

  try {
    const url = await createLessonVideoUrl(lesson.slug);

    return NextResponse.json(
      { url },
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
