"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { buildAuthCallbackUrl, sanitizeNextPath } from "@/lib/auth-redirects";
import {
  getAuthErrorFromSearchParam,
  getAuthMessageFromSearchParam,
  getFriendlyAuthErrorMessage,
} from "@/lib/auth-feedback";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/config";

type AuthFormProps = {
  initialError?: string | null;
  initialMessage?: string | null;
  mode: "login" | "register";
  nextPath: string;
};

async function syncAuthenticatedProfile() {
  try {
    await fetch("/api/profile/sync", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Session creation is more important than best-effort profile sync.
  }
}

export function AuthForm({
  initialError,
  initialMessage,
  mode,
  nextPath,
}: AuthFormProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const isMounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const safeNextPath = sanitizeNextPath(nextPath);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    getAuthErrorFromSearchParam(initialError),
  );
  const [message, setMessage] = useState<string | null>(
    getAuthMessageFromSearchParam(initialMessage, nextPath),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const [showResendConfirmation, setShowResendConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [resendCooldown]);

  async function handleGoogleAuth() {
    if (!supabase) {
      setError(
        "Supabase is not configured yet. Add the public URL and anon key to your environment first.",
      );
      return;
    }

    setError(null);
    setMessage(null);
    setShowResendConfirmation(false);
    setIsSubmitting(true);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthCallbackUrl(window.location.origin, safeNextPath),
      },
    });

    if (oauthError) {
      setError(getFriendlyAuthErrorMessage(oauthError.message));
      setIsSubmitting(false);
      return;
    }

    setMessage("Redirecting to Google...");
    setIsSubmitting(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setError(
        "Supabase is not configured yet. Add the public URL and anon key to your environment first.",
      );
      return;
    }

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    if (mode === "login") {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(getFriendlyAuthErrorMessage(loginError.message));
        setShowResendConfirmation(/confirm/i.test(loginError.message));
        setIsSubmitting(false);
        return;
      }

      await syncAuthenticatedProfile();
      window.location.assign(safeNextPath);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, safeNextPath),
      },
    });

    if (signUpError) {
      setError(getFriendlyAuthErrorMessage(signUpError.message));
      setIsSubmitting(false);
      return;
    }

    if (data.session) {
      await syncAuthenticatedProfile();
      window.location.assign(safeNextPath);
      return;
    }

    setMessage(
      "Account created. Check your email to confirm your address before logging in.",
    );
    setShowResendConfirmation(true);
    setIsSubmitting(false);
  }

  async function handleResendConfirmation() {
    if (!supabase) {
      setError(
        "Supabase is not configured yet. Add the public URL and anon key to your environment first.",
      );
      return;
    }

    if (!email) {
      setError("Enter your email first so we know where to resend the confirmation.");
      return;
    }

    if (resendCooldown > 0) {
      return;
    }

    setError(null);
    setMessage(null);
    setIsResendingConfirmation(true);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: buildAuthCallbackUrl(window.location.origin, safeNextPath),
      },
    });

    if (resendError) {
      setError(getFriendlyAuthErrorMessage(resendError.message));
      setIsResendingConfirmation(false);
      return;
    }

    setMessage("Confirmation email sent.");
    setShowResendConfirmation(true);
    setResendCooldown(60);
    setIsResendingConfirmation(false);
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 text-white">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
        {mode === "login" ? "Welcome back" : "Create account"}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        {mode === "login" ? "Log in to continue" : "Start your learning account"}
      </h1>
      <p className="mt-4 text-sm leading-7 text-zinc-400">
        {mode === "login"
          ? "Access your curriculum progress, quiz history, and tutor sessions."
          : "Create an account so lesson progress and future subscriptions belong to you."}
      </p>

      {!hasSupabaseEnv() ? (
        <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-100">
          Supabase is not configured yet. Add the values from `.env.example`
          before using these forms.
        </div>
      ) : null}

      <div className="mt-8">
        <Button
          className="w-full !border-[#dadce0] !bg-white !text-[#1a73e8] shadow-none hover:!bg-[#f8f9fa] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          disabled={isSubmitting}
          onClick={handleGoogleAuth}
          type="button"
          variant="secondary"
        >
          <svg
            aria-hidden="true"
            className="mr-2 h-4 w-4"
            viewBox="0 0 24 24"
          >
            <path
              d="M21.805 12.23c0-.79-.07-1.55-.2-2.28H12v4.32h5.49a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.055-4.4 3.055-7.68Z"
              fill="#4285F4"
            />
            <path
              d="M12 22c2.76 0 5.07-.91 6.76-2.47l-3.3-2.56c-.92.62-2.1.99-3.46.99-2.66 0-4.91-1.8-5.72-4.22H2.87v2.64A10 10 0 0 0 12 22Z"
              fill="#34A853"
            />
            <path
              d="M6.28 13.74A5.98 5.98 0 0 1 5.96 12c0-.6.11-1.18.32-1.74V7.62H2.87A10 10 0 0 0 2 12c0 1.61.39 3.13 1.08 4.38l3.2-2.64Z"
              fill="#FBBC05"
            />
            <path
              d="M12 6.04c1.5 0 2.84.51 3.9 1.5l2.92-2.92C17.06 2.98 14.75 2 12 2a10 10 0 0 0-9.13 5.62l3.41 2.64C7.09 7.84 9.34 6.04 12 6.04Z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>
      </div>

      <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
        <span className="h-px flex-1 bg-white/10" />
        <span>or use email</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {isMounted ? (
          <>
            <label className="block">
              <span className="text-sm text-zinc-400">Email</span>
              <input
                autoComplete="email"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500/40"
                data-1p-ignore="true"
                data-lpignore="true"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="block">
              <span className="text-sm text-zinc-400">Password</span>
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500/40"
                data-1p-ignore="true"
                data-lpignore="true"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
          </>
        ) : (
          <div className="space-y-4" aria-hidden="true">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-500">
              Loading form fields...
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-500">
              Loading form fields...
            </div>
          </div>
        )}

        {mode === "login" ? (
          <div className="flex justify-end">
            <Link
              className="text-sm font-medium text-zinc-400 transition hover:text-white"
              href="/auth/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </p>
        ) : null}

        <Button
          className="mt-2 w-full bg-orange-500 !text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting
            ? mode === "login"
              ? "Logging in..."
              : "Creating account..."
            : mode === "login"
              ? "Log in"
              : "Create account"}
        </Button>

        {showResendConfirmation ? (
          <Button
            className="w-full border border-white/10 bg-white text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            disabled={isResendingConfirmation || resendCooldown > 0}
            onClick={handleResendConfirmation}
            type="button"
            variant="secondary"
          >
            {isResendingConfirmation
              ? "Sending confirmation..."
              : resendCooldown > 0
                ? `Try again in ${resendCooldown}s`
                : "Resend confirmation email"}
          </Button>
        ) : null}
      </form>

      <p className="mt-6 text-sm text-zinc-500">
        {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
        <Link
          className="font-medium text-orange-300 transition hover:text-orange-200"
          href={mode === "login" ? "/auth/register" : "/auth/login"}
        >
          {mode === "login" ? "Create one" : "Log in"}
        </Link>
      </p>
    </div>
  );
}
