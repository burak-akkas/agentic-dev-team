import { defineConfig, devices } from "@playwright/test";

// E2E_BASE_URL points the suite at a deployed site (e.g. a PR preview, ending in "/").
// Without it, the suite serves the local static export in out/ (run `npm run build` first).
const remoteURL = process.env.E2E_BASE_URL;
const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: remoteURL ?? `http://localhost:${PORT}/`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chrome",
      // Uses the installed Google Chrome (preinstalled on GitHub runners), so no browser download.
      use: { ...devices["Desktop Chrome"], channel: process.env.E2E_CHANNEL ?? "chrome" },
    },
  ],
  webServer: remoteURL
    ? undefined
    : {
        command: `node tests/support/serve.mjs out ${PORT}`,
        url: `http://localhost:${PORT}/`,
        reuseExistingServer: !process.env.CI,
      },
});
