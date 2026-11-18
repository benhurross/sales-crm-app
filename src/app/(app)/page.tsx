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
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { BadgeIcons, useHighlights, WinOfTheWeek } from "@/components/celebration/badges";
import { RecentWins } from "@/components/celebration/recent-wins";
import { PageHeader } from "@/components/page-header";
import { Progress } from "@/components/ui/progress";
import { intlLocale } from "@/i18n/config";
import { formatAmount, formatCompact, formatPercent, RIYAL } from "@/lib/format";
import {
  computeKpis,
  monthlyVolume,
  monthOf,
  paceStatus,
  pipelineAging,
  producerLeaderboard,
  teamTarget,
  STATUS_COLORS,
  statusBreakdown,
  TONE_COLORS,
  yearElapsed,
  type DashboardLead,
} from "@/lib/dashboard";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };
const GRID = { stroke: "var(--border)", strokeOpacity: 0.6 };
const CURSOR = { fill: "var(--accent)", opacity: 0.35 };
const LEGEND = { iconType: "circle", iconSize: 8, wrapperStyle: { fontSize: 12 }, itemSorter: null } as const;
const compactAxis = (v: number) => formatCompact(v).replace(`${RIYAL} `, "");
const money = (v: number) => formatAmount(v);

function useMonthLabel() {
  const locale = intlLocale(useLocale());
  return (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleString(locale, { month: "short", year: "2-digit" });
  };
}

interface DashboardData {
  leads: DashboardLead[];
  producers: { id: number; name: string; annualTarget: string; employmentStatus: string }[];
  prospects: { producerId: number; total: number; converted: number; premiums: number }[];
}

export default function DashboardPage() {
  const user = useCurrentUser();
  const isSalesman = user.role === "salesman";
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const tCob = useTranslations("cob");
  const monthLabel = useMonthLabel();
  const { data: highlights } = useHighlights();

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
      teamTarget((data?.producers ?? []).filter((p) => !producerFilter || p.id === Number(producerFilter))),
    [data, producerFilter],
  );
  const targetAchievement = annualTarget > 0 ? kpis.securedPremium / annualTarget : 0;
  const [today] = useState(() => new Date());
  const yearPace = yearElapsed(today);
  const pace = paceStatus(targetAchievement, yearPace);

  const funnel = [
    { name: t("funnelProspects"), count: prospects.total },
    { name: t("funnelLeads"), count: kpis.totalLeads },
    { name: t("funnelBor"), count: kpis.bor },
    { name: t("funnelQuoted"), count: kpis.quoted },
    { name: t("funnelSecured"), count: kpis.secured },
  ];

  const monthlyStatus = useMemo(() => statusBreakdown(filtered, monthOf), [filtered]);
  const cobStatus = useMemo(() => statusBreakdown(filtered, (l) => l.cob), [filtered]);
  const aging = useMemo(() => pipelineAging(filtered, today), [filtered, today]);
  const volume = useMemo(() => monthlyVolume(filtered), [filtered]);
  const leaderboard = useMemo(
    () => producerLeaderboard(filtered, (data?.producers ?? []).filter((p) => !producerFilter || p.id === Number(producerFilter))),
    [data, filtered, producerFilter],
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("title")} description={t("description")} />
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">{tc("loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />

      {/* Filters */}
      {!isSalesman && (
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="h-9 rounded-md border border-input bg-popover px-3 text-sm"
            value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)}
          >
            <option value="">{tc("allProducers")}</option>
            {data?.producers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-popover px-3 text-sm"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={tc("fromDate")}
          />
          <input
            type="date"
            className="h-9 rounded-md border border-input bg-popover px-3 text-sm"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={tc("toDate")}
          />
          {(producerFilter || dateFrom || dateTo) && (
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => { setProducerFilter(""); setDateFrom(""); setDateTo(""); }}
            >
              {tc("clearFilters")}
            </button>
          )}
        </div>
      )}

      {/* KPI tiles: pipeline volume, then performance */}
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4 @4xl:grid-cols-7">
          <KpiCard label={t("kpiProspects")} value={prospects.total.toLocaleString()} sub={t("kpiProspectsSub", { amount: formatCompact(prospects.premiums) })} color="text-blue-600 dark:text-blue-400" />
          <KpiCard label={t("kpiConverted")} value={prospects.converted.toLocaleString()} sub={t("kpiConvertedSub", { count: prospects.total - prospects.converted })} color="text-emerald-600 dark:text-emerald-400" />
          <KpiCard label={t("kpiConversion")} value={formatPercent(prospects.total > 0 ? prospects.converted / prospects.total : 0)} sub={t("kpiConversionSub")} />
          <KpiCard label={t("kpiLeads")} value={kpis.totalLeads.toLocaleString()} sub={t("kpiLeadsSub", { count: kpis.renewalLeads })} />
          <KpiCard label={t("kpiPipeline")} value={formatCompact(kpis.pendingPremium)} sub={t("kpiPipelineSub", { count: kpis.pending })} color="text-amber-600 dark:text-amber-400" />
          <KpiCard label={t("kpiSecured")} value={formatCompact(kpis.securedPremium)} sub={t("kpiSecuredSub", { count: kpis.secured })} color="text-emerald-600 dark:text-emerald-400" />
          <KpiCard label={t("kpiLost")} value={formatCompact(kpis.lostPremium)} sub={t("kpiLostSub", { count: kpis.lost })} color="text-red-600 dark:text-red-400" />

          <KpiCard label={t("kpiTotalPremium")} value={formatCompact(kpis.totalPremium)} sub={t("kpiTotalPremiumSub")} />
          <KpiCard label={t("kpiSuccess")} value={formatPercent(kpis.successRate)} sub={t("kpiSuccessSub")} progress={kpis.successRate} />
          <KpiCard label={t("kpiDealSize")} value={formatCompact(kpis.avgDealSize)} sub={t("kpiDealSizeSub")} />
          <KpiCard label={t("kpiCommission")} value={formatCompact(kpis.commissionEarned)} sub={t("kpiCommissionSub", { percent: formatPercent(kpis.securedPremium > 0 ? kpis.commissionEarned / kpis.securedPremium : 0) })} />
          <KpiCard label={t("kpiQuoteRate")} value={formatPercent(kpis.quoteRate)} sub={t("kpiQuoteRateSub", { count: kpis.quoted })} />
          <KpiCard label={t("kpiBorRate")} value={formatPercent(kpis.borRate)} sub={t("kpiBorRateSub", { count: kpis.bor })} />
          <KpiCard label={t("kpiDaysToQuote")} value={kpis.avgDaysToQuote === null ? "--" : kpis.avgDaysToQuote.toFixed(0)} sub={t("kpiDaysToQuoteSub")} />
        </div>
      </div>

      {/* Headline gauges + funnel */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ChartCard title={t("targetTitle")} subtitle={t("targetSubtitle", { target: formatCompact(annualTarget) })}>
          <Gauge
            value={targetAchievement}
            color={TONE_COLORS[pace.tone]}
            marker={yearPace}
            markerLabel={t("paceMarker")}
            caption={t("targetCaption", { amount: formatCompact(kpis.securedPremium) })}
            status={t("paceStatus", { status: t(`pace.${pace.tone}`), pace: formatPercent(yearPace) })}
          />
        </ChartCard>
        <ChartCard title={t("winRateTitle")} subtitle={t("winRateSubtitle")}>
          <Gauge
            value={kpis.winRate}
            color="var(--chart-1)"
            caption={t("winRateCaption", { won: kpis.secured, lost: kpis.lost })}
            status={t("winRateStatus", { count: kpis.pending })}
          />
        </ChartCard>
        <ChartCard title={t("funnelTitle")} subtitle={t("funnelSubtitle")} className="md:col-span-2">
          <Funnel stages={funnel} />
        </ChartCard>
      </div>

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={t("monthlyTitle")} subtitle={t("monthlySubtitle")} className="lg:col-span-2">
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
        <div className="grid min-w-0 content-start gap-4">
          <WinOfTheWeek />
          <ChartCard title={t("winsTitle")} subtitle={t("winsSubtitle")} className="scroll-mt-20" id="recent-wins">
            <RecentWins />
          </ChartCard>
        </div>
      </div>

      {/* Producers and lead volume */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title={t("leaderboardTitle")} subtitle={t("leaderboardSubtitle")} className="lg:col-span-2">
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-popover text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pe-2 text-start font-medium">#</th>
                  <th className="py-2 pe-2 text-start font-medium">{t("colProducer")}</th>
                  <th className="py-2 pe-2 text-end font-medium">{t("colLeads")}</th>
                  <th className="py-2 pe-2 text-end font-medium">{t("colWinRate")}</th>
                  <th className="py-2 pe-2 text-end font-medium">{t("colPipeline")}</th>
                  <th className="py-2 pe-2 text-end font-medium">{t("colSecured")}</th>
                  <th className="py-2 pe-2 text-end font-medium">{t("colTarget")}</th>
                  <th className="w-[22%] py-2 text-start font-medium">{t("colAchievement")}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums whitespace-nowrap">
                {leaderboard.map((p, i) => (
                  <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-accent/40">
                    <td className="py-2 pe-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 pe-2 font-medium">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 max-w-[160px] truncate" title={p.name}>{p.name}</span>
                        <BadgeIcons badges={highlights?.badges[p.id]} className="shrink-0 flex-nowrap" />
                      </span>
                    </td>
                    <td className="py-2 pe-2 text-end">{p.leads}</td>
                    <td className="py-2 pe-2 text-end">{p.closed > 0 ? formatPercent(p.winRate) : "--"}</td>
                    <td className="py-2 pe-2 text-end">{formatCompact(p.pipeline)}</td>
                    <td className="py-2 pe-2 text-end font-medium">{formatCompact(p.secured)}</td>
                    <td className="py-2 pe-2 text-end text-muted-foreground">{formatCompact(p.target)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-border/60">
                          <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.min(100, p.achievement * 100)}%` }} />
                        </div>
                        <span className="w-12 text-end text-xs">{p.target > 0 ? formatPercent(p.achievement) : "--"}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title={t("volumeTitle")} subtitle={t("volumeSubtitle")}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={volume}>
              <CartesianGrid vertical={false} {...GRID} />
              <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={monthLabel} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip content={<ChartTooltip formatter={(v) => t("leadsCount", { count: v })} labelFormatter={monthLabel} />} cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }} />
              <Line type="monotone" dataKey="New" name={t("new")} stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--background)", fill: "var(--chart-1)" }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="Renewal" name={t("renewal")} stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3.5, strokeWidth: 2, stroke: "var(--background)", fill: "var(--chart-2)" }} activeDot={{ r: 5 }} />
              <Legend {...LEGEND} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Lines of business and pipeline health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("cobTitle")} subtitle={t("cobSubtitle")}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={cobStatus} layout="vertical" barCategoryGap="30%">
              <CartesianGrid horizontal={false} {...GRID} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
              <YAxis dataKey="name" type="category" tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => tCob(v)} />
              <Tooltip content={<ChartTooltip formatter={money} />} cursor={CURSOR} />
              <StatusBars horizontal />
              <Legend {...LEGEND} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("agingTitle")} subtitle={t("agingSubtitle")}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aging} layout="vertical" barCategoryGap="28%" margin={{ right: 64 }}>
              <CartesianGrid horizontal={false} {...GRID} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={compactAxis} />
              <YAxis dataKey="name" type="category" tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
              <Tooltip content={<ChartTooltip formatter={money} />} cursor={CURSOR} />
              <Bar dataKey="value" name={t("pendingPremium")} radius={[0, 4, 4, 0]}>
                {aging.map((_, i) => <Cell key={i} fill="var(--chart-1)" fillOpacity={0.4 + i * 0.2} />)}
                <LabelList dataKey="count" position="right" fontSize={11} fill="var(--muted-foreground)" formatter={(v) => t("leadsCount", { count: Number(v) })} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

/** Secured / Pending / Lost stacked bars; the outer segment gets the rounded end. */
function StatusBars({ horizontal = false }: { horizontal?: boolean }) {
  const ts = useTranslations("status");
  const end: [number, number, number, number] = horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0];
  const common = { stackId: "status", stroke: "var(--background)", strokeWidth: 1 };
  return (
    <>
      <Bar dataKey="secured" name={ts("Secured")} fill={STATUS_COLORS.Secured} {...common} />
      <Bar dataKey="pending" name={ts("Pending")} fill={STATUS_COLORS.Pending} {...common} />
      <Bar dataKey="lost" name={ts("Lost")} fill={STATUS_COLORS.Lost} radius={end} {...common} />
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
            <span className="text-end">
              <span className="font-semibold tabular-nums">{s.count.toLocaleString()}</span>
              {prev !== undefined && (
                <span className="ms-1.5 text-xs text-muted-foreground tabular-nums">{prev > 0 ? formatPercent(s.count / prev) : "--"}</span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ChartCard({ title, subtitle, className, id, children }: { title: string; subtitle?: string; className?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} className={`min-w-0 rounded-xl border bg-card p-4 shadow-glass glass-sheen ${className ?? ""}`}>
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
