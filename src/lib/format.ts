export const RIYAL = "\u{20C1}";

const numberFmt = new Intl.NumberFormat("en-SA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const compactFmt = new Intl.NumberFormat("en-SA", { notation: "compact", maximumFractionDigits: 1 });

export function formatAmount(value: number): string {
  return `${RIYAL} ${numberFmt.format(value)}`;
}

export function formatCompact(value: number): string {
  return `${RIYAL} ${compactFmt.format(value)}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const dateFormats = {
  en: new Intl.DateTimeFormat("en-SA", { year: "numeric", month: "short", day: "numeric" }),
  // Arabic month names with the Gregorian calendar and Western digits
  ar: new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { year: "numeric", month: "short", day: "numeric" }),
};

export function formatDate(date: Date | string, locale = "en"): string {
  return (locale === "ar" ? dateFormats.ar : dateFormats.en).format(typeof date === "string" ? new Date(date) : date);
}
