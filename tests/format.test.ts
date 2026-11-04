import { describe, expect, it } from "vitest";
import { RIYAL, formatAmount, formatCompact, formatPercent, formatDate } from "@/lib/format";

describe("RIYAL constant", () => {
  it("is U+20C1", () => {
    expect(RIYAL).toBe("\u{20C1}");
  });
});

describe("formatAmount", () => {
  it("formats whole numbers with grouping", () => {
    expect(formatAmount(250000)).toBe(`${RIYAL} 250,000`);
  });

  it("formats decimals up to two places", () => {
    expect(formatAmount(1234.5)).toBe(`${RIYAL} 1,234.5`);
    expect(formatAmount(99.99)).toBe(`${RIYAL} 99.99`);
  });

  it("formats zero", () => {
    expect(formatAmount(0)).toBe(`${RIYAL} 0`);
  });

  it("formats large amounts", () => {
    expect(formatAmount(1000000)).toBe(`${RIYAL} 1,000,000`);
  });
});

describe("formatCompact", () => {
  it("uses compact notation for thousands", () => {
    const result = formatCompact(250000);
    expect(result).toContain(RIYAL);
    expect(result).toMatch(/250K/);
  });

  it("uses compact notation for millions", () => {
    const result = formatCompact(1500000);
    expect(result).toContain(RIYAL);
    expect(result).toMatch(/1\.5M/);
  });
});

describe("formatPercent", () => {
  it("formats fractions as percentages", () => {
    expect(formatPercent(0.15)).toBe("15.0%");
    expect(formatPercent(0.055)).toBe("5.5%");
  });

  it("formats 1.0 as 100%", () => {
    expect(formatPercent(1)).toBe("100.0%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
});

describe("formatDate", () => {
  it("formats a Date object", () => {
    const result = formatDate(new Date("2026-11-04"));
    expect(result).toContain("Nov");
    expect(result).toContain("2026");
  });

  it("formats an ISO string", () => {
    const result = formatDate("2026-01-15");
    expect(result).toContain("Jan");
    expect(result).toContain("2026");
  });
});
