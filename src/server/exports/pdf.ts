import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { formatAmount } from "@/lib/format";
import type { ProducerReportRow, ReportSummary } from "@/lib/reports";

function achievementColor(pct: number) {
  if (pct >= 100) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function buildHtml(
  rows: ProducerReportRow[],
  summary: ReportSummary,
  filters: { from?: string; to?: string; producer?: string; status?: string },
  logoSvg: string,
): string {
  const filterParts: string[] = [];
  if (filters.from || filters.to) filterParts.push(`Date: ${filters.from ?? "start"} to ${filters.to ?? "present"}`);
  if (filters.producer) filterParts.push(`Producer: ${filters.producer}`);
  if (filters.status) filterParts.push(`Status: ${filters.status}`);

  const dataRows = rows
    .map(
      (r, i) => `
    <tr style="background:${i % 2 === 1 ? "#f8fafc" : "#fff"}">
      <td>${r.code}</td>
      <td>${r.name}</td>
      <td class="num">${r.totalLeads}</td>
      <td class="num">${r.borCount}</td>
      <td class="num" style="color:#10b981">${r.securedCount}</td>
      <td class="num" style="color:#f59e0b">${r.pendingCount}</td>
      <td class="num" style="color:#ef4444">${r.lostCount}</td>
      <td class="num">${formatAmount(r.securedPremium)}</td>
      <td class="num">${formatAmount(r.totalPremium)}</td>
      <td class="num">${formatAmount(r.annualTarget)}</td>
      <td class="num" style="color:${achievementColor(r.achievementPct)}">${r.achievementPct.toFixed(1)}%</td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 15mm 12mm; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #333; margin: 0; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 2px solid #0047ba; }
  .header svg { width: 120px; height: auto; }
  .header-text { flex: 1; }
  .header-text h1 { margin: 0; font-size: 16px; color: #0047ba; }
  .header-text h2 { margin: 2px 0 0; font-size: 12px; color: #666; font-weight: normal; }
  .filters { color: #888; font-size: 8px; margin-bottom: 6px; font-style: italic; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #0047ba; color: #fff; padding: 5px 6px; font-size: 8px; text-align: center; white-space: nowrap; }
  th:nth-child(1), th:nth-child(2) { text-align: left; }
  td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; }
  td:nth-child(1), td:nth-child(2) { text-align: left; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .summary td { background: #0047ba; color: #fff; font-weight: bold; border: none; padding: 5px 6px; }
  .footer { margin-top: 8px; font-size: 7px; color: #999; display: flex; justify-content: space-between; }
</style>
</head>
<body>
  <div class="header">
    ${logoSvg.replace(/fill:\s*#fff/g, "fill: #0047ba").replace(/class="st0"/g, 'style="fill:#0047ba"')}
    <div class="header-text">
      <h1>AP Plus Insurance Brokerage</h1>
      <h2>Sales Report</h2>
    </div>
  </div>
  ${filterParts.length ? `<div class="filters">${filterParts.join("  |  ")}</div>` : ""}
  <table>
    <thead>
      <tr>
        <th>Code</th><th>Producer</th><th>Leads</th><th>BOR</th>
        <th>Secured</th><th>Pending</th><th>Lost</th>
        <th>Secured Premium</th><th>Total Premium</th><th>Target</th><th>Achievement</th>
      </tr>
    </thead>
    <tbody>
      ${dataRows}
      <tr class="summary">
        <td>TOTAL</td><td></td>
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
  </table>
  <div class="footer">
    <span>AP Plus Insurance Brokerage</span>
    <span>Generated: ${new Date().toLocaleDateString("en-SA")}</span>
  </div>
</body>
</html>`;
}

export async function generatePdf(
  rows: ProducerReportRow[],
  summary: ReportSummary,
  filters: { from?: string; to?: string; producer?: string; status?: string },
): Promise<Buffer> {
  let logoSvg = "";
  try {
    logoSvg = await readFile(join(process.cwd(), "public/brand/ap_head.svg"), "utf-8");
  } catch {
    // proceed without logo
  }

  const html = buildHtml(rows, summary, filters, logoSvg);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
