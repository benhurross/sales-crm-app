import ExcelJS from "exceljs";
import { RIYAL } from "@/lib/format";
import type { ProducerReportRow, ReportSummary } from "@/lib/reports";
import { intlLocale } from "@/i18n/config";
import { filterSummary, type ExportLanguage, type ReportFilters } from "./letterhead";

const BRAND_BLUE = "0047BA";
const BRAND_BLUE_LIGHT = "E8F0FE";
const HEADER_FONT: Partial<ExcelJS.Font> = { name: "Arial", bold: true, size: 10, color: { argb: "FFFFFFFF" } };
const BODY_FONT: Partial<ExcelJS.Font> = { name: "Arial", size: 10 };
const NUMBER_FMT = `"${RIYAL}" #,##0`;
const PCT_FMT = "0.0%";

export async function generateExcel(
  rows: ProducerReportRow[],
  summary: ReportSummary,
  filters: ReportFilters,
  lang: ExportLanguage,
): Promise<Buffer> {
  const { t, locale } = lang;
  const wb = new ExcelJS.Workbook();
  wb.creator = "AP Plus IBS";
  wb.created = new Date();

  const ws = wb.addWorksheet(t("reports.title"), { views: [{ rightToLeft: locale === "ar" }] });

  // -- Column widths
  ws.columns = [
    { width: 24 },  // A: Producer
    { width: 8 },   // B: Leads
    { width: 8 },   // C: BOR
    { width: 10 },  // D: Secured
    { width: 10 },  // E: Pending
    { width: 8 },   // F: Lost
    { width: 18 },  // G: Secured Premium
    { width: 18 },  // H: Total Premium
    { width: 18 },  // I: Target
    { width: 14 },  // J: Achievement
  ];

  // -- Letterhead
  ws.mergeCells("A1:J1");
  const titleRow = ws.getRow(1);
  titleRow.getCell(1).value = t("export.company");
  titleRow.getCell(1).font = { name: "Arial", bold: true, size: 14, color: { argb: `FF${BRAND_BLUE}` } };
  titleRow.getCell(1).alignment = { horizontal: "center" };
  titleRow.height = 30;

  const subtitleRowNum = 2;
  ws.mergeCells(`A${subtitleRowNum}:J${subtitleRowNum}`);
  const subtitleRow = ws.getRow(subtitleRowNum);
  subtitleRow.getCell(1).value = t("export.producerReportTitle");
  subtitleRow.getCell(1).font = { name: "Arial", bold: true, size: 12, color: { argb: `FF${BRAND_BLUE}` } };
  subtitleRow.getCell(1).alignment = { horizontal: "center" };
  subtitleRow.height = 22;

  // -- Filter info row
  const filterText = filterSummary(filters, lang);

  const filterRowNum = subtitleRowNum + 1;
  {
    ws.mergeCells(`A${filterRowNum}:J${filterRowNum}`);
    const filterRow = ws.getRow(filterRowNum);
    filterRow.getCell(1).value = filterText;
    filterRow.getCell(1).font = { name: "Arial", size: 9, italic: true, color: { argb: "FF666666" } };
    filterRow.getCell(1).alignment = { horizontal: "center" };
  }

  ws.mergeCells(`A${filterRowNum + 1}:J${filterRowNum + 1}`);
  const dateRow = ws.getRow(filterRowNum + 1);
  dateRow.getCell(1).value = t("export.generated", { date: new Date().toLocaleDateString(intlLocale(locale)) });
  dateRow.getCell(1).font = { name: "Arial", size: 8, color: { argb: "FF999999" } };
  dateRow.getCell(1).alignment = { horizontal: locale === "ar" ? "left" : "right" };

  // -- Header row
  const headerRowNum = filterRowNum + 3;
  const headers = [
    t("reports.colProducer"),
    t("reports.colLeads"),
    t("reports.colBor"),
    t("status.Secured"),
    t("status.Pending"),
    t("status.Lost"),
    t("reports.colSecuredPremium"),
    t("reports.colTotalPremium"),
    t("reports.colTarget"),
    t("reports.colAchievement"),
  ];
  const headerRow = ws.getRow(headerRowNum);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = HEADER_FONT;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_BLUE}` } };
    cell.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF333333" } },
    };
  });
  headerRow.height = 24;

  // -- Data rows
  rows.forEach((r, idx) => {
    const row = ws.getRow(headerRowNum + 1 + idx);
    row.getCell(1).value = r.name;
    row.getCell(2).value = r.totalLeads;
    row.getCell(3).value = r.borCount;
    row.getCell(4).value = r.securedCount;
    row.getCell(5).value = r.pendingCount;
    row.getCell(6).value = r.lostCount;
    row.getCell(7).value = r.securedPremium;
    row.getCell(7).numFmt = NUMBER_FMT;
    row.getCell(8).value = r.totalPremium;
    row.getCell(8).numFmt = NUMBER_FMT;
    row.getCell(9).value = r.annualTarget;
    row.getCell(9).numFmt = NUMBER_FMT;
    row.getCell(10).value = r.achievementPct / 100;
    row.getCell(10).numFmt = PCT_FMT;

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.font = BODY_FONT;
      cell.alignment = { horizontal: c === 1 ? "left" : "center" };
      if (idx % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_BLUE_LIGHT}` } };
      }
    }
  });

  // -- Summary row
  const summaryRowNum = headerRowNum + 1 + rows.length + 1;
  const sRow = ws.getRow(summaryRowNum);
  sRow.getCell(1).value = t("export.total");
  sRow.getCell(2).value = summary.totalLeads;
  sRow.getCell(3).value = summary.totalBor;
  sRow.getCell(4).value = summary.totalSecured;
  sRow.getCell(5).value = summary.totalPending;
  sRow.getCell(6).value = summary.totalLost;
  sRow.getCell(7).value = summary.securedPremium;
  sRow.getCell(7).numFmt = NUMBER_FMT;
  sRow.getCell(8).value = summary.totalPremium;
  sRow.getCell(8).numFmt = NUMBER_FMT;
  sRow.getCell(9).value = "";
  sRow.getCell(10).value = summary.successRate;
  sRow.getCell(10).numFmt = PCT_FMT;

  for (let c = 1; c <= 10; c++) {
    const cell = sRow.getCell(c);
    cell.font = { ...BODY_FONT, bold: true };
    cell.alignment = { horizontal: c === 1 ? "left" : "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND_BLUE}` } };
    cell.font = { ...HEADER_FONT };
    cell.border = {
      top: { style: "double", color: { argb: `FF${BRAND_BLUE}` } },
    };
  }

  // -- Print setup
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws.headerFooter = {
    oddFooter: `&L${t("export.company")}&C&P / &N&R&D`,
  };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
