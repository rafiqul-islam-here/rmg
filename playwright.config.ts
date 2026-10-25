import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests.
 * - Local:  npm run build && npm run test:e2e   (starts `next start` on :3100)
 * - Docker: E2E_BASE_URL=http://localhost:3000 npm run test:e2e   (tests the running container)
 * Uses the installed Google Chrome (`channel: "chrome"`); set E2E_CHANNEL=chromium to use Playwright's own build.
 */
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? "http://localhost:3100";
const channel = process.env.E2E_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "tests/e2e",
  // The mock API keeps one shared in-memory database, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    channel: channel === "chromium" ? undefined : channel,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: external
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: "http://localhost:3100/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
