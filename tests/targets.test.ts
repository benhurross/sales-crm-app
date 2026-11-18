import { describe, expect, it } from "vitest";
import { achievementPct, achievementColor, progressColor, rankBySecured, type ProducerTarget } from "@/lib/targets";

describe("achievementPct", () => {
  it("calculates percentage from strings", () => {
    expect(achievementPct("250000", "1000000")).toBe(25);
  });

  it("calculates percentage from numbers", () => {
    expect(achievementPct(500000, 1000000)).toBe(50);
  });

  it("returns 0 when target is 0", () => {
    expect(achievementPct("100000", "0")).toBe(0);
  });

  it("returns 0 when target is negative", () => {
    expect(achievementPct("100000", "-500")).toBe(0);
  });

  it("handles over 100%", () => {
    expect(achievementPct("1500000", "1000000")).toBe(150);
  });

  it("returns 0 when secured is 0", () => {
    expect(achievementPct("0", "1000000")).toBe(0);
  });
});

describe("achievementColor", () => {
  it("returns emerald for >= 100%", () => {
    expect(achievementColor(100)).toContain("emerald");
    expect(achievementColor(150)).toContain("emerald");
  });

  it("returns blue for >= 75%", () => {
    expect(achievementColor(75)).toContain("blue");
    expect(achievementColor(99)).toContain("blue");
  });

  it("returns amber for >= 50%", () => {
    expect(achievementColor(50)).toContain("amber");
    expect(achievementColor(74)).toContain("amber");
  });

  it("returns red for < 50%", () => {
    expect(achievementColor(0)).toContain("red");
    expect(achievementColor(49)).toContain("red");
  });
});

describe("progressColor", () => {
  it("returns emerald for >= 100%", () => {
    expect(progressColor(100)).toBe("bg-emerald-500");
  });

  it("returns blue for >= 75%", () => {
    expect(progressColor(80)).toBe("bg-blue-500");
  });

  it("returns amber for >= 50%", () => {
    expect(progressColor(60)).toBe("bg-amber-500");
  });

  it("returns red for < 50%", () => {
    expect(progressColor(30)).toBe("bg-red-500");
  });
});

describe("rankBySecured", () => {
  const producers: ProducerTarget[] = [
    { id: 1, code: "J-1", name: "Alice", region: "Jeddah", employmentStatus: "Active", leavingDate: null, annualTarget: "1000000", monthlyTarget: "83333", securedPremium: "200000", securedCount: 5, totalLeads: 10 },
    { id: 2, code: "J-2", name: "Bob", region: "Jeddah", employmentStatus: "Active", leavingDate: null, annualTarget: "800000", monthlyTarget: "66667", securedPremium: "500000", securedCount: 8, totalLeads: 12 },
    { id: 3, code: "R-1", name: "Charlie", region: "Riyadh", employmentStatus: "Active", leavingDate: null, annualTarget: "1200000", monthlyTarget: "100000", securedPremium: "300000", securedCount: 3, totalLeads: 7 },
  ];

  it("sorts by secured premium descending", () => {
    const ranked = rankBySecured(producers);
    expect(ranked[0].name).toBe("Bob");
    expect(ranked[1].name).toBe("Charlie");
    expect(ranked[2].name).toBe("Alice");
  });

  it("does not mutate the original array", () => {
    const original = [...producers];
    rankBySecured(producers);
    expect(producers).toEqual(original);
  });
});
