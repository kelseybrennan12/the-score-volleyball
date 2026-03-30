import { expect, test } from "@playwright/test";
import { provisionStarterScenario, signInAsAdmin } from "./helpers/starter";

test("settings smoke shows active auth, environment, and worker details", async ({ context, page }) => {
  const scenario = await provisionStarterScenario(context);

  try {
    await signInAsAdmin(page, "/settings");

    const identityCard = page.locator("article").filter({ hasText: "Identity" });
    const environmentCard = page.locator("article").filter({ hasText: "Environment" });
    const sessionCard = page.locator("article").filter({ hasText: "Session" });
    const workerCard = page.locator("article").filter({ hasText: "Worker schema" });

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(identityCard.getByText("New Local User")).toBeVisible();
    await expect(environmentCard.getByText("local")).toBeVisible();
    await expect(sessionCard.getByText("Active")).toBeVisible();
    await expect(workerCard.getByText("graphile_worker_e2e")).toBeVisible();
    await expect(page.getByText(/Email: new-.*@starter\.local/i)).toBeVisible();
  } finally {
    await scenario.cleanup();
  }
});
