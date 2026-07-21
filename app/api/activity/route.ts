import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getServerSupabaseOrError,
  parseJsonBody,
} from "@/lib/api-route";
import {
  EMPTY_LEARNING_HISTORY,
  mergeLearningHistory,
  sanitizeLearningHistory,
} from "@/lib/learning-history";
import type {
  ConversionEventRecord,
  LearningHistory,
  QuizAttemptRecord,
  TutorPromptRecord,
} from "@/types/activity";

const ACTIVITY_COOKIE = "satoshilearn-activity";
const CONVERSION_EVENT_TYPES = [
  "locked_view",
  "upgrade_click",
  "checkout_start",
  "checkout_complete",
] as const;

type ActivityInsertBody =
  | {
      type: "lesson_completion";
      lessonSlug?: string;
      lessonTitle?: string;
      completedAt?: string;
    }
  | {
      type: "quiz_attempt";
      lessonSlug?: string;
      lessonTitle?: string;
      correctCount?: number;
      totalQuestions?: number;
      passed?: boolean;
      attemptedAt?: string;
    }
  | {
      type: "tutor_prompt";
      lessonSlug?: string;
      lessonTitle?: string;
      repliedAt?: string;
      responsePreview?: string;
      topic?: string;
    }
  | {
      type: "conversion_event";
      eventType?: ConversionEventRecord["eventType"];
      occurredAt?: string;
      plan?: ConversionEventRecord["plan"];
      source?: string;
      targetSlug?: string;
      targetTitle?: string;
    };

type ActivityRecord =
  | {
      type: "lesson_completion";
      lessonSlug: string;
      lessonTitle: string;
      completedAt: string;
    }
  | {
      type: "quiz_attempt";
      lessonSlug: string;
      lessonTitle: string;
      correctCount: number;
      totalQuestions: number;
      passed: boolean;
      attemptedAt: string;
    }
  | {
      type: "tutor_prompt";
      lessonSlug: string;
      lessonTitle: string;
      repliedAt: string;
      responsePreview: string | null;
      topic: string | null;
    }
  | {
      type: "conversion_event";
      eventType: ConversionEventRecord["eventType"];
      occurredAt: string;
      plan: ConversionEventRecord["plan"];
      source: string;
      targetSlug: string;
      targetTitle: string;
    };

type LearningActivityRow = {
  activity_context: string | null;
  activity_type: string;
  correct_count: number | null;
  created_at: string;
  lesson_slug: string;
  lesson_title: string;
  passed: boolean | null;
  response_preview: string | null;
  total_questions: number | null;
};

type LearningActivityInsertPayload = LearningActivityRow & {
  user_id: string;
};

type ActivityWriteResult =
  | {
      persisted: true;
      response: NextResponse;
    }
  | {
      persisted: false;
      response: NextResponse;
    }
  | null;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function normalizeTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value))
    ? value
    : new Date().toISOString();
}

function isConversionEventType(
  value: unknown,
): value is ConversionEventRecord["eventType"] {
  return CONVERSION_EVENT_TYPES.includes(
    value as (typeof CONVERSION_EVENT_TYPES)[number],
  );
}

function normalizePlan(value: unknown): ConversionEventRecord["plan"] {
  return value === "pro_monthly" || value === "pro_yearly" ? value : null;
}

function parseConversionContext(raw: string | null) {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as {
      eventType?: ConversionEventRecord["eventType"];
      plan?: ConversionEventRecord["plan"];
      source?: string;
    };
  } catch {
    return null;
  }
}

function mapRowsToLearningHistory(rows: LearningActivityRow[]) {
  return sanitizeLearningHistory({
    lessonCompletions: rows
      .filter((row) => row.activity_type === "lesson_completion")
      .map((row) => ({
        lessonSlug: row.lesson_slug,
        lessonTitle: row.lesson_title,
        completedAt: row.created_at,
      })),
    quizAttempts: rows
      .filter((row) => row.activity_type === "quiz_attempt")
      .map((row) => ({
        lessonSlug: row.lesson_slug,
        lessonTitle: row.lesson_title,
        correctCount: row.correct_count ?? 0,
        totalQuestions: row.total_questions ?? 0,
        passed: Boolean(row.passed),
        attemptedAt: row.created_at,
      })),
    tutorPrompts: rows
      .filter((row) => row.activity_type === "tutor_prompt")
      .map((row) => ({
        prompt: row.lesson_title,
        repliedAt: row.created_at,
        responsePreview: row.response_preview ?? null,
        topic: row.activity_context ?? null,
      })),
    conversionEvents: rows
      .filter((row) => row.activity_type === "conversion_event")
      .map((row) => {
        const context = parseConversionContext(row.activity_context);

        return {
          eventType: context?.eventType ?? "upgrade_click",
          occurredAt: row.created_at,
          plan: normalizePlan(context?.plan),
          source: context?.source ?? "unknown",
          targetSlug: row.lesson_slug,
          targetTitle: row.lesson_title,
        };
      }),
  });
}

function sanitizeActivityInsert(body: ActivityInsertBody): ActivityRecord | null {
  if (!body || typeof body !== "object" || typeof body.type !== "string") {
    return null;
  }

  if (
    body.type === "lesson_completion" &&
    isNonEmptyString(body.lessonSlug) &&
    isNonEmptyString(body.lessonTitle)
  ) {
    return {
      type: "lesson_completion",
      lessonSlug: body.lessonSlug,
      lessonTitle: body.lessonTitle,
      completedAt: normalizeTimestamp(body.completedAt),
    };
  }

  if (
    body.type === "quiz_attempt" &&
    isNonEmptyString(body.lessonSlug) &&
    isNonEmptyString(body.lessonTitle) &&
    typeof body.correctCount === "number" &&
    typeof body.totalQuestions === "number" &&
    typeof body.passed === "boolean"
  ) {
    return {
      type: "quiz_attempt",
      lessonSlug: body.lessonSlug,
      lessonTitle: body.lessonTitle,
      correctCount: body.correctCount,
      totalQuestions: body.totalQuestions,
      passed: body.passed,
      attemptedAt: normalizeTimestamp(body.attemptedAt),
    };
  }

  if (
    body.type === "tutor_prompt" &&
    isNonEmptyString(body.lessonSlug) &&
    isNonEmptyString(body.lessonTitle)
  ) {
    return {
      type: "tutor_prompt",
      lessonSlug: body.lessonSlug,
      lessonTitle: body.lessonTitle,
      repliedAt: normalizeTimestamp(body.repliedAt),
      responsePreview: isNonEmptyString(body.responsePreview)
        ? body.responsePreview
        : null,
      topic: isNonEmptyString(body.topic) ? body.topic : null,
    };
  }

  if (
    body.type === "conversion_event" &&
    isConversionEventType(body.eventType) &&
    isNonEmptyString(body.source) &&
    isNonEmptyString(body.targetSlug) &&
    isNonEmptyString(body.targetTitle)
  ) {
    return {
      type: "conversion_event",
      eventType: body.eventType,
      occurredAt: normalizeTimestamp(body.occurredAt),
      plan: normalizePlan(body.plan),
      source: body.source,
      targetSlug: body.targetSlug,
      targetTitle: body.targetTitle,
    };
  }

  return null;
}

function invalidActivityResponse() {
  return NextResponse.json({ error: "Invalid activity payload." }, { status: 400 });
}

function toCookieHistoryPatch(activity: ActivityRecord): LearningHistory {
  if (activity.type === "lesson_completion") {
    return {
      conversionEvents: [],
      lessonCompletions: [
        {
          lessonSlug: activity.lessonSlug,
          lessonTitle: activity.lessonTitle,
          completedAt: activity.completedAt,
        },
      ],
      quizAttempts: [],
      tutorPrompts: [],
    };
  }

  if (activity.type === "quiz_attempt") {
    return {
      conversionEvents: [],
      lessonCompletions: [],
      quizAttempts: [
        {
          lessonSlug: activity.lessonSlug,
          lessonTitle: activity.lessonTitle,
          correctCount: activity.correctCount,
          totalQuestions: activity.totalQuestions,
          passed: activity.passed,
          attemptedAt: activity.attemptedAt,
        } satisfies QuizAttemptRecord,
      ],
      tutorPrompts: [],
    };
  }

  if (activity.type === "tutor_prompt") {
    return {
      conversionEvents: [],
      lessonCompletions: [],
      quizAttempts: [],
      tutorPrompts: [
        {
          prompt: activity.lessonTitle,
          repliedAt: activity.repliedAt,
          responsePreview: activity.responsePreview,
          topic: activity.topic,
        } satisfies TutorPromptRecord,
      ],
    };
  }

  return {
    conversionEvents: [
      {
        eventType: activity.eventType,
        occurredAt: activity.occurredAt,
        plan: activity.plan,
        source: activity.source,
        targetSlug: activity.targetSlug,
        targetTitle: activity.targetTitle,
      } satisfies ConversionEventRecord,
    ],
    lessonCompletions: [],
    quizAttempts: [],
    tutorPrompts: [],
  };
}

function toSupabaseInsertPayload(
  activity: ActivityRecord,
  userId: string,
): LearningActivityInsertPayload {
  if (activity.type === "lesson_completion") {
    return {
      activity_context: null,
      activity_type: "lesson_completion",
      correct_count: null,
      created_at: activity.completedAt,
      lesson_slug: activity.lessonSlug,
      lesson_title: activity.lessonTitle,
      passed: null,
      response_preview: null,
      total_questions: null,
      user_id: userId,
    };
  }

  if (activity.type === "quiz_attempt") {
    return {
      activity_context: null,
      activity_type: "quiz_attempt",
      correct_count: activity.correctCount,
      created_at: activity.attemptedAt,
      lesson_slug: activity.lessonSlug,
      lesson_title: activity.lessonTitle,
      passed: activity.passed,
      response_preview: null,
      total_questions: activity.totalQuestions,
      user_id: userId,
    };
  }

  if (activity.type === "tutor_prompt") {
    return {
      activity_context: activity.topic,
      activity_type: "tutor_prompt",
      created_at: activity.repliedAt,
      lesson_slug: activity.lessonSlug,
      lesson_title: activity.lessonTitle,
      correct_count: null,
      passed: null,
      response_preview: activity.responsePreview,
      total_questions: null,
      user_id: userId,
    };
  }

  return {
    activity_context: JSON.stringify({
      eventType: activity.eventType,
      plan: activity.plan,
      source: activity.source,
    }),
    activity_type: "conversion_event",
    correct_count: null,
    created_at: activity.occurredAt,
    lesson_slug: activity.targetSlug,
    lesson_title: activity.targetTitle,
    passed: null,
    response_preview: null,
    total_questions: null,
    user_id: userId,
  };
}

async function readCookieHistory() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACTIVITY_COOKIE)?.value;

  if (!raw) {
    return EMPTY_LEARNING_HISTORY;
  }

  try {
    return sanitizeLearningHistory(JSON.parse(raw));
  } catch {
    return EMPTY_LEARNING_HISTORY;
  }
}

async function writeCookieHistory(history: LearningHistory) {
  const normalized = sanitizeLearningHistory(history);
  const response = NextResponse.json(normalized);

  response.cookies.set(ACTIVITY_COOKIE, JSON.stringify(normalized), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}

async function readSupabaseHistory() {
  const supabaseResult = await getServerSupabaseOrError();

  if ("response" in supabaseResult) {
    return null;
  }

  const { supabase } = supabaseResult;

  let user: { id: string } | null = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return null;
  }

  if (!user) {
    return null;
  }

  let data: LearningActivityRow[] | null = null;
  let error: { message?: string } | null = null;

  try {
    const result = await supabase
      .from("learning_activity")
      .select(
        "activity_type, lesson_slug, lesson_title, correct_count, total_questions, passed, created_at, activity_context, response_preview",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(24);

    data = (result.data ?? null) as LearningActivityRow[] | null;
    error = result.error;
  } catch {
    return null;
  }

  if (error) {
    return null;
  }

  return {
    history: mapRowsToLearningHistory((data ?? []) as LearningActivityRow[]),
    persisted: true as const,
  };
}

async function getPersistedHistoryResponse() {
  const history = await readSupabaseHistory();

  if (!history) {
    return null;
  }

  return {
    persisted: true as const,
    response: NextResponse.json(history.history),
  };
}

async function writeSupabaseHistory(body: ActivityInsertBody): Promise<ActivityWriteResult> {
  const supabaseResult = await getServerSupabaseOrError();

  if ("response" in supabaseResult) {
    return null;
  }

  const { supabase } = supabaseResult;

  let user: { id: string } | null = null;

  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch {
    return null;
  }

  if (!user) {
    return null;
  }

  const activity = sanitizeActivityInsert(body);

  if (!activity) {
    return {
      persisted: false,
      response: invalidActivityResponse(),
    };
  }

  if (activity.type === "tutor_prompt") {
    return getPersistedHistoryResponse();
  }

  if (activity.type === "lesson_completion") {
    let existingCompletion: { id: string } | null = null;
    let existingError: { message?: string } | null = null;

    try {
      const result = await supabase
        .from("learning_activity")
        .select("id")
        .eq("user_id", user.id)
        .eq("activity_type", "lesson_completion")
        .eq("lesson_slug", activity.lessonSlug)
        .maybeSingle();

      existingCompletion = result.data;
      existingError = result.error;
    } catch {
      return null;
    }

    if (existingError) {
      return null;
    }

    if (existingCompletion) {
      return getPersistedHistoryResponse();
    }
  }

  let error: { message?: string } | null = null;

  try {
    const result = await supabase
      .from("learning_activity")
      .insert(toSupabaseInsertPayload(activity, user.id));

    error = result.error;
  } catch {
    return null;
  }

  if (error) {
    return null;
  }

  return getPersistedHistoryResponse();
}

export async function GET() {
  const supabaseHistory = await readSupabaseHistory();

  if (supabaseHistory) {
    return NextResponse.json(supabaseHistory.history);
  }

  return NextResponse.json(await readCookieHistory());
}

export async function POST(request: Request) {
  const bodyResult = await parseJsonBody<ActivityInsertBody>(
    request,
    "Invalid activity payload.",
  );

  if ("response" in bodyResult) {
    return bodyResult.response;
  }

  const body = bodyResult.data;

  const supabaseWrite = await writeSupabaseHistory(body);

  if (supabaseWrite) {
    return supabaseWrite.response;
  }

  const current = await readCookieHistory();
  const activity = sanitizeActivityInsert(body);

  if (!activity) {
    return invalidActivityResponse();
  }

  return writeCookieHistory(
    mergeLearningHistory(current, toCookieHistoryPatch(activity)),
  );
}
