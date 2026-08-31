import "server-only";

import type { User } from "@supabase/supabase-js";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWelcomeEmailEnv } from "@/lib/supabase/config";

type WelcomeEmailResult =
  | "already-claimed"
  | "failed"
  | "not-configured"
  | "sent";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFirstName(user: User) {
  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name;

  if (typeof displayName !== "string" || !displayName.trim()) {
    return null;
  }

  return displayName.trim().split(/\s+/)[0] ?? null;
}

function buildWelcomeEmail(user: User, siteUrl: string) {
  const firstName = getFirstName(user);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const safeGreeting = escapeHtml(greeting);
  const learnUrl = `${siteUrl}/learn`;

  return {
    html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#09090b;color:#e4e4e7;font-family:Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:48px 24px">
      <p style="margin:0 0 28px;color:#f59e0b;font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Bloquera</p>
      <h1 style="margin:0 0 20px;color:#ffffff;font-size:32px;line-height:1.2">Welcome to Bloquera</h1>
      <p style="margin:0 0 16px;font-size:17px;line-height:1.7">${safeGreeting}</p>
      <p style="margin:0 0 28px;font-size:17px;line-height:1.7">Your learning account is ready. Start with the Bitcoin foundations course and build your understanding one clear lesson at a time.</p>
      <a href="${learnUrl}" style="display:inline-block;border-radius:999px;background:#f59e0b;color:#18181b;padding:14px 24px;font-weight:700;text-decoration:none">Start learning</a>
      <p style="margin:36px 0 0;color:#a1a1aa;font-size:14px;line-height:1.6">You received this account email because you signed up for Bloquera.</p>
    </div>
  </body>
</html>`,
    subject: "Welcome to Bloquera",
    text: `${greeting}\n\nYour learning account is ready. Start with the Bitcoin foundations course and build your understanding one clear lesson at a time.\n\nStart learning: ${learnUrl}\n\nYou received this account email because you signed up for Bloquera.`,
  };
}

export async function sendWelcomeEmailForUser(
  user: User,
): Promise<WelcomeEmailResult> {
  const env = getWelcomeEmailEnv();
  const admin = createSupabaseAdminClient();

  if (!env || !admin || !user.email) {
    return "not-configured";
  }

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_welcome_email",
    { target_user_id: user.id },
  );

  if (claimError || !claimed) {
    return "already-claimed";
  }

  const email = buildWelcomeEmail(user, env.siteUrl);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: env.fromEmail,
        html: email.html,
        reply_to: env.replyToEmail ?? undefined,
        subject: email.subject,
        text: email.text,
        to: [user.email],
      }),
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `welcome-${user.id}`,
      },
      method: "POST",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error("Resend rejected the welcome email.");
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        welcome_email_claimed_at: null,
        welcome_email_sent_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return updateError ? "failed" : "sent";
  } catch {
    await admin
      .from("profiles")
      .update({ welcome_email_claimed_at: null })
      .eq("id", user.id)
      .is("welcome_email_sent_at", null);

    return "failed";
  }
}
