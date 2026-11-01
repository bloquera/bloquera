import "server-only";

import { createHash, createHmac } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitWindow = {
  end: Date;
  start: Date;
};

function getSubjectHash(subject: string) {
  const secret = process.env.RATE_LIMIT_SECRET?.trim();

  return secret
    ? createHmac("sha256", secret).update(subject).digest("hex")
    : createHash("sha256").update(subject).digest("hex");
}

export function getUtcDayWindow(now = new Date()): RateLimitWindow {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { end, start };
}

export function getFixedWindow(
  windowMs: number,
  now = new Date(),
): RateLimitWindow {
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;

  return {
    end: new Date(startMs + windowMs),
    start: new Date(startMs),
  };
}

export function getRequestClientIdentifier(request: Request, fallback: string) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const clientAddress =
    request.headers.get("x-real-ip")?.trim() || forwardedFor || fallback;

  return `client:${clientAddress}`;
}

export async function consumeDistributedRateLimit({
  limit,
  scope,
  subject,
  window,
}: {
  limit: number;
  scope: string;
  subject: string;
  window: RateLimitWindow;
}): Promise<DistributedRateLimitResult | null> {
  const admin = createSupabaseAdminClient();

  if (!admin) {
    return null;
  }

  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    target_limit: limit,
    target_scope: scope,
    target_subject_hash: getSubjectHash(subject),
    target_window_end: window.end.toISOString(),
    target_window_start: window.start.toISOString(),
  });

  if (error) {
    throw error;
  }

  const result = data?.[0];

  if (!result) {
    throw new Error("The rate-limit service returned no result.");
  }

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: new Date(result.reset_at).getTime(),
  };
}
