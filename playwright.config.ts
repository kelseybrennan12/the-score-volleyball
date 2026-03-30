import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const artifactsDir = process.env.PLAYWRIGHT_ARTIFACTS_DIR ?? "artifacts/e2e";
const headless = process.env.PLAYWRIGHT_HEADLESS !== "false";
const configuredWorkers = process.env.PLAYWRIGHT_WORKERS?.trim();
const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "src/tests/e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  timeout: ci ? 120_000 : 30_000,
  expect: {
    timeout: ci ? 30_000 : 15_000,
  },
  workers: configuredWorkers ? Number(configuredWorkers) : 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: path.join(artifactsDir, "html-report"),
      },
    ],
  ],
  outputDir: path.join(artifactsDir, "test-results"),
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${process.env.E2E_WEB_PORT ?? "3202"}`,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    headless,
    ...(process.env.PLAYWRIGHT_SLOW_MO ? { launchOptions: { slowMo: Number(process.env.PLAYWRIGHT_SLOW_MO) } } : {}),
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
