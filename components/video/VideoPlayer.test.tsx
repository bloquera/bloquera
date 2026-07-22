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
});
