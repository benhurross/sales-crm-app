import { formatAmount } from "@/lib/format";
import type { ProducerReportRow, ReportSummary } from "@/lib/reports";
import { BRAND_BLUE, esc, letterheadDocument, renderPdf, type ReportFilters } from "./letterhead";

function achievementColor(pct: number) {
  if (pct >= 100) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

const CSS = `
  body { font-size: 9px; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { background: ${BRAND_BLUE}; color: #fff; padding: 5px 6px; font-size: 8px; text-align: right; white-space: nowrap; }
  th:first-child, td:first-child { text-align: left; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  .summary td { background: ${BRAND_BLUE} !important; color: #fff; font-weight: bold; border: none; padding: 5px 6px; }`;

export async function generatePdf(rows: ProducerReportRow[], summary: ReportSummary, filters: ReportFilters): Promise<Buffer> {
  return renderPdf(await buildProducerHtml(rows, summary, filters), true);
}

export async function buildProducerHtml(rows: ProducerReportRow[], summary: ReportSummary, filters: ReportFilters): Promise<string> {
  const body = `
  <table>
    <thead>
      <tr>
        <th>Producer</th><th>Leads</th><th>BOR</th><th>Secured</th><th>Pending</th><th>Lost</th>
        <th>Secured Premium</th><th>Total Premium</th><th>Target</th><th>Achievement</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (r) => `
      <tr>
        <td>${esc(r.name)}</td>
        <td class="num">${r.totalLeads}</td>
        <td class="num">${r.borCount}</td>
        <td class="num">${r.securedCount}</td>
        <td class="num">${r.pendingCount}</td>
        <td class="num">${r.lostCount}</td>
        <td class="num">${formatAmount(r.securedPremium)}</td>
        <td class="num">${formatAmount(r.totalPremium)}</td>
        <td class="num">${formatAmount(r.annualTarget)}</td>
        <td class="num" style="color:${achievementColor(r.achievementPct)}">${r.achievementPct.toFixed(1)}%</td>
      </tr>`,
        )
        .join("")}
      <tr class="summary">
        <td>TOTAL</td>
        <td class="num">${summary.totalLeads}</td>
        <td class="num">${summary.totalBor}</td>
        <td class="num">${summary.totalSecured}</td>
        <td class="num">${summary.totalPending}</td>
        <td class="num">${summary.totalLost}</td>
        <td class="num">${formatAmount(summary.securedPremium)}</td>
        <td class="num">${formatAmount(summary.totalPremium)}</td>
        <td></td>
        <td class="num">${(summary.successRate * 100).toFixed(1)}%</td>
      </tr>
    </tbody>
  </table>`;

  return letterheadDocument({ title: "Sales Report by Producer", filters, css: CSS, body });
}
