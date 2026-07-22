import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { LessonVideo } from "@/components/lesson/LessonVideo";

const lesson = {
  body: "Lesson body",
  duration: "8 min",
  order: 1,
  slug: "what-is-money",
  summary: "Summary",
  title: "What Is Money?",
  track: "bitcoin",
};

function videoResponse(url: string) {
  return new Response(JSON.stringify({ url }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function progressResponse(options?: {
  completed?: boolean;
  durationSeconds?: number;
  positionSeconds?: number;
}) {
  return new Response(
    JSON.stringify({
      completed: options?.completed ?? false,
      completedAt: null,
      durationSeconds: options?.durationSeconds ?? 0,
      positionSeconds: options?.positionSeconds ?? 0,
      updatedAt: null,
    }),
    {
      headers: { "Content-Type": "application/json" },
      status: 200,
    },
  );
}

describe("LessonVideo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets the student retry a failed signed URL request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Temporary video error." }), {
          headers: { "Content-Type": "application/json" },
          status: 503,
        }),
      )
      .mockResolvedValueOnce(progressResponse())
      .mockResolvedValueOnce(videoResponse("https://signed.example/retry.mp4"));
    vi.stubGlobal("fetch", fetchMock);

    render(<LessonVideo lesson={lesson} />);

    expect(await screen.findByText("Temporary video error.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByLabelText("What Is Money?")).toHaveAttribute(
        "src",
        "https://signed.example/retry.mp4",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("refreshes the signed URL once after a playback error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(videoResponse("https://signed.example/first.mp4"))
      .mockResolvedValueOnce(progressResponse())
      .mockResolvedValueOnce(videoResponse("https://signed.example/refreshed.mp4"));
    vi.stubGlobal("fetch", fetchMock);

    render(<LessonVideo lesson={lesson} />);

    const player = (await screen.findByLabelText(
      "What Is Money?",
    )) as HTMLVideoElement;
    Object.defineProperty(player, "currentTime", { configurable: true, value: 42 });
    fireEvent.error(player);

    await waitFor(() => {
      expect(screen.getByLabelText("What Is Money?")).toHaveAttribute(
        "src",
        "https://signed.example/refreshed.mp4",
      );
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fireEvent.error(screen.getByLabelText("What Is Money?"));

    expect(
      await screen.findByText(
        "Playback stopped unexpectedly. Refresh the secure link and try again.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("saves progress every ten seconds and on pause or completion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(videoResponse("https://signed.example/video.mp4"))
      .mockResolvedValueOnce(progressResponse())
      .mockResolvedValue(new Response(JSON.stringify({ saved: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LessonVideo lesson={lesson} />);

    const player = (await screen.findByLabelText(
      "What Is Money?",
    )) as HTMLVideoElement;
    Object.defineProperty(player, "duration", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(player, "currentTime", {
      configurable: true,
      writable: true,
      value: 5,
    });

    fireEvent.timeUpdate(player);
    player.currentTime = 10;
    fireEvent.timeUpdate(player);
    player.currentTime = 15;
    fireEvent.timeUpdate(player);
    fireEvent.pause(player);
    fireEvent.ended(player);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/lessons/what-is-money/video-progress",
      expect.objectContaining({
        body: JSON.stringify({ durationSeconds: 100, positionSeconds: 10 }),
        method: "PUT",
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "/api/lessons/what-is-money/video-progress",
      expect.objectContaining({
        body: JSON.stringify({ durationSeconds: 100, positionSeconds: 15 }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      "/api/lessons/what-is-money/video-progress",
      expect.objectContaining({
        body: JSON.stringify({ durationSeconds: 100, positionSeconds: 100 }),
      }),
    );
  });

  it("restores an incomplete video to its saved position", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(videoResponse("https://signed.example/video.mp4"))
      .mockResolvedValueOnce(
        progressResponse({ durationSeconds: 100, positionSeconds: 42 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<LessonVideo lesson={lesson} />);

    const player = (await screen.findByLabelText(
      "What Is Money?",
    )) as HTMLVideoElement;
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    fireEvent.loadedMetadata(player);
    expect(player.currentTime).toBe(42);
  });
});
