import { describe, expect, it } from "vitest";
import { hasRole, ROLES } from "@/lib/permissions";

describe("ROLES", () => {
  it("lists admin, manager, salesman", () => {
    expect(ROLES).toEqual(["admin", "manager", "salesman"]);
  });
});

describe("hasRole", () => {
  it("admin has every role", () => {
    expect(hasRole("admin", "admin")).toBe(true);
    expect(hasRole("admin", "manager")).toBe(true);
    expect(hasRole("admin", "salesman")).toBe(true);
  });

  it("manager has manager and salesman", () => {
    expect(hasRole("manager", "admin")).toBe(false);
    expect(hasRole("manager", "manager")).toBe(true);
    expect(hasRole("manager", "salesman")).toBe(true);
  });

  it("salesman has only salesman", () => {
    expect(hasRole("salesman", "admin")).toBe(false);
    expect(hasRole("salesman", "manager")).toBe(false);
    expect(hasRole("salesman", "salesman")).toBe(true);
  });

  it("returns false for null/undefined/invalid", () => {
    expect(hasRole(null, "salesman")).toBe(false);
    expect(hasRole(undefined, "salesman")).toBe(false);
    expect(hasRole("bogus", "salesman")).toBe(false);
  });
});
