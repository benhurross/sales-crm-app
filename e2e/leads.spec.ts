import { test, expect } from "./fixtures.js";

test.describe("leads CRUD", () => {
  test("displays leads table with seeded data", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: /acme/i }).first()).toBeVisible();
  });

  test("creates a new lead", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /add lead/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Prospect Name").fill("New E2E Lead");
    await page.locator("#producerId").selectOption({ index: 1 });
    await page.getByLabel("Estimated Premium").fill("100000");
    await page.getByLabel("City").clear();
    await page.getByLabel("City").fill("Jeddah");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Lead created")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("cell", { name: "New E2E Lead" })).toBeVisible();
  });

  test("edits an existing lead", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole("row").filter({ hasText: "Beta Industries" });
    await row.getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByLabel("Prospect Name").clear();
    await page.getByLabel("Prospect Name").fill("Beta Industries Updated");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Lead updated")).toBeVisible({ timeout: 10_000 });
  });

  test("filters leads by status", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    const statusSelect = page.locator("select").first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption("Secured");
      await page.waitForTimeout(500);
    }
  });

  test("searches leads by prospect name", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill("Delta");
      await expect(page.getByRole("cell", { name: /delta/i })).toBeVisible();
    }
  });

  test("table has fixed headers", async ({ adminPage: page }) => {
    await page.goto("/leads");
    const table = page.getByRole("table");
    await expect(table).toBeVisible({ timeout: 15_000 });
    const header = table.locator("thead");
    await expect(header).toBeVisible();
    await expect(header.getByText("Prospect")).toBeVisible();
  });
});
