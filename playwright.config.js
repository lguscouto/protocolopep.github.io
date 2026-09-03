import { defineConfig, devices } from "@playwright/test";

const REAL_DEVICE_TEST = /device-real\.spec\.js/;

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
    { name: "android-small", testIgnore: REAL_DEVICE_TEST, use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } } },
    { name: "android-standard", testIgnore: REAL_DEVICE_TEST, use: { ...devices["Pixel 7"] } },
    { name: "wide-mobile", testIgnore: REAL_DEVICE_TEST, use: { viewport: { width: 600, height: 960 } } },
    {
      name: "galaxy-a55",
      testMatch: REAL_DEVICE_TEST,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 412, height: 915 },
        screen: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
      }
    },
    {
      name: "galaxy-a55-landscape",
      testMatch: REAL_DEVICE_TEST,
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 915, height: 412 },
        screen: { width: 915, height: 412 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true
      }
    }
  ]
});
