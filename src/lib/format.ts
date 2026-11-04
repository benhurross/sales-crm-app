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

const dateFmt = new Intl.DateTimeFormat("en-SA", { year: "numeric", month: "short", day: "numeric" });

export function formatDate(date: Date | string): string {
  return dateFmt.format(typeof date === "string" ? new Date(date) : date);
}
