"use client";

import { useEffect, useState } from "react";

import { VideoPlayer } from "@/components/video/VideoPlayer";
import { getApiErrorMessage } from "@/lib/client-api";
import type { Lesson } from "@/types/lesson";

export function LessonVideo({ lesson }: { lesson: Lesson }) {
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

      <div className="mt-5">
        <VideoPlayer
          duration={lesson.duration}
          error={error}
          src={videoUrl}
          title={lesson.title}
        />
      </div>
    </section>
  );
}
