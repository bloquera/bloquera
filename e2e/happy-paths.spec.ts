import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function getHomeChatPrompt(page: Page) {
  const viewportWidth = page.viewportSize()?.width ?? 1280;

  if (viewportWidth < 768) {
    const mobileLauncher = page.getByRole("button", { name: "Open home chat" });
    await expect(mobileLauncher).toBeVisible();
    await mobileLauncher.click();
    return page.locator("#home-mobile-chat input[placeholder='Ask anything about crypto...']");
  }

  return page.locator("#demo input[placeholder='Ask anything about crypto...']:visible");
}

test.describe("happy paths", () => {
  test("opens the guest home chat demo and renders the tutor reply", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          recordedAt: new Date().toISOString(),
          reply: "Bitcoin is digital money that runs on a public network.",
          topic: "bitcoin",
          usage: {
            limit: 3,
            plan: "free",
            remaining: 2,
            resetAt: Date.now() + 60_000,
          },
        }),
      });
    });

    await page.goto("/");
    const prompt = await getHomeChatPrompt(page);
    await expect(prompt).toBeVisible();
    await prompt.fill("What is Bitcoin?");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(
      page.getByText("Bitcoin is digital money that runs on a public network."),
    ).toBeVisible();
    await expect(page.getByText("What is Bitcoin?")).toBeVisible();
    await expect(
      page.getByText("Guest demo · 2 of 3 questions left"),
    ).toBeVisible();
  });

  test("shows the guest limit conversion state on the fourth signed-out question", async ({ page, baseURL }) => {
    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({
          error: "You have used the guest AI demo for now. Log in to keep chatting.",
          usage: {
            limit: 3,
            plan: "free",
            remaining: 0,
            resetAt: Date.now() + 60_000,
          },
        }),
      });
    });

    await page.context().addCookies([
      {
        name: "bloquera_guest_tutor_id",
        value: "guest-e2e-user",
        url: baseURL ?? "http://127.0.0.1:3100",
      },
      {
        name: "bloquera_guest_tutor_usage",
        value: JSON.stringify({ count: 3 }),
        url: baseURL ?? "http://127.0.0.1:3100",
      },
    ]);

    await page.goto("/");
    const prompt = await getHomeChatPrompt(page);
    await expect(prompt).toBeVisible();

    await prompt.fill("What is self-custody?");
    const chatResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/chat") &&
        response.request().method() === "POST",
    );

    await page.getByRole("button", { name: "Ask" }).click();
    const chatResponse = await chatResponsePromise;
    expect(chatResponse.status()).toBe(429);

    const activeChatRoot = page.locator("#home-mobile-chat:visible, #demo:visible");
    await expect(
      activeChatRoot.getByText("Guest demo · 0 of 3 questions left"),
    ).toBeVisible();
    await expect(activeChatRoot.getByText("Guest demo complete")).toBeVisible();
    await expect(
      activeChatRoot.getByText(
        "Create a free account to unlock 10 tutor questions per day",
      ),
    ).toBeVisible();
    await expect(activeChatRoot.locator('a[href="/auth/register"]').first()).toBeVisible();
    await expect(activeChatRoot.locator('a[href="/auth/login"]').first()).toBeVisible();
  });

  test("navigates into checkout successfully from pricing", async ({ page, baseURL }) => {
    await page.route("**/api/stripe/checkout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          checkoutUrl: `${baseURL}/learn-crypto`,
        }),
      });
    });

    await page.goto("/pricing");
    await page
      .getByRole("button", { name: /Upgrade to Pro|Upgrade to yearly|Choose yearly/ })
      .first()
      .click();

    await page.waitForURL("**/learn-crypto");
    await expect(page).toHaveURL(/\/learn-crypto$/);
  });
});
