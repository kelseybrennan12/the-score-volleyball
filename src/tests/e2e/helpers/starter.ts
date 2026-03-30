import { expect, type BrowserContext, type Page } from "@playwright/test";
import { createIsolatedStarterSchema } from "../../support/starter-test-runtime";

const baseUrl = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3202");
const idpBaseUrl = new URL(process.env.PLAYWRIGHT_IDP_BASE_URL ?? "http://localhost:3203");
const schemaCookieName = process.env.APP_E2E_SCHEMA_COOKIE_NAME?.trim() || "project-starter-e2e-schema";

const setScenarioCookies = async (context: BrowserContext, schemaName: string): Promise<void> => {
  await context.addCookies([
    {
      name: schemaCookieName,
      value: schemaName,
      url: baseUrl.origin,
    },
    {
      name: schemaCookieName,
      value: schemaName,
      url: idpBaseUrl.origin,
    },
  ]);
};

export interface E2eScenarioHandle {
  schemaName: string;
  clearExampleJobs(): Promise<void>;
  countExampleJobs(): Promise<number>;
  cleanup(): Promise<void>;
}

export const provisionStarterScenario = async (context: BrowserContext): Promise<E2eScenarioHandle> => {
  const appSchema = await createIsolatedStarterSchema("e2e");
  await setScenarioCookies(context, appSchema.schemaName);

  return {
    schemaName: appSchema.schemaName,
    clearExampleJobs: appSchema.clearExampleJobs,
    countExampleJobs: appSchema.countExampleJobs,
    cleanup: appSchema.destroy,
  };
};

export const signInAsAdmin = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Sign In Required" })).toBeVisible();
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Local OIDC Login" })).toBeVisible();
  await page.getByRole("button", { name: "New User (admin group)" }).click();
  await expect(page.getByRole("navigation", { name: "Primary Navigation" })).toBeVisible();

  if (new URL(page.url()).pathname !== path) {
    await page.goto(path);
  }

  await expect(page).toHaveURL(new RegExp(`${path.replace("/", "\\/")}$`));
};

export const expectPrimaryNavigation = async (page: Page): Promise<void> => {
  await expect(page.getByRole("navigation", { name: "Primary Navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Database" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Jobs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
};
