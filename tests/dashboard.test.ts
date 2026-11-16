import { describe, expect, it } from "vitest";
import {
  computeKpis,
  monthOf,
  pipelineAging,
  statusBreakdown,
  type DashboardLead,
} from "../src/lib/dashboard";

function lead(overrides: Partial<DashboardLead> = {}): DashboardLead {
  return {
    id: 1,
    producerId: 1,
    prospectName: "Test Co",
    startWorkingDate: "2025-03-15",
    rfqType: "New",
    cob: "General",
    status: "Pending",
    estimatedPremium: "10000",
    city: "Jeddah",
    producerName: "Ali",
    producerCode: "J-1",
    ...overrides,
  };
}

describe("computeKpis", () => {
  it("derives win rate, deal size, commission, quote and BOR rates", () => {
    const kpis = computeKpis([
      lead({ status: "Secured", estimatedPremium: "60000", commission: "6000", quoted: true, bor: true, startWorkingDate: "2025-03-01", quoteTimestamp: "2025-03-11" }),
      lead({ status: "Secured", estimatedPremium: "40000", commission: "4000", quoted: true, rfqType: "Renewal", startWorkingDate: "2025-03-01", quoteTimestamp: "2025-03-21" }),
      lead({ status: "Lost", estimatedPremium: "10000", commission: "999" }),
      lead({ status: "Pending" }),
    ]);
    expect(kpis.winRate).toBeCloseTo(2 / 3);
    expect(kpis.successRate).toBe(0.5);
    expect(kpis.avgDealSize).toBe(50000);
    expect(kpis.commissionEarned).toBe(10000);
    expect(kpis.quoted).toBe(2);
    expect(kpis.quoteRate).toBe(0.5);
    expect(kpis.borRate).toBe(0.25);
    expect(kpis.avgDaysToQuote).toBe(15);
    expect(kpis.newLeads).toBe(3);
    expect(kpis.renewalLeads).toBe(1);
  });

  it("has no average days to quote without quote dates", () => {
    expect(computeKpis([lead()]).avgDaysToQuote).toBeNull();
    expect(computeKpis([]).winRate).toBe(0);
  });

  it("returns zeros for empty array", () => {
    const kpis = computeKpis([]);
    expect(kpis.totalLeads).toBe(0);
    expect(kpis.secured).toBe(0);
    expect(kpis.pending).toBe(0);
    expect(kpis.lost).toBe(0);
    expect(kpis.securedPremium).toBe(0);
    expect(kpis.pendingPremium).toBe(0);
    expect(kpis.lostPremium).toBe(0);
    expect(kpis.totalPremium).toBe(0);
    expect(kpis.successRate).toBe(0);
  });

  it("counts statuses correctly", () => {
    const leads = [
      lead({ status: "Secured", estimatedPremium: "50000" }),
      lead({ status: "Secured", estimatedPremium: "30000" }),
      lead({ status: "Pending", estimatedPremium: "20000" }),
      lead({ status: "Lost", estimatedPremium: "10000" }),
    ];
    const kpis = computeKpis(leads);
    expect(kpis.totalLeads).toBe(4);
    expect(kpis.secured).toBe(2);
    expect(kpis.pending).toBe(1);
    expect(kpis.lost).toBe(1);
  });

  it("sums premiums by status", () => {
    const leads = [
      lead({ status: "Secured", estimatedPremium: "50000" }),
      lead({ status: "Secured", estimatedPremium: "30000" }),
      lead({ status: "Pending", estimatedPremium: "20000" }),
      lead({ status: "Lost", estimatedPremium: "10000" }),
    ];
    const kpis = computeKpis(leads);
    expect(kpis.securedPremium).toBe(80000);
    expect(kpis.pendingPremium).toBe(20000);
    expect(kpis.lostPremium).toBe(10000);
    expect(kpis.totalPremium).toBe(110000);
  });

  it("calculates success rate", () => {
    const leads = [
      lead({ status: "Secured" }),
      lead({ status: "Pending" }),
      lead({ status: "Lost" }),
      lead({ status: "Secured" }),
    ];
    const kpis = computeKpis(leads);
    expect(kpis.successRate).toBe(0.5);
  });
});

describe("statusBreakdown", () => {
  it("splits premium by status per group, sorted", () => {
    const rows = statusBreakdown(
      [
        lead({ cob: "Motor", status: "Secured", estimatedPremium: "100" }),
        lead({ cob: "Medical", status: "Lost", estimatedPremium: "50" }),
        lead({ cob: "Motor", status: "Pending", estimatedPremium: "30" }),
      ],
      (l) => l.cob,
    );
    expect(rows).toEqual([
      { name: "Medical", secured: 0, pending: 0, lost: 50 },
      { name: "Motor", secured: 100, pending: 30, lost: 0 },
    ]);
  });

  it("groups by month with monthOf", () => {
    const rows = statusBreakdown([lead({ startWorkingDate: "2025-03-15" }), lead({ startWorkingDate: "2025-01-02" })], monthOf);
    expect(rows.map((r) => r.name)).toEqual(["2025-01", "2025-03"]);
  });
});

describe("pipelineAging", () => {
  it("buckets pending leads by days since start", () => {
    const today = new Date("2025-06-30");
    const rows = pipelineAging(
      [
        lead({ startWorkingDate: "2025-06-20", estimatedPremium: "10" }),
        lead({ startWorkingDate: "2025-05-15", estimatedPremium: "20" }),
        lead({ startWorkingDate: "2025-04-15", estimatedPremium: "30" }),
        lead({ startWorkingDate: "2025-01-01", estimatedPremium: "40" }),
        lead({ startWorkingDate: "2025-01-01", status: "Secured" }),
      ],
      today,
    );
    expect(rows.map((r) => r.count)).toEqual([1, 1, 1, 1]);
    expect(rows.map((r) => r.value)).toEqual([10, 20, 30, 40]);
  });
});
