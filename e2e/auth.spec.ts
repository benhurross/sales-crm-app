import { test, expect } from "@playwright/test";

test.describe("auth flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("redirects unauthenticated user to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("shows sign-in form with email and password fields", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("wrong@test.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible({ timeout: 10_000 });
  });

  test("signs in with valid credentials and redirects to dashboard", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("admin@test.com");
    await page.getByLabel("Password").fill("Password1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("/", { timeout: 30_000 });
  });

  test("protects /leads from unauthenticated access", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("protects /targets from unauthenticated access", async ({ page }) => {
    await page.goto("/targets");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("protects /settings from unauthenticated access", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
