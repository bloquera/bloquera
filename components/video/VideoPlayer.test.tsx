import { fireEvent, render, screen } from "@testing-library/react";

import { VideoPlayer } from "@/components/video/VideoPlayer";

describe("VideoPlayer", () => {
  it("renders the native video player when a source is ready", () => {
    render(
      <VideoPlayer
        duration="8 min"
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );

    const player = screen.getByLabelText("What Is Money?");

    expect(player.tagName).toBe("VIDEO");
    expect(player).toHaveAttribute("controls");
    expect(player).toHaveAttribute("crossorigin", "anonymous");
    expect(player).toHaveAttribute("playsinline");
    expect(player).toHaveAttribute("preload", "metadata");
    expect(player).toHaveAttribute("src", "https://signed.example/video.mp4");
  });

  it("announces the loading state", () => {
    render(<VideoPlayer duration="8 min" title="What Is Money?" />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Preparing secure stream",
    );
    expect(screen.getByText("8 min")).toBeInTheDocument();
  });

  it("announces playback preparation errors", () => {
    const onRetry = vi.fn();
    render(
      <VideoPlayer
        error="This lesson video is not available yet."
        onRetry={onRetry}
        title="What Is Money?"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Video unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This lesson video is not available yet.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("reports native playback errors with the current position", () => {
    const onPlaybackError = vi.fn();
    render(
      <VideoPlayer
        onPlaybackError={onPlaybackError}
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );
    const player = screen.getByLabelText("What Is Money?") as HTMLVideoElement;
    Object.defineProperty(player, "currentTime", { configurable: true, value: 42 });

    fireEvent.error(player);

    expect(onPlaybackError).toHaveBeenCalledWith(42);
  });

  it("restores the playback position after a source refresh", () => {
    render(
      <VideoPlayer
        resumeAt={42}
        src="https://signed.example/refreshed.mp4"
        title="What Is Money?"
      />,
    );
    const player = screen.getByLabelText("What Is Money?") as HTMLVideoElement;

    fireEvent.loadedMetadata(player);

    expect(player.currentTime).toBe(42);
  });

  it("reports time, pause, and completion progress", () => {
    const onProgress = vi.fn();
    render(
      <VideoPlayer
        onProgress={onProgress}
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );
    const player = screen.getByLabelText("What Is Money?") as HTMLVideoElement;
    Object.defineProperty(player, "currentTime", {
      configurable: true,
      value: 25,
    });
    Object.defineProperty(player, "duration", {
      configurable: true,
      value: 100,
    });

    fireEvent.timeUpdate(player);
    fireEvent.pause(player);
    fireEvent.ended(player);

    expect(onProgress).toHaveBeenNthCalledWith(1, {
      durationSeconds: 100,
      positionSeconds: 25,
      reason: "timeupdate",
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      durationSeconds: 100,
      positionSeconds: 25,
      reason: "pause",
    });
    expect(onProgress).toHaveBeenNthCalledWith(3, {
      durationSeconds: 100,
      positionSeconds: 100,
      reason: "ended",
    });
  });

  it("renders signed captions when a track is available", () => {
    const { container } = render(
      <VideoPlayer
        captions={{
          label: "English",
          language: "en",
          src: "https://signed.example/captions.vtt",
        }}
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );

    const track = container.querySelector("track");
    expect(track).toHaveAttribute("kind", "captions");
    expect(track).toHaveAttribute("label", "English");
    expect(track).toHaveAttribute("srclang", "en");
    expect(track).toHaveAttribute("src", "https://signed.example/captions.vtt");
  });

  it("changes native playback speed", () => {
    render(
      <VideoPlayer
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );
    const player = screen.getByLabelText("What Is Money?") as HTMLVideoElement;

    fireEvent.change(screen.getByLabelText("Playback speed"), {
      target: { value: "1.5" },
    });

    expect(player.playbackRate).toBe(1.5);
    expect(screen.getByLabelText("Playback speed")).toHaveValue("1.5");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Playback speed 1.5 times.",
    );
  });

  it("supports keyboard seeking and mute shortcuts", () => {
    render(
      <VideoPlayer
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );
    const player = screen.getByLabelText("What Is Money?") as HTMLVideoElement;
    Object.defineProperty(player, "currentTime", {
      configurable: true,
      value: 20,
      writable: true,
    });
    Object.defineProperty(player, "duration", {
      configurable: true,
      value: 100,
    });

    fireEvent.keyDown(player, { key: "ArrowRight" });
    expect(player.currentTime).toBe(30);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Skipped forward 10 seconds.",
    );

    fireEvent.keyDown(player, { key: "ArrowLeft" });
    expect(player.currentTime).toBe(20);

    fireEvent.keyDown(player, { key: "m" });
    expect(player.muted).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent("Sound muted.");
  });

  it("offers a keyboard-accessible captions toggle", () => {
    render(
      <VideoPlayer
        captions={{
          label: "English",
          language: "en",
          src: "https://signed.example/captions.vtt",
        }}
        src="https://signed.example/video.mp4"
        title="What Is Money?"
      />,
    );
    const player = screen.getByLabelText("What Is Money?") as HTMLVideoElement;
    const textTrack = { mode: "showing" };
    Object.defineProperty(player, "textTracks", {
      configurable: true,
      value: [textTrack],
    });

    fireEvent.keyDown(player, { key: "c" });

    expect(textTrack.mode).toBe("hidden");
    expect(screen.getByRole("button", { name: "Turn captions on" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Captions off.");
  });

  it("moves focus to retry when a playback error is shown", () => {
    render(
      <VideoPlayer
        error="Playback failed."
        onRetry={vi.fn()}
        title="What Is Money?"
      />,
    );

    expect(screen.getByRole("button", { name: "Try again" })).toHaveFocus();
  });
});
