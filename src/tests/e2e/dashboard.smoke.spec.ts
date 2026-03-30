import { expect, test } from "@playwright/test";
import { expectPrimaryNavigation, provisionStarterScenario, signInAsAdmin } from "./helpers/starter";

test("dashboard smoke shows starter health, db, job, and auth signals", async ({ context, page }) => {
  const scenario = await provisionStarterScenario(context);

  try {
    await signInAsAdmin(page, "/dashboard");

    await expectPrimaryNavigation(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: /PROJECT STARTER Local/i })).toBeVisible();

    const healthCard = page.locator("article").filter({ hasText: "API health" });
    const roleCard = page.locator("article").filter({ hasText: "Signed-in role" });

    await expect(healthCard.getByText("OK")).toBeVisible();
    await expect(roleCard.getByText("admin")).toBeVisible();
    await expect(page.getByText(/Health route: api is ok\./i)).toBeVisible();
    await expect(page.getByText(new RegExp(`Database target: .* / ${scenario.schemaName}\\.`))).toBeVisible();
    await expect(page.getByText(/Session context: new-.*@starter\.local/i)).toBeVisible();
  } finally {
    await scenario.cleanup();
  }
});
