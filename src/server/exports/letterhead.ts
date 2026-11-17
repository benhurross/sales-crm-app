import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { direction, intlLocale, type Locale } from "@/i18n/config";
import { translator, type Translate } from "@/i18n/server";

export interface ReportFilters {
  from?: string;
  to?: string;
  producer?: string;
  status?: string;
}

/** The language a report is written in. */
export interface ExportLanguage {
  locale: Locale;
  t: Translate;
}

export const exportLanguage = (locale: Locale): ExportLanguage => ({ locale, t: translator(locale) });

export const BRAND_BLUE = "#0047ba";

export function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function filterSummary(filters: ReportFilters, { t }: ExportLanguage): string {
  const parts: string[] = [];
  if (filters.from || filters.to)
    parts.push(t("export.filterDate", { from: filters.from ?? t("export.start"), to: filters.to ?? t("export.present") }));
  if (filters.producer) parts.push(t("export.filterProducer", { name: filters.producer }));
  if (filters.status) parts.push(t("export.filterStatus", { status: t(`status.${filters.status}`) }));
  return parts.length ? parts.join("  |  ") : t("export.allFilters");
}

const font = (file: string) => readFile(join(process.cwd(), "src", "assets", "fonts", file));

/**
 * Font faces embedded in every PDF, since the server's Chromium may have neither: the Riyal sign
 * (Arial lacks U+20C1) and, for Arabic reports, IBM Plex Sans Arabic.
 */
async function fontFaces(locale: Locale): Promise<string> {
  const face = (family: string, data: Buffer, weight: number, range?: string) =>
    `@font-face { font-family: "${family}"; src: url(data:font/woff2;base64,${data.toString("base64")}) format("woff2"); font-weight: ${weight};${range ? ` unicode-range: ${range};` : ""} }`;
  const [riyal, riyalBold] = await Promise.all([font("saudi-riyal.woff2"), font("saudi-riyal-bold.woff2")]);
  const faces = [face("Saudi Riyal", riyal, 400, "U+20C1, U+E900"), face("Saudi Riyal", riyalBold, 700, "U+20C1, U+E900")];
  if (locale === "ar") {
    const [regular, bold] = await Promise.all([font("ibm-plex-sans-arabic-400.woff2"), font("ibm-plex-sans-arabic-700.woff2")]);
    faces.push(face("IBM Plex Sans Arabic", regular, 400), face("IBM Plex Sans Arabic", bold, 700));
  }
  return faces.join("\n");
}

const FONT_STACK = `"Saudi Riyal", "IBM Plex Sans Arabic", Arial, sans-serif`;

async function baseCss(locale: Locale): Promise<string> {
  return `
  ${await fontFaces(locale)}
  * { box-sizing: border-box; }
  body { font-family: ${FONT_STACK}; color: #1e2022; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  svg { direction: ltr; }
  .letterhead { display: flex; align-items: center; gap: 14px; padding-bottom: 8px; margin-bottom: 8px; border-bottom: 2px solid ${BRAND_BLUE}; }
  .letterhead img { height: 64px; width: auto; }
  .letterhead .titles { flex: 1; }
  .letterhead h1 { margin: 0; font-size: 16px; color: ${BRAND_BLUE}; }
  .letterhead h2 { margin: 2px 0 0; font-size: 12px; color: #555; font-weight: normal; }
  .letterhead .meta { text-align: end; font-size: 8px; color: #777; line-height: 1.5; }
  .num { text-align: end; font-variant-numeric: tabular-nums; }`;
}

async function logoDataUri(): Promise<string> {
  const svg = await readFile(join(process.cwd(), "public", "brand", "applus-report-logo.svg"));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}

/** A complete HTML document on the AP Plus letterhead, in the report's language and direction. */
export async function letterheadDocument(opts: { title: string; filters: ReportFilters; css: string; body: string; lang: ExportLanguage }): Promise<string> {
  const { locale, t } = opts.lang;
  const [css, logo] = await Promise.all([baseCss(locale), logoDataUri()]);
  const generated = new Date().toLocaleString(intlLocale(locale), { dateStyle: "medium", timeStyle: "short" });
  return `<!DOCTYPE html>
<html lang="${locale}" dir="${direction(locale)}">
<head><meta charset="utf-8"><style>${css}${opts.css}</style></head>
<body>
  <div class="letterhead">
    <img src="${logo}" alt="AP Plus">
    <div class="titles">
      <h1>${esc(t("export.company"))}</h1>
      <h2>${esc(opts.title)}</h2>
    </div>
    <div class="meta">${esc(filterSummary(opts.filters, opts.lang))}<br>${esc(t("export.generated", { date: generated }))}</div>
  </div>
  ${opts.body}
</body>
</html>`;
}

export async function renderPdf(html: string, landscape: boolean, { locale, t }: ExportLanguage): Promise<Buffer> {
  // The footer is drawn in a separate document, so it needs its own fonts.
  const footer = `<style>${await fontFaces(locale)}</style>
<div dir="${direction(locale)}" style="width:100%;font-size:7px;color:#999;padding:0 12mm;display:flex;justify-content:space-between;font-family:${FONT_STACK.replaceAll('"', "'")}">
  <span>${esc(t("export.company"))}</span>
  <span>${t("export.page", { page: "PAGE", pages: "PAGES" }).replace("PAGES", '<span class="totalPages"></span>').replace("PAGE", '<span class="pageNumber"></span>')}</span>
</div>`;
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
      footerTemplate: footer,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
