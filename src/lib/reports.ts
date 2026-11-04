export interface ReportLead {
  producerId: number;
  producerCode: string | null;
  producerName: string | null;
  status: "Secured" | "Pending" | "Lost";
  estimatedPremium: string;
  bor: boolean;
}

export interface ProducerReportRow {
  code: string;
  name: string;
  totalLeads: number;
  borCount: number;
  securedCount: number;
  pendingCount: number;
  lostCount: number;
  securedPremium: number;
  pendingPremium: number;
  lostPremium: number;
  totalPremium: number;
  annualTarget: number;
  achievementPct: number;
}

export function buildProducerReport(
  leads: ReportLead[],
  producers: { id: number; code: string; name: string; annualTarget: string }[],
): ProducerReportRow[] {
  const map = new Map<number, Omit<ProducerReportRow, "code" | "name" | "annualTarget" | "achievementPct">>();

  for (const l of leads) {
    const entry = map.get(l.producerId) ?? {
      totalLeads: 0, borCount: 0, securedCount: 0, pendingCount: 0, lostCount: 0,
      securedPremium: 0, pendingPremium: 0, lostPremium: 0, totalPremium: 0,
    };
    entry.totalLeads++;
    if (l.bor) entry.borCount++;
    const p = Number(l.estimatedPremium);
    entry.totalPremium += p;
    if (l.status === "Secured") { entry.securedCount++; entry.securedPremium += p; }
    else if (l.status === "Pending") { entry.pendingCount++; entry.pendingPremium += p; }
    else { entry.lostCount++; entry.lostPremium += p; }
    map.set(l.producerId, entry);
  }

  return producers.map((prod) => {
    const stats = map.get(prod.id) ?? {
      totalLeads: 0, borCount: 0, securedCount: 0, pendingCount: 0, lostCount: 0,
      securedPremium: 0, pendingPremium: 0, lostPremium: 0, totalPremium: 0,
    };
    const target = Number(prod.annualTarget);
    return {
      code: prod.code,
      name: prod.name,
      annualTarget: target,
      achievementPct: target > 0 ? (stats.securedPremium / target) * 100 : 0,
      ...stats,
    };
  });
}

export interface ReportSummary {
  totalLeads: number;
  totalBor: number;
  totalSecured: number;
  totalPending: number;
  totalLost: number;
  securedPremium: number;
  pendingPremium: number;
  lostPremium: number;
  totalPremium: number;
  successRate: number;
}

export function summarizeReport(rows: ProducerReportRow[]): ReportSummary {
  const s: ReportSummary = {
    totalLeads: 0, totalBor: 0, totalSecured: 0, totalPending: 0, totalLost: 0,
    securedPremium: 0, pendingPremium: 0, lostPremium: 0, totalPremium: 0, successRate: 0,
  };
  for (const r of rows) {
    s.totalLeads += r.totalLeads;
    s.totalBor += r.borCount;
    s.totalSecured += r.securedCount;
    s.totalPending += r.pendingCount;
    s.totalLost += r.lostCount;
    s.securedPremium += r.securedPremium;
    s.pendingPremium += r.pendingPremium;
    s.lostPremium += r.lostPremium;
    s.totalPremium += r.totalPremium;
  }
  s.successRate = s.totalLeads > 0 ? s.totalSecured / s.totalLeads : 0;
  return s;
}
