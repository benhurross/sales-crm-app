"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo, useState } from "react";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { formatAmount, formatCompact, formatPercent, RIYAL } from "@/lib/format";
import {
  computeKpis,
  monthOf,
  pipelineAging,
  statusBreakdown,
  type DashboardLead,
} from "@/lib/dashboard";

const STATUS_COLORS = { Secured: "#10b981", Pending: "#f59e0b", Lost: "#ef4444" };
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const GRID = { stroke: "var(--border)", strokeOpacity: 0.6 };
const CURSOR = { fill: "var(--accent)", opacity: 0.35 };
const LEGEND = { iconType: "circle", iconSize: 8, wrapperStyle: { fontSize: 12 }, itemSorter: null } as const;
const compactAxis = (v: number) => formatCompact(v).replace(`${RIYAL} `, "");
const money = (v: number) => formatAmount(v);

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "2-digit" });
}

interface DashboardData {
  leads: DashboardLead[];
  producers: { id: number; name: string; annualTarget: string }[];
  prospects: { producerId: number; total: number; converted: number; premiums: number }[];
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

  const prospects = useMemo(() => {
    const totals = { total: 0, converted: 0, premiums: 0 };
    for (const p of data?.prospects ?? []) {
      if (producerFilter && p.producerId !== Number(producerFilter)) continue;
      totals.total += p.total;
      totals.converted += p.converted;
      totals.premiums += p.premiums;
    }
    return totals;
  }, [data, producerFilter]);

  const annualTarget = useMemo(
    () =>
      (data?.producers ?? [])
        .filter((p) => !producerFilter || p.id === Number(producerFilter))
        .reduce((sum, p) => sum + Number(p.annualTarget), 0),
    [data, producerFilter],
  );
  const targetAchievement = annualTarget > 0 ? kpis.securedPremium / annualTarget : 0;
  const [yearPace] = useState(() => {
    const now = new Date();
    return (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (365.25 * 86_400_000);
  });
  const paceStatus =
    targetAchievement >= yearPace ? "On pace" : targetAchievement >= yearPace / 2 ? "Behind pace" : "Well behind pace";
  const paceColor =
    targetAchievement >= yearPace ? STATUS_COLORS.Secured : targetAchievement >= yearPace / 2 ? STATUS_COLORS.Pending : STATUS_COLORS.Lost;

  const funnel = [
    { name: "Prospects", count: prospects.total },
    { name: "Leads", count: kpis.totalLeads },
    { name: "BOR received", count: kpis.bor },
    { name: "Quoted", count: kpis.quoted },
    { name: "Secured", count: kpis.secured },
  ];

  const monthlyStatus = useMemo(() => statusBreakdown(filtered, monthOf), [filtered]);
  const cobStatus = useMemo(() => statusBreakdown(filtered, (l) => l.cob), [filtered]);
  const [today] = useState(() => new Date());
  const aging = useMemo(() => pipelineAging(filtered, today), [filtered, today]);
  const monthlyVolume = useMemo(() => {
    const map = new Map<string, { name: string; New: number; Renewal: number }>();
    for (const l of filtered) {
      const key = monthOf(l);
      const entry = map.get(key) ?? { name: key, New: 0, Renewal: 0 };
      entry[l.rfqType]++;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const leaderboard = useMemo(() => {
    if (!data) return [];
    const byProducer = new Map<number, DashboardLead[]>();
    for (const l of filtered) byProducer.set(l.producerId, [...(byProducer.get(l.producerId) ?? []), l]);
    return data.producers
      .filter((p) => !producerFilter || p.id === Number(producerFilter))
      .map((p) => {
        const k = computeKpis(byProducer.get(p.id) ?? []);
        const target = Number(p.annualTarget);
        return { id: p.id, name: p.name, leads: k.totalLeads, winRate: k.winRate, closed: k.secured + k.lost, secured: k.securedPremium, pipeline: k.pendingPremium, target, achievement: target > 0 ? k.securedPremium / target : 0 };
      })
      .filter((p) => p.leads > 0 || p.target > 0)
      .sort((a, b) => b.secured - a.secured || b.leads - a.leads);
  }, [data, filtered, producerFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" description="Sales performance overview" />
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" description="Sales performance overview" />

      {/* Filters */}
      {!isSalesman && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-input bg-popover px-3 text-sm"
            value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)}
          >
            <option value="">All Producers</option>
            {data?.producers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-popover px-3 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="From date"
          />
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-popover px-3 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="To date"
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

      {/* KPI tiles: pipeline volume, then performance */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4 @4xl:grid-cols-7">
          <KpiCard label="Prospects" value={prospects.total.toLocaleString()} sub={`${formatCompact(prospects.premiums)} potential`} color="text-blue-600 dark:text-blue-400" />
          <KpiCard label="Converted" value={prospects.converted.toLocaleString()} sub={`${(prospects.total - prospects.converted).toLocaleString()} open`} color="text-emerald-600 dark:text-emerald-400" />
          <KpiCard label="Conversion Rate" value={formatPercent(prospects.total > 0 ? prospects.converted / prospects.total : 0)} sub="prospects to leads" />
          <KpiCard label="Leads" value={kpis.totalLeads.toLocaleString()} sub={`${kpis.renewalLeads} renewals`} />
          <KpiCard label="Open Pipeline" value={formatCompact(kpis.pendingPremium)} sub={`${kpis.pending} pending`} color="text-amber-600 dark:text-amber-400" />
          <KpiCard label="Secured" value={formatCompact(kpis.securedPremium)} sub={`${kpis.secured} leads won`} color="text-emerald-600 dark:text-emerald-400" />
          <KpiCard label="Lost" value={formatCompact(kpis.lostPremium)} sub={`${kpis.lost} leads lost`} color="text-red-600 dark:text-red-400" />

          <KpiCard label="Total Premium" value={formatCompact(kpis.totalPremium)} sub="all leads" />
          <KpiCard label="Success Rate" value={formatPercent(kpis.successRate)} sub="of all leads" progress={kpis.successRate} />
          <KpiCard label="Avg Deal Size" value={formatCompact(kpis.avgDealSize)} sub="per secured lead" />
          <KpiCard label="Commission" value={formatCompact(kpis.commissionEarned)} sub={`${formatPercent(kpis.securedPremium > 0 ? kpis.commissionEarned / kpis.securedPremium : 0)} of secured`} />
          <KpiCard label="Quote Rate" value={formatPercent(kpis.quoteRate)} sub={`${kpis.quoted} leads quoted`} />
          <KpiCard label="BOR Rate" value={formatPercent(kpis.borRate)} sub={`${kpis.bor} received`} />
          <KpiCard label="Days to Quote" value={kpis.avgDaysToQuote === null ? "--" : kpis.avgDaysToQuote.toFixed(0)} sub="average, from start" />
        </div>
      </div>

      {/* Headline gauges + funnel */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title="Target Achievement" subtitle={`Secured premium vs ${formatCompact(annualTarget)} annual target`}>
          <Gauge
            value={targetAchievement}
            color={paceColor}
            marker={yearPace}
            markerLabel="Year-to-date pace"
            caption={`${formatCompact(kpis.securedPremium)} secured`}
            status={`${paceStatus} (pace ${formatPercent(yearPace)})`}
          />
        </ChartCard>
        <ChartCard title="Win Rate" subtitle="Secured out of closed leads">
          <Gauge
            value={kpis.winRate}
            color="var(--chart-1)"
            caption={`${kpis.secured} won, ${kpis.lost} lost`}
            status={`${kpis.pending} still open`}
          />
        </ChartCard>
        <ChartCard title="Sales Funnel" subtitle="Count at each stage, with conversion from the stage before" className="md:col-span-2">
          <Funnel stages={funnel} />
        </ChartCard>
      </div>

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Monthly Premium by Status" subtitle="Estimated premium by the month work started" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyStatus} barCategoryGap="28%">
              <CartesianGrid vertical={false} {...GRID} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={monthLabel} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} width={44} />
              <Tooltip content={<ChartTooltip formatter={money} labelFormatter={monthLabel} />} cursor={CURSOR} />
              <StatusBars />
              <Legend {...LEGEND} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly Lead Volume" subtitle="New business vs renewals">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyVolume}>
              <CartesianGrid vertical={false} {...GRID} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={monthLabel} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<ChartTooltip formatter={(v) => `${v} leads`} labelFormatter={monthLabel} />} cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }} />
              <Line type="monotone" dataKey="New" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--background)", fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Renewal" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--background)", fill: "var(--chart-2)" }} activeDot={{ r: 5 }} />
              <Legend {...LEGEND} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Producers, lines of business, pipeline health */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Producer Leaderboard" subtitle="Ranked by secured premium; achievement is secured against annual target" className="lg:col-span-2">
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-popover text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-2 text-left font-medium">#</th>
                  <th className="py-2 pr-2 text-left font-medium">Producer</th>
                  <th className="py-2 pr-2 text-right font-medium">Leads</th>
                  <th className="py-2 pr-2 text-right font-medium">Win rate</th>
                  <th className="py-2 pr-2 text-right font-medium">Open pipeline</th>
                  <th className="py-2 pr-2 text-right font-medium">Secured</th>
                  <th className="py-2 pr-2 text-right font-medium">Target</th>
                  <th className="w-[22%] py-2 text-left font-medium">Achievement</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {leaderboard.map((p, i) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                    <td className="py-2 pr-2 text-muted-foreground">{i + 1}</td>
                    <td className="max-w-[160px] truncate py-2 pr-2 font-medium" title={p.name}>{p.name}</td>
                    <td className="py-2 pr-2 text-right">{p.leads}</td>
                    <td className="py-2 pr-2 text-right">{p.closed > 0 ? formatPercent(p.winRate) : "--"}</td>
                    <td className="py-2 pr-2 text-right">{formatCompact(p.pipeline)}</td>
                    <td className="py-2 pr-2 text-right font-medium">{formatCompact(p.secured)}</td>
                    <td className="py-2 pr-2 text-right text-muted-foreground">{formatCompact(p.target)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-border/60">
                          <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.min(100, p.achievement * 100)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs">{p.target > 0 ? formatPercent(p.achievement) : "--"}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <div className="grid min-w-0 gap-4">
          <ChartCard title="Premium by Class of Business" subtitle="Split by lead status">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cobStatus} layout="vertical" barCategoryGap="30%">
                <CartesianGrid horizontal={false} {...GRID} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
                <YAxis dataKey="name" type="category" tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} />
                <Tooltip content={<ChartTooltip formatter={money} />} cursor={CURSOR} />
                <StatusBars horizontal />
                <Legend {...LEGEND} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Open Pipeline Aging" subtitle="Pending premium by age, in days since work started">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={aging} layout="vertical" barCategoryGap="28%" margin={{ right: 64 }}>
                <CartesianGrid horizontal={false} {...GRID} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
                <YAxis dataKey="name" type="category" tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip formatter={money} />} cursor={CURSOR} />
                <Bar dataKey="value" name="Pending premium" radius={[0, 4, 4, 0]}>
                  {aging.map((_, i) => <Cell key={i} fill="var(--chart-1)" fillOpacity={0.4 + i * 0.2} />)}
                  <LabelList dataKey="count" position="right" fontSize={11} fill="var(--muted-foreground)" formatter={(v) => `${v} leads`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

/** Secured / Pending / Lost stacked bars; the outer segment gets the rounded end. */
function StatusBars({ horizontal = false }: { horizontal?: boolean }) {
  const end: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  const common = { stackId: "status", stroke: "var(--background)", strokeWidth: 1 };
  return (
    <>
      <Bar dataKey="secured" name="Secured" fill={STATUS_COLORS.Secured} {...common} />
      <Bar dataKey="pending" name="Pending" fill={STATUS_COLORS.Pending} {...common} />
      <Bar dataKey="lost" name="Lost" fill={STATUS_COLORS.Lost} radius={end} {...common} />
    </>
  );
}

function KpiCard({ label, value, sub, color, progress }: { label: string; value: string; sub?: string; color?: string; progress?: number }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-3 py-2.5 shadow-glass glass-sheen">
      <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-0.5 truncate text-xl font-semibold ${color ?? ""}`}>{value}</p>
      {progress !== undefined && (
        <Progress value={Math.min(100, progress * 100)} className="mt-1.5 h-1.5" indicatorClassName="bg-emerald-500" />
      )}
      {sub && <p className="mt-1 truncate text-xs text-muted-foreground" title={sub}>{sub}</p>}
    </div>
  );
}

function Gauge({ value, color, marker, markerLabel, caption, status }: { value: number; color: string; marker?: number; markerLabel?: string; caption: string; status: string }) {
  const arc = "M 20 100 A 80 80 0 0 1 180 100";
  const shown = Math.min(1, Math.max(0, value)) * 100;
  const angle = Math.PI * (1 - Math.min(1, marker ?? 0));
  const point = (r: number) => ({ x: 100 + r * Math.cos(angle), y: 100 - r * Math.sin(angle) });
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[240px]" role="img" aria-label={`${formatPercent(value)}. ${caption}. ${status}`}>
        <path d={arc} fill="none" stroke="var(--border)" strokeWidth={14} strokeLinecap="round" />
        {shown > 0 && (
          <path d={arc} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" pathLength={100} strokeDasharray={`${shown} 100`} />
        )}
        {marker !== undefined && (
          <line x1={point(68).x} y1={point(68).y} x2={point(98).x} y2={point(98).y} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round">
            <title>{`${markerLabel}: ${formatPercent(marker)}`}</title>
          </line>
        )}
        <text x={100} y={90} textAnchor="middle" className="fill-foreground text-[28px] font-semibold">{formatPercent(value)}</text>
        <text x={20} y={114} textAnchor="middle" className="fill-muted-foreground text-[9px]">0%</text>
        <text x={180} y={114} textAnchor="middle" className="fill-muted-foreground text-[9px]">100%</text>
      </svg>
      <p className="mt-1 text-sm font-medium">{caption}</p>
      <p className="text-xs text-muted-foreground">{status}</p>
    </div>
  );
}

function Funnel({ stages }: { stages: { name: string; count: number }[] }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <div className="space-y-3 pt-1">
      {stages.map((s, i) => {
        const prev = stages[i - 1]?.count;
        return (
          <div key={s.name} className="grid grid-cols-[100px_1fr_110px] items-center gap-3 text-sm">
            <span className="truncate text-muted-foreground">{s.name}</span>
            <div className="h-7 rounded bg-border/40">
              <div
                className="h-full rounded"
                style={{ width: `${Math.max(1.5, (s.count / max) * 100)}%`, backgroundColor: "var(--chart-1)", opacity: 1 - i * 0.15 }}
                title={`${s.name}: ${s.count.toLocaleString()}`}
              />
            </div>
            <span className="text-right">
              <span className="font-semibold tabular-nums">{s.count.toLocaleString()}</span>
              {prev !== undefined && (
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{prev > 0 ? formatPercent(s.count / prev) : "--"}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({ title, subtitle, className, children }: { title: string; subtitle?: string; className?: string; children: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-xl border bg-card p-4 shadow-glass glass-sheen ${className ?? ""}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter = (l) => l,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  formatter: (v: number, name: string) => string;
  labelFormatter?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg">
      {label && <p className="mb-1.5 font-medium text-popover-foreground">{labelFormatter(String(label))}</p>}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium tabular-nums text-popover-foreground">{formatter(entry.value, entry.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
