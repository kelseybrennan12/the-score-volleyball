import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_ROUTES_FILE = path.join(dirname, "routes.json");
const DEFAULT_OUTPUT_DIR = "artifacts/visual-parity/latest";
const DEFAULT_APP_BASE_URL = "http://localhost:8080";
const DEFAULT_FIGMA_BASE_URL = "http://localhost:4173";
const DEFAULT_VIEWPORT = "1728x1117";
const DEFAULT_WAIT_MS = 900;
const DEFAULT_TIMEOUT_MS = 60_000;

const disableMotionCss = `
*,
*::before,
*::after {
  transition: none !important;
  animation: none !important;
  caret-color: transparent !important;
}
`;

const env = process.env;

const loadPlaywrightChromium = async () => {
  try {
    const module = await import("playwright");
    return module.chromium;
  } catch {
    // Fallback for environments that install Playwright outside the workspace tree.
  }

  const explicitModulePath = env.VISUAL_PARITY_PLAYWRIGHT_MODULE;
  if (explicitModulePath && explicitModulePath.trim().length > 0) {
    const moduleUrl = pathToFileURL(path.resolve(explicitModulePath)).toString();
    const module = await import(moduleUrl);
    return module.chromium;
  }

  throw new Error(
    "Playwright runtime is not available. Install `playwright` or set VISUAL_PARITY_PLAYWRIGHT_MODULE to an absolute module path.",
  );
};

const parseViewport = (raw) => {
  const match = /^(\d+)x(\d+)$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid VISUAL_PARITY_VIEWPORT "${raw}". Expected WIDTHxHEIGHT.`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
};

const normalizeBaseUrl = (value) => new URL(value).toString().replace(/\/$/, "");

const buildTargetUrl = (baseUrl, routePath) => new URL(routePath, `${normalizeBaseUrl(baseUrl)}/`).toString();

const ensureDir = async (targetPath) => {
  await fs.mkdir(targetPath, { recursive: true });
};

const readJson = async (targetPath) => JSON.parse(await fs.readFile(targetPath, "utf8"));

const clickLabels = async (page, labels, timeoutMs) => {
  for (const label of labels ?? []) {
    const locator = page.getByText(label, { exact: true }).first();
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    await locator.click();
  }
};

const writeReport = async (outputDir, routes) => {
  const lines = [
    "# Visual Parity Report",
    "",
    "| Route | Status | Figma | App | Notes |",
    "| --- | --- | --- | --- | --- |",
  ];

  for (const route of routes) {
    const figmaCell = route.figmaShot ? `[figma](${path.basename(route.figmaShot)})` : "n/a";
    const appCell = route.appShot ? `[app](${path.basename(route.appShot)})` : "n/a";
    const notes = route.notes?.join(" ; ") ?? "";
    lines.push(`| ${route.label} | ${route.status} | ${figmaCell} | ${appCell} | ${notes} |`);
  }

  lines.push("");
  await fs.writeFile(path.join(outputDir, "report.md"), `${lines.join("\n")}\n`);
};

const captureSide = async ({ context, baseUrl, routePath, clickSequence, outputPath, viewport, waitMs, timeoutMs }) => {
  const page = await context.newPage();

  try {
    await page.setViewportSize(viewport);
    await page.addStyleTag({ content: disableMotionCss });
    await page.goto(buildTargetUrl(baseUrl, routePath), { waitUntil: "networkidle", timeout: timeoutMs });
    await clickLabels(page, clickSequence, timeoutMs);
    await page.waitForTimeout(waitMs);
    await page.screenshot({ path: outputPath, fullPage: true });
  } finally {
    await page.close();
  }
};

async function main() {
  const chromium = await loadPlaywrightChromium();
  const viewport = parseViewport(env.VISUAL_PARITY_VIEWPORT ?? DEFAULT_VIEWPORT);
  const waitMs = Number(env.VISUAL_PARITY_WAIT_MS ?? DEFAULT_WAIT_MS);
  const timeoutMs = Number(env.VISUAL_PARITY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const routesFile = path.resolve(env.VISUAL_PARITY_ROUTES_FILE ?? DEFAULT_ROUTES_FILE);
  const outputDir = path.resolve(env.VISUAL_PARITY_OUTPUT_DIR ?? DEFAULT_OUTPUT_DIR);
  const appBaseUrl = env.VISUAL_PARITY_APP_BASE_URL ?? DEFAULT_APP_BASE_URL;
  const figmaBaseUrl = env.VISUAL_PARITY_FIGMA_BASE_URL ?? DEFAULT_FIGMA_BASE_URL;
  const storageState = env.VISUAL_PARITY_STORAGE_STATE ? path.resolve(env.VISUAL_PARITY_STORAGE_STATE) : undefined;
  const routes = await readJson(routesFile);

  await fs.rm(outputDir, { recursive: true, force: true });
  await ensureDir(outputDir);

  const browser = await chromium.launch({ headless: true });

  try {
    const figmaContext = await browser.newContext({ viewport });
    const appContext = await browser.newContext({
      viewport,
      ...(storageState ? { storageState } : {}),
    });

    for (const route of routes) {
      route.notes = [];
      route.status = "ok";
      route.figmaShot = path.join(outputDir, `${route.id}.figma.png`);
      route.appShot = path.join(outputDir, `${route.id}.app.png`);

      try {
        await captureSide({
          context: figmaContext,
          baseUrl: figmaBaseUrl,
          routePath: route.figmaPath,
          clickSequence: route.figmaClickLabels,
          outputPath: route.figmaShot,
          viewport,
          waitMs,
          timeoutMs,
        });
      } catch (error) {
        route.status = "failed";
        route.notes.push(`figma: ${error instanceof Error ? error.message : String(error)}`);
        route.figmaShot = null;
      }

      try {
        await captureSide({
          context: appContext,
          baseUrl: appBaseUrl,
          routePath: route.appPath,
          clickSequence: route.appClickLabels,
          outputPath: route.appShot,
          viewport,
          waitMs,
          timeoutMs,
        });
      } catch (error) {
        route.status = "failed";
        route.notes.push(`app: ${error instanceof Error ? error.message : String(error)}`);
        route.appShot = null;
      }
    }

    await figmaContext.close();
    await appContext.close();
    await writeReport(outputDir, routes);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exitCode = 1;
});
