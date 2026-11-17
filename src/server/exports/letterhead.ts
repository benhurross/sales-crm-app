import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

export interface ReportFilters {
  from?: string;
  to?: string;
  producer?: string;
  status?: string;
}

export const BRAND_BLUE = "#0047ba";

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function filterSummary(filters: ReportFilters): string {
  const parts: string[] = [];
  if (filters.from || filters.to) parts.push(`Date: ${filters.from ?? "start"} to ${filters.to ?? "present"}`);
  if (filters.producer) parts.push(`Producer: ${filters.producer}`);
  if (filters.status) parts.push(`Status: ${filters.status}`);
  return parts.length ? parts.join("  |  ") : "All producers, all dates";
}

/** Base styles shared by every PDF: the Riyal sign font (Arial lacks U+20C1) and the letterhead. */
async function baseCss(): Promise<string> {
  const [regular, bold] = await Promise.all([
    readFile(join(process.cwd(), "src", "assets", "fonts", "saudi-riyal.woff2")),
    readFile(join(process.cwd(), "src", "assets", "fonts", "saudi-riyal-bold.woff2")),
  ]);
  const face = (data: Buffer, weight: number) =>
    `@font-face { font-family: "Saudi Riyal"; src: url(data:font/woff2;base64,${data.toString("base64")}) format("woff2"); font-weight: ${weight}; unicode-range: U+20C1, U+E900; }`;
  return `
  ${face(regular, 400)}
  ${face(bold, 700)}
  * { box-sizing: border-box; }
  body { font-family: "Saudi Riyal", Arial, sans-serif; color: #1e2022; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .letterhead { display: flex; align-items: center; gap: 14px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 2px solid ${BRAND_BLUE}; }
  .letterhead img { height: 64px; width: auto; }
  .letterhead .titles { flex: 1; }
  .letterhead h1 { margin: 0; font-size: 16px; color: ${BRAND_BLUE}; }
  .letterhead h2 { margin: 2px 0 0; font-size: 12px; color: #555; font-weight: normal; }
  .letterhead .meta { text-align: right; font-size: 8px; color: #777; line-height: 1.5; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }`;
}

async function logoDataUri(): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public", "brand", "applus-report-logo.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** A complete HTML document on the AP Plus letterhead. */
export async function letterheadDocument(opts: { title: string; filters: ReportFilters; css: string; body: string }): Promise<string> {
  const [css, logo] = await Promise.all([baseCss(), logoDataUri()]);
  const generated = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${css}${opts.css}</style></head>
<body>
  <div class="letterhead">
    <img src="${logo}" alt="AP Plus">
    <div class="titles">
      <h1>AP Plus Insurance Brokerage</h1>
      <h2>${esc(opts.title)}</h2>
    </div>
    <div class="meta">${esc(filterSummary(opts.filters))}<br>Generated ${esc(generated)}</div>
  </div>
  ${opts.body}
</body>
</html>`;
}

export async function renderPdf(html: string, landscape: boolean): Promise<Buffer> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      landscape,
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm", left: "12mm", right: "12mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:7px;color:#999;padding:0 12mm;display:flex;justify-content:space-between;font-family:Arial"><span>AP Plus Insurance Brokerage</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
