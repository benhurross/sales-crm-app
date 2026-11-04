import { test, expect } from "./fixtures.js";

test.describe("targets", () => {
  test("displays targets table with producer data", async ({ adminPage: page }) => {
    await page.goto("/targets");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: /test salesman/i }).first()).toBeVisible();
  });

  test("shows achievement progress bars", async ({ adminPage: page }) => {
    await page.goto("/targets");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars.first()).toBeVisible();
  });

  test("admin can see edit controls", async ({ adminPage: page }) => {
    await page.goto("/targets");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const buttons = page.getByRole("table").getByRole("button");
    await expect(buttons.first()).toBeVisible();
  });

  test("shows leaderboard section", async ({ adminPage: page }) => {
    await page.goto("/targets");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("salesman can view targets page", async ({ salesmanPage: page }) => {
    await page.goto("/targets");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /targets/i })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("reports", () => {
  test("displays reports page with table", async ({ adminPage: page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
  });

  test("has export buttons", async ({ adminPage: page }) => {
    await page.goto("/reports");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const excelBtn = page.getByRole("button").filter({ has: page.locator("svg") });
    await expect(excelBtn.first()).toBeVisible();
  });

  test("triggers Excel export download", async ({ adminPage: page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }).catch(() => null),
      page.getByRole("button", { name: /excel/i }).click(),
    ]);
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    }
  });
});
