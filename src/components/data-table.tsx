"use client";

import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import {
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { ColumnFilter, excelFilter, type FilterMeta, type FilterValue } from "@/components/column-filter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- RowData requires Record<string,any>
interface DataTableProps<TData extends Record<string, any>> {
  columns: LegacyColumnDef<TData, unknown>[];
  data: TData[];
  globalFilter?: string;
  onGlobalFilterChange?: (value: string) => void;
  enableRowSelection?: boolean;
  rowSelection?: Record<string, true>;
  onRowSelectionChange?: (value: Record<string, true>) => void;
}

type Sorting = { id: string; desc: boolean }[];
type Filters = { id: string; value: unknown }[];

/** Above this many rows only the rows in view are drawn, so long lists scroll smoothly. */
const VIRTUAL_FROM = 200;

/**
 * One scrollable table with a fixed header. Each column header has an Excel-style filter
 * (values, months or a number range, from the column's `meta`) and sorts on click.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- RowData requires Record<string,any>
export function DataTable<TData extends Record<string, any>>({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
}: DataTableProps<TData>) {
  const t = useTranslations("filter");
  const [sorting, setSorting] = useState<Sorting>([]);
  const [columnFilters, setColumnFilters] = useState<Filters>([]);
  const [internalSelection, setInternalSelection] = useState<Record<string, true>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const kinds = new Map(
    columns.map((c) => [String(c.id ?? (c as { accessorKey?: string }).accessorKey), (c.meta as FilterMeta | undefined)?.filter]),
  );

  const table = useLegacyTable({
    data,
    columns,
    defaultColumn: {
      filterFn: (row: { getValue: (id: string) => unknown }, columnId: string, value: FilterValue) =>
        excelFilter(row, columnId, value, kinds.get(columnId)),
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    onSortingChange: setSorting,
    onColumnFiltersChange: (updater: unknown) => {
      setColumnFilters((current) => (typeof updater === "function" ? updater(current) : updater));
      // selected rows could be hidden by the new filter, so start the selection again
      onRowSelectionChange?.({});
    },
    onGlobalFilterChange,
    enableRowSelection,
    onRowSelectionChange: onRowSelectionChange
      ? (updater: unknown) => {
          const next = typeof updater === "function" ? updater(rowSelection ?? {}) : updater;
          onRowSelectionChange(next);
        }
      : setInternalSelection,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection: rowSelection ?? internalSelection,
    },
  });

  const rows = table.getRowModel().rows;
  const virtual = rows.length > VIRTUAL_FROM;
  const virtualizer = useVirtualizer({
    count: virtual ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 31,
    overscan: 15,
  });
  const items = virtual ? virtualizer.getVirtualItems() : [];
  const padTop = items[0]?.start ?? 0;
  const padBottom = virtual ? virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0) : 0;
  const shown = virtual ? items.map((i) => rows[i.index]) : rows;
  const span = table.getVisibleLeafColumns().length;

  return (
    <div className="space-y-2">
      <div ref={scrollRef} className="max-h-[calc(100dvh-230px)] overflow-auto rounded-xl border bg-card shadow-glass glass-sheen">
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted shadow-[0_1px_0_var(--border)]">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="h-8 border-e border-border/60 px-2 text-xs font-semibold last:border-e-0"
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                  >
                    {header.isPlaceholder ? null : (
                      <div className="flex items-center gap-1">
                        {header.column.getCanSort() ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 hover:text-foreground"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {header.column.getIsSorted() === "asc" && <ArrowUp className="size-3.5" />}
                            {header.column.getIsSorted() === "desc" && <ArrowDown className="size-3.5" />}
                          </button>
                        ) : (
                          flexRender(header.column.columnDef.header, header.getContext())
                        )}
                        {header.column.getCanFilter() && <ColumnFilter column={header.column} />}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {padTop > 0 && <tr style={{ height: padTop }} aria-hidden />}
            {shown.length ? (
              shown.map((row, i) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                  data-index={virtual ? items[i].index : undefined}
                  ref={virtual ? virtualizer.measureElement : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="border-e border-border/40 px-2 py-1 last:border-e-0 [&_[data-size=icon]]:size-6">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={span} className="h-24 text-center text-muted-foreground">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            )}
            {padBottom > 0 && <tr style={{ height: padBottom }} aria-hidden />}
          </TableBody>
        </Table>
      </div>
      <div className="flex min-h-8 items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
        <span>
          {rows.length === data.length
            ? t("rows", { count: data.length })
            : t("rowsOf", { shown: rows.length, total: data.length })}
        </span>
        {columnFilters.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => table.resetColumnFilters()}>
            {t("clearAll")}
          </Button>
        )}
      </div>
    </div>
  );
}
