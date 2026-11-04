import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const STORAGE_DIR = path.join(import.meta.dirname, ".auth");

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    try {
      await expect(page).toHaveURL("/", { timeout: 15_000 });
      return;
    } catch {
      if (attempt === 2) throw new Error(`Failed to sign in as ${email} after 3 attempts`);
      await page.waitForTimeout(2000);
    }
  }
}

setup("authenticate admin", async ({ page }) => {
  await signIn(page, "admin@test.com", "Password1");
  await page.context().storageState({ path: path.join(STORAGE_DIR, "admin.json") });
});

setup("authenticate manager", async ({ page }) => {
  await signIn(page, "manager@test.com", "Password1");
  await page.context().storageState({ path: path.join(STORAGE_DIR, "manager.json") });
});

setup("authenticate salesman1", async ({ page }) => {
  await signIn(page, "salesman1@test.com", "Password1");
  await page.context().storageState({ path: path.join(STORAGE_DIR, "salesman1.json") });
});

setup("authenticate salesman2", async ({ page }) => {
  await signIn(page, "salesman2@test.com", "Password1");
  await page.context().storageState({ path: path.join(STORAGE_DIR, "salesman2.json") });
});
