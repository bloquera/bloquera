import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { absoluteUrl, getSiteUrl } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Bloquera",
    template: "%s | Bloquera",
  },
  description:
    "Bloquera helps beginners learn crypto with structured lessons, quizzes, dashboard progress, and an AI tutor, starting with a live Bitcoin track.",
  applicationName: "Bloquera",
  keywords: [
    "Bloquera",
    "crypto course",
    "learn crypto",
    "crypto lessons",
    "crypto quizzes",
    "crypto education",
    "Bitcoin course",
    "learn Bitcoin",
    "Bitcoin lessons",
    "Bitcoin quizzes",
    "AI tutor",
  ],
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Bloquera",
    description:
      "Structured crypto learning with lessons, quizzes, dashboard progress, and an AI tutor, starting with Bitcoin.",
    url: absoluteUrl("/"),
    siteName: "Bloquera",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bloquera",
    description:
      "Structured crypto learning with lessons, quizzes, dashboard progress, and an AI tutor, starting with Bitcoin.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-black text-white">
        <Navbar />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
