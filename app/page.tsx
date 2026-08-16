import type { Metadata } from "next";
import Script from "next/script";
import { unstable_noStore as noStore } from "next/cache";

import HomePage from "@/components/home/HomePage";
import { getBillingSnapshotForCurrentUser, hasProAccess } from "@/lib/billing";
import { publicGuides } from "@/lib/public-guides";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = createPageMetadata({
  title: "Learn crypto the structured way",
  description:
    "Learn crypto with structured beginner lessons, quizzes, progress tracking, and an AI tutor in Bloquera, starting with a live Bitcoin track.",
  pathname: "/",
});

export default async function Page() {
  noStore();

  const supabase = await createServerSupabaseClient();
  const authResult = supabase
    ? await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
    : { data: { user: null } };
  const isAuthenticated = Boolean(authResult.data.user);
  const billingSnapshot = await getBillingSnapshotForCurrentUser();
  const currentPlanSlug = hasProAccess(billingSnapshot)
    ? billingSnapshot.subscription?.plan_slug ?? null
    : null;

  const faq = [
    {
      question: "Is Bloquera for complete beginners?",
      answer:
        "Yes. Bloquera is built to explain crypto concepts in plain language with guides, lessons, quizzes, and AI tutor support.",
    },
    {
      question: "Why does Bloquera start with Bitcoin?",
      answer:
        "Bitcoin is the live track today and gives beginners a strong foundation in scarcity, self-custody, and network verification before new tracks arrive.",
    },
    {
      question: "Do I need to buy crypto to start learning?",
      answer:
        "No. You can learn the concepts first, use the guides and curriculum, and decide later whether ownership makes sense for you.",
    },
    {
      question: "Will Bloquera expand beyond Bitcoin?",
      answer:
        "Yes. The platform is designed to support broader crypto tracks over time while keeping the current learning path focused.",
    },
  ];

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Bloquera",
        url: absoluteUrl("/"),
        description:
          "Structured crypto learning with lessons, quizzes, dashboard progress, and an AI tutor, starting with Bitcoin.",
      },
      {
        "@type": "Organization",
        name: "Bloquera",
        url: absoluteUrl("/"),
        description:
          "Bloquera helps beginners learn crypto with structured lessons, quizzes, and an AI tutor.",
      },
      {
        "@type": "WebApplication",
        name: "Bloquera",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: absoluteUrl("/"),
        description:
          "A guided crypto learning platform with beginner lessons, quizzes, progress tracking, and AI tutor support.",
      },
      {
        "@type": "ItemList",
        name: "Bloquera public crypto guides",
        itemListElement: publicGuides.map((guide, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: guide.title,
          url: absoluteUrl(guide.href),
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      },
    ],
  };

  return (
    <>
      <Script
        id="bloquera-home-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <HomePage currentPlanSlug={currentPlanSlug} isAuthenticated={isAuthenticated} />
    </>
  );
}
