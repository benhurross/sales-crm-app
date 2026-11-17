"use client";

import { useQuery } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Calendar, FileBarChart, FileSpreadsheet, FileText, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/format";
import { hasRole } from "@/lib/permissions";
import { buildProducerReport, summarizeReport, type ProducerReportRow, type ReportLead } from "@/lib/reports";

interface ApiLead extends ReportLead {
  startWorkingDate: string | null;
}

interface ApiProducer {
  id: number;
  code: string;
  name: string;
  annualTarget: string;
}

type ExportType = "excel" | "pdf" | "dashboard";
const EXPORT_FILES: Record<ExportType, string> = {
  excel: "sales-report.xlsx",
  pdf: "sales-report.pdf",
  dashboard: "sales-performance-report.pdf",
};

export default function ReportsPage() {
  const user = useCurrentUser();
  const isSalesman = !hasRole(user.role, "manager");
  const t = useTranslations("reports");
  const tc = useTranslations("common");
  const ts = useTranslations("status");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [producerFilter, setProducerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<ExportType | null>(null);

  const { data, isLoading } = useQuery<{ leads: ApiLead[]; producers: ApiProducer[] }>({
    queryKey: ["reports"],
    queryFn: () => fetch("/api/reports").then((r) => r.json()),
  });

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const producers = useMemo(() => data?.producers ?? [], [data]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (dateFrom) result = result.filter((l) => l.startWorkingDate && l.startWorkingDate >= dateFrom);
    if (dateTo) result = result.filter((l) => l.startWorkingDate && l.startWorkingDate <= dateTo);
    if (producerFilter) result = result.filter((l) => l.producerId === Number(producerFilter));
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);
    return result;
  }, [leads, dateFrom, dateTo, producerFilter, statusFilter]);

  const rows = useMemo(
    () => buildProducerReport(filteredLeads, producerFilter ? producers.filter((p) => p.id === Number(producerFilter)) : producers),
    [filteredLeads, producers, producerFilter],
  );

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  }, [rows, search]);

  const summary = useMemo(() => summarizeReport(filteredRows), [filteredRows]);

  const hasFilters = dateFrom || dateTo || producerFilter || statusFilter || search;

  async function handleExport(type: ExportType) {
    setExporting(type);
    try {
      const params = new URLSearchParams({ type });
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      if (producerFilter) params.set("producer", producerFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/reports/export?${params}`);
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t("exportFailed", { status: res.status }));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = EXPORT_FILES[type];
      a.click();
      // Revoking at once breaks downloads the browser holds for confirmation (e.g. over plain HTTP).
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  const columns = useMemo<LegacyColumnDef<ProducerReportRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: t("colProducer"), size: 160 },
      {
        accessorKey: "totalLeads",
        meta: { filter: "range" },
        header: t("colLeads"),
        size: 70,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: "borCount",
        meta: { filter: "range" },
        header: t("colBor"),
        size: 60,
        cell: ({ getValue }) => (getValue() as number).toLocaleString(),
      },
      {
        accessorKey: "securedCount",
        meta: { filter: "range" },
        header: ts("Secured"),
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-emerald-600 dark:text-emerald-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "pendingCount",
        meta: { filter: "range" },
        header: ts("Pending"),
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-amber-600 dark:text-amber-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "lostCount",
        meta: { filter: "range" },
        header: ts("Lost"),
        size: 60,
        cell: ({ getValue }) => (
          <span className="text-red-600 dark:text-red-400">
            {(getValue() as number).toLocaleString()}
          </span>
        ),
      },
      {
        accessorKey: "securedPremium",
        meta: { filter: "range" },
        header: t("colSecuredPremium"),
        size: 140,
        cell: ({ getValue }) => formatAmount(getValue() as number),
        sortingFn: (a: { original: ProducerReportRow }, b: { original: ProducerReportRow }) =>
          a.original.securedPremium - b.original.securedPremium,
      },
      {
        accessorKey: "totalPremium",
        meta: { filter: "range" },
        header: t("colTotalPremium"),
        size: 140,
        cell: ({ getValue }) => formatAmount(getValue() as number),
        sortingFn: (a: { original: ProducerReportRow }, b: { original: ProducerReportRow }) =>
          a.original.totalPremium - b.original.totalPremium,
      },
      {
        accessorKey: "annualTarget",
        meta: { filter: "range" },
        header: t("colTarget"),
        size: 130,
        cell: ({ getValue }) => formatAmount(getValue() as number),
        sortingFn: (a: { original: ProducerReportRow }, b: { original: ProducerReportRow }) =>
          a.original.annualTarget - b.original.annualTarget,
      },
      {
        accessorKey: "achievementPct",
        meta: { filter: "range" },
        header: t("colAchievement"),
        size: 120,
        cell: ({ getValue }) => {
          const pct = getValue() as number;
          return (
            <div className="flex items-center gap-2">
              <div className="h-2 w-16 rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className="text-xs tabular-nums">{pct.toFixed(1)}%</span>
            </div>
          );
        },
        sortingFn: (a: { original: ProducerReportRow }, b: { original: ProducerReportRow }) =>
          a.original.achievementPct - b.original.achievementPct,
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")}>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("excel")}
          >
            <FileSpreadsheet className="size-4" />
            {exporting === "excel" ? t("exporting") : "Excel"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("pdf")}
          >
            <FileText className="size-4" />
            {exporting === "pdf" ? t("exporting") : "PDF"}
          </Button>
          <Button
            size="sm"
            disabled={exporting !== null}
            onClick={() => handleExport("dashboard")}
            title={t("performanceHint")}
          >
            <FileBarChart className="size-4" />
            {exporting === "dashboard" ? t("exporting") : t("performanceReport")}
          </Button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            className="h-9 w-48 ps-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {!isSalesman && (
          <select
            className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm"
            value={producerFilter}
            onChange={(e) => setProducerFilter(e.target.value)}
            aria-label={t("colProducer")}
          >
            <option value="">{tc("allProducers")}</option>
            {producers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        <select
          className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label={t("status")}
        >
          <option value="">{t("allStatuses")}</option>
          <option value="Secured">{ts("Secured")}</option>
          <option value="Pending">{ts("Pending")}</option>
          <option value="Lost">{ts("Lost")}</option>
        </select>

        <div className="flex items-center gap-1.5">
          <Calendar className="size-4 text-muted-foreground" />
          <Input
            type="date"
            className="h-9 w-36"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">{t("to")}</span>
          <Input
            type="date"
            className="h-9 w-36"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setProducerFilter("");
              setStatusFilter("");
              setSearch("");
            }}
          >
            {tc("clearFilters")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">
          {tc("loading")}
        </div>
      ) : (
        <>
          <DataTable columns={columns} data={filteredRows} globalFilter={search} onGlobalFilterChange={setSearch} />

          <div className="rounded-xl border bg-card p-4 shadow-glass glass-sheen">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
              <SummaryItem label={t("totalLeads")} value={summary.totalLeads.toLocaleString()} />
              <SummaryItem label={t("colBor")} value={summary.totalBor.toLocaleString()} />
              <SummaryItem label={ts("Secured")} value={summary.totalSecured.toLocaleString()} className="text-emerald-600 dark:text-emerald-400" />
              <SummaryItem label={ts("Pending")} value={summary.totalPending.toLocaleString()} className="text-amber-600 dark:text-amber-400" />
              <SummaryItem label={ts("Lost")} value={summary.totalLost.toLocaleString()} className="text-red-600 dark:text-red-400" />
              <SummaryItem label={t("colSecuredPremium")} value={formatAmount(summary.securedPremium)} />
              <SummaryItem label={t("colTotalPremium")} value={formatAmount(summary.totalPremium)} />
              <SummaryItem label={t("successRate")} value={`${(summary.successRate * 100).toFixed(1)}%`} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function SummaryItem({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${className ?? ""}`}>{value}</p>
    </div>
  );
}
