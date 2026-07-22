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
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes the signed URL once after a playback error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(videoResponse("https://signed.example/first.mp4"))
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
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.error(screen.getByLabelText("What Is Money?"));

    expect(
      await screen.findByText(
        "Playback stopped unexpectedly. Refresh the secure link and try again.",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
