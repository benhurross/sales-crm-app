import { describe, expect, it } from "vitest";
import { amount, cellValue, insurerName, isoDate, leadStatus, nameKey, text, yes } from "@/lib/sheet-import";

const google = (literal: string, result?: unknown) => ({ formula: `IFERROR(__xludf.DUMMYFUNCTION("""COMPUTED_VALUE"""),${literal})`, result });

describe("cellValue", () => {
  it("reads the value Google computed from the formula, ignoring a mangled cached result", () => {
    expect(cellValue(google('"Tawuniya"', null))).toBe("Tawuniya");
    expect(cellValue(google('"say ""hi"""'))).toBe('say "hi"');
    expect(cellValue(google("TRUE", new Date("1899-12-31")))).toBe(true);
    expect(cellValue(google("46055.0"))).toBe(46055);
  });

  it("falls back to the cached result and plain values", () => {
    expect(cellValue({ formula: "SUM(A1:A2)", result: 7 })).toBe(7);
    expect(cellValue("x")).toBe("x");
    expect(cellValue(new Date("invalid"))).toBeNull();
    expect(cellValue({ richText: [{ text: "a" }, { text: "b" }] })).toBe("ab");
  });
});

describe("value helpers", () => {
  it("reads yes/no in every form the sheet uses", () => {
    expect(yes(google("TRUE"))).toBe(true);
    expect(yes("✅")).toBe(true);
    expect(yes(new Date("1899-12-31T00:00:00Z"))).toBe(true);
    expect(yes(new Date("1899-12-30T00:00:00Z"))).toBe(false);
    expect(yes(null)).toBe(false);
  });

  it("reads amounts", () => {
    expect(amount(155542)).toBe(155542);
    expect(amount("4.500.000")).toBe(4500000);
    expect(amount("1,250.5")).toBe(1250.5);
    expect(amount("-")).toBeNull();
    expect(amount(null)).toBeNull();
  });

  it("reads dates from serials, Dates and text", () => {
    expect(isoDate(google("46055.0"))).toBe("2026-02-02");
    expect(isoDate(new Date("2026-07-15T00:00:00Z"))).toBe("2026-07-15");
    expect(isoDate("2026-03-01")).toBe("2026-03-01");
    expect(isoDate(new Date("1899-12-30T00:00:00Z"))).toBeNull();
    expect(isoDate("")).toBeNull();
  });

  it("maps sheet statuses to the app's three", () => {
    expect(leadStatus("Secured")).toBe("Secured");
    expect(leadStatus("Lost")).toBe("Lost");
    expect(leadStatus("Pending Quote")).toBe("Pending");
    expect(leadStatus("Pending Client Dec")).toBe("Pending");
    expect(leadStatus(null)).toBe("Pending");
  });

  it("normalises insurer and client names", () => {
    expect(insurerName(" bupa ")).toBe("Bupa Arabia");
    expect(insurerName("Tawuniya")).toBe("Tawuniya");
    expect(nameKey("  Gissa Perfumes Co. ")).toBe(nameKey("gissa perfumes co"));
    expect(text(google('"  Jeddah "'))).toBe("Jeddah");
  });
});
