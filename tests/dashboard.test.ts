import { describe, expect, it } from "vitest";
import {
  computeKpis,
  groupByField,
  monthlyTrend,
  quarterlyPerformance,
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

describe("groupByField", () => {
  it("groups by rfqType", () => {
    const leads = [
      lead({ rfqType: "New", estimatedPremium: "10000" }),
      lead({ rfqType: "Renewal", estimatedPremium: "20000" }),
      lead({ rfqType: "New", estimatedPremium: "5000" }),
    ];
    const result = groupByField(leads, "rfqType");
    const newGroup = result.find((r) => r.name === "New")!;
    const renewalGroup = result.find((r) => r.name === "Renewal")!;
    expect(newGroup.value).toBe(15000);
    expect(newGroup.count).toBe(2);
    expect(renewalGroup.value).toBe(20000);
    expect(renewalGroup.count).toBe(1);
  });

  it("groups by cob", () => {
    const leads = [
      lead({ cob: "General", estimatedPremium: "10000" }),
      lead({ cob: "Medical", estimatedPremium: "20000" }),
      lead({ cob: "General", estimatedPremium: "30000" }),
    ];
    const result = groupByField(leads, "cob");
    expect(result.find((r) => r.name === "General")!.value).toBe(40000);
    expect(result.find((r) => r.name === "Medical")!.value).toBe(20000);
  });

  it("groups by city", () => {
    const leads = [
      lead({ city: "Jeddah", estimatedPremium: "10000" }),
      lead({ city: "Riyadh", estimatedPremium: "20000" }),
      lead({ city: "Jeddah", estimatedPremium: "5000" }),
    ];
    const result = groupByField(leads, "city");
    expect(result.find((r) => r.name === "Jeddah")!.count).toBe(2);
    expect(result.find((r) => r.name === "Riyadh")!.count).toBe(1);
  });

  it("returns empty for no leads", () => {
    expect(groupByField([], "rfqType")).toEqual([]);
  });
});

describe("monthlyTrend", () => {
  it("groups by year-month sorted", () => {
    const leads = [
      lead({ startWorkingDate: "2025-01-10", estimatedPremium: "10000" }),
      lead({ startWorkingDate: "2025-03-20", estimatedPremium: "20000" }),
      lead({ startWorkingDate: "2025-01-25", estimatedPremium: "5000" }),
    ];
    const result = monthlyTrend(leads);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("2025-01");
    expect(result[0].value).toBe(15000);
    expect(result[0].count).toBe(2);
    expect(result[1].name).toBe("2025-03");
    expect(result[1].value).toBe(20000);
    expect(result[1].count).toBe(1);
  });

  it("returns empty for no leads", () => {
    expect(monthlyTrend([])).toEqual([]);
  });
});

describe("quarterlyPerformance", () => {
  it("groups by quarter with status breakdown", () => {
    const leads = [
      lead({ startWorkingDate: "2025-01-10", status: "Secured", estimatedPremium: "50000" }),
      lead({ startWorkingDate: "2025-02-15", status: "Pending", estimatedPremium: "20000" }),
      lead({ startWorkingDate: "2025-04-10", status: "Lost", estimatedPremium: "10000" }),
      lead({ startWorkingDate: "2025-05-20", status: "Secured", estimatedPremium: "30000" }),
    ];
    const result = quarterlyPerformance(leads);
    expect(result).toHaveLength(2);
    const q1 = result.find((r) => r.quarter === "Q1 2025")!;
    const q2 = result.find((r) => r.quarter === "Q2 2025")!;
    expect(q1.secured).toBe(50000);
    expect(q1.pending).toBe(20000);
    expect(q1.lost).toBe(0);
    expect(q2.secured).toBe(30000);
    expect(q2.lost).toBe(10000);
  });

  it("returns empty for no leads", () => {
    expect(quarterlyPerformance([])).toEqual([]);
  });
});
