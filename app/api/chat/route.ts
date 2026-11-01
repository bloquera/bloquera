import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  getServerSupabaseOrError,
  jsonError,
  parseJsonBody,
} from "@/lib/api-route";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getBillingSnapshotForCurrentUser,
  getTutorRequestLimit,
  hasProAccess,
} from "@/lib/billing";
import { createTutorReply, inferTutorTopic } from "@/lib/openai";
import {
  consumeDistributedRateLimit,
  getFixedWindow,
  getRequestClientIdentifier,
  getUtcDayWindow,
} from "@/server/security/distributed-rate-limit";

const MAX_MESSAGE_LENGTH = 500;
const TUTOR_PROMPT_PREVIEW_MAX = 160;
const GUEST_TUTOR_REQUEST_LIMIT = 3;
const GUEST_TUTOR_COOKIE = "bloquera_guest_tutor_id";
const GUEST_TUTOR_USAGE_COOKIE = "bloquera_guest_tutor_usage";
const GUEST_TUTOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const GUEST_LIMIT_ERROR =
  "You have used the guest AI demo for now. Log in to keep chatting.";
const TUTOR_UNAVAILABLE_ERROR =
  "The tutor is temporarily unavailable. Please try again shortly.";

function buildTutorUsage(
  limit: number,
  limitResult: { remaining: number; resetAt: number },
) {
  return {
    limit,
    remaining: limitResult.remaining,
    resetAt: limitResult.resetAt,
  };
}

function getNextDayResetAt(now = new Date()) {
  const resetAt = new Date(now);
  resetAt.setUTCHours(24, 0, 0, 0);
  return resetAt.getTime();
}

function buildRateLimitResponse(resetAt: number, error: string) {
  return NextResponse.json(
    { error },
    {
      status: 429,
      headers: {
        "Retry-After": String(
          Math.max(
            1,
            Math.ceil((resetAt - Date.now()) / 1000),
          ),
        ),
      },
    },
  );
}

function buildGuestCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    maxAge: maxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
  };
}

type TutorUsageCounter = {
  count: number | null;
};

type TutorUsageSupabase = {
  from: (table: "learning_activity") => {
    select: (
      columns: "id",
      options: { count: "exact"; head: true },
    ) => {
      eq: (column: "user_id", value: string) => {
        eq: (column: "activity_type", value: "tutor_prompt") => {
          gte: (column: "created_at", value: string) => {
            lt: (
              column: "created_at",
              value: string,
            ) => Promise<TutorUsageCounter>;
          };
        };
      };
    };
  };
};

async function getSignedInTutorUsageToday({
  supabase,
  userId,
  limit,
}: {
  supabase: unknown;
  userId: string;
  limit: number;
}) {
  const usageSupabase = supabase as TutorUsageSupabase;
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);
  const nextResetAt = getNextDayResetAt(now);

  const result = await usageSupabase
    .from("learning_activity")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("activity_type", "tutor_prompt")
    .gte("created_at", dayStart.toISOString())
    .lt("created_at", new Date(nextResetAt).toISOString());

  const used = result.count ?? 0;

  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    resetAt: nextResetAt,
    used,
  };
}

function readGuestUsageCount(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as { count?: unknown };

    if (
      typeof parsed.count !== "number" ||
      !Number.isFinite(parsed.count)
    ) {
      return null;
    }

    return parsed.count;
  } catch {
    return null;
  }
}

function getGuestUsageResult(existingValue: string | null) {
  const currentCount = readGuestUsageCount(existingValue) ?? 0;
  const resetAt = Date.now() + GUEST_TUTOR_COOKIE_MAX_AGE * 1000;

  if (currentCount >= GUEST_TUTOR_REQUEST_LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      shouldPersist: false,
      value: existingValue ?? "",
    };
  }

  const nextCount = currentCount + 1;

  return {
    allowed: true,
    remaining: GUEST_TUTOR_REQUEST_LIMIT - nextCount,
    resetAt,
    shouldPersist: true,
    value: JSON.stringify({
      count: nextCount,
    }),
  };
}

export async function POST(request: Request) {
  try {
    const supabaseResult = await getServerSupabaseOrError({
      unavailableMessage: "Unable to reach tutor services right now.",
    });

    if ("response" in supabaseResult) {
      return supabaseResult.response;
    }

    const bodyResult = await parseJsonBody<{
      message?: unknown;
      source?: unknown;
    }>(request, "Please enter a valid tutor question.");

    if ("response" in bodyResult) {
      return bodyResult.response;
    }

    let user = null;

    try {
      const authResult = await supabaseResult.supabase.auth.getUser();
      user = authResult.data.user;
    } catch {
      return jsonError("Unable to verify your account right now.", 503);
    }

    const message =
      typeof bodyResult.data.message === "string" ? bodyResult.data.message.trim() : "";
    const source = bodyResult.data.source === "home" ? "home" : "lesson";

    if (!message) {
      return jsonError("Please enter a question before submitting.", 400);
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonError("Please keep tutor questions under 500 characters.", 400);
    }

    if (!user) {
      if (source !== "home") {
        return jsonError("Log in to use the AI tutor.", 401);
      }

      const cookieStore = await cookies();
      const existingGuestId = cookieStore.get(GUEST_TUTOR_COOKIE)?.value ?? null;
      const existingGuestUsage =
        cookieStore.get(GUEST_TUTOR_USAGE_COOKIE)?.value ?? null;
      const guestId = existingGuestId ?? crypto.randomUUID();
      let distributedLimitResult;

      try {
        distributedLimitResult = await consumeDistributedRateLimit({
          limit: GUEST_TUTOR_REQUEST_LIMIT,
          scope: "tutor:guest",
          subject: getRequestClientIdentifier(request, guestId),
          window: getFixedWindow(GUEST_TUTOR_COOKIE_MAX_AGE * 1000),
        });
      } catch {
        return jsonError("Unable to load tutor usage right now.", 503);
      }

      const fallbackLimitResult = distributedLimitResult
        ? null
        : getGuestUsageResult(existingGuestUsage);
      const limitResult = distributedLimitResult ?? fallbackLimitResult!;

      if (!limitResult.allowed) {
        const response = NextResponse.json(
          {
            error: GUEST_LIMIT_ERROR,
            usage: {
              ...buildTutorUsage(GUEST_TUTOR_REQUEST_LIMIT, limitResult),
              plan: "free" as const,
            },
          },
          { status: 429 },
        );

        if (!existingGuestId) {
          response.cookies.set(
            GUEST_TUTOR_COOKIE,
            guestId,
            buildGuestCookieOptions(GUEST_TUTOR_COOKIE_MAX_AGE),
          );
        }

        return response;
      }

      let reply;

      try {
        reply = await createTutorReply(message);
      } catch {
        return jsonError(TUTOR_UNAVAILABLE_ERROR, 503);
      }

      const topic = inferTutorTopic(message);
      const response = NextResponse.json({
        reply,
        recordedAt: new Date().toISOString(),
        topic,
        usage: {
          ...buildTutorUsage(GUEST_TUTOR_REQUEST_LIMIT, limitResult),
          plan: "free" as const,
        },
      });

      if (!existingGuestId) {
        response.cookies.set(
          GUEST_TUTOR_COOKIE,
          guestId,
          buildGuestCookieOptions(GUEST_TUTOR_COOKIE_MAX_AGE),
        );
      }

      if (fallbackLimitResult?.shouldPersist) {
        response.cookies.set(
          GUEST_TUTOR_USAGE_COOKIE,
          fallbackLimitResult.value,
          buildGuestCookieOptions(GUEST_TUTOR_COOKIE_MAX_AGE),
        );
      }

      return response;
    }

    let billingSnapshot;

    try {
      billingSnapshot = await getBillingSnapshotForCurrentUser();
    } catch {
      return jsonError("Unable to load tutor access right now.", 503);
    }

    const tutorRequestLimit = getTutorRequestLimit(billingSnapshot);

    const activityClient = createSupabaseAdminClient() ?? supabaseResult.supabase;
    let limitResult;
    let usedDistributedLimit = false;

    try {
      const distributedLimitResult = await consumeDistributedRateLimit({
        limit: tutorRequestLimit,
        scope: "tutor:user",
        subject: `user:${user.id}`,
        window: getUtcDayWindow(),
      });

      if (distributedLimitResult) {
        limitResult = distributedLimitResult;
        usedDistributedLimit = true;
      } else {
        limitResult = await getSignedInTutorUsageToday({
          limit: tutorRequestLimit,
          supabase: activityClient,
          userId: user.id,
        });
      }
    } catch {
      return jsonError("Unable to load tutor usage right now.", 503);
    }

    if (!limitResult.allowed) {
      return buildRateLimitResponse(
        limitResult.resetAt,
        "You have reached your tutor limit for today. Please come back tomorrow.",
      );
    }

    let reply;

    try {
      reply = await createTutorReply(message);
    } catch {
      return jsonError(TUTOR_UNAVAILABLE_ERROR, 503);
    }

    const topic = inferTutorTopic(message);
    const responsePreview = reply.slice(0, TUTOR_PROMPT_PREVIEW_MAX);
    const recordedAt = new Date().toISOString();

    try {
      const insertResult = await activityClient.from("learning_activity").insert({
        activity_context: topic,
        activity_type: "tutor_prompt",
        created_at: recordedAt,
        lesson_slug: "ai-tutor",
        lesson_title: message,
        response_preview: responsePreview,
        user_id: user.id,
      });

      if (insertResult?.error) {
        return jsonError("Unable to save tutor activity right now.", 503);
      }
    } catch {
      return jsonError("Unable to save tutor activity right now.", 503);
    }

    return NextResponse.json({
      reply,
      recordedAt,
      topic,
      usage: {
        ...buildTutorUsage(tutorRequestLimit, {
          remaining: usedDistributedLimit
            ? limitResult.remaining
            : Math.max(0, limitResult.remaining - 1),
          resetAt: limitResult.resetAt,
        }),
        plan: hasProAccess(billingSnapshot) ? "pro" : "free",
      },
    });
  } catch {
    return jsonError("Unable to process your request right now.", 500);
  }
}
