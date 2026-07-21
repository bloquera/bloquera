import { render, screen } from "@testing-library/react";

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
    render(
      <VideoPlayer
        error="This lesson video is not available yet."
        title="What Is Money?"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Video unavailable");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This lesson video is not available yet.",
    );
  });
});
