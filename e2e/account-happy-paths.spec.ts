import { expect, test } from "@playwright/test";

test.describe("account happy paths", () => {
  test("saves profile details successfully", async ({ page }) => {
    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            id: "e2e-profile-id",
            email: "learner@bloquera.dev",
            display_name: "Nakamoto Path",
            avatar_url:
              "https://images.unsplash.com/photo-1511367461989-f85a21fda167?auto=format&fit=crop&w=200&q=80",
            bio: "Working through the Bitcoin curriculum at a steady pace.",
            timezone: "America/New_York",
            created_at: "2025-01-15T10:00:00.000Z",
          },
        }),
      });
    });

    await page.goto("/profiles");
    await page.getByLabel("Display name").fill("Nakamoto Path");
    await page.getByLabel("Bio").fill(
      "Working through the Bitcoin curriculum at a steady pace.",
    );
    await page.getByLabel("Timezone").selectOption("America/New_York");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("Profile updated.")).toBeVisible();
    await expect(page.getByText("Current display name")).toBeVisible();
    await expect(page.getByText("Nakamoto Path")).toBeVisible();
    await expect(page.getByLabel("Timezone")).toHaveValue("America/New_York");
  });

  test("uploads a new avatar and saves the profile", async ({ page }) => {
    let avatarUploadCalled = false;

    await page.route("**/api/profile/avatar", async (route) => {
      avatarUploadCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          avatarUrl: "https://example.com/avatar-uploaded.png",
          path: "e2e-profile-id/avatar-uploaded.png",
        }),
      });
    });

    await page.route("**/api/profile", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          profile: {
            id: "e2e-profile-id",
            email: "learner@bloquera.dev",
            display_name: "Satoshi Learner",
            avatar_url: "https://example.com/avatar-uploaded.png",
            bio: "Learning Bitcoin one clear step at a time.",
            timezone: "Europe/London",
            created_at: "2025-01-15T10:00:00.000Z",
          },
        }),
      });
    });

    await page.goto("/profiles");
    const profileDetailsSection = page
      .locator("section")
      .filter({ has: page.getByText("Profile details", { exact: true }) })
      .first();
    const avatarInput = page.getByLabel("Avatar image");
    await avatarInput.setInputFiles({
      name: "avatar.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    await expect
      .poll(async () =>
        avatarInput.evaluate(
          (input) =>
            (input as HTMLInputElement).files?.[0]?.name ?? null,
        ),
      )
      .toBe("avatar.png");
    const saveButton = profileDetailsSection.locator('button[type="submit"]').first();
    await expect(profileDetailsSection).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await expect(page.getByText("Profile updated.")).toBeVisible();
    expect(avatarUploadCalled).toBe(true);
  });

  test("opens the billing portal successfully", async ({ page, baseURL }) => {
    await page.route("**/api/stripe/portal", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          portalUrl: `${baseURL}/learn-crypto`,
        }),
      });
    });

    await page.goto("/purchases");
    await page.getByRole("tab", { name: "Billings" }).click();
    await page.getByRole("button", { name: "Manage billing" }).click();

    await page.waitForURL("**/learn-crypto");
    await expect(page).toHaveURL(/\/learn-crypto$/);
  });
});
