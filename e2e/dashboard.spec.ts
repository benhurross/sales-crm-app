import { test, expect } from "./fixtures.js";

test.describe("dashboard", () => {
  test("displays KPI stat cards", async ({ adminPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Open Pipeline", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=Secured").first()).toBeVisible();
    await expect(page.locator("text=Pending").first()).toBeVisible();
  });

  test("displays charts", async ({ adminPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Open Pipeline", { exact: true })).toBeVisible({ timeout: 30_000 });
    const charts = page.locator(".recharts-wrapper");
    await expect(charts.first()).toBeVisible({ timeout: 15_000 });
  });

  test("salesman sees dashboard", async ({ salesmanPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1, h2").filter({ hasText: /dashboard/i }).first()).toBeVisible({ timeout: 30_000 });
  });

  test("shows success rate", async ({ adminPage: page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Open Pipeline", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=Success Rate").or(page.locator("text=success rate")).first()).toBeVisible();
  });
});
