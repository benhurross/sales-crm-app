import { describe, expect, it } from "vitest";
import { securedColumns, winEmail } from "@/server/wins";

describe("winEmail", () => {
  const win = { producer: "Adel <A>", client: "Baskin & Robbins", premium: 45_000.4, cob: "Medical", rfqType: "New" };

  it("is written in English then Arabic, escaping HTML", () => {
    const mail = winEmail(win, "http://192.168.0.119:3600/");
    expect(mail.subject).toBe("Deal secured: Adel <A> won Baskin & Robbins | صفقة مُبرمة: Adel <A> أبرم صفقة Baskin & Robbins");
    expect(mail.html).toContain("Adel &#60;A&#62; secured a deal");
    expect(mail.html).toContain("Baskin &#38; Robbins");
    expect(mail.html).toContain("SAR 45,000");
    expect(mail.html).toContain("45,000 ريال");
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toContain("طبي, جديد");
    expect(mail.html.indexOf("secured a deal")).toBeLessThan(mail.html.indexOf("أبرم صفقة"));
    expect(mail.html).toContain('href="http://192.168.0.119:3600/leads"');
    expect(mail.text).toContain("http://192.168.0.119:3600/leads");
  });

  it("leaves out the link when no app address is set", () => {
    const mail = winEmail(win);
    expect(mail.html).not.toContain("href");
    expect(mail.text).not.toContain("http");
  });
});

describe("securedColumns", () => {
  it("leaves the secured time alone when the status is not being changed", () => {
    expect(securedColumns(undefined)).toEqual({});
  });

  it("clears it when a lead stops being Secured", () => {
    expect(securedColumns("Lost")).toEqual({ securedAt: null, celebratedAt: null });
  });

  it("stamps it only for leads that were not already Secured", () => {
    const cols = securedColumns("Secured");
    expect(Object.keys(cols)).toEqual(["securedAt", "celebratedAt"]);
  });
});
