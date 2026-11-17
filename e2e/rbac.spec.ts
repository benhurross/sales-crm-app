import { test, expect } from "./fixtures.js";

test.describe("RBAC data isolation", () => {
  test("salesman1 sees only own leads via API", async ({ salesmanPage: page }) => {
    const response = await page.request.get("/api/leads");
    const leads = await response.json();
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) {
      expect(lead.producerName).toBe("Test Salesman 1");
    }
  });

  test("salesman2 sees only own leads via API", async ({ salesman2Page: page }) => {
    const response = await page.request.get("/api/leads");
    const leads = await response.json();
    expect(leads.length).toBeGreaterThan(0);
    for (const lead of leads) {
      expect(lead.producerName).toBe("Test Salesman 2");
    }
  });

  test("admin sees all leads via API", async ({ adminPage: page }) => {
    const response = await page.request.get("/api/leads");
    const leads = await response.json();
    const names = [...new Set(leads.map((l: Record<string, unknown>) => l.producerName))];
    expect(names.length).toBeGreaterThan(1);
  });

  test("manager sees all leads", async ({ managerPage: page }) => {
    await page.goto("/leads");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("cell", { name: /delta/i }).first()).toBeVisible();
  });

  test("salesman is sent away from Settings and has no producer filter", async ({ salesmanPage: page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL("/", { timeout: 10_000 });
    await expect(page.getByText("User Management")).not.toBeVisible();
    await page.goto("/leads");
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();
    await expect(page.getByLabel("Producer")).toHaveCount(0);
    await expect(page.getByText("Insurance Companies")).not.toBeVisible();
  });

  test("admin can access user management", async ({ adminPage: page }) => {
    await page.goto("/settings");
    await expect(page.getByText("User Management")).toBeVisible({ timeout: 10_000 });
    await page.getByText("User Management").click();
    await expect(page.getByRole("heading", { name: "User Management" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
  });
});
