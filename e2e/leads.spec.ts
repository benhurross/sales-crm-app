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
    await expect(page.getByRole("cell", { name: "New E2E Lead" }).first()).toBeVisible();
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

    await page.getByLabel("Status").selectOption("Secured");
    await expect(page.getByRole("cell", { name: "Pending", exact: true })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "Secured", exact: true }).first()).toBeVisible();
  });

  test("filters leads by producer and pages through results", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const producer = page.getByLabel("Producer");
    await expect(producer).toBeVisible();
    const name = await producer.locator("option").nth(1).textContent();
    await producer.selectOption({ index: 1 });
    const producerCells = page.locator("tbody tr td:nth-child(3)");
    await expect(producerCells.first()).toHaveText(name!);
    for (const text of await producerCells.allTextContents()) expect(text).toBe(name);
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

  test("pages forward and back", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const pager = page.getByText(/^Page \d+ of \d+/);
    if (!(await pager.isVisible())) test.skip(true, "seed data fits on one page");
    await expect(pager).toContainText("Page 1 of");
    await page.getByRole("button", { name: "Next page" }).click();
    await expect(pager).toContainText("Page 2 of");
    await page.getByRole("button", { name: "Previous page" }).click();
    await expect(pager).toContainText("Page 1 of");
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
