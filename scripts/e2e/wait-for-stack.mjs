const args = process.argv.slice(2);

const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
};

const baseUrl = getArg("--base-url");
const idpUrl = getArg("--idp-url");
const jobsUrl = getArg("--jobs-url");
const timeoutMs = Number.parseInt(getArg("--timeout-ms") ?? "120000", 10);

if (!baseUrl || !idpUrl || !jobsUrl) {
  console.error(
    "usage: node scripts/e2e/wait-for-stack.mjs --base-url <url> --idp-url <url> --jobs-url <url> [--timeout-ms <ms>]",
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const assertOk = async (url) => {
  const response = await fetch(url, {
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
};

const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    await Promise.all([
      assertOk(new URL("/healthz", baseUrl).toString()),
      assertOk(new URL("/_dev/idp/.well-known/openid-configuration", idpUrl).toString()),
      assertOk(new URL("/healthz", jobsUrl).toString()),
    ]);
    process.exit(0);
  } catch {
    await sleep(1_000);
  }
}

console.error(`timed out waiting for e2e stack after ${timeoutMs}ms`);
process.exit(1);
