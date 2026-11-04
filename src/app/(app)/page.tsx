"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { formatAmount, formatCompact, RIYAL } from "@/lib/format";
import {
  computeKpis,
  groupByField,
  monthlyTrend,
  quarterlyPerformance,
  type DashboardLead,
  type ProducerPerformance,
} from "@/lib/dashboard";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const STATUS_COLORS: Record<string, string> = {
  Secured: "#10b981",
  Pending: "#f59e0b",
  Lost: "#ef4444",
};

interface DashboardData {
  leads: DashboardLead[];
  producers: { id: number; code: string; name: string; annualTarget: string }[];
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const isSalesman = user.role === "salesman";

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => fetch("/api/dashboard").then((r) => r.json()),
  });

  const [producerFilter, setProducerFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    let leads = data.leads;
    if (producerFilter) leads = leads.filter((l) => l.producerId === Number(producerFilter));
    if (dateFrom) leads = leads.filter((l) => l.startWorkingDate >= dateFrom);
    if (dateTo) leads = leads.filter((l) => l.startWorkingDate <= dateTo);
    return leads;
  }, [data, producerFilter, dateFrom, dateTo]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);
  const byRfq = useMemo(() => groupByField(filtered, "rfqType"), [filtered]);
  const byCob = useMemo(() => groupByField(filtered, "cob"), [filtered]);
  const byCity = useMemo(() => groupByField(filtered, "city"), [filtered]);
  const monthly = useMemo(() => monthlyTrend(filtered), [filtered]);
  const quarterly = useMemo(() => quarterlyPerformance(filtered), [filtered]);

  const producerPerf = useMemo<ProducerPerformance[]>(() => {
    if (!data) return [];
    const securedMap = new Map<number, number>();
    for (const l of filtered) {
      if (l.status === "Secured") {
        securedMap.set(l.producerId, (securedMap.get(l.producerId) ?? 0) + Number(l.estimatedPremium));
      }
    }
    return data.producers
      .map((p) => ({
        name: `${p.code} - ${p.name}`,
        secured: securedMap.get(p.id) ?? 0,
        target: Number(p.annualTarget),
      }))
      .sort((a, b) => b.secured - a.secured);
  }, [data, filtered]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Sales performance overview" />
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Sales performance overview" />

      {/* Filters */}
      {!isSalesman && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)}
          >
            <option value="">All Producers</option>
            {data?.producers.map((p) => (
              <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
            ))}
          </select>
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="To"
          />
          {(producerFilter || dateFrom || dateTo) && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => { setProducerFilter(""); setDateFrom(""); setDateTo(""); }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Leads" value={String(kpis.totalLeads)} />
        <KpiCard label="Secured" value={String(kpis.secured)} sub={formatAmount(kpis.securedPremium)} color="text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="Pending" value={String(kpis.pending)} sub={formatAmount(kpis.pendingPremium)} color="text-amber-600 dark:text-amber-400" />
        <KpiCard label="Lost" value={String(kpis.lost)} sub={formatAmount(kpis.lostPremium)} color="text-red-600 dark:text-red-400" />
      </div>

      {/* Premium Breakdown + Success Rate */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 shadow-glass glass-sheen">
          <p className="text-sm font-medium text-muted-foreground">Total Premium</p>
          <p className="mt-1 text-2xl font-semibold">{formatAmount(kpis.totalPremium)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-glass glass-sheen">
          <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
          <p className="mt-1 text-2xl font-semibold">{(kpis.successRate * 100).toFixed(1)}%</p>
          <Progress value={kpis.successRate * 100} className="mt-2 h-2" indicatorClassName="bg-emerald-500" />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-glass glass-sheen">
          <p className="text-sm font-medium text-muted-foreground">Premium by Status</p>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-emerald-600">Secured</span><span>{formatCompact(kpis.securedPremium)}</span></div>
            <div className="flex justify-between"><span className="text-amber-600">Pending</span><span>{formatCompact(kpis.pendingPremium)}</span></div>
            <div className="flex justify-between"><span className="text-red-600">Lost</span><span>{formatCompact(kpis.lostPremium)}</span></div>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Pie charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Leads by RFQ Type">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byRfq} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ name, payload }) => `${name} (${(payload as { count?: number }).count ?? ""})`}>
                {byRfq.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatAmount(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Leads by COB">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={byCob} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ name, payload }) => `${name} (${(payload as { count?: number }).count ?? ""})`}>
                {byCob.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => formatAmount(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2: Bar + Line */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Leads by City">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={byCity}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="fill-muted-foreground" tick={{ fontSize: 12 }} />
              <YAxis className="fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${RIYAL}${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatAmount(Number(v))} />
              <Bar dataKey="value" name="Premium" radius={[4, 4, 0, 0]}>
                {byCity.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Lead Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="fill-muted-foreground" tick={{ fontSize: 12 }} />
              <YAxis className="fill-muted-foreground" tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v, name) => name === "count" ? v : formatAmount(Number(v))} />
              <Line type="monotone" dataKey="count" name="Leads" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="value" name="Premium" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 4 }} yAxisId={0} />
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 3: Quarterly + Producer */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Quarterly Performance">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={quarterly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="quarter" className="fill-muted-foreground" tick={{ fontSize: 12 }} />
              <YAxis className="fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${RIYAL}${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v) => formatAmount(Number(v))} />
              <Bar dataKey="secured" name="Secured" fill={STATUS_COLORS.Secured} radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" name="Pending" fill={STATUS_COLORS.Pending} radius={[4, 4, 0, 0]} />
              <Bar dataKey="lost" name="Lost" fill={STATUS_COLORS.Lost} radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Target vs Secured by Producer">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={producerPerf} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" className="fill-muted-foreground" tick={{ fontSize: 12 }} tickFormatter={(v) => `${RIYAL}${(v / 1000).toFixed(0)}K`} />
              <YAxis dataKey="name" type="category" className="fill-muted-foreground" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v) => formatAmount(Number(v))} />
              <Bar dataKey="target" name="Target" fill="var(--chart-5)" radius={[0, 4, 4, 0]} />
              <Bar dataKey="secured" name="Secured" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-glass glass-sheen">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color ?? ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-glass glass-sheen">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}
