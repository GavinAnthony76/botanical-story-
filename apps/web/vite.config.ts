import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", port: 5173, proxy: { "/api": "http://localhost:3001" } },
  build: { outDir: "../../dist/web", emptyOutDir: true, sourcemap: true }
});
