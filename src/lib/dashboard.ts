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
}

export interface KpiSummary {
  totalLeads: number;
  secured: number;
  pending: number;
  lost: number;
  securedPremium: number;
  pendingPremium: number;
  lostPremium: number;
  totalPremium: number;
  successRate: number;
}

export function computeKpis(leads: DashboardLead[]): KpiSummary {
  let secured = 0, pending = 0, lost = 0;
  let securedPremium = 0, pendingPremium = 0, lostPremium = 0;

  for (const l of leads) {
    const p = Number(l.estimatedPremium);
    if (l.status === "Secured") { secured++; securedPremium += p; }
    else if (l.status === "Pending") { pending++; pendingPremium += p; }
    else { lost++; lostPremium += p; }
  }

  const totalLeads = leads.length;
  return {
    totalLeads,
    secured, pending, lost,
    securedPremium, pendingPremium, lostPremium,
    totalPremium: securedPremium + pendingPremium + lostPremium,
    successRate: totalLeads > 0 ? secured / totalLeads : 0,
  };
}

export interface ChartDatum { name: string; value: number; count?: number }

export function groupByField<K extends keyof DashboardLead>(
  leads: DashboardLead[],
  field: K,
): ChartDatum[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const l of leads) {
    const key = String(l[field]);
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += Number(l.estimatedPremium);
    entry.count++;
    map.set(key, entry);
  }
  return Array.from(map, ([name, { value, count }]) => ({ name, value, count }));
}

export function monthlyTrend(leads: DashboardLead[]): ChartDatum[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const l of leads) {
    const d = new Date(l.startWorkingDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += Number(l.estimatedPremium);
    entry.count++;
    map.set(key, entry);
  }
  return Array.from(map, ([name, { value, count }]) => ({ name, value, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function quarterlyPerformance(leads: DashboardLead[]): { quarter: string; secured: number; pending: number; lost: number }[] {
  const map = new Map<string, { secured: number; pending: number; lost: number }>();
  for (const l of leads) {
    const d = new Date(l.startWorkingDate);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const key = `Q${q} ${d.getFullYear()}`;
    const entry = map.get(key) ?? { secured: 0, pending: 0, lost: 0 };
    const p = Number(l.estimatedPremium);
    if (l.status === "Secured") entry.secured += p;
    else if (l.status === "Pending") entry.pending += p;
    else entry.lost += p;
    map.set(key, entry);
  }
  return Array.from(map, ([quarter, vals]) => ({ quarter, ...vals }))
    .sort((a, b) => a.quarter.localeCompare(b.quarter));
}

export interface ProducerPerformance {
  name: string;
  secured: number;
  target: number;
}
