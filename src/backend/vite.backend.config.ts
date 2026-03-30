import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import packageJson from "../../package.json";

const backendRoot = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

const builtinExternals = [...builtinModules, ...builtinModules.map((mod) => `node:${mod}`)];

const entries = {
  "api.entry": fileURLToPath(new URL("./api.entry.ts", import.meta.url)),
  "db-bootstrap.entry": fileURLToPath(new URL("./db-bootstrap.entry.ts", import.meta.url)),
  "worker.entry": fileURLToPath(new URL("./worker.entry.ts", import.meta.url)),
  "idp.entry": fileURLToPath(new URL("./idp.entry.ts", import.meta.url)),
};

const dependencyExternals = Object.keys(packageJson.dependencies ?? {});

export default defineConfig({
  root: repoRoot,
  resolve: {
    alias: {
      backend: backendRoot,
    },
  },
  build: {
    target: "node22",
    outDir: "dist/backend",
    emptyOutDir: true,
    sourcemap: true,
    minify: false,
    ssr: true,
    rollupOptions: {
      input: entries,
      external: [...builtinExternals, ...dependencyExternals],
      output: {
        format: "es",
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
