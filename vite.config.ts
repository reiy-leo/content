import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// 前端：web/ → public/，再由 scripts/build-inline-assets.mjs 内联进 Worker
export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: { outDir: "../public", emptyOutDir: true, target: "es2022", sourcemap: false, chunkSizeWarningLimit: 1500 },
  server: { proxy: { "/api": "http://localhost:8787", "/auth": "http://localhost:8787", "/dl": "http://localhost:8787" } },
});
