import { describe, expect, it } from "vitest";
import { buildProducerReport, summarizeReport, type ReportLead } from "@/lib/reports";

const producers = [
  { id: 1, code: "J-1", name: "Alice", annualTarget: "500000" },
  { id: 2, code: "R-1", name: "Bob", annualTarget: "300000" },
  { id: 3, code: "J-2", name: "Charlie", annualTarget: "0" },
];

const leads: ReportLead[] = [
  { producerId: 1, producerCode: "J-1", producerName: "Alice", status: "Secured", estimatedPremium: "100000", bor: true },
  { producerId: 1, producerCode: "J-1", producerName: "Alice", status: "Pending", estimatedPremium: "50000", bor: false },
  { producerId: 1, producerCode: "J-1", producerName: "Alice", status: "Lost", estimatedPremium: "30000", bor: false },
  { producerId: 2, producerCode: "R-1", producerName: "Bob", status: "Secured", estimatedPremium: "200000", bor: true },
  { producerId: 2, producerCode: "R-1", producerName: "Bob", status: "Secured", estimatedPremium: "150000", bor: true },
];

describe("buildProducerReport", () => {
  const rows = buildProducerReport(leads, producers);

  it("returns one row per producer", () => {
    expect(rows).toHaveLength(3);
  });

  it("aggregates lead counts for Alice", () => {
    const alice = rows.find((r) => r.code === "J-1")!;
    expect(alice.totalLeads).toBe(3);
    expect(alice.securedCount).toBe(1);
    expect(alice.pendingCount).toBe(1);
    expect(alice.lostCount).toBe(1);
    expect(alice.borCount).toBe(1);
  });

  it("aggregates premiums for Alice", () => {
    const alice = rows.find((r) => r.code === "J-1")!;
    expect(alice.securedPremium).toBe(100000);
    expect(alice.pendingPremium).toBe(50000);
    expect(alice.lostPremium).toBe(30000);
    expect(alice.totalPremium).toBe(180000);
  });

  it("calculates achievement percentage", () => {
    const alice = rows.find((r) => r.code === "J-1")!;
    expect(alice.achievementPct).toBeCloseTo(20);

    const bob = rows.find((r) => r.code === "R-1")!;
    expect(bob.achievementPct).toBeCloseTo(116.667, 2);
  });

  it("handles producer with zero target", () => {
    const charlie = rows.find((r) => r.code === "J-2")!;
    expect(charlie.achievementPct).toBe(0);
    expect(charlie.totalLeads).toBe(0);
  });

  it("returns zero stats for producer with no leads", () => {
    const charlie = rows.find((r) => r.code === "J-2")!;
    expect(charlie.securedPremium).toBe(0);
    expect(charlie.pendingPremium).toBe(0);
    expect(charlie.lostPremium).toBe(0);
    expect(charlie.totalPremium).toBe(0);
    expect(charlie.borCount).toBe(0);
  });
});

describe("summarizeReport", () => {
  const rows = buildProducerReport(leads, producers);
  const summary = summarizeReport(rows);

  it("totals all leads", () => {
    expect(summary.totalLeads).toBe(5);
  });

  it("totals BOR", () => {
    expect(summary.totalBor).toBe(3);
  });

  it("totals by status", () => {
    expect(summary.totalSecured).toBe(3);
    expect(summary.totalPending).toBe(1);
    expect(summary.totalLost).toBe(1);
  });

  it("totals premiums", () => {
    expect(summary.securedPremium).toBe(450000);
    expect(summary.pendingPremium).toBe(50000);
    expect(summary.lostPremium).toBe(30000);
    expect(summary.totalPremium).toBe(530000);
  });

  it("calculates success rate", () => {
    expect(summary.successRate).toBeCloseTo(0.6);
  });

  it("handles empty rows", () => {
    const empty = summarizeReport([]);
    expect(empty.totalLeads).toBe(0);
    expect(empty.successRate).toBe(0);
    expect(empty.totalPremium).toBe(0);
  });
});
