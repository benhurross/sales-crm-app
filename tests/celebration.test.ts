import { describe, expect, it } from "vitest";
import { celebrationFor } from "@/lib/celebration";

const at = (iso: string) => new Date(iso);

describe("celebrationFor", () => {
  it("marks the first win of the month and a small deal as a small celebration", () => {
    const c = celebrationFor({ premium: 5_000, securedAt: at("2026-11-17T10:00") }, [{ premium: 9_000, securedAt: at("2026-10-02T10:00") }], 0);
    expect(c).toEqual({ big: false, milestones: [{ key: "firstThisMonth" }] });
  });

  it("is a plain small win when nothing special happened", () => {
    const c = celebrationFor({ premium: 1_000, securedAt: at("2026-11-17T10:00") }, [{ premium: 9_000, securedAt: at("2026-11-03T10:00") }], 0);
    expect(c).toEqual({ big: false, milestones: [] });
  });

  it("spots a personal best against earlier wins, including undated ones", () => {
    const c = celebrationFor(
      { premium: 50_000, securedAt: at("2026-11-17T10:00") },
      [
        { premium: 40_000, securedAt: null },
        { premium: 10_000, securedAt: at("2026-11-02T10:00") },
        { premium: 90_000, securedAt: at("2026-11-20T10:00") }, // later, ignored
      ],
      0,
    );
    expect(c.milestones).toContainEqual({ key: "personalBest" });
    expect(c.big).toBe(true);
  });

  it("does not call a first-ever win a personal best", () => {
    expect(celebrationFor({ premium: 50_000, securedAt: at("2026-11-17") }, [], 0).milestones).not.toContainEqual({ key: "personalBest" });
  });

  it("reports the highest target step crossed", () => {
    const c = celebrationFor({ premium: 40_000, securedAt: at("2026-11-17") }, [{ premium: 20_000, securedAt: null }], 100_000);
    expect(c.milestones).toContainEqual({ key: "targetPassed", value: 50 });
    const done = celebrationFor({ premium: 30_000, securedAt: at("2026-11-17") }, [{ premium: 80_000, securedAt: null }], 100_000);
    expect(done.milestones).toContainEqual({ key: "targetReached" });
    const none = celebrationFor({ premium: 1_000, securedAt: at("2026-11-17") }, [{ premium: 80_000, securedAt: null }], 100_000);
    expect(none.milestones.some((m) => m.key.startsWith("target"))).toBe(false);
  });

  it("counts wins in the same Monday-to-Sunday week", () => {
    const wins = [
      { premium: 1, securedAt: at("2026-11-16T09:00") }, // Monday
      { premium: 1, securedAt: at("2026-11-17T09:00") },
      { premium: 1, securedAt: at("2026-11-15T09:00") }, // previous Sunday
    ];
    expect(celebrationFor({ premium: 1, securedAt: at("2026-11-18T09:00") }, wins, 0).milestones).toContainEqual({ key: "weekStreak", value: 3 });
  });
});
