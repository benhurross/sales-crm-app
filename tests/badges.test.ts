import { describe, expect, it } from "vitest";
import { producerBadges, winOfTheWeek, type SecuredWin } from "@/lib/badges";

let id = 0;
const win = (producerId: number, premium: number, at: string | null): SecuredWin => ({ id: ++id, producerId, premium, securedAt: at ? new Date(at) : null });
const keys = (badges = new Map<number, { key: string }[]>(), producerId: number) => (badges.get(producerId) ?? []).map((b) => b.key);

describe("producerBadges", () => {
  it("gives First Win for any secured lead, dated or not", () => {
    const badges = producerBadges([win(1, 100, null)], new Map());
    expect(keys(badges, 1)).toEqual(["firstWin"]);
    expect(badges.has(2)).toBe(false);
  });

  it("gives Hat-trick for three wins in one Monday-to-Sunday week only", () => {
    const sameWeek = [win(1, 1, "2026-11-16T09:00"), win(1, 1, "2026-11-18T09:00"), win(1, 1, "2026-11-22T20:00")];
    expect(keys(producerBadges(sameWeek, new Map()), 1)).toContain("hatTrick");
    const splitWeeks = [win(2, 1, "2026-11-15T09:00"), win(2, 1, "2026-11-16T09:00"), win(2, 1, "2026-11-17T09:00")];
    expect(keys(producerBadges(splitWeeks, new Map()), 2)).not.toContain("hatTrick");
  });

  it("gives Five-Deal Month for five wins in one calendar month", () => {
    const five = ["01", "05", "09", "20", "28"].map((d) => win(1, 1, `2026-10-${d}T10:00`));
    expect(keys(producerBadges(five, new Map()), 1)).toContain("fiveDealMonth");
    expect(keys(producerBadges(five.slice(0, 4), new Map()), 1)).not.toContain("fiveDealMonth");
  });

  it("gives Target Reached when secured premium meets the annual target", () => {
    const wins = [win(1, 60_000, null), win(1, 40_000, "2026-11-02")];
    expect(keys(producerBadges(wins, new Map([[1, 100_000]])), 1)).toContain("targetReached");
    expect(keys(producerBadges(wins, new Map([[1, 100_001]])), 1)).not.toContain("targetReached");
    expect(keys(producerBadges(wins, new Map([[1, 0]])), 1)).not.toContain("targetReached");
  });

  it("gives Deal of the Quarter to the biggest single win in each quarter", () => {
    const badges = producerBadges(
      [win(1, 500, "2026-10-05"), win(2, 900, "2026-11-05"), win(1, 300, "2026-07-01"), win(2, 9_999, null)],
      new Map(),
    );
    expect(badges.get(2)).toContainEqual({ key: "dealOfQuarter", period: "Q4 2026" });
    expect(badges.get(1)).toContainEqual({ key: "dealOfQuarter", period: "Q3 2026" });
    expect(badges.get(1)).not.toContainEqual({ key: "dealOfQuarter", period: "Q4 2026" });
  });

  it("orders badges from most to least prestigious", () => {
    const wins = [win(1, 100_000, "2026-11-16"), win(1, 1, "2026-11-17"), win(1, 1, "2026-11-18")];
    expect(keys(producerBadges(wins, new Map([[1, 50_000]])), 1)).toEqual(["targetReached", "dealOfQuarter", "hatTrick", "firstWin"]);
  });
});

describe("winOfTheWeek", () => {
  const today = new Date("2026-11-18T12:00"); // Wednesday

  it("picks this week's biggest win", () => {
    const wins = [win(1, 500, "2026-11-16T10:00"), win(2, 800, "2026-11-17T10:00"), win(3, 9_000, "2026-11-12T10:00")];
    expect(winOfTheWeek(wins, today)).toMatchObject({ week: "this", win: { producerId: 2 } });
  });

  it("falls back to last week, and ignores undated wins", () => {
    const wins = [win(1, 500, "2026-11-10T10:00"), win(2, 50_000, null)];
    expect(winOfTheWeek(wins, today)).toMatchObject({ week: "last", win: { producerId: 1 } });
    expect(winOfTheWeek([win(1, 1, "2026-11-01")], today)).toBeNull();
  });
});
