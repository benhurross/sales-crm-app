import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3500);
const BASE_URL = `http://localhost:${PORT}`;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://sales:sales@localhost:5435/sales_crm_test";

const browsers = [
  { name: "chromium", device: devices["Desktop Chrome"] },
  { name: "firefox", device: devices["Desktop Firefox"] },
  { name: "webkit", device: devices["Desktop Safari"] },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: true,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    ...browsers.map(({ name, device }) => ({
      name,
      use: { ...device },
      dependencies: ["setup"],
    })),
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: TEST_DATABASE_URL, BETTER_AUTH_URL: BASE_URL, AUTH_RATE_LIMIT: "off" },
  },
});
