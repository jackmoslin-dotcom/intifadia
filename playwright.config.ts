import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:4321", trace: "retain-on-failure" },
  webServer: {
    command: "npm start",
    env: { NODE_ENV: "production", PORT: "4321" },
    url: "http://127.0.0.1:4321",
    reuseExistingServer: false,
    timeout: 60000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
