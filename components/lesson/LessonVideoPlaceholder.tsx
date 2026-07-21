"use client";

import { useEffect, useState } from "react";

import { getApiErrorMessage } from "@/lib/client-api";
import type { Lesson } from "@/types/lesson";

export function LessonVideoPlaceholder({ lesson }: { lesson: Lesson }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadVideo() {
      setError(null);
      setVideoUrl(null);

      try {
        const response = await fetch(
          `/api/lessons/${encodeURIComponent(lesson.slug)}/video`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setError(
            await getApiErrorMessage(response, {
              fallbackMessage: "This lesson video is unavailable right now.",
            }),
          );
          return;
        }

        const payload = (await response.json()) as { url?: unknown };

        if (typeof payload.url !== "string" || payload.url.length === 0) {
          setError("This lesson video is unavailable right now.");
          return;
        }

        setVideoUrl(payload.url);
      } catch (loadError) {
        if (!(loadError instanceof DOMException && loadError.name === "AbortError")) {
          setError("This lesson video is unavailable right now.");
        }
      }
    }

    void loadVideo();

    return () => controller.abort();
  }, [lesson.slug]);

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Lesson video
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Watch the concept first
          </h2>
        </div>
        <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-300">
          Private stream
        </span>
      </div>

      <div className="mt-5 aspect-video overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.2),transparent_28%),linear-gradient(145deg,rgba(24,24,27,1),rgba(10,10,10,0.95))]">
        {videoUrl ? (
          <video
            className="h-full w-full bg-black object-contain"
            controls
            playsInline
            preload="metadata"
            src={videoUrl}
          >
            Your browser does not support HTML video.
          </video>
        ) : (
          <div className="flex h-full flex-col justify-between p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                  {error ? "Video unavailable" : "Preparing secure stream"}
                </p>
                <h3 className="mt-2 max-w-2xl text-xl font-semibold text-white sm:text-2xl">
                  {lesson.title}
                </h3>
              </div>
              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-300">
                {lesson.duration}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur">
                <svg
                  aria-hidden="true"
                  className="ml-1 h-8 w-8 fill-white"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.85l8.1-5.18a1 1 0 0 0 0-1.68l-8.1-5.18A1 1 0 0 0 8 6.82Z" />
                </svg>
              </div>
            </div>

            <div className="max-w-2xl">
              <p className="text-sm leading-7 text-zinc-300 sm:text-base">
                {error ?? "Your private playback link is being prepared."}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
