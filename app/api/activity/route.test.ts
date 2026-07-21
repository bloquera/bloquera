const cookieState = new Map<string, string>();
const createServerSupabaseClient = vi.fn();
const getUser = vi.fn();
const insert = vi.fn();
const maybeSingle = vi.fn();
const limit = vi.fn();
const order = vi.fn();
const readEq = vi.fn();
const duplicateEqUser = vi.fn();
const duplicateEqType = vi.fn();
const duplicateEqSlug = vi.fn();
const select = vi.fn();
const from = vi.fn();

type LearningActivityRow = {
  activity_context: string | null;
  activity_type: string;
  correct_count: number | null;
  created_at: string;
  lesson_slug: string;
  lesson_title: string;
  passed: boolean | null;
  response_preview: string | null;
  total_questions: number | null;
};

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieState.get(name);
      return value ? { value } : undefined;
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClient(),
}));

function configureSupabaseActivityClient(options?: {
  existingCompletion?: { id: string } | null;
  rows?: LearningActivityRow[];
  userId?: string | null;
}) {
  const userId = options?.userId === undefined ? "user-1" : options.userId;
  const rows = options?.rows ?? [];
  const existingCompletion =
    options?.existingCompletion === undefined ? null : options.existingCompletion;

  getUser.mockResolvedValue({
    data: {
      user: userId ? { id: userId } : null,
    },
  });

  maybeSingle.mockReset();
  limit.mockReset();
  order.mockReset();
  readEq.mockReset();
  duplicateEqUser.mockReset();
  duplicateEqType.mockReset();
  duplicateEqSlug.mockReset();
  select.mockReset();
  from.mockReset();
  insert.mockReset();

  maybeSingle.mockResolvedValue({
    data: existingCompletion,
    error: null,
  });

  limit.mockResolvedValue({
    data: rows,
    error: null,
  });

  order.mockReturnValue({
    limit,
  });

  readEq.mockImplementation(() => {
    return {
      order,
    };
  });

  duplicateEqSlug.mockImplementation(() => ({
    maybeSingle,
  }));

  duplicateEqType.mockImplementation(() => ({
    eq: duplicateEqSlug,
  }));

  duplicateEqUser.mockImplementation(() => ({
    eq: duplicateEqType,
  }));

  select.mockImplementation((query: string) => {
    if (query === "id") {
      return {
        eq: duplicateEqUser,
      };
    }

    return {
      eq: readEq,
    };
  });

  insert.mockResolvedValue({ error: null });

  from.mockImplementation((table: string) => {
    if (table === "learning_activity") {
      return {
        insert,
        select,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  createServerSupabaseClient.mockResolvedValue({
    auth: {
      getUser,
    },
    from,
  });
}

describe("activity route", () => {
  beforeEach(() => {
    cookieState.clear();
    getUser.mockReset();
    createServerSupabaseClient.mockReset();
    createServerSupabaseClient.mockResolvedValue(null);
  });

  it("returns empty activity by default", async () => {
    const { GET } = await import("@/app/api/activity/route");
    const response = await GET();
    const payload = await response.json();

    expect(payload).toEqual({
      conversionEvents: [],
      lessonCompletions: [],
      quizAttempts: [],
      tutorPrompts: [],
    });
  });

  it("falls back to cookie history when Supabase auth throws during reads", async () => {
    cookieState.set(
      "satoshilearn-activity",
      JSON.stringify({
        conversionEvents: [],
        lessonCompletions: [
          {
            lessonSlug: "bitcoin-basics",
            lessonTitle: "Bitcoin Basics",
            completedAt: "2026-03-25T18:00:00.000Z",
          },
        ],
        quizAttempts: [],
        tutorPrompts: [],
      }),
    );

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockRejectedValue(new Error("network")),
      },
      from,
    });

    const { GET } = await import("@/app/api/activity/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      conversionEvents: [],
      lessonCompletions: [
        {
          lessonSlug: "bitcoin-basics",
          lessonTitle: "Bitcoin Basics",
          completedAt: "2026-03-25T18:00:00.000Z",
        },
      ],
      quizAttempts: [],
      tutorPrompts: [],
    });
  });

  it("stores lesson completions in the fallback cookie payload", async () => {
    const { POST, GET } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "lesson_completion",
          lessonSlug: "what-is-money",
          lessonTitle: "What Is Money?",
          completedAt: "2026-03-25T18:00:00.000Z",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie");

    expect(setCookie).toContain("satoshilearn-activity=");
    expect(setCookie).toContain("HttpOnly");

    cookieState.set(
      "satoshilearn-activity",
      JSON.stringify(await response.json()),
    );

    const getResponse = await GET();
    const payload = await getResponse.json();

    expect(payload.lessonCompletions).toEqual([
      {
        lessonSlug: "what-is-money",
        lessonTitle: "What Is Money?",
        completedAt: "2026-03-25T18:00:00.000Z",
      },
    ]);
  });

  it("stores quiz attempts in the fallback cookie payload", async () => {
    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "quiz_attempt",
          lessonSlug: "what-is-money",
          lessonTitle: "What Is Money?",
          correctCount: 3,
          totalQuestions: 3,
          passed: true,
          attemptedAt: "2026-03-25T18:05:00.000Z",
        }),
      }),
    );

    const payload = await response.json();

    expect(payload.quizAttempts).toEqual([
      {
        lessonSlug: "what-is-money",
        lessonTitle: "What Is Money?",
        correctCount: 3,
        totalQuestions: 3,
        passed: true,
        attemptedAt: "2026-03-25T18:05:00.000Z",
      },
    ]);
    expect(payload.conversionEvents).toEqual([]);
  });

  it("stores tutor prompts in the fallback cookie payload", async () => {
    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "tutor_prompt",
          lessonSlug: "ai-tutor",
          lessonTitle: "How does Bitcoin supply work?",
          repliedAt: "2026-03-25T18:10:00.000Z",
          responsePreview: "Bitcoin supply is capped at 21 million.",
          topic: "Bitcoin foundations",
        }),
      }),
    );

    const payload = await response.json();

    expect(payload.tutorPrompts).toEqual([
      {
        prompt: "How does Bitcoin supply work?",
        repliedAt: "2026-03-25T18:10:00.000Z",
        responsePreview: "Bitcoin supply is capped at 21 million.",
        topic: "Bitcoin foundations",
      },
    ]);
    expect(payload.conversionEvents).toEqual([]);
  });

  it("does not insert duplicate tutor prompts for authenticated users", async () => {
    configureSupabaseActivityClient({
      rows: [
        {
          activity_context: "Bitcoin foundations",
          activity_type: "tutor_prompt",
          correct_count: null,
          created_at: "2026-03-25T18:10:00.000Z",
          lesson_slug: "ai-tutor",
          lesson_title: "How does Bitcoin supply work?",
          passed: null,
          response_preview: "Bitcoin supply is capped at 21 million.",
          total_questions: null,
        },
      ],
    });

    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "tutor_prompt",
          lessonSlug: "ai-tutor",
          lessonTitle: "How does Bitcoin supply work?",
          repliedAt: "2026-03-25T18:10:00.000Z",
          responsePreview: "Bitcoin supply is capped at 21 million.",
          topic: "Bitcoin foundations",
        }),
      }),
    );

    expect(insert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      conversionEvents: [],
      lessonCompletions: [],
      quizAttempts: [],
      tutorPrompts: [
        {
          prompt: "How does Bitcoin supply work?",
          repliedAt: "2026-03-25T18:10:00.000Z",
          responsePreview: "Bitcoin supply is capped at 21 million.",
          topic: "Bitcoin foundations",
        },
      ],
    });
  });

  it("stores conversion events in the fallback cookie payload", async () => {
    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "conversion_event",
          eventType: "upgrade_click",
          source: "learn_overview_module_card",
          targetSlug: "advanced-basics",
          targetTitle: "Advanced Basics",
          occurredAt: "2026-03-25T18:15:00.000Z",
          plan: null,
        }),
      }),
    );

    const payload = await response.json();

    expect(payload.conversionEvents).toEqual([
      {
        eventType: "upgrade_click",
        occurredAt: "2026-03-25T18:15:00.000Z",
        plan: null,
        source: "learn_overview_module_card",
        targetSlug: "advanced-basics",
        targetTitle: "Advanced Basics",
      },
    ]);
  });

  it("rejects malformed activity payloads", async () => {
    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid activity payload.",
    });
  });

  it("falls back to cookies for signed-out users even when Supabase is configured", async () => {
    configureSupabaseActivityClient({
      userId: null,
    });

    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "lesson_completion",
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("satoshilearn-activity=");
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        lessonCompletions: [
          expect.objectContaining({
            lessonSlug: "wallet-basics",
            lessonTitle: "Wallet Basics",
          }),
        ],
      }),
    );
  });

  it("persists authenticated activity to Supabase and returns persisted history", async () => {
    configureSupabaseActivityClient({
      rows: [
        {
          activity_context: null,
          activity_type: "lesson_completion",
          correct_count: null,
          created_at: "2026-03-25T18:00:00.000Z",
          lesson_slug: "wallet-basics",
          lesson_title: "Wallet Basics",
          passed: null,
          response_preview: null,
          total_questions: null,
        },
      ],
    });

    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "lesson_completion",
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
          completedAt: "2026-03-25T18:00:00.000Z",
        }),
      }),
    );

    expect(insert).toHaveBeenCalledWith({
      activity_context: null,
      activity_type: "lesson_completion",
      correct_count: null,
      created_at: "2026-03-25T18:00:00.000Z",
      lesson_slug: "wallet-basics",
      lesson_title: "Wallet Basics",
      passed: null,
      response_preview: null,
      total_questions: null,
      user_id: "user-1",
    });
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      conversionEvents: [],
      lessonCompletions: [
        {
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
          completedAt: "2026-03-25T18:00:00.000Z",
        },
      ],
      quizAttempts: [],
      tutorPrompts: [],
    });
  });

  it("falls back to cookies when Supabase writes throw unexpectedly", async () => {
    configureSupabaseActivityClient();
    insert.mockRejectedValue(new Error("network"));

    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "lesson_completion",
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
          completedAt: "2026-03-25T18:00:00.000Z",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("satoshilearn-activity=");
    await expect(response.json()).resolves.toEqual({
      conversionEvents: [],
      lessonCompletions: [
        {
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
          completedAt: "2026-03-25T18:00:00.000Z",
        },
      ],
      quizAttempts: [],
      tutorPrompts: [],
    });
  });

  it("returns existing persisted history instead of inserting duplicate lesson completions", async () => {
    configureSupabaseActivityClient({
      existingCompletion: { id: "activity-1" },
      rows: [
        {
          activity_context: null,
          activity_type: "lesson_completion",
          correct_count: null,
          created_at: "2026-03-25T18:00:00.000Z",
          lesson_slug: "wallet-basics",
          lesson_title: "Wallet Basics",
          passed: null,
          response_preview: null,
          total_questions: null,
        },
      ],
    });

    const { POST } = await import("@/app/api/activity/route");
    const response = await POST(
      new Request("http://localhost/api/activity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "lesson_completion",
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
        }),
      }),
    );

    expect(insert).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      conversionEvents: [],
      lessonCompletions: [
        {
          lessonSlug: "wallet-basics",
          lessonTitle: "Wallet Basics",
          completedAt: "2026-03-25T18:00:00.000Z",
        },
      ],
      quizAttempts: [],
      tutorPrompts: [],
    });
  });
});
