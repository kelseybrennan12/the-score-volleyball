import { expect, test } from "@playwright/test";
import { provisionStarterScenario, signInAsAdmin } from "./helpers/starter";

test("database smoke exposes starter-safe metadata and system tables", async ({ context, page }) => {
  const scenario = await provisionStarterScenario(context);

  try {
    await signInAsAdmin(page, "/database");

    await expect(page.getByRole("heading", { name: "Database", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter-safe checks" })).toBeVisible();
    await expect(page.getByText("current_database() / current_schema()")).toBeVisible();
    await expect(page.getByText("information_schema table discovery")).toBeVisible();
    await expect(page.getByText(scenario.schemaName, { exact: true })).toBeVisible();
    await expect(page.getByText(`${scenario.schemaName}.system_users`)).toBeVisible();
    await expect(page.getByText(`${scenario.schemaName}.system_auth_sessions`)).toBeVisible();
    await expect(page.getByText(`${scenario.schemaName}.system_auth_login_states`)).toBeVisible();
  } finally {
    await scenario.cleanup();
  }
});
