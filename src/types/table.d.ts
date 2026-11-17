import type { CellData, RowData, TableFeatures } from "@tanstack/table-core";
import type { FilterMeta } from "@/components/column-filter";

// Lets columns declare how their header filter works (see FilterMeta).
declare module "@tanstack/table-core" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface ColumnMeta<in out TFeatures extends TableFeatures, in out TData extends RowData, TValue extends CellData = CellData> extends FilterMeta {}
}
