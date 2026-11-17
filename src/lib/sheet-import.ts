/**
 * Reading values from the Sales Lead Mastersheet, a Google Sheets export where most cells are
 * `IFERROR(__xludf.DUMMYFUNCTION("COMPUTED_VALUE"), <value>)`: the value Google computed is the
 * formula's second argument, and the cached result is often missing or mangled by a date format.
 */

export type Cell = string | number | boolean | Date | null | undefined | { formula?: string; result?: unknown; richText?: { text: string }[]; text?: unknown };

const GOOGLE_VALUE = /^IFERROR\(__xludf\.DUMMYFUNCTION\(".*?"\),([\s\S]*)\)$/;

/** The value Google Sheets computed for a cell, as a plain string, number, boolean or Date. */
export function cellValue(cell: Cell): string | number | boolean | Date | null {
  if (cell === null || cell === undefined) return null;
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell;
  if (typeof cell !== "object") return cell;
  if ("richText" in cell && cell.richText) return cell.richText.map((r) => r.text).join("");
  if ("formula" in cell && cell.formula) {
    const literal = cell.formula.match(GOOGLE_VALUE)?.[1]?.trim();
    if (literal !== undefined) {
      if (literal === "TRUE" || literal === "FALSE") return literal === "TRUE";
      if (literal.startsWith('"') && literal.endsWith('"')) return literal.slice(1, -1).replace(/""/g, '"');
      if (literal !== "" && !Number.isNaN(Number(literal))) return Number(literal);
    }
    return cellValue(cell.result as Cell);
  }
  if ("text" in cell) return String(cell.text);
  return null;
}

export const text = (cell: Cell): string => {
  const v = cellValue(cell);
  return v === null || v instanceof Date ? "" : String(v).trim();
};

/** A yes/no cell: TRUE, "✅", "yes", 1, or a date-formatted 1 (31 Dec 1899) count as yes. */
export function yes(cell: Cell): boolean {
  const v = cellValue(cell);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (v instanceof Date) return v.toISOString().startsWith("1899-12-31");
  return ["true", "✅", "yes", "1"].includes(String(v ?? "").trim().toLowerCase());
}

/** An amount, accepting "1,234", "4.500.000" (dots as thousands separators) and "-" for none. */
export function amount(cell: Cell): number | null {
  const v = cellValue(cell);
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s || s === "-" || s.startsWith("#") || s.toUpperCase() === "N/A") return null;
  const cleaned = (s.match(/\./g)?.length ?? 0) > 1 ? s.replace(/[.,]/g, "") : s.replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/** A date as YYYY-MM-DD, from a Date, an Excel serial number or a date string. */
export function isoDate(cell: Cell): string | null {
  const v = cellValue(cell);
  if (v === null || typeof v === "boolean") return null;
  if (v instanceof Date) return v.getUTCFullYear() < 1950 ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") return v > 30000 && v < 60000 ? new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10) : null;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

/** Sheet statuses ("Pending Quote", "Pending Client Dec", blank...) mapped to the app's three. */
export function leadStatus(cell: Cell): "Secured" | "Pending" | "Lost" {
  const s = text(cell).toLowerCase();
  if (s === "secured") return "Secured";
  if (s === "lost") return "Lost";
  return "Pending";
}

const INSURER_ALIASES: Record<string, string> = {
  bupa: "Bupa Arabia",
  "bupa arabia": "Bupa Arabia",
  cigna: "CIGNA",
  watanyah: "Wataniya",
  wataniya: "Wataniya",
  mutakamilah: "Mutakamelah",
  mutakamelah: "Mutakamelah",
  "al rajihi": "Al Rajhi Takaful",
  "takaful al rajhi": "Al Rajhi Takaful",
  "oriant - exellence": "Orient Excellence",
};

export const insurerName = (raw: string) => INSURER_ALIASES[raw.trim().toLowerCase()] ?? raw.trim();

/** Matching key for a client name: case, spacing and punctuation differences are ignored. */
export const nameKey = (s: string) => s.toLowerCase().replace(/[\s.,'"()\-_/]+/g, " ").trim();
