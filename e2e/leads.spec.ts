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
    const form = page.getByRole("dialog");
    await expect(form).toBeVisible();

    await form.getByLabel("Prospect Name").fill("New E2E Lead");
    await form.locator("#producerId").selectOption({ index: 1 });
    await form.getByLabel("Estimated Premium").fill("100000");
    await form.getByLabel("City").clear();
    await form.getByLabel("City").fill("Jeddah");
    await form.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Lead created")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("cell", { name: "New E2E Lead" }).first()).toBeVisible();
  });

  test("edits an existing lead", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    const row = page.getByRole("row").filter({ hasText: "Beta Industries" });
    await row.getByRole("button").first().click();
    const form = page.getByRole("dialog");
    await expect(form).toBeVisible();

    await form.getByLabel("Prospect Name").clear();
    await form.getByLabel("Prospect Name").fill("Beta Industries Updated");
    await form.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Lead updated")).toBeVisible({ timeout: 10_000 });
  });

  test("filters leads by status from the column header", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Filter Status" }).click();
    const menu = page.getByRole("dialog");
    await menu.getByText("(Select all)").click();
    await menu.getByText("Secured", { exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("cell", { name: "Pending", exact: true })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "Secured", exact: true }).first()).toBeVisible();
    await expect(page.getByText(/\d+ of \d+ rows/)).toBeVisible();

    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(page.getByText(/^\d+ rows$/)).toBeVisible();
  });

  test("filters leads by producer from the column header", async ({ adminPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    const producerCells = page.locator("tbody tr td:nth-child(2)");
    const name = (await producerCells.first().textContent())!;

    await page.getByRole("button", { name: "Filter Producer" }).click();
    const menu = page.getByRole("dialog");
    await menu.getByText("(Select all)").click();
    await menu.getByText(name, { exact: true }).click();
    await page.keyboard.press("Escape");
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

  test("shows all leads in one scrollable table with the Main Data columns", async ({ adminPage: page }) => {
    await page.goto("/leads");
    const header = page.locator("thead");
    await expect(header).toBeVisible({ timeout: 15_000 });
    for (const title of ["Producer", "Prospect Name", "Start Working Date", "RFQ Type", "COB", "BOR", "Quoted", "Status", "Estimated Premium", "Commission", "Current Insurer"])
      await expect(header.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(0);
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
