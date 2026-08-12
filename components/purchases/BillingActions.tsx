"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLearningHistory } from "@/hooks/useLearningHistory";
import {
  getApiErrorMessage,
  getNetworkErrorMessage,
} from "@/lib/client-api";

type PlanKey = "pro_monthly" | "pro_yearly";

type BillingActionsProps = {
  canCheckout: boolean;
  canOpenPortal: boolean;
  checkoutLabel: string;
};

export function BillingActions({
  canCheckout,
  canOpenPortal,
  checkoutLabel,
}: BillingActionsProps) {
  const { recordConversionEvent } = useLearningHistory();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loadingAction, setLoadingAction] = useState<
    PlanKey | "portal" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const hasAutoStartedRef = useRef(false);

  const startCheckout = useCallback(async (plan: PlanKey) => {
    setLoadingAction(plan);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });
      const payload = (await response.clone().json().catch(() => null)) as
        | { checkoutUrl?: string }
        | null;

      if (response.status === 401) {
        router.push("/auth/login?next=/purchases");
        return;
      }

      if (!response.ok || !payload?.checkoutUrl) {
        setError(await getApiErrorMessage(response, {
          badRequestMessage: "Please double-check your billing choice and try again.",
          fallbackMessage: "Unable to start checkout right now.",
          networkMessage: "We couldn't reach billing right now. Please try again shortly.",
          rateLimitMessage:
            "Billing is busy right now. Please wait a minute and try again.",
          unauthorizedMessage: "Log in to continue to checkout.",
          unavailableMessage:
            "Billing is temporarily unavailable. Please try again shortly.",
        }));
        return;
      }

      recordConversionEvent({
        eventType: "checkout_start",
        plan,
        source: "billing_actions",
        targetSlug: "/purchases",
        targetTitle: `Checkout ${plan === "pro_monthly" ? "Pro monthly" : "Pro yearly"}`,
      });

      window.location.assign(payload.checkoutUrl);
    } catch {
      setError(getNetworkErrorMessage({
        fallbackMessage: "Unable to start checkout right now.",
        networkMessage: "We couldn't reach billing right now. Please try again shortly.",
        unavailableMessage:
          "Billing is temporarily unavailable. Please try again shortly.",
      }));
    } finally {
      setLoadingAction(null);
    }
  }, [recordConversionEvent, router]);

  const openPortal = useCallback(async () => {
    setLoadingAction("portal");
    setError(null);

    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
      });
      const payload = (await response.clone().json().catch(() => null)) as
        | { portalUrl?: string }
        | null;

      if (response.status === 401) {
        router.push("/auth/login?next=/purchases");
        return;
      }

      if (!response.ok || !payload?.portalUrl) {
        setError(await getApiErrorMessage(response, {
          fallbackMessage: "Unable to open billing portal right now.",
          networkMessage: "We couldn't reach billing right now. Please try again shortly.",
          rateLimitMessage:
            "Billing portal access is busy right now. Please wait a minute and try again.",
          unauthorizedMessage: "Log in to manage billing.",
          unavailableMessage:
            "Billing portal is temporarily unavailable. Please try again shortly.",
        }));
        return;
      }

      window.location.assign(payload.portalUrl);
    } catch {
      setError(getNetworkErrorMessage({
        fallbackMessage: "Unable to open billing portal right now.",
        networkMessage: "We couldn't reach billing right now. Please try again shortly.",
        unavailableMessage:
          "Billing portal is temporarily unavailable. Please try again shortly.",
      }));
    } finally {
      setLoadingAction(null);
    }
  }, [router]);

  useEffect(() => {
    const requestedPlan = searchParams.get("plan");

    if (
      hasAutoStartedRef.current ||
      !canCheckout ||
      (requestedPlan !== "pro_monthly" && requestedPlan !== "pro_yearly")
    ) {
      return;
    }

    hasAutoStartedRef.current = true;
    void startCheckout(requestedPlan);
  }, [canCheckout, searchParams, startCheckout]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <button
          className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canCheckout || loadingAction !== null}
          onClick={() => startCheckout("pro_monthly")}
          type="button"
        >
          {loadingAction === "pro_monthly"
            ? "Opening checkout..."
            : `${checkoutLabel} monthly`}
        </button>
        <button
          className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canCheckout || loadingAction !== null}
          onClick={() => startCheckout("pro_yearly")}
          type="button"
        >
          {loadingAction === "pro_yearly"
            ? "Opening checkout..."
            : `${checkoutLabel} yearly`}
        </button>
      </div>
      {canOpenPortal ? (
        <button
          className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loadingAction !== null}
          onClick={openPortal}
          type="button"
        >
          {loadingAction === "portal" ? "Opening billing portal..." : "Manage billing"}
        </button>
      ) : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {!canCheckout ? (
        <p className="text-sm text-zinc-500">
          Add Stripe keys before starting checkout in this environment.
        </p>
      ) : null}
    </div>
  );
}
