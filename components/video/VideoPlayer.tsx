"use client";

import { useEffect, useId, useRef, useState } from "react";

export type VideoPlaybackProgress = {
  durationSeconds: number;
  positionSeconds: number;
  reason: "ended" | "pause" | "timeupdate";
};

type VideoPlayerProps = {
  captions?: {
    label: string;
    language: string;
    src: string;
  } | null;
  duration?: string;
  error?: string | null;
  isLoading?: boolean;
  onPlaybackError?: (currentTime: number) => void;
  onProgress?: (progress: VideoPlaybackProgress) => void;
  onRetry?: () => void;
  resumeAt?: number;
  src?: string | null;
  title: string;
};

export function VideoPlayer({
  captions,
  duration,
  error,
  src,
  isLoading = !src && !error,
  onPlaybackError,
  onProgress,
  onRetry,
  resumeAt = 0,
  title,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const speedControlId = useId();
  const [playbackRate, setPlaybackRate] = useState(1);

  useEffect(() => {
    const video = videoRef.current;

    if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA && resumeAt > 0) {
      video.currentTime = resumeAt;
    }
  }, [resumeAt, src]);

  return (
    <div className="aspect-video overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.2),transparent_28%),linear-gradient(145deg,rgba(24,24,27,1),rgba(10,10,10,0.95))]">
      {src ? (
        <div className="relative h-full">
          <video
            aria-label={title}
            className="h-full w-full bg-black object-contain"
            controls
            crossOrigin="anonymous"
            onEnded={(event) =>
              onProgress?.({
                durationSeconds: event.currentTarget.duration,
                positionSeconds: event.currentTarget.duration,
                reason: "ended",
              })
            }
            onError={(event) =>
              onPlaybackError?.(event.currentTarget.currentTime)
            }
            onLoadedMetadata={() => {
              const video = videoRef.current;

              if (video) {
                video.playbackRate = playbackRate;

                if (resumeAt > 0) {
                  video.currentTime = resumeAt;
                }
              }
            }}
            onPause={(event) =>
              onProgress?.({
                durationSeconds: event.currentTarget.duration,
                positionSeconds: event.currentTarget.currentTime,
                reason: "pause",
              })
            }
            onTimeUpdate={(event) =>
              onProgress?.({
                durationSeconds: event.currentTarget.duration,
                positionSeconds: event.currentTarget.currentTime,
                reason: "timeupdate",
              })
            }
            playsInline
            preload="metadata"
            ref={videoRef}
            src={src}
          >
            {captions ? (
              <track
                default
                kind="captions"
                label={captions.label}
                src={captions.src}
                srcLang={captions.language}
              />
            ) : null}
            Your browser does not support HTML video.
          </video>
          <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
            <label className="sr-only" htmlFor={speedControlId}>
              Playback speed
            </label>
            <select
              aria-label="Playback speed"
              className="bg-transparent font-semibold text-white outline-none"
              id={speedControlId}
              onChange={(event) => {
                const nextRate = Number(event.currentTarget.value);
                setPlaybackRate(nextRate);

                if (videoRef.current) {
                  videoRef.current.playbackRate = nextRate;
                }
              }}
              value={playbackRate}
            >
              {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                <option className="bg-zinc-950" key={rate} value={rate}>
                  {rate}x
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div
          aria-live="polite"
          className="flex h-full flex-col justify-between p-6 sm:p-8"
          role={error ? "alert" : "status"}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
                {error
                  ? "Video unavailable"
                  : isLoading
                    ? "Preparing secure stream"
                    : "Ready to play"}
              </p>
              <h3 className="mt-2 max-w-2xl text-xl font-semibold text-white sm:text-2xl">
                {title}
              </h3>
            </div>
            {duration ? (
              <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-300">
                {duration}
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-center">
            <div
              className={`flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/10 shadow-[0_18px_50px_rgba(0,0,0,0.35)] backdrop-blur ${isLoading ? "animate-pulse" : ""}`}
            >
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
              {error ??
                (isLoading
                  ? "Your private playback link is being prepared."
                  : "The video is ready when you are.")}
            </p>
            {error && onRetry ? (
              <button
                className="mt-4 rounded-full border border-orange-400/30 bg-orange-500/15 px-4 py-2 text-sm font-semibold text-orange-200 transition hover:bg-orange-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                onClick={onRetry}
                type="button"
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
