import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4175",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
    timeout: 30000
  },
  projects: [
    { name: "android-small", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } } },
    { name: "android-standard", use: { ...devices["Pixel 7"] } },
    { name: "wide-mobile", use: { viewport: { width: 600, height: 960 } } }
  ]
});
