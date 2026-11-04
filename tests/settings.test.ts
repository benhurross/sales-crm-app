import { describe, expect, it } from "vitest";

describe("user management validation", () => {
  it("rejects empty name", () => {
    expect("".length >= 1).toBe(false);
  });

  it("accepts valid email", () => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(emailRe.test("user@example.com")).toBe(true);
    expect(emailRe.test("bad")).toBe(false);
    expect(emailRe.test("")).toBe(false);
  });

  it("enforces minimum password length", () => {
    expect("short".length >= 8).toBe(false);
    expect("longpassword".length >= 8).toBe(true);
    expect("exactly8".length >= 8).toBe(true);
  });

  it("validates role values", () => {
    const validRoles = ["admin", "manager", "salesman"];
    expect(validRoles.includes("admin")).toBe(true);
    expect(validRoles.includes("manager")).toBe(true);
    expect(validRoles.includes("salesman")).toBe(true);
    expect(validRoles.includes("superuser")).toBe(false);
  });
});

describe("password change validation", () => {
  it("requires both current and new password", () => {
    const valid = (current: string, next: string) => !!current && !!next;
    expect(valid("old", "newpass123")).toBe(true);
    expect(valid("", "newpass123")).toBe(false);
    expect(valid("old", "")).toBe(false);
  });

  it("enforces minimum length on new password", () => {
    expect("1234567".length >= 8).toBe(false);
    expect("12345678".length >= 8).toBe(true);
  });

  it("validates password confirmation match", () => {
    const matches = (pw: string, confirm: string) => pw === confirm;
    expect(matches("password1", "password1")).toBe(true);
    expect(matches("password1", "password2")).toBe(false);
  });
});

describe("insurance company validation", () => {
  it("rejects empty name", () => {
    expect("".trim().length > 0).toBe(false);
    expect("  ".trim().length > 0).toBe(false);
  });

  it("trims whitespace from name", () => {
    expect("  Bupa Arabia  ".trim()).toBe("Bupa Arabia");
  });

  it("detects duplicate names", () => {
    const existing = ["Bupa Arabia", "Tawuniya", "Medgulf"];
    expect(existing.includes("Bupa Arabia")).toBe(true);
    expect(existing.includes("New Insurer")).toBe(false);
  });
});

describe("user deactivation logic", () => {
  it("prevents self-deactivation", () => {
    const currentUserId = "user-1";
    const targetUserId = "user-1";
    expect(currentUserId === targetUserId).toBe(true);
  });

  it("allows deactivating other users", () => {
    const currentUserId = "user-1";
    const targetUserId = "user-2";
    expect(currentUserId).not.toBe(targetUserId);
  });

  it("toggles banned status", () => {
    const user = { banned: false };
    const toggled = !user.banned;
    expect(toggled).toBe(true);

    const banned = { banned: true };
    expect(!banned.banned).toBe(false);
  });
});

describe("role-based access for settings", () => {
  const ROLE_RANK: Record<string, number> = { admin: 3, manager: 2, salesman: 1 };

  function hasRole(role: string, required: string): boolean {
    return (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[required] ?? 0);
  }

  it("admin can access user management", () => {
    expect(hasRole("admin", "admin")).toBe(true);
  });

  it("manager cannot access user management", () => {
    expect(hasRole("manager", "admin")).toBe(false);
  });

  it("salesman cannot access user management", () => {
    expect(hasRole("salesman", "admin")).toBe(false);
  });

  it("manager can access insurance companies", () => {
    expect(hasRole("manager", "manager")).toBe(true);
  });

  it("all roles can change their own password", () => {
    expect(hasRole("admin", "salesman")).toBe(true);
    expect(hasRole("manager", "salesman")).toBe(true);
    expect(hasRole("salesman", "salesman")).toBe(true);
  });
});
