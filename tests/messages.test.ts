import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import ar from "../messages/ar.json";
import en from "../messages/en.json";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [[prefix + k, v] as [string, string]] : leaves(v, `${prefix}${k}.`)));
}

describe("messages", () => {
  it("has the same keys in English and Arabic", () => {
    expect(leaves(ar).map(([k]) => k).sort()).toEqual(leaves(en).map(([k]) => k).sort());
  });

  it("uses the same placeholders in both languages", () => {
    const placeholders = (s: string) => [...new Set(s.match(/\{(\w+)/g) ?? [])].sort();
    const arMap = new Map(leaves(ar));
    for (const [key, text] of leaves(en)) expect(placeholders(arMap.get(key)!), key).toEqual(placeholders(text));
  });

  it("formats every message in Arabic without errors", () => {
    type Loose = { (key: string, values?: object): string; rich: (key: string, values?: object) => unknown };
    const t = createTranslator({ locale: "ar", messages: ar }) as unknown as Loose;
    const values = { count: 3, value: 50, name: "Adel", client: "Acme", who: "Adel", names: "A, B", amount: "1M", percent: "5%", target: "2M", status: "x", pace: "80%", won: 2, lost: 1, page: 1, pages: 2, rows: 30 };
    for (const [key] of leaves(ar)) {
      const rich = { ...values, b: (chunks: unknown) => chunks };
      expect(() => (key.includes("Feed") || key === "wins.youSecured" ? t.rich(key, rich) : t(key, values)), key).not.toThrow();
    }
  });

  it("chooses Arabic plural forms", () => {
    const t = createTranslator({ locale: "ar", messages: ar });
    expect(t("dashboard.leadsCount", { count: 1 })).toBe("فرصة واحدة");
    expect(t("dashboard.leadsCount", { count: 2 })).toBe("فرصتان");
    expect(t("dashboard.leadsCount", { count: 5 })).toBe("5 فرص");
    expect(t("dashboard.leadsCount", { count: 20 })).toBe("20 فرصة");
  });
});
