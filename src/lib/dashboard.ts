export interface DashboardLead {
  id: number;
  producerId: number;
  prospectName: string;
  startWorkingDate: string;
  rfqType: "New" | "Renewal";
  cob: "General" | "Medical" | "Motor";
  status: "Secured" | "Pending" | "Lost";
  estimatedPremium: string;
  city: string;
  producerName: string | null;
  producerCode: string | null;
  bor?: boolean;
  quoted?: boolean;
  commission?: string | null;
  quoteTimestamp?: string | null;
}

export interface KpiSummary {
  totalLeads: number;
  newLeads: number;
  renewalLeads: number;
  secured: number;
  pending: number;
  lost: number;
  securedPremium: number;
  pendingPremium: number;
  lostPremium: number;
  totalPremium: number;
  successRate: number;
  /** Secured out of closed (secured + lost) leads. */
  winRate: number;
  avgDealSize: number;
  commissionEarned: number;
  quoted: number;
  quoteRate: number;
  bor: number;
  borRate: number;
  /** Average days from start of work to quote, null when no lead has a quote date. */
  avgDaysToQuote: number | null;
}

const DAY_MS = 86_400_000;

export function computeKpis(leads: DashboardLead[]): KpiSummary {
  let secured = 0, pending = 0, lost = 0, newLeads = 0, quoted = 0, bor = 0;
  let securedPremium = 0, pendingPremium = 0, lostPremium = 0, commissionEarned = 0;
  let quoteDays = 0, quoteDated = 0;

  for (const l of leads) {
    const p = Number(l.estimatedPremium);
    if (l.status === "Secured") { secured++; securedPremium += p; commissionEarned += Number(l.commission ?? 0); }
    else if (l.status === "Pending") { pending++; pendingPremium += p; }
    else { lost++; lostPremium += p; }
    if (l.rfqType === "New") newLeads++;
    if (l.quoted) quoted++;
    if (l.bor) bor++;
    if (l.quoteTimestamp) {
      quoteDays += (Date.parse(l.quoteTimestamp) - Date.parse(l.startWorkingDate)) / DAY_MS;
      quoteDated++;
    }
  }

  const totalLeads = leads.length;
  const rate = (n: number, of: number) => (of > 0 ? n / of : 0);
  return {
    totalLeads,
    newLeads,
    renewalLeads: totalLeads - newLeads,
    secured, pending, lost,
    securedPremium, pendingPremium, lostPremium,
    totalPremium: securedPremium + pendingPremium + lostPremium,
    successRate: rate(secured, totalLeads),
    winRate: rate(secured, secured + lost),
    avgDealSize: rate(securedPremium, secured),
    commissionEarned,
    quoted,
    quoteRate: rate(quoted, totalLeads),
    bor,
    borRate: rate(bor, totalLeads),
    avgDaysToQuote: quoteDated > 0 ? quoteDays / quoteDated : null,
  };
}

export interface StatusBreakdown { name: string; secured: number; pending: number; lost: number }

/** Premium split by lead status for each group, sorted by group name. */
export function statusBreakdown(leads: DashboardLead[], groupOf: (l: DashboardLead) => string): StatusBreakdown[] {
  const map = new Map<string, StatusBreakdown>();
  for (const l of leads) {
    const name = groupOf(l);
    const entry = map.get(name) ?? { name, secured: 0, pending: 0, lost: 0 };
    const p = Number(l.estimatedPremium);
    if (l.status === "Secured") entry.secured += p;
    else if (l.status === "Pending") entry.pending += p;
    else entry.lost += p;
    map.set(name, entry);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export const monthOf = (l: DashboardLead) => l.startWorkingDate.slice(0, 7);

export const AGING_BUCKETS = ["0-30", "31-60", "61-90", "90+"] as const;

/** Pending leads grouped by days since work started. */
export function pipelineAging(leads: DashboardLead[], today: Date): { name: string; count: number; value: number }[] {
  const buckets = AGING_BUCKETS.map((name) => ({ name, count: 0, value: 0 }));
  for (const l of leads) {
    if (l.status !== "Pending") continue;
    const days = (today.getTime() - Date.parse(l.startWorkingDate)) / DAY_MS;
    const bucket = buckets[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3];
    bucket.count++;
    bucket.value += Number(l.estimatedPremium);
  }
  return buckets;
}
