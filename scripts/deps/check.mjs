#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";

const DEFAULT_TIMEOUT_MS = 8000;
const USER_AGENT = "project-starter-dependency-currency/1.0";
const FETCH_RETRY_ATTEMPTS = 3;
const FETCH_RETRY_BASE_DELAY_MS = 250;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const packageJson = await readJson("package.json");
  const npmVersions = await collectNpmSurface(packageJson);
  const toolchainVersions = await collectToolchainSurface();
  const containerVersions = await collectContainerSurface();

  const surfaces = [npmVersions, toolchainVersions, containerVersions]
    .map((surface) => ({
      ...surface,
      entries: sortEntries(surface.entries),
    }))
    .sort((a, b) => a.surface.localeCompare(b.surface));

  const summary = summarize(surfaces);
  printCheckSummary(surfaces, summary);
}

function parseArgs(argv) {
  const args = {
    help: false,
  };

  for (const token of argv) {
    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log("Usage: node scripts/deps/check.mjs");
  console.log("  Runs advisory dependency-currency checks and prints a summary.");
}

async function collectNpmSurface(packageJson) {
  const dependencyGroups = [
    ["dependencies", packageJson.dependencies ?? {}],
    ["devDependencies", packageJson.devDependencies ?? {}],
  ];

  const lockfileVersions = await parseRootImporterVersionsFromLockfile("pnpm-lock.yaml");

  const items = [];
  for (const [group, entries] of dependencyGroups) {
    for (const [name, declared] of Object.entries(entries)) {
      const current = lockfileVersions.get(name) ?? normalizeDeclaredVersion(declared);
      items.push({
        name,
        group,
        declared,
        current,
      });
    }
  }

  items.sort((a, b) => a.name.localeCompare(b.name));

  const latestByName = new Map();
  await mapLimit(items, 6, async (item) => {
    const latest = await fetchNpmLatestVersion(item.name);
    latestByName.set(item.name, latest);
  });

  const entries = items.map((item) => {
    const latest = latestByName.get(item.name);
    const status = compareVersions(item.current, latest.version);

    return {
      name: item.name,
      group: item.group,
      declared: item.declared,
      current: item.current,
      latest: latest.version,
      status: latest.error ? "error" : status,
      source: "package.json + pnpm-lock.yaml",
      error: latest.error,
    };
  });

  return {
    surface: "npm",
    source: ["package.json", "pnpm-lock.yaml", "npm registry"],
    entries,
  };
}

async function parseRootImporterVersionsFromLockfile(lockfilePath) {
  const versions = new Map();
  let contents;

  try {
    contents = await readFile(lockfilePath, "utf8");
  } catch {
    return versions;
  }

  const lines = contents.split(/\r?\n/);

  let inImporters = false;
  let inRootImporter = false;
  let currentSection = null;
  let currentPackage = null;

  for (const line of lines) {
    if (!inImporters) {
      if (line.trim() === "importers:") {
        inImporters = true;
      }
      continue;
    }

    if (!inRootImporter) {
      if (line === "  .:") {
        inRootImporter = true;
      } else if (/^  [^\s].*:/.test(line)) {
        break;
      }
      continue;
    }

    if (/^  [^\s].*:/.test(line) && line !== "  .:") {
      break;
    }

    const sectionMatch = line.match(/^    (dependencies|devDependencies):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      currentPackage = null;
      continue;
    }

    if (/^    [^\s].*:/.test(line) && !sectionMatch) {
      currentSection = null;
      currentPackage = null;
      continue;
    }

    if (!currentSection) {
      continue;
    }

    const packageMatch = line.match(/^      (".*?"|[^:]+):\s*$/);
    if (packageMatch) {
      currentPackage = packageMatch[1].replace(/^"|"$/g, "");
      continue;
    }

    const versionMatch = line.match(/^        version:\s+(.+)$/);
    if (versionMatch && currentPackage) {
      const normalizedVersion = normalizeResolvedVersion(versionMatch[1]);
      versions.set(currentPackage, normalizedVersion);
    }
  }

  return versions;
}

function normalizeResolvedVersion(versionField) {
  const unquoted = versionField.replace(/^"|"$/g, "").trim();
  return unquoted.split("(")[0].trim();
}

function normalizeDeclaredVersion(version) {
  const normalized = String(version ?? "").trim();
  return normalized.replace(/^[~^><=\s]*/, "");
}

async function fetchNpmLatestVersion(packageName) {
  const encodedName = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encodedName}/latest`;

  try {
    const body = await fetchJson(url);
    return {
      version: typeof body.version === "string" ? body.version : null,
      error: null,
    };
  } catch (error) {
    return {
      version: null,
      error: formatError(error),
    };
  }
}

async function collectToolchainSurface() {
  const tools = await parseMiseTools("mise.toml");
  const entries = [];

  const sortedTools = [...tools.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [tool, configured] of sortedTools) {
    const latest = runCommand("mise", ["latest", tool]);
    const active = detectActiveToolVersion(tool);

    const current = active ?? normalizeDeclaredVersion(configured);
    const treatLatestSpecifierAsUpToDate = configured === "latest" && !active;
    const status = latest.error ? "error" : compareVersions(current, latest.value, treatLatestSpecifierAsUpToDate);

    entries.push({
      name: tool,
      configured,
      active,
      current,
      latest: latest.value,
      status,
      source: "mise.toml + mise latest",
      error: latest.error,
    });
  }

  const miseCurrent = detectMiseVersion();
  const miseLatest = await fetchLatestMiseVersion();
  entries.push({
    name: "mise",
    configured: "system",
    active: miseCurrent,
    current: miseCurrent,
    latest: miseLatest.version,
    status: miseLatest.error ? "error" : compareVersions(miseCurrent, miseLatest.version),
    source: "mise --version + GitHub releases API",
    error: miseLatest.error,
  });

  return {
    surface: "toolchain",
    source: ["mise.toml", "mise latest", "active runtime binaries", "mise --version", "GitHub releases API"],
    entries,
  };
}

async function parseMiseTools(miseTomlPath) {
  const tools = new Map();
  const contents = await readFile(miseTomlPath, "utf8");
  const lines = contents.split(/\r?\n/);

  let inTools = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      inTools = line === "[tools]";
      continue;
    }

    if (!inTools) {
      continue;
    }

    const match = rawLine.match(/^([a-zA-Z0-9_.-]+)\s*=\s*(.+)$/);
    if (!match) {
      continue;
    }

    const tool = match[1].trim();
    const value = match[2].trim().replace(/^"|"$/g, "");
    tools.set(tool, value);
  }

  return tools;
}

function detectActiveToolVersion(tool) {
  const binaryByTool = {
    node: "node",
    pnpm: "pnpm",
  };

  const binary = binaryByTool[tool];
  if (!binary) {
    return null;
  }

  const result = runCommand(binary, ["-v"]);
  if (result.error || !result.value) {
    return null;
  }

  return result.value.replace(/^v/, "");
}

function detectMiseVersion() {
  const result = runCommand("mise", ["--version"]);
  if (result.error || !result.value) {
    return null;
  }

  const match = result.value.match(/^([0-9][0-9A-Za-z._-]*)/);
  if (!match) {
    return null;
  }

  return match[1];
}

async function fetchLatestMiseVersion() {
  const url = "https://api.github.com/repos/jdx/mise/releases/latest";

  try {
    const body = await fetchJson(url);
    const tagName = typeof body.tag_name === "string" ? body.tag_name : null;
    const normalized = tagName ? tagName.replace(/^v/, "") : null;
    return {
      version: normalized,
      error: null,
    };
  } catch (error) {
    return {
      version: null,
      error: formatError(error),
    };
  }
}

async function collectContainerSurface() {
  const composeImages = await parseComposeImages("infra/docker/docker-compose.yml");
  const dockerfileImages = await parseDockerfileFromImages("infra/docker");

  const imageRefs = [...new Set([...composeImages, ...dockerfileImages])].sort((a, b) => a.localeCompare(b));

  const entries = [];
  await mapLimit(imageRefs, 4, async (ref) => {
    const metadata = parseContainerImageRef(ref);

    const latest = await fetchLatestCompatibleContainerTag(metadata);
    const status = latest.error ? "error" : compareVersions(metadata.tag, latest.tag);

    entries.push({
      name: ref,
      repository: metadata.repository,
      current: metadata.tag,
      latest: latest.tag,
      status,
      source: "docker compose / Dockerfiles + registry metadata",
      error: latest.error,
    });
  });

  return {
    surface: "container",
    source: ["infra/docker/docker-compose.yml", "infra/docker/Dockerfile*", "Docker Hub API"],
    entries,
  };
}

async function parseComposeImages(composePath) {
  const contents = await readFile(composePath, "utf8");
  const images = [];

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*image:\s*([^\s#]+)\s*$/);
    if (match) {
      images.push(match[1]);
    }
  }

  return images;
}

async function parseDockerfileFromImages(dockerDirPath) {
  const entries = await readdir(dockerDirPath, { withFileTypes: true });
  const dockerfiles = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith("Dockerfile"))
    .map((entry) => `${dockerDirPath}/${entry.name}`)
    .sort((a, b) => a.localeCompare(b));

  const refs = [];

  for (const dockerfilePath of dockerfiles) {
    const contents = await readFile(dockerfilePath, "utf8");
    const stageAliases = new Set();
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*FROM(?:\s+--[^\s=]+(?:=[^\s]+)?)*\s+([^\s]+)(?:\s+AS\s+([A-Za-z0-9._-]+))?\s*$/i);
      if (match) {
        const fromRef = match[1];
        const stageAlias = match[2];

        if (!isDockerfileStageReference(fromRef, stageAliases)) {
          refs.push(fromRef);
        }

        if (stageAlias) {
          stageAliases.add(stageAlias.toLowerCase());
        }
      }
    }
  }

  return refs;
}

function isDockerfileStageReference(fromRef, stageAliases) {
  if (/^\d+$/.test(fromRef)) {
    return true;
  }

  return stageAliases.has(fromRef.toLowerCase());
}

function parseContainerImageRef(ref) {
  const withoutDigest = ref.split("@")[0];
  const slashIndex = withoutDigest.lastIndexOf("/");
  const colonIndex = withoutDigest.lastIndexOf(":");

  const hasTag = colonIndex > slashIndex;
  const imageName = hasTag ? withoutDigest.slice(0, colonIndex) : withoutDigest;
  const tag = hasTag ? withoutDigest.slice(colonIndex + 1) : "latest";

  const parts = imageName.split("/");
  const firstSegment = parts[0];
  const hasRegistryPrefix = firstSegment.includes(".") || firstSegment.includes(":") || firstSegment === "localhost";

  const registry = hasRegistryPrefix ? firstSegment : "docker.io";

  let repository;
  if (hasRegistryPrefix) {
    repository = parts.slice(1).join("/");
  } else if (parts.length === 1) {
    repository = `library/${parts[0]}`;
  } else {
    repository = parts.join("/");
  }

  return {
    registry,
    repository,
    tag,
  };
}

async function fetchLatestCompatibleContainerTag(metadata) {
  if (metadata.registry === "docker.io") {
    return fetchLatestCompatibleDockerHubTag(metadata.repository, metadata.tag);
  }

  if (metadata.registry === "mcr.microsoft.com") {
    return fetchLatestCompatibleMcrTag(metadata.repository, metadata.tag);
  }

  return {
    tag: null,
    error: `Unsupported registry: ${metadata.registry}`,
  };
}

async function fetchLatestCompatibleDockerHubTag(repository, currentTag) {
  try {
    const tags = await fetchDockerHubTags(repository, currentTag);
    if (tags.length === 0) {
      return {
        tag: null,
        error: "No registry tags resolved",
      };
    }

    const best = pickBestCompatibleTag(currentTag, tags);
    if (!best) {
      return {
        tag: null,
        error: "No compatible tag found",
      };
    }

    return {
      tag: best,
      error: null,
    };
  } catch (error) {
    return {
      tag: null,
      error: formatError(error),
    };
  }
}

async function fetchDockerHubTags(repository, currentTag) {
  const searchName = currentTag.split("-")[0];
  const filteredTags = await fetchDockerHubTagsPages(repository, searchName);
  if (filteredTags.length > 0) {
    return filteredTags;
  }

  return fetchDockerHubTagsPages(repository, null);
}

async function fetchDockerHubTagsPages(repository, searchName) {
  const dockerHubApiBases = [
    "https://registry.hub.docker.com/v2/repositories",
    "https://hub.docker.com/v2/repositories",
  ];

  let lastError = null;
  for (const apiBase of dockerHubApiBases) {
    try {
      return await fetchDockerHubTagsFromBase(apiBase, repository, searchName);
    } catch (error) {
      lastError = error;
      const statusCode = parseHttpStatusCode(formatError(error));
      if (statusCode === 404) {
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error(`Unable to resolve Docker Hub tags for ${repository}`);
}

async function fetchDockerHubTagsFromBase(apiBase, repository, searchName) {
  const tags = new Set();
  const repositoryPath = encodeRegistryRepositoryPath(repository);

  for (let page = 1; page <= 5; page += 1) {
    const nameFilter = searchName ? `&name=${encodeURIComponent(searchName)}` : "";
    const url = `${apiBase}/${repositoryPath}/tags?page_size=100&page=${page}${nameFilter}`;

    const body = await fetchJson(url);
    const results = Array.isArray(body.results) ? body.results : [];

    for (const result of results) {
      if (typeof result.name === "string") {
        tags.add(result.name);
      }
    }

    if (!body.next) {
      break;
    }
  }

  return [...tags];
}

async function fetchLatestCompatibleMcrTag(repository, currentTag) {
  try {
    const tags = await fetchMcrTags(repository);
    if (tags.length === 0) {
      return {
        tag: null,
        error: "No registry tags resolved",
      };
    }

    const best = pickBestCompatibleTag(currentTag, tags);
    if (!best) {
      return {
        tag: null,
        error: "No compatible tag found",
      };
    }

    return {
      tag: best,
      error: null,
    };
  } catch (error) {
    return {
      tag: null,
      error: formatError(error),
    };
  }
}

async function fetchMcrTags(repository) {
  const repositoryPath = encodeRegistryRepositoryPath(repository);
  const url = `https://mcr.microsoft.com/v2/${repositoryPath}/tags/list`;
  const body = await fetchJson(url);
  const tags = Array.isArray(body.tags) ? body.tags : [];

  return tags.filter((tag) => typeof tag === "string");
}

function encodeRegistryRepositoryPath(repository) {
  return String(repository)
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function pickBestCompatibleTag(currentTag, tags) {
  const current = parseVersionLikeTag(currentTag);
  if (!current) {
    return tags.includes(currentTag) ? currentTag : null;
  }

  const candidates = [];
  const exactSuffixCandidates = [];

  for (const tag of tags) {
    const parsed = parseVersionLikeTag(tag);
    if (!parsed) {
      continue;
    }

    if (parsed.major !== current.major) {
      continue;
    }

    if (current.suffix && parsed.suffix && !parsed.suffix.startsWith(current.suffix)) {
      continue;
    }

    if (current.suffix && !parsed.suffix) {
      continue;
    }

    const candidate = { tag, parsed };
    candidates.push(candidate);
    if (parsed.suffix === current.suffix) {
      exactSuffixCandidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return tags.includes(currentTag) ? currentTag : null;
  }

  const preferredCandidates = exactSuffixCandidates.length > 0 ? exactSuffixCandidates : candidates;
  preferredCandidates.sort((a, b) => compareParsedVersions(a.parsed, b.parsed));
  return preferredCandidates[preferredCandidates.length - 1].tag;
}

function compareVersions(current, latest, treatLatestSpecifierAsUpToDate = false) {
  if (!latest) {
    return "unknown";
  }

  if (treatLatestSpecifierAsUpToDate) {
    return "up_to_date";
  }

  if (current === latest) {
    return "up_to_date";
  }

  const currentParsed = parseVersionLikeTag(String(current));
  const latestParsed = parseVersionLikeTag(String(latest));

  if (!currentParsed || !latestParsed) {
    return "unknown";
  }

  const comparison = compareParsedVersions(currentParsed, latestParsed);
  if (comparison < 0) {
    return "behind";
  }

  return "up_to_date";
}

function parseVersionLikeTag(input) {
  const value = String(input ?? "").trim();

  const majorSuffixMatch = value.match(/^v?(\d+)(-[0-9A-Za-z._-]+)$/);
  if (majorSuffixMatch) {
    return {
      major: Number(majorSuffixMatch[1]),
      minor: 0,
      patch: 0,
      suffix: majorSuffixMatch[2],
    };
  }

  const semverMatch = value.match(/^v?(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z._-]+)?$/);
  if (!semverMatch) {
    return null;
  }

  return {
    major: Number(semverMatch[1]),
    minor: Number(semverMatch[2]),
    patch: Number(semverMatch[3]),
    suffix: semverMatch[4] ?? "",
  };
}

function compareParsedVersions(a, b) {
  if (a.major !== b.major) {
    return a.major - b.major;
  }

  if (a.minor !== b.minor) {
    return a.minor - b.minor;
  }

  if (a.patch !== b.patch) {
    return a.patch - b.patch;
  }

  if (a.suffix === b.suffix) {
    return 0;
  }

  if (!a.suffix) {
    return 1;
  }

  if (!b.suffix) {
    return -1;
  }

  return a.suffix.localeCompare(b.suffix);
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name));
}

function summarize(surfaces) {
  const summary = {
    total_entries: 0,
    by_surface: {},
    by_status: {},
  };

  for (const surface of surfaces) {
    const surfaceCounts = {};

    for (const entry of surface.entries) {
      summary.total_entries += 1;
      const status = entry.status ?? "unknown";
      surfaceCounts[status] = (surfaceCounts[status] ?? 0) + 1;
      summary.by_status[status] = (summary.by_status[status] ?? 0) + 1;
    }

    summary.by_surface[surface.surface] = {
      total: surface.entries.length,
      ...surfaceCounts,
    };
  }

  return summary;
}

function printCheckSummary(surfaces, summary) {
  console.log("Dependency currency advisory summary");
  console.log(`Total dependencies checked: ${summary.total_entries}`);

  const orderedStatuses = ["behind", "up_to_date", "unknown", "error"];
  for (const status of orderedStatuses) {
    const count = summary.by_status[status] ?? 0;
    console.log(`- ${status}: ${count}`);
  }

  for (const surface of surfaces) {
    console.log(`\n[${surface.surface}]`);
    let hasFindings = false;
    for (const entry of surface.entries) {
      if (entry.status === "behind" || entry.status === "error" || entry.status === "unknown") {
        hasFindings = true;
        const latest = entry.latest ?? "unknown";
        const error = entry.error ? ` (${entry.error})` : "";
        console.log(`- ${entry.name}: ${entry.current} -> ${latest} [${entry.status}]${error}`);
      }
    }

    if (!hasFindings) {
      console.log("- all up_to_date");
    }
  }
}

async function mapLimit(items, limit, mapper) {
  const workers = [];
  const queue = [...items];

  for (let workerIndex = 0; workerIndex < limit; workerIndex += 1) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) {
            return;
          }
          await mapper(item);
        }
      })(),
    );
  }

  await Promise.all(workers);
}

async function fetchJson(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= FETCH_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await fetchJsonOnce(url);
    } catch (error) {
      lastError = error;

      if (!isRetryableFetchError(error) || attempt === FETCH_RETRY_ATTEMPTS) {
        throw error;
      }

      const delayMs = FETCH_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function fetchJsonOnce(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableFetchError(error) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const statusCode = parseHttpStatusCode(error.message);
  if (statusCode !== null) {
    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
  }

  const message = error.message.toLowerCase();
  return message.includes("fetch failed") || message.includes("network") || message.includes("aborted");
}

function parseHttpStatusCode(message) {
  const match = String(message ?? "").match(/^HTTP\s+(\d{3})\b/);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function runCommand(command, args) {
  try {
    const stdout = execFileSync(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    }).trim();

    return { value: stdout, error: null };
  } catch (error) {
    return {
      value: null,
      error: formatError(error),
    };
  }
}

function readJson(filePath) {
  return readFile(filePath, "utf8").then((contents) => JSON.parse(contents));
}

function formatError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
