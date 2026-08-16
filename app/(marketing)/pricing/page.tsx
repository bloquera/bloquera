import type { Metadata } from "next";
import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";

import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { hasProAccess, getBillingSnapshotForCurrentUser } from "@/lib/billing";
import { publicGuides } from "@/lib/public-guides";
import { createPageMetadata } from "@/lib/seo";
import type { BillingPlanSlug } from "@/types/billing";

const plans = [
  {
    name: "Free",
    price: "£0",
    cadence: "forever",
    description:
      "Get the live Bitcoin curriculum, guided lessons, quizzes, and your learning dashboard at no cost.",
    accent: "border-white/10 bg-white/[0.04]",
    badge: "Start here",
    ctaLabel: "Join free",
    href: "/auth/register",
    features: [
      "Live Bitcoin track access",
      "Quiz progress and dashboard history",
      "10 AI tutor questions per day",
      "Account profile and recovery tools",
    ],
  },
  {
    name: "Pro Monthly",
    price: "£14.99",
    cadence: "per month",
    description:
      "Unlock premium billing access, future premium tracks, and a more generous daily tutor allowance with a flexible monthly subscription.",
    accent: "border-orange-500/30 bg-orange-500/10",
    badge: "Most flexible",
    ctaLabel: "Upgrade to Pro",
    plan: "pro_monthly" as const,
    features: [
      "Everything in Starter",
      "60 AI tutor questions per day",
      "Billing portal and purchase history",
    ],
  },
  {
    name: "Pro Yearly",
    price: "£149.99",
    cadence: "per year",
    description:
      "Get the same Pro access with a fixed annual price and the cleanest long-term plan for committed learners.",
    accent: "border-emerald-400/30 bg-emerald-400/10",
    badge: "Best value",
    ctaLabel: "Choose yearly",
    plan: "pro_yearly" as const,
    features: [
      "Everything in Pro Monthly",
      "60 AI tutor questions per day",
      "Lower annual cost than paying monthly",
      "Annual billing with full portal access",
    ],
  },
] as const;

export const metadata: Metadata = createPageMetadata({
  title: "Pricing",
  description:
    "View Bloquera pricing for guided crypto learning plans, including the live Bitcoin curriculum, quizzes, and AI tutor support.",
  pathname: "/pricing",
  imagePath: "/pricing/opengraph-image",
});

export default async function PricingPage() {
  noStore();

  const billingSnapshot = await getBillingSnapshotForCurrentUser();
  const currentPlanSlug = hasProAccess(billingSnapshot)
    ? billingSnapshot.subscription?.plan_slug ?? null
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <section className="border-b border-white/10 px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 sm:p-10">
            <div className="mt-4 flex justify-center">
              <div className="max-w-3xl text-center">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Simple plans for beginners and committed learners.
                </h1>
                <p className="mt-5 text-base leading-8 text-zinc-400 sm:text-lg">
                  Learn the basics for free, then upgrade when you want more
                  depth.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid items-stretch gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative flex h-full overflow-hidden rounded-[2rem] border p-8 ${plan.accent}`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.18em] text-zinc-500">
                        {plan.name}
                      </p>
                      <h2 className="mt-4 text-5xl font-semibold tracking-tight text-white">
                        {plan.price}
                      </h2>
                      <p className="mt-2 text-sm uppercase tracking-[0.16em] text-zinc-500">
                        {plan.cadence}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-300">
                      {plan.badge}
                    </span>
                  </div>

                  <p className="mt-6 text-sm leading-7 text-zinc-300">
                    {plan.description}
                  </p>

                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature) => (
                      <div
                        key={feature}
                        className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-200"
                      >
                        {feature}
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-8">
                    {isCurrentPlan(plan.name, currentPlanSlug) ? (
                      <span
                        aria-disabled="true"
                        className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-5 py-3 text-sm font-semibold text-emerald-200 opacity-90"
                      >
                        Current subscription
                      </span>
                    ) : (
                      plan.name === "Free" ? (
                        <Link
                          href="/auth/register"
                          className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                          {plan.ctaLabel}
                        </Link>
                      ) : (
                        <CheckoutButton
                          className={`inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition ${
                            plan.name === "Pro Monthly"
                              ? "bg-orange-500 text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                              : "border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                          }`}
                          label={getPlanCtaLabel(
                            plan.name,
                            currentPlanSlug,
                            plan.ctaLabel,
                          )}
                          loadingLabel="Opening checkout..."
                          plan={plan.plan}
                        />
                      )
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-6 py-16">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
                What changes with Pro
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                Pay for deeper usage, not basic access.
              </h2>
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Bloquera keeps the live Bitcoin curriculum open on the free plan.
                Pro adds account-level billing tools and the next layer of product
                depth as premium tracks roll out.
              </p>
              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Tutor access
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  Start with 3 guest questions, then grow into daily access
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Guests can try 3 demo questions before login. Free accounts get
                  10 tutor questions per day, and Pro plans increase that to 60
                  questions per day.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-orange-300">
                  Included today
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  Learning, progress, and billing clarity
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Lessons, quizzes, dashboard progress, purchase history, and
                  billing management all stay connected to one account.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-300">
                  Coming next
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  Premium tracks and stronger tutor access
                </p>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  Pro is the path for future premium tracks, expanded AI usage,
                  and more advanced account-level learning controls.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/10 bg-white/[0.03] p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">
            Explore free guides first
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Learn the basics before you choose a plan.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
            Public guides explain crypto basics, Bitcoin, wallets, and
            transactions in plain language before learners move into the full
            product.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {publicGuides.map((guide) => (
              <Link
                key={guide.id}
                href={guide.href}
                className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5 transition hover:border-orange-500/30 hover:bg-black/30"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {guide.eyebrow}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">
                  {guide.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {guide.summary}
                </p>
                <span className="mt-4 inline-flex text-sm font-semibold text-orange-300">
                  Read guide
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function isCurrentPlan(
  planName: (typeof plans)[number]["name"],
  currentPlanSlug: BillingPlanSlug | null,
) {
  if (planName === "Pro Monthly") {
    return currentPlanSlug === "pro_monthly";
  }

  if (planName === "Pro Yearly") {
    return currentPlanSlug === "pro_yearly";
  }

  return false;
}

function getPlanCtaLabel(
  planName: (typeof plans)[number]["name"],
  currentPlanSlug: BillingPlanSlug | null,
  defaultLabel: string,
) {
  if (planName === "Pro Monthly" && currentPlanSlug === "pro_yearly") {
    return "Downgrade to monthly";
  }

  if (planName === "Pro Yearly" && currentPlanSlug === "pro_monthly") {
    return "Upgrade to yearly";
  }

  return defaultLabel;
}
