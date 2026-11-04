import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.E2E_PORT ?? 3500);
const BASE_URL = `http://localhost:${PORT}`;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://sales:sales@localhost:5435/sales_crm_test";
const AUTH_DIR = path.join(import.meta.dirname, "e2e", ".auth");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/, fullyParallel: false },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: path.join(AUTH_DIR, "admin.json") },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], storageState: path.join(AUTH_DIR, "admin.json") },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: TEST_DATABASE_URL, BETTER_AUTH_URL: BASE_URL, AUTH_RATE_LIMIT: "off" },
  },
});
