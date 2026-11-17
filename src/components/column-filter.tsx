"use client";

import { ArrowDownAZ, ArrowUpAZ, ListFilter } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { intlLocale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** How a column is filtered from its header, set through the column's `meta`. */
export interface FilterMeta {
  /** values: tick values from a list (default); month: tick months of a date column; range: min and max of a number column. */
  filter?: "values" | "month" | "range";
  /** Display text for a raw value in the list, e.g. a translated status. */
  filterLabel?: (value: string) => string;
}

export type FilterValue = { values: string[] } | { min?: number; max?: number };

/** The key a cell value is listed under: blanks become "", dates become "YYYY-MM" for month filters. */
export function filterKey(raw: unknown, kind: FilterMeta["filter"]): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const s = String(raw);
  return kind === "month" ? s.slice(0, 7) : s;
}

/** Shared filter function: a list of allowed keys, or a numeric range. */
export function excelFilter(row: { getValue: (id: string) => unknown }, columnId: string, value: FilterValue, kind?: FilterMeta["filter"]) {
  const raw = row.getValue(columnId);
  if ("values" in value) return value.values.includes(filterKey(raw, kind));
  const n = Number(raw);
  if (raw === null || raw === undefined || Number.isNaN(n)) return false;
  return (value.min === undefined || n >= value.min) && (value.max === undefined || n <= value.max);
}

/** The parts of a table column the filter uses. */
export interface FilterableColumn {
  columnDef: { header?: unknown; meta?: unknown };
  getFilterValue: () => unknown;
  setFilterValue: (value: unknown) => void;
  getIsFiltered: () => boolean;
  getFacetedUniqueValues: () => Map<unknown, number>;
  getCanSort: () => boolean;
  toggleSorting: (desc?: boolean) => void;
}

export function ColumnFilter({ column }: { column: FilterableColumn }) {
  const t = useTranslations("filter");
  const locale = useLocale();
  const meta = (column.columnDef.meta ?? {}) as FilterMeta;
  const kind = meta.filter ?? "values";
  const value = column.getFilterValue() as FilterValue | undefined;
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const label = useMemo(() => {
    const monthFmt = new Intl.DateTimeFormat(intlLocale(locale), { month: "long", year: "numeric" });
    return (key: string) => {
      if (key === "") return t("blanks");
      if (kind === "month") {
        const [y, m] = key.split("-").map(Number);
        return monthFmt.format(new Date(y, m - 1, 1));
      }
      return meta.filterLabel ? meta.filterLabel(key) : key;
    };
  }, [kind, locale, meta, t]);

  // Values with counts among rows that pass the other columns' filters, as in Excel.
  const options = useMemo(() => {
    if (!open || kind === "range") return [];
    const counts = new Map<string, number>();
    for (const [raw, n] of column.getFacetedUniqueValues()) {
      const key = filterKey(raw, kind);
      counts.set(key, (counts.get(key) ?? 0) + n);
    }
    // keep ticked values visible even when other filters hide all their rows
    if (value && "values" in value) for (const v of value.values) if (!counts.has(v)) counts.set(v, 0);
    return [...counts]
      .map(([key, count]) => ({ key, count, text: label(key) }))
      .sort((a, b) => (kind === "month" ? b.key.localeCompare(a.key) : a.key === "" ? 1 : b.key === "" ? -1 : a.text.localeCompare(b.text)));
  }, [open, kind, column, value, label]);

  const visible = search ? options.filter((o) => o.text.toLowerCase().includes(search.toLowerCase())) : options;
  const selected = value && "values" in value ? new Set(value.values) : null; // null = everything shown
  const isChecked = (key: string) => !selected || selected.has(key);
  const allVisibleChecked = visible.length > 0 && visible.every((o) => isChecked(o.key));
  const someVisibleChecked = visible.some((o) => isChecked(o.key));

  const setSelected = (keys: Set<string>) =>
    column.setFilterValue(options.every((o) => keys.has(o.key)) ? undefined : { values: [...keys] });
  const toggle = (key: string) => {
    const next = new Set(selected ?? options.map((o) => o.key));
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };
  const toggleAll = () => {
    const next = new Set(selected ?? options.map((o) => o.key));
    for (const o of visible) {
      if (allVisibleChecked) next.delete(o.key);
      else next.add(o.key);
    }
    setSelected(next);
  };

  const range = value && !("values" in value) ? value : {};
  const setRange = (bound: "min" | "max", text: string) => {
    const next = { ...range, [bound]: text === "" ? undefined : Number(text) };
    column.setFilterValue(next.min === undefined && next.max === undefined ? undefined : next);
  };

  const active = column.getIsFiltered();
  const title = typeof column.columnDef.header === "string" ? column.columnDef.header : "";

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("filterColumn", { column: title })}
          title={t("filterColumn", { column: title })}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-accent",
            active ? "bg-primary/15 text-primary" : "text-muted-foreground/60 hover:text-foreground",
          )}
        >
          <ListFilter className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2 text-sm font-normal">
        {column.getCanSort() && (
          <div className="mb-2 grid gap-0.5 border-b pb-2">
            <button type="button" className="flex items-center gap-2 rounded px-2 py-1.5 text-start hover:bg-accent" onClick={() => { column.toggleSorting(false); setOpen(false); }}>
              <ArrowDownAZ className="size-4 text-muted-foreground" /> {t(kind === "values" ? "sortAsc" : "sortSmallest")}
            </button>
            <button type="button" className="flex items-center gap-2 rounded px-2 py-1.5 text-start hover:bg-accent" onClick={() => { column.toggleSorting(true); setOpen(false); }}>
              <ArrowUpAZ className="size-4 text-muted-foreground" /> {t(kind === "values" ? "sortDesc" : "sortLargest")}
            </button>
          </div>
        )}

        {kind === "range" ? (
          <div className="grid grid-cols-2 gap-2 p-1">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("min")}
              <Input type="number" className="h-8" value={range.min ?? ""} onChange={(e) => setRange("min", e.target.value)} />
            </label>
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("max")}
              <Input type="number" className="h-8" value={range.max ?? ""} onChange={(e) => setRange("max", e.target.value)} />
            </label>
          </div>
        ) : (
          <>
            {options.length > 8 && (
              <Input autoFocus placeholder={t("search")} className="mb-2 h-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            )}
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 font-medium hover:bg-accent">
              <Checkbox checked={allVisibleChecked ? true : someVisibleChecked ? "indeterminate" : false} onCheckedChange={toggleAll} />
              {t("selectAll")}
            </label>
            <div className="max-h-60 overflow-auto">
              {visible.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent">
                  <Checkbox checked={isChecked(o.key)} onCheckedChange={() => toggle(o.key)} />
                  <span className="min-w-0 flex-1 truncate" title={o.text}>{o.text}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{o.count}</span>
                </label>
              ))}
              {visible.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">{t("noValues")}</p>}
            </div>
          </>
        )}

        {active && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => column.setFilterValue(undefined)}>
            {t("clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
