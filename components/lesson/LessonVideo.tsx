"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  VideoPlayer,
  type VideoPlaybackProgress,
} from "@/components/video/VideoPlayer";
import { getApiErrorMessage } from "@/lib/client-api";
import type { Lesson } from "@/types/lesson";

export function LessonVideo({ lesson }: { lesson: Lesson }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeAt, setResumeAt] = useState(0);
  const requestController = useRef<AbortController | null>(null);
  const recoveryAttempts = useRef(0);
  const lastSavedPosition = useRef(0);
  const progressSaveQueue = useRef<Promise<void>>(Promise.resolve());

  const loadVideo = useCallback(async (resetPosition = false) => {
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;

    await Promise.resolve();

    if (controller.signal.aborted) {
      return;
    }

    if (resetPosition) {
      setResumeAt(0);
    }
    setError(null);
    setIsLoading(true);
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
    } finally {
      if (requestController.current === controller) {
        setIsLoading(false);
      }
    }
  }, [lesson.slug]);

  const loadSavedProgress = useCallback(
    async (signal: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/lessons/${encodeURIComponent(lesson.slug)}/video-progress`,
          { cache: "no-store", signal },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          completed?: unknown;
          durationSeconds?: unknown;
          positionSeconds?: unknown;
        };
        const positionSeconds = payload.positionSeconds;
        const durationSeconds = payload.durationSeconds;

        if (
          typeof positionSeconds !== "number" ||
          !Number.isFinite(positionSeconds) ||
          positionSeconds <= 0 ||
          typeof durationSeconds !== "number" ||
          !Number.isFinite(durationSeconds) ||
          durationSeconds <= 0
        ) {
          return;
        }

        lastSavedPosition.current = positionSeconds;
        setResumeAt(
          payload.completed === true
            ? 0
            : Math.min(positionSeconds, durationSeconds),
        );
      } catch (progressError) {
        if (
          !(progressError instanceof DOMException && progressError.name === "AbortError")
        ) {
          // Progress loading is best-effort and must not prevent video playback.
        }
      }
    },
    [lesson.slug],
  );

  useEffect(() => {
    recoveryAttempts.current = 0;
    lastSavedPosition.current = 0;
    const progressController = new AbortController();
    const requestTimer = window.setTimeout(() => {
      void loadVideo(true).then(() =>
        loadSavedProgress(progressController.signal),
      );
    }, 0);

    return () => {
      window.clearTimeout(requestTimer);
      progressController.abort();
      requestController.current?.abort();
    };
  }, [loadSavedProgress, loadVideo]);

  function handlePlaybackError(currentTime: number) {
    setResumeAt(Number.isFinite(currentTime) ? Math.max(0, currentTime) : 0);

    if (recoveryAttempts.current < 1) {
      recoveryAttempts.current += 1;
      void loadVideo();
      return;
    }

    setVideoUrl(null);
    setError(
      "Playback stopped unexpectedly. Refresh the secure link and try again.",
    );
  }

  function handleRetry() {
    recoveryAttempts.current = 0;
    void loadVideo();
  }

  function handleProgress(progress: VideoPlaybackProgress) {
    const { durationSeconds, positionSeconds, reason } = progress;

    if (
      !Number.isFinite(positionSeconds) ||
      positionSeconds < 0 ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds <= 0
    ) {
      return;
    }

    const shouldSave =
      reason === "pause" ||
      reason === "ended" ||
      Math.abs(positionSeconds - lastSavedPosition.current) >= 10;

    if (!shouldSave) {
      return;
    }

    lastSavedPosition.current = positionSeconds;

    progressSaveQueue.current = progressSaveQueue.current
      .then(async () => {
        await fetch(
          `/api/lessons/${encodeURIComponent(lesson.slug)}/video-progress`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ durationSeconds, positionSeconds }),
            keepalive: true,
          },
        );
      })
      .catch(() => {
        // Playback must remain uninterrupted if progress persistence is unavailable.
      });
  }

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
          isLoading={isLoading}
          onPlaybackError={handlePlaybackError}
          onProgress={handleProgress}
          onRetry={handleRetry}
          resumeAt={resumeAt}
          src={videoUrl}
          title={lesson.title}
        />
      </div>
    </section>
  );
}
