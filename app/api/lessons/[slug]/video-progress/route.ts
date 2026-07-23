import { NextResponse } from "next/server";

import {
  getAuthenticatedServerSupabaseOrError,
  jsonError,
  parseJsonBody,
} from "@/lib/api-route";
import { hasProAccessForCurrentUser } from "@/lib/account-status";
import { getLessonBySlug } from "@/lib/lessons";

const COMPLETION_THRESHOLD = 0.9;
const MAX_VIDEO_DURATION_SECONDS = 24 * 60 * 60;

type ProgressBody = {
  durationSeconds?: unknown;
  positionSeconds?: unknown;
};

async function getProgressContext(slug: string) {
  const authResult = await getAuthenticatedServerSupabaseOrError({
    unauthorizedMessage: "You must be logged in to save video progress.",
  });

  if ("response" in authResult) {
    return authResult;
  }

  const lesson = getLessonBySlug(slug);

  if (!lesson) {
    return { response: jsonError("Lesson not found.", 404) };
  }

  if (lesson.requiresPro && !(await hasProAccessForCurrentUser())) {
    return {
      response: jsonError("Upgrade to Pro to track this lesson video.", 403),
    };
  }

  return { ...authResult, lesson };
}

function serializeProgress(
  row: {
    completed_at: string | null;
    duration_seconds: number;
    position_seconds: number;
    updated_at: string;
  } | null,
) {
  return {
    completed: Boolean(row?.completed_at),
    completedAt: row?.completed_at ?? null,
    durationSeconds: row?.duration_seconds ?? 0,
    positionSeconds: row?.position_seconds ?? 0,
    updatedAt: row?.updated_at ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const context = await getProgressContext(slug);

  if ("response" in context) {
    return context.response;
  }

  const { data, error } = await context.supabase
    .from("video_progress")
    .select("position_seconds, duration_seconds, completed_at, updated_at")
    .eq("user_id", context.user.id)
    .eq("lesson_slug", context.lesson.slug)
    .maybeSingle();

  if (error) {
    return jsonError("Unable to load video progress right now.", 503);
  }

  return NextResponse.json(serializeProgress(data));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const context = await getProgressContext(slug);

  if ("response" in context) {
    return context.response;
  }

  const bodyResult = await parseJsonBody<ProgressBody>(
    request,
    "Send valid video progress.",
  );

  if ("response" in bodyResult) {
    return bodyResult.response;
  }

  const positionSeconds = bodyResult.data.positionSeconds;
  const durationSeconds = bodyResult.data.durationSeconds;

  if (
    typeof positionSeconds !== "number" ||
    !Number.isFinite(positionSeconds) ||
    positionSeconds < 0 ||
    typeof durationSeconds !== "number" ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_VIDEO_DURATION_SECONDS
  ) {
    return jsonError("Send valid video position and duration values.", 400);
  }

  const normalizedPosition = Math.min(positionSeconds, durationSeconds);
  const { data: existing, error: readError } = await context.supabase
    .from("video_progress")
    .select("completed_at")
    .eq("user_id", context.user.id)
    .eq("lesson_slug", context.lesson.slug)
    .maybeSingle();

  if (readError) {
    return jsonError("Unable to save video progress right now.", 503);
  }

  const completedAt =
    existing?.completed_at ??
    (normalizedPosition / durationSeconds >= COMPLETION_THRESHOLD
      ? new Date().toISOString()
      : null);
  const updatedAt = new Date().toISOString();
  const { data, error } = await context.supabase
    .from("video_progress")
    .upsert(
      {
        user_id: context.user.id,
        lesson_slug: context.lesson.slug,
        position_seconds: normalizedPosition,
        duration_seconds: durationSeconds,
        completed_at: completedAt,
        updated_at: updatedAt,
      },
      { onConflict: "user_id,lesson_slug" },
    )
    .select("position_seconds, duration_seconds, completed_at, updated_at")
    .single();

  if (error || !data) {
    return jsonError("Unable to save video progress right now.", 503);
  }

  return NextResponse.json(serializeProgress(data));
}
