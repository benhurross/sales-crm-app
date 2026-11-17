import {
  computeKpis,
  monthlyVolume,
  monthOf,
  paceStatus,
  pipelineAging,
  producerLeaderboard,
  STATUS_COLORS,
  statusBreakdown,
  TONE_COLORS,
  yearElapsed,
  type StatusBreakdown,
} from "@/lib/dashboard";
import { formatAmount, formatCompact, formatPercent, RIYAL } from "@/lib/format";
import type { DashboardData } from "@/server/dashboard-data";
import { BRAND_BLUE, esc, letterheadDocument, renderPdf, type ReportFilters } from "./letterhead";

const TEAL = "#0f9d84";
const GRID = "#e5e9f0";
const MUTED = "#6b7280";
const STATUS_KEYS = [
  { key: "secured", label: "Secured", color: STATUS_COLORS.Secured },
  { key: "pending", label: "Pending", color: STATUS_COLORS.Pending },
  { key: "lost", label: "Lost", color: STATUS_COLORS.Lost },
] as const;

const whole = (v: number) => formatAmount(Math.round(v));
const axisAmount = (v: number) => formatCompact(v).replace(`${RIYAL} `, "");

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en", { month: "short", year: "2-digit" });
}

/** A rounded axis maximum with four even steps. */
function niceScale(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? 10 * mag;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

function legend(items: { label: string; color: string }[]) {
  return `<div class="legend">${items.map((i) => `<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join("")}</div>`;
}

function gauge(value: number, color: string, marker?: number) {
  const arc = "M 20 100 A 80 80 0 0 1 180 100";
  const shown = Math.min(1, Math.max(0, value)) * 100;
  const angle = Math.PI * (1 - Math.min(1, marker ?? 0));
  const p = (r: number) => `${100 + r * Math.cos(angle)} ${100 - r * Math.sin(angle)}`;
  return `<svg viewBox="0 0 200 116" class="gauge">
    <path d="${arc}" fill="none" stroke="${GRID}" stroke-width="14" stroke-linecap="round"/>
    ${shown > 0 ? `<path d="${arc}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" pathLength="100" stroke-dasharray="${shown} 100"/>` : ""}
    ${marker !== undefined ? `<path d="M ${p(68)} L ${p(98)}" stroke="#1e2022" stroke-width="2.5" stroke-linecap="round"/>` : ""}
    <text x="100" y="90" text-anchor="middle" font-size="28" font-weight="700" fill="#1e2022">${formatPercent(value)}</text>
    <text x="20" y="114" text-anchor="middle" font-size="9" fill="${MUTED}">0%</text>
    <text x="180" y="114" text-anchor="middle" font-size="9" fill="${MUTED}">100%</text>
  </svg>`;
}

function stackedColumns(data: StatusBreakdown[], width: number, height: number) {
  const left = 40, bottom = 20, top = 6;
  const plotH = height - bottom - top;
  const ticks = niceScale(Math.max(0, ...data.map((d) => d.secured + d.pending + d.lost)));
  const max = ticks[ticks.length - 1];
  const slot = (width - left) / Math.max(1, data.length);
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const grid = ticks
    .map((t) => `<line x1="${left}" x2="${width}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}"/><text x="${left - 6}" y="${y(t) + 3}" text-anchor="end" font-size="8" fill="${MUTED}">${axisAmount(t)}</text>`)
    .join("");
  const bars = data
    .map((d, i) => {
      const x = left + i * slot + (slot - barW) / 2;
      let acc = 0;
      const segs = STATUS_KEYS.map(({ key, color }) => {
        const v = d[key];
        if (v <= 0) return "";
        const y1 = y(acc + v), h = y(acc) - y1;
        acc += v;
        return `<rect x="${x}" y="${y1}" width="${barW}" height="${Math.max(0, h - 1)}" fill="${color}"/>`;
      }).join("");
      return `${segs}<text x="${x + barW / 2}" y="${height - 6}" text-anchor="middle" font-size="8" fill="${MUTED}">${monthLabel(d.name)}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%">${grid}${bars}</svg>`;
}

function lineChart(data: { name: string; New: number; Renewal: number }[], width: number, height: number) {
  const left = 26, bottom = 20, top = 6, right = 6;
  const plotH = height - bottom - top;
  const ticks = niceScale(Math.max(0, ...data.map((d) => Math.max(d.New, d.Renewal))));
  const max = ticks[ticks.length - 1];
  const step = (width - left - right) / Math.max(1, data.length - 1);
  const x = (i: number) => left + (data.length === 1 ? (width - left - right) / 2 : i * step);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const grid = ticks
    .map((t) => `<line x1="${left}" x2="${width - right}" y1="${y(t)}" y2="${y(t)}" stroke="${GRID}"/><text x="${left - 5}" y="${y(t) + 3}" text-anchor="end" font-size="8" fill="${MUTED}">${t}</text>`)
    .join("");
  const series = (["New", "Renewal"] as const)
    .map((k) => {
      const color = k === "New" ? BRAND_BLUE : TEAL;
      const pts = data.map((d, i) => `${x(i)},${y(d[k])}`).join(" ");
      const dots = data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d[k])}" r="2.5" fill="${color}" stroke="#fff" stroke-width="1"/>`).join("");
      return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${dots}`;
    })
    .join("");
  const labels = data
    .map((d, i) => (data.length <= 8 || i % 2 === 0 ? `<text x="${x(i)}" y="${height - 6}" text-anchor="middle" font-size="8" fill="${MUTED}">${monthLabel(d.name)}</text>` : ""))
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" width="100%">${grid}${series}${labels}</svg>`;
}

function horizontalBars(rows: { name: string; segments: { value: number; color: string }[]; label?: string }[], width: number, labelW: number) {
  const rowH = 22, barH = 12, right = rows.some((r) => r.label) ? 60 : 8;
  const max = Math.max(1, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
  const plotW = width - labelW - right;
  const body = rows
    .map((r, i) => {
      const cy = i * rowH + rowH / 2;
      let acc = 0;
      const segs = r.segments
        .map((s) => {
          if (s.value <= 0) return "";
          const x = labelW + (acc / max) * plotW, w = (s.value / max) * plotW;
          acc += s.value;
          return `<rect x="${x}" y="${cy - barH / 2}" width="${Math.max(0.5, w - 1)}" height="${barH}" fill="${s.color}"/>`;
        })
        .join("");
      const end = labelW + (acc / max) * plotW;
      return `<text x="${labelW - 6}" y="${cy + 3}" text-anchor="end" font-size="8.5" fill="#374151">${esc(r.name)}</text>${segs}${
        r.label ? `<text x="${end + 5}" y="${cy + 3}" font-size="8" fill="${MUTED}">${esc(r.label)}</text>` : ""
      }`;
    })
    .join("");
  return `<svg viewBox="0 0 ${width} ${rows.length * rowH}" width="100%">${body}</svg>`;
}

const CSS = `
  body { font-size: 9px; }
  h3 { margin: 0; font-size: 10px; color: #1e2022; }
  .sub { margin: 1px 0 6px; font-size: 7.5px; color: ${MUTED}; }
  .section { margin-top: 10px; }
  .section-title { font-size: 9px; font-weight: 700; color: ${BRAND_BLUE}; text-transform: uppercase; letter-spacing: 0.06em; margin: 12px 0 6px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .kpi { border: 1px solid ${GRID}; border-radius: 6px; padding: 6px 8px; }
  .kpi .label { font-size: 7.5px; color: ${MUTED}; }
  .kpi .value { font-size: 15px; font-weight: 700; margin-top: 1px; }
  .kpi .note { font-size: 7.5px; color: ${MUTED}; margin-top: 1px; }
  .bar { height: 4px; border-radius: 2px; background: ${GRID}; margin-top: 4px; }
  .bar > div { height: 100%; border-radius: 2px; background: ${TONE_COLORS.good}; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid-perf { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 8px; }
  .card { border: 1px solid ${GRID}; border-radius: 6px; padding: 8px 10px; break-inside: avoid; }
  .gauge { width: 100%; max-width: 150px; display: block; margin: 0 auto; }
  .center { text-align: center; }
  .caption { font-size: 8.5px; font-weight: 600; margin-top: 2px; }
  .funnel-row { display: grid; grid-template-columns: 62px 1fr 64px; gap: 6px; align-items: center; margin: 5px 0; font-size: 8px; }
  .funnel-track { height: 12px; background: #f1f4f9; border-radius: 3px; }
  .funnel-fill { height: 100%; border-radius: 3px; background: ${BRAND_BLUE}; }
  .legend { display: flex; gap: 12px; justify-content: center; font-size: 7.5px; color: #374151; margin-top: 4px; }
  .legend i { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: -0.5px; }
  .insights { margin: 0; padding-left: 14px; font-size: 8.5px; line-height: 1.55; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: ${BRAND_BLUE}; color: #fff; font-size: 7.5px; padding: 5px; text-align: right; font-weight: 600; }
  th:nth-child(-n+2), td:nth-child(-n+2) { text-align: left; }
  td { font-size: 8px; padding: 4px 5px; border-bottom: 1px solid ${GRID}; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .ach { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }
  .ach .track { width: 50px; height: 4px; background: ${GRID}; border-radius: 2px; }
  .ach .fill { height: 100%; background: ${BRAND_BLUE}; border-radius: 2px; }
  .page-break { break-before: page; }`;

type DashboardFilters = ReportFilters & { producerId?: number };

/** Portrait PDF mirroring the dashboard: KPIs, gauges, funnel, trends, mix, aging and the producer leaderboard. */
export async function generateDashboardPdf(data: DashboardData, filters: DashboardFilters): Promise<Buffer> {
  return renderPdf(await buildDashboardHtml(data, filters, new Date()), false);
}

export async function buildDashboardHtml(data: DashboardData, filters: DashboardFilters, today: Date): Promise<string> {
  const leads = data.leads.filter(
    (l) =>
      (!filters.producerId || l.producerId === filters.producerId) &&
      (!filters.from || l.startWorkingDate >= filters.from) &&
      (!filters.to || l.startWorkingDate <= filters.to) &&
      (!filters.status || l.status === filters.status),
  );
  const producers = data.producers.filter((p) => !filters.producerId || p.id === filters.producerId);
  const prospects = data.prospects
    .filter((p) => !filters.producerId || p.producerId === filters.producerId)
    .reduce((t, p) => ({ total: t.total + p.total, converted: t.converted + p.converted, premiums: t.premiums + p.premiums }), { total: 0, converted: 0, premiums: 0 });

  const k = computeKpis(leads);
  const target = producers.reduce((s, p) => s + Number(p.annualTarget), 0);
  const achievement = target > 0 ? k.securedPremium / target : 0;
  const pace = yearElapsed(today);
  const status = paceStatus(achievement, pace);
  const conversion = prospects.total > 0 ? prospects.converted / prospects.total : 0;
  const monthly = statusBreakdown(leads, monthOf);
  const cob = statusBreakdown(leads, (l) => l.cob);
  const aging = pipelineAging(leads, today);
  const volume = monthlyVolume(leads);
  const board = producerLeaderboard(leads, producers);

  const kpi = (label: string, value: string, note: string, progress?: number) =>
    `<div class="kpi"><div class="label">${label}</div><div class="value">${value}</div>${
      progress !== undefined ? `<div class="bar"><div style="width:${Math.min(100, progress * 100)}%"></div></div>` : ""
    }<div class="note">${note}</div></div>`;

  const funnel = [
    { name: "Prospects", count: prospects.total },
    { name: "Leads", count: k.totalLeads },
    { name: "BOR received", count: k.bor },
    { name: "Quoted", count: k.quoted },
    { name: "Secured", count: k.secured },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.count));

  const topProducer = board.find((p) => p.secured > 0);
  const biggestCob = [...cob].sort((a, b) => b.secured + b.pending + b.lost - (a.secured + a.pending + a.lost))[0];
  const stale = aging[aging.length - 1];
  const insights = [
    `Secured premium is ${whole(k.securedPremium)}, ${formatPercent(achievement)} of the ${whole(target)} annual target; ${formatPercent(pace)} of the year has passed (${status.label.toLowerCase()}).`,
    `${k.pending} leads worth ${whole(k.pendingPremium)} are still open; ${stale.count} of them (${whole(stale.value)}) have been open for more than 90 days.`,
    `Win rate on decided leads is ${formatPercent(k.winRate)} (${k.secured} won, ${k.lost} lost), with an average secured deal of ${whole(k.avgDealSize)}.`,
    topProducer ? `Top producer by secured premium: ${esc(topProducer.name)} with ${whole(topProducer.secured)} (${formatPercent(topProducer.achievement)} of target).` : "",
    biggestCob ? `${esc(biggestCob.name)} is the largest class of business at ${whole(biggestCob.secured + biggestCob.pending + biggestCob.lost)} in estimated premium.` : "",
    `Only ${formatPercent(conversion)} of ${prospects.total.toLocaleString()} prospects have become leads.`,
  ].filter(Boolean);

  const body = `
  <div class="section-title">Key metrics</div>
  <div class="kpis">
    ${kpi("Prospects", prospects.total.toLocaleString(), `${formatCompact(prospects.premiums)} potential premium`)}
    ${kpi("Converted to Leads", prospects.converted.toLocaleString(), `${(prospects.total - prospects.converted).toLocaleString()} not yet converted`)}
    ${kpi("Conversion Rate", formatPercent(conversion), "prospects to leads")}
    ${kpi("Leads", k.totalLeads.toLocaleString(), `${k.newLeads} new, ${k.renewalLeads} renewal`)}
    ${kpi("Total Premium", formatCompact(k.totalPremium), "estimated, all leads")}
    ${kpi("Open Pipeline", formatCompact(k.pendingPremium), `${k.pending} pending leads`)}
    ${kpi("Secured", formatCompact(k.securedPremium), `${k.secured} leads won`)}
    ${kpi("Lost", formatCompact(k.lostPremium), `${k.lost} leads lost`)}
    ${kpi("Target Achievement", formatPercent(achievement), `of ${formatCompact(target)} annual target`, achievement)}
    ${kpi("Win Rate", formatPercent(k.winRate), "secured of decided leads", k.winRate)}
    ${kpi("Success Rate", formatPercent(k.successRate), "secured of all leads", k.successRate)}
    ${kpi("Avg Deal Size", formatCompact(k.avgDealSize), "per secured lead")}
    ${kpi("Commission Earned", formatCompact(k.commissionEarned), `${formatPercent(k.securedPremium > 0 ? k.commissionEarned / k.securedPremium : 0)} of secured premium`)}
    ${kpi("Quote Rate", formatPercent(k.quoteRate), `${k.quoted} leads quoted`)}
    ${kpi("BOR Rate", formatPercent(k.borRate), `${k.bor} BORs received`)}
    ${kpi("Avg Days to Quote", k.avgDaysToQuote === null ? "--" : k.avgDaysToQuote.toFixed(0), "from start of work")}
  </div>

  <div class="section-title">Performance</div>
  <div class="grid-perf">
    <div class="card center">
      <h3>Target Achievement</h3>
      <div class="sub">Secured vs annual target; tick marks year-to-date pace</div>
      ${gauge(achievement, TONE_COLORS[status.tone], pace)}
      <div class="caption">${formatCompact(k.securedPremium)} secured</div>
      <div class="sub">${status.label} (pace ${formatPercent(pace)})</div>
    </div>
    <div class="card center">
      <h3>Win Rate</h3>
      <div class="sub">Secured out of decided leads</div>
      ${gauge(k.winRate, BRAND_BLUE)}
      <div class="caption">${k.secured} won, ${k.lost} lost</div>
      <div class="sub">${k.pending} still open</div>
    </div>
    <div class="card">
      <h3>Sales Funnel</h3>
      <div class="sub">Count at each stage, with conversion from the stage before</div>
      ${funnel
        .map(
          (f, i) => `<div class="funnel-row"><span>${f.name}</span><div class="funnel-track"><div class="funnel-fill" style="width:${Math.max(1.5, (f.count / funnelMax) * 100)}%;opacity:${1 - i * 0.15}"></div></div><span class="num"><b>${f.count.toLocaleString()}</b>${
            i > 0 ? ` <span style="color:${MUTED}">${funnel[i - 1].count > 0 ? formatPercent(f.count / funnel[i - 1].count) : "--"}</span>` : ""
          }</span></div>`,
        )
        .join("")}
    </div>
  </div>

  <div class="section card">
    <h3>Monthly Premium by Status</h3>
    <div class="sub">Estimated premium by the month work started</div>
    ${stackedColumns(monthly, 680, 190)}
    ${legend(STATUS_KEYS.map((s) => ({ label: s.label, color: s.color })))}
  </div>

  <div class="page-break"></div>
  <div class="section-title">Pipeline and mix</div>
  <div class="grid-2">
    <div class="card">
      <h3>Monthly Lead Volume</h3>
      <div class="sub">New business vs renewals, by count</div>
      ${lineChart(volume, 330, 170)}
      ${legend([{ label: "New", color: BRAND_BLUE }, { label: "Renewal", color: TEAL }])}
    </div>
    <div class="card">
      <h3>Premium by Class of Business</h3>
      <div class="sub">Split by lead status</div>
      ${horizontalBars(cob.map((c) => ({ name: c.name, segments: STATUS_KEYS.map((s) => ({ value: c[s.key], color: s.color })), label: formatCompact(c.secured + c.pending + c.lost) })), 330, 56)}
      ${legend(STATUS_KEYS.map((s) => ({ label: s.label, color: s.color })))}
      <h3 style="margin-top:12px">Open Pipeline Aging</h3>
      <div class="sub">Pending premium by days since work started</div>
      ${horizontalBars(aging.map((a, i) => ({ name: `${a.name} days`, segments: [{ value: a.value, color: `rgba(0,71,186,${0.4 + i * 0.2})` }], label: `${a.count} leads` })), 330, 56)}
    </div>
  </div>

  <div class="section card">
    <h3>Highlights</h3>
    <ul class="insights">${insights.map((i) => `<li>${i}</li>`).join("")}</ul>
  </div>

  <div class="section-title">Producer leaderboard</div>
  <table>
    <thead>
      <tr><th>#</th><th>Producer</th><th>Leads</th><th>Win rate</th><th>Open pipeline</th><th>Secured</th><th>Target</th><th>Achievement</th></tr>
    </thead>
    <tbody>
      ${board
        .map(
          (p, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(p.name)}</td>
        <td class="num">${p.leads}</td>
        <td class="num">${p.closed > 0 ? formatPercent(p.winRate) : "--"}</td>
        <td class="num">${whole(p.pipeline)}</td>
        <td class="num"><b>${whole(p.secured)}</b></td>
        <td class="num">${whole(p.target)}</td>
        <td><div class="ach"><div class="track"><div class="fill" style="width:${Math.min(100, p.achievement * 100)}%"></div></div>${p.target > 0 ? formatPercent(p.achievement) : "--"}</div></td>
      </tr>`,
        )
        .join("")}
    </tbody>
  </table>`;

  return letterheadDocument({ title: "Sales Performance Report", filters, css: CSS, body });
}
