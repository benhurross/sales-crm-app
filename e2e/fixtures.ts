import { test as base, expect } from "@playwright/test";
import path from "node:path";

const STORAGE_DIR = path.join(import.meta.dirname, ".auth");

type Fixtures = {
  adminPage: import("@playwright/test").Page;
  managerPage: import("@playwright/test").Page;
  salesmanPage: import("@playwright/test").Page;
  salesman2Page: import("@playwright/test").Page;
};

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: path.join(STORAGE_DIR, "admin.json") });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  managerPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: path.join(STORAGE_DIR, "manager.json") });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  salesmanPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: path.join(STORAGE_DIR, "salesman1.json") });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
  salesman2Page: async ({ browser }, use) => {
    const ctx = await browser.newContext({ storageState: path.join(STORAGE_DIR, "salesman2.json") });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };
