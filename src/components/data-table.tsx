"use client";

import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import { flexRender } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
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
  pageSize?: number;
  server?: ServerSide;
}

type Sorting = { id: string; desc: boolean }[];

// Paging and sorting done by the caller (the API returns one page at a time).
export interface ServerSide {
  rowCount: number;
  pageIndex: number;
  onPageIndexChange: (pageIndex: number) => void;
  sorting: Sorting;
  onSortingChange: (sorting: Sorting) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- RowData requires Record<string,any>
export function DataTable<TData extends Record<string, any>>({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  pageSize = 25,
  server,
}: DataTableProps<TData>) {
  const [localSorting, setSorting] = useState<Sorting>([]);
  const sorting = server?.sorting ?? localSorting;
  const [columnFilters, setColumnFilters] = useState<{ id: string; value: unknown }[]>([]);
  const [internalSelection, setInternalSelection] = useState<Record<string, true>>({});
  const [localPage, setLocalPage] = useState(0);

  // Back to the first page when the search or the row set changes.
  const [resetKey, setResetKey] = useState({ globalFilter, rows: data.length });
  if (resetKey.globalFilter !== globalFilter || resetKey.rows !== data.length) {
    setResetKey({ globalFilter, rows: data.length });
    setLocalPage(0);
  }

  const pageIndex = server?.pageIndex ?? localPage;
  const setPageIndex = server?.onPageIndexChange ?? setLocalPage;

  const table = useLegacyTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: server
      ? (updater: unknown) => server.onSortingChange(typeof updater === "function" ? updater(server.sorting) : updater)
      : setSorting,
    manualPagination: !!server,
    manualSorting: !!server,
    rowCount: server?.rowCount,
    autoResetPageIndex: false,
    onPaginationChange: (updater: unknown) => {
      const current = { pageIndex, pageSize };
      setPageIndex((typeof updater === "function" ? updater(current) : updater).pageIndex);
    },
    onColumnFiltersChange: setColumnFilters,
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
      pagination: { pageIndex, pageSize },
    },
  });

  const pageCount = table.getPageCount();

  return (
    <div className="space-y-2">
      <div className="max-h-[calc(100dvh-280px)] overflow-auto rounded-xl border bg-card shadow-glass glass-sheen">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted backdrop-blur supports-[backdrop-filter]:bg-muted/90">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="size-3.5" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="size-3.5" />
                        ) : (
                          <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
          <span>
            Page {pageIndex + 1} of {pageCount} ({server?.rowCount ?? table.getFilteredRowModel().rows.length} rows)
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="size-8" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
