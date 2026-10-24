import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  reporter: "list",
  timeout: 60_000,
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:5173", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: process.env.E2E_LIVE_API ? "npm run dev" : "npm run dev --workspace @botanical-story/web", url: "http://127.0.0.1:5173", reuseExistingServer: !process.env.CI, timeout: 120_000 }
});
