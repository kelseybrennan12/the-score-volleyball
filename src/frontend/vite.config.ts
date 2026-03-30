import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(() => {
  return {
    root,
    base: "/",
    plugins: [tailwindcss(), react()],
    build: {
      outDir: "../../dist/frontend",
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@frontend": root,
      },
    },
    server: {
      allowedHosts: ["dev-edge", "localhost", "127.0.0.1"],
      host: "0.0.0.0",
      port: Number(process.env.FRONTEND_PORT ?? 5173),
    },
  };
});
