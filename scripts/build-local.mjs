import { build } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await build({
  configFile: false,
  root: resolve(root, "local-client"),
  publicDir: resolve(root, "public"),
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom"] },
  build: {
    outDir: resolve(root, "local-dist"),
    emptyOutDir: true,
    target: "es2022",
  },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
});
