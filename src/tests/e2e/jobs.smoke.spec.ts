import { expect, test } from "@playwright/test";
import { provisionStarterScenario, signInAsAdmin } from "./helpers/starter";

test("jobs smoke enqueues an example job and shows the queued run", async ({ context, page }) => {
  const scenario = await provisionStarterScenario(context);

  try {
    await scenario.clearExampleJobs();
    await signInAsAdmin(page, "/jobs");

    const mutationCard = page.locator("article").filter({ hasText: "Mutation path" });

    await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
    await expect(page.getByText("Graphile", { exact: true })).toBeVisible();
    await expect(page.getByText("example.db_ping")).toBeVisible();
    await expect(mutationCard.getByText("Ready")).toBeVisible();

    const enqueueResponsePromise = page.waitForResponse((response) => {
      return response.url().includes("/trpc/jobs.enqueueExample") && response.request().method() === "POST";
    });
    const listRunsRefreshPromise = page.waitForResponse((response) => {
      return response.url().includes("/trpc/jobs.listRuns") && response.ok();
    });

    await page.getByRole("button", { name: "Enqueue example job" }).click();
    expect((await enqueueResponsePromise).ok()).toBe(true);
    expect((await listRunsRefreshPromise).ok()).toBe(true);
    await expect(page.getByRole("button", { name: "Enqueue example job" })).toBeVisible();
    await expect(mutationCard.getByText("Ready")).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { name: "Jobs" })).toBeVisible();
    await expect(page.getByText("example.db_ping")).toBeVisible();
    await expect(mutationCard.getByText("Ready")).toBeVisible();
  } finally {
    await scenario.cleanup();
  }
});
