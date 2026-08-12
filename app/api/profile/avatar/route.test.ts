const getUser = vi.fn();
const upload = vi.fn();
const getPublicUrl = vi.fn();
const remove = vi.fn();
const from = vi.fn();
const createServerSupabaseClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => createServerSupabaseClient(),
}));

describe("profile avatar route", () => {
  beforeEach(() => {
    getUser.mockReset();
    upload.mockReset();
    getPublicUrl.mockReset();
    remove.mockReset();
    from.mockReset();
    createServerSupabaseClient.mockReset();

    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getUser,
      },
      storage: {
        from,
      },
    });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
        },
      },
    });
    from.mockReturnValue({
      upload,
      getPublicUrl,
      remove,
    });
    upload.mockResolvedValue({ error: null });
    remove.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({
      data: {
        publicUrl:
          "https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png",
      },
    });
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-key");
  });

  it("requires an authenticated user", async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    });

    const { POST } = await import("@/app/api/profile/avatar/route");
    const formData = new FormData();
    formData.set("file", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const response = await POST({
      formData: async () => formData,
    } as Request);

    expect(response.status).toBe(401);
  });

  it("rejects unsupported file types", async () => {
    const { POST } = await import("@/app/api/profile/avatar/route");
    const formData = new FormData();
    formData.set("file", new File(["avatar"], "avatar.gif", { type: "image/gif" }));

    const response = await POST({
      formData: async () => formData,
    } as Request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Avatar images must be JPG, PNG, or WebP.",
    });
  });

  it("uploads an allowed avatar image", async () => {
    const { POST } = await import("@/app/api/profile/avatar/route");
    const formData = new FormData();
    formData.set("file", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const response = await POST({
      formData: async () => formData,
    } as Request);

    expect(from).toHaveBeenCalledWith("avatars");
    expect(upload).toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      avatarUrl:
        "https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png",
      path: expect.stringContaining("user-1/"),
    });
  });

  it("rejects malformed avatar removal payloads", async () => {
    const { DELETE } = await import("@/app/api/profile/avatar/route");

    const response = await DELETE(
      new Request("http://localhost/api/profile/avatar", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{not-json",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Send a valid avatar removal body.",
    });
  });

  it("returns a service-unavailable response when avatar upload throws", async () => {
    upload.mockRejectedValue(new Error("network"));
    const { POST } = await import("@/app/api/profile/avatar/route");
    const formData = new FormData();
    formData.set("file", new File(["avatar"], "avatar.png", { type: "image/png" }));

    const response = await POST({
      formData: async () => formData,
    } as Request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Unable to upload your avatar right now.",
    });
  });

  it("removes an owned avatar image", async () => {
    const { DELETE } = await import("@/app/api/profile/avatar/route");

    const response = await DELETE(
      new Request("http://localhost/api/profile/avatar", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl:
            "https://project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png",
        }),
      }),
    );

    expect(from).toHaveBeenCalledWith("avatars");
    expect(remove).toHaveBeenCalledWith(["user-1/avatar.png"]);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ removed: true });
  });

  it("rejects avatar URLs from a different Supabase project", async () => {
    const { DELETE } = await import("@/app/api/profile/avatar/route");

    const response = await DELETE(
      new Request("http://localhost/api/profile/avatar", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatarUrl:
            "https://other-project.supabase.co/storage/v1/object/public/avatars/user-1/avatar.png",
        }),
      }),
    );

    expect(remove).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "That avatar does not belong to this account.",
    });
  });
});
