import { describe, expect, it } from "vitest";
import type { DashboardLead } from "@/lib/dashboard";
import { RIYAL } from "@/lib/format";
import { buildProducerReport, summarizeReport } from "@/lib/reports";
import type { DashboardData } from "@/server/dashboard-data";
import { buildDashboardHtml } from "@/server/exports/dashboard-pdf";
import { esc, filterSummary } from "@/server/exports/letterhead";
import { buildProducerHtml } from "@/server/exports/pdf";

function lead(overrides: Partial<DashboardLead>): DashboardLead {
  return {
    id: 1,
    producerId: 1,
    prospectName: "Client",
    startWorkingDate: "2026-03-10",
    rfqType: "New",
    cob: "Medical",
    status: "Pending",
    estimatedPremium: "1000",
    city: "Jeddah",
    producerName: "Alice",
    producerCode: "J-101",
    ...overrides,
  };
}

const data: DashboardData = {
  leads: [
    lead({ id: 1, status: "Secured", estimatedPremium: "50000", bor: true, quoted: true }),
    lead({ id: 2, status: "Lost", estimatedPremium: "20000", startWorkingDate: "2026-05-02" }),
    lead({ id: 3, producerId: 2, producerName: "Bob <B>", producerCode: "R-202", cob: "Motor" }),
  ],
  producers: [
    { id: 1, code: "J-101", name: "Alice", annualTarget: "100000" },
    { id: 2, code: "R-202", name: "Bob <B>", annualTarget: "200000" },
  ],
  prospects: [
    { producerId: 1, total: 10, converted: 2, premiums: 90000 },
    { producerId: 2, total: 5, converted: 0, premiums: 1000 },
  ],
};

describe("buildDashboardHtml", () => {
  it("shows names, not producer codes, and escapes them", async () => {
    const html = await buildDashboardHtml(data, {}, new Date(2026, 5, 30));
    expect(html).toContain("Alice");
    expect(html).toContain("Bob &#60;B&#62;");
    expect(html).not.toContain("J-101");
    expect(html).not.toContain("R-202");
  });

  it("embeds the logo and the Riyal font so the sign prints on any machine", async () => {
    const html = await buildDashboardHtml(data, {}, new Date(2026, 5, 30));
    expect(html).toContain('src="data:image/svg+xml;base64,');
    expect(html).toContain('font-family: "Saudi Riyal"');
    expect(html).toContain("unicode-range: U+20C1");
    expect(html).toContain(RIYAL);
  });

  it("applies the producer filter to leads, prospects and target", async () => {
    const html = await buildDashboardHtml(data, { producerId: 2, producer: "Bob <B>" }, new Date(2026, 5, 30));
    expect(html).toContain("Producer: Bob &#60;B&#62;");
    expect(html).not.toContain(">Alice<");
    // Bob: 5 prospects, 1 lead, target 200K
    expect(html).toMatch(/Prospects<\/div><div class="value">5</);
    expect(html).toMatch(/Leads<\/div><div class="value">1</);
    expect(html).toContain("200K annual target");
  });

  it("applies the date filter", async () => {
    const html = await buildDashboardHtml(data, { from: "2026-04-01" }, new Date(2026, 5, 30));
    expect(html).toMatch(/Leads<\/div><div class="value">1</);
  });
});

describe("buildProducerHtml", () => {
  it("has no code column", async () => {
    const rows = buildProducerReport(
      data.leads.map((l) => ({ ...l, bor: l.bor ?? false })),
      data.producers,
    );
    const html = await buildProducerHtml(rows, summarizeReport(rows), {});
    expect(html).not.toContain(">Code<");
    expect(html).not.toContain("J-101");
    expect(html).toContain("<th>Producer</th>");
  });
});

describe("letterhead helpers", () => {
  it("summarises filters", () => {
    expect(filterSummary({})).toBe("All producers, all dates");
    expect(filterSummary({ from: "2026-01-01", producer: "Alice", status: "Secured" })).toBe(
      "Date: 2026-01-01 to present  |  Producer: Alice  |  Status: Secured",
    );
  });

  it("escapes HTML", () => {
    expect(esc(`<a href="x">&'`)).toBe("&#60;a href=&#34;x&#34;&#62;&#38;&#39;");
  });
});
