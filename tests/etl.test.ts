import { describe, expect, it } from "vitest";

// Re-implement ETL helpers for testing (they are not exported from the script)
function str(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v) return str((v as { result: unknown }).result);
  if (typeof v === "object" && "richText" in v) {
    return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("").trim();
  }
  return String(v).trim();
}

function num(v: unknown): number {
  const s = str(v).replace(/,/g, "").replace(/\./g, (_m, _i, full: string) => {
    const dots = (full.match(/\./g) || []).length;
    return dots > 1 ? "" : _m;
  });
  if (!s || s === "-" || s === "#NAME?" || s === "N/A") return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

function dateStr(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object" && "result" in v) return dateStr((v as { result: unknown }).result);
  const s = String(v).trim();
  if (!s || s === "#NAME?" || s === "#VALUE!") return null;
  const n = Number(s);
  if (!Number.isNaN(n) && n > 30000 && n < 60000) {
    const d = new Date((n - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function toBool(v: unknown): boolean {
  if (v === true) return true;
  const s = str(v).toLowerCase();
  return s === "true" || s === "✅" || s === "yes" || s === "1";
}

type EmploymentStatus = "Active" | "Resigned" | "Transferred";
function normalizeEmployment(v: string): EmploymentStatus {
  const s = v.trim().toLowerCase();
  if (s === "active") return "Active";
  if (s === "transferred" || s === "transfered") return "Transferred";
  return "Resigned";
}

type LeadStatus = "Secured" | "Pending" | "Lost";
function normalizeStatus(v: string): LeadStatus {
  const s = v.trim().toLowerCase();
  if (s === "secured") return "Secured";
  if (s === "lost") return "Lost";
  return "Pending";
}

function normalizeInsurer(name: string): string {
  const map: Record<string, string> = {
    "bupa": "Bupa Arabia",
    "bupa arabia": "Bupa Arabia",
    "cigna": "CIGNA",
    "watanyah": "Wataniya",
    "wataniya": "Wataniya",
    "mutakamilah": "Mutakamelah",
    "al rajihi": "Al Rajhi Takaful",
    "takaful al rajhi": "Al Rajhi Takaful",
  };
  const key = name.trim().toLowerCase();
  return map[key] ?? name.trim();
}

describe("str", () => {
  it("returns empty for null/undefined", () => {
    expect(str(null)).toBe("");
    expect(str(undefined)).toBe("");
  });

  it("converts plain strings", () => {
    expect(str("hello")).toBe("hello");
    expect(str("  trimmed  ")).toBe("trimmed");
  });

  it("converts dates to ISO format", () => {
    const d = new Date("2026-03-15T00:00:00Z");
    expect(str(d)).toBe("2026-03-15");
  });

  it("extracts formula result", () => {
    expect(str({ formula: "=A1+B1", result: "Secured" })).toBe("Secured");
    expect(str({ formula: "=A1", result: 42 })).toBe("42");
    expect(str({ formula: "=A1", result: null })).toBe("");
  });

  it("handles rich text", () => {
    expect(str({ richText: [{ text: "Hello " }, { text: "World" }] })).toBe("Hello World");
  });

  it("converts numbers", () => {
    expect(str(42)).toBe("42");
    expect(str(0)).toBe("0");
  });
});

describe("num", () => {
  it("converts plain numbers", () => {
    expect(num(155542)).toBe(155542);
    expect(num("155542")).toBe(155542);
  });

  it("strips commas", () => {
    expect(num("1,234,567")).toBe(1234567);
  });

  it("handles European dot notation", () => {
    expect(num("4.500.000")).toBe(4500000);
  });

  it("returns 0 for dash/empty/error", () => {
    expect(num("-")).toBe(0);
    expect(num("")).toBe(0);
    expect(num(null)).toBe(0);
    expect(num("#NAME?")).toBe(0);
    expect(num("N/A")).toBe(0);
  });

  it("handles formula results", () => {
    expect(num({ formula: "=SUM(A:A)", result: 5000 })).toBe(5000);
  });

  it("preserves single decimal", () => {
    expect(num("1234.56")).toBe(1234.56);
  });
});

describe("dateStr", () => {
  it("converts Date objects", () => {
    expect(dateStr(new Date("2026-02-02T00:00:00Z"))).toBe("2026-02-02");
  });

  it("converts Excel serial numbers", () => {
    expect(dateStr(46055)).toBe("2026-02-02");
    expect(dateStr("46055")).toBe("2026-02-02");
  });

  it("converts ISO strings", () => {
    expect(dateStr("2026-02-02T00:00:00.000Z")).toBe("2026-02-02");
  });

  it("returns null for invalid/empty", () => {
    expect(dateStr(null)).toBeNull();
    expect(dateStr("")).toBeNull();
    expect(dateStr("#NAME?")).toBeNull();
    expect(dateStr("#VALUE!")).toBeNull();
  });

  it("extracts from formula result", () => {
    expect(dateStr({ formula: "=TODAY()", result: new Date("2026-06-15T00:00:00Z") })).toBe("2026-06-15");
  });
});

describe("toBool", () => {
  it("handles true boolean", () => {
    expect(toBool(true)).toBe(true);
    expect(toBool(false)).toBe(false);
  });

  it("handles checkmark and text values", () => {
    expect(toBool("✅")).toBe(true);
    expect(toBool("True")).toBe(true);
    expect(toBool("true")).toBe(true);
    expect(toBool("yes")).toBe(true);
    expect(toBool("1")).toBe(true);
  });

  it("returns false for other values", () => {
    expect(toBool("")).toBe(false);
    expect(toBool(null)).toBe(false);
    expect(toBool("no")).toBe(false);
    expect(toBool("❌")).toBe(false);
  });
});

describe("normalizeEmployment", () => {
  it("normalizes active", () => {
    expect(normalizeEmployment("Active")).toBe("Active");
    expect(normalizeEmployment("active")).toBe("Active");
  });

  it("normalizes transferred (including misspelling)", () => {
    expect(normalizeEmployment("Transferred")).toBe("Transferred");
    expect(normalizeEmployment("Transfered")).toBe("Transferred");
  });

  it("maps Inactive to Resigned", () => {
    expect(normalizeEmployment("Inactive")).toBe("Resigned");
    expect(normalizeEmployment("Resigned")).toBe("Resigned");
  });
});

describe("normalizeStatus", () => {
  it("normalizes known statuses", () => {
    expect(normalizeStatus("Secured")).toBe("Secured");
    expect(normalizeStatus("Lost")).toBe("Lost");
    expect(normalizeStatus("Pending")).toBe("Pending");
  });

  it("maps pending variants to Pending", () => {
    expect(normalizeStatus("Pending Quote")).toBe("Pending");
    expect(normalizeStatus("Pending Issuance")).toBe("Pending");
  });

  it("defaults unknown to Pending", () => {
    expect(normalizeStatus("")).toBe("Pending");
    expect(normalizeStatus("unknown")).toBe("Pending");
  });
});

describe("normalizeInsurer", () => {
  it("normalizes known variants", () => {
    expect(normalizeInsurer("Bupa")).toBe("Bupa Arabia");
    expect(normalizeInsurer("BUPA")).toBe("Bupa Arabia");
    expect(normalizeInsurer("Bupa Arabia")).toBe("Bupa Arabia");
    expect(normalizeInsurer("Watanyah")).toBe("Wataniya");
    expect(normalizeInsurer("CIGNA")).toBe("CIGNA");
    expect(normalizeInsurer("cigna")).toBe("CIGNA");
    expect(normalizeInsurer("Al Rajihi")).toBe("Al Rajhi Takaful");
    expect(normalizeInsurer("Takaful Al Rajhi")).toBe("Al Rajhi Takaful");
  });

  it("passes through unknown names", () => {
    expect(normalizeInsurer("Unknown Co")).toBe("Unknown Co");
  });

  it("trims whitespace", () => {
    expect(normalizeInsurer("  Bupa  ")).toBe("Bupa Arabia");
  });
});
