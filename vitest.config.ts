import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const srcRoot = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^backend\/(.*)$/, replacement: `${srcRoot}backend/$1` },
      { find: /^frontend\/(.*)$/, replacement: `${srcRoot}frontend/$1` },
      { find: /^@frontend\/(.*)$/, replacement: `${srcRoot}frontend/$1` },
    ],
  },
  test: {
    environment: "node",
    exclude: ["src/tests/e2e/**"],
  },
});
