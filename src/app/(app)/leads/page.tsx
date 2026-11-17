"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { formatAmount, formatDate } from "@/lib/format";
import { hasRole } from "@/lib/permissions";
import { LeadFormDialog, type LeadFormValues } from "./lead-form";

interface Lead {
  id: number;
  producerId: number;
  prospectName: string;
  startWorkingDate: string;
  rfqType: "New" | "Renewal";
  cob: "General" | "Medical" | "Motor";
  bor: boolean;
  quoted: boolean;
  status: "Secured" | "Pending" | "Lost";
  estimatedPremium: string;
  commission: string | null;
  currentInsurerId: number | null;
  city: string;
  borTimestamp: string | null;
  quoteTimestamp: string | null;
  comments: string | null;
  prospectClientId: number | null;
  producerName: string | null;
  producerCode: string | null;
  insurerName: string | null;
}

export default function LeadsPage() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const t = useTranslations("leads");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const tRfq = useTranslations("rfq");
  const tCob = useTranslations("cob");
  const locale = useLocale();

  const [search, setSearch] = useState("");
  const [rowSelection, setRowSelection] = useState<Record<string, true>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [convertDefaults, setConvertDefaults] = useState<Partial<LeadFormValues> | null>(null);

  const convertProspectId = searchParams.get("convertProspect");

  useEffect(() => {
    if (!convertProspectId) return;
    fetch(`/api/prospects/${convertProspectId}`)
      .then((r) => r.json())
      .then((prospect) => {
        if (prospect.error) return;
        setConvertDefaults({
          prospectName: prospect.clientName,
          prospectClientId: String(prospect.id),
          producerId: String(prospect.producerId),
          currentInsurerId: prospect.currentInsurerId ? String(prospect.currentInsurerId) : undefined,
          cob: prospect.lob ?? "General",
          estimatedPremium: prospect.premiums ?? "",
        });
        setFormOpen(true);
        window.history.replaceState(null, "", "/leads");
      });
  }, [convertProspectId]);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetch("/api/leads").then((r) => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: async (values: LeadFormValues & { id?: number }) => {
      const { id, producerId, currentInsurerId, prospectClientId, ...rest } = values;
      const body = {
        ...rest,
        producerId: Number(producerId),
        currentInsurerId: currentInsurerId ? Number(currentInsurerId) : null,
        prospectClientId: prospectClientId ? Number(prospectClientId) : null,
      };
      const res = await fetch(id ? `/api/leads/${id}` : "/api/leads", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || tc("failed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["wins"] });
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success(editingLead ? t("updated") : t("created"));
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(tc("deleteFailed"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["wins"] });
      toast.success(t("deleted"));
    },
  });

  const bulkMutation = useMutation({
    mutationFn: async (status: string) => {
      const ids = Object.keys(rowSelection).map((idx) => leads[Number(idx)].id);
      const res = await fetch("/api/leads/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      if (!res.ok) throw new Error(t("bulkFailed"));
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["wins"] });
      setRowSelection({});
      toast.success(t("bulkUpdated", { count: data.updated }));
    },
  });

  function openCreate() {
    setEditingLead(null);
    setFormOpen(true);
  }
  function openEdit(lead: Lead) {
    setEditingLead(lead);
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingLead(null);
    setConvertDefaults(null);
  }

  const selectedCount = Object.keys(rowSelection).length;

  const columns = useMemo<LegacyColumnDef<Lead, unknown>[]>(() => {
    const check = (on: unknown) =>
      on ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground/40" />;
    const yesNo = (v: string) => (v === "true" ? tc("yes") : tc("no"));
    const date = (v: unknown) => (v ? formatDate(v as string, locale) : "--");
    return [
      {
        id: "select",
        size: 40,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label={t("selectAll")}
          />
        ),
        cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      },
      { id: "producer", header: t("colProducer"), accessorFn: (row) => row.producerName, size: 160 },
      { accessorKey: "prospectName", header: t("colProspect") },
      { accessorKey: "startWorkingDate", header: t("colDate"), size: 150, meta: { filter: "month" }, cell: ({ getValue }) => date(getValue()) },
      { accessorKey: "rfqType", header: t("colRfq"), size: 110, meta: { filterLabel: (v) => tRfq(v) }, cell: ({ getValue }) => tRfq(getValue() as string) },
      { accessorKey: "cob", header: t("colCob"), size: 100, meta: { filterLabel: (v) => tCob(v) }, cell: ({ getValue }) => tCob(getValue() as string) },
      { accessorKey: "bor", header: t("colBor"), size: 80, meta: { filterLabel: yesNo }, cell: ({ getValue }) => check(getValue()) },
      { accessorKey: "quoted", header: t("colQuoted"), size: 90, meta: { filterLabel: yesNo }, cell: ({ getValue }) => check(getValue()) },
      {
        accessorKey: "status",
        header: t("colStatus"),
        size: 110,
        meta: { filterLabel: (v) => ts(v) },
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "estimatedPremium",
        header: t("colPremium"),
        size: 150,
        meta: { filter: "range" },
        cell: ({ getValue }) => formatAmount(Number(getValue())),
        sortingFn: (a: { original: Lead }, b: { original: Lead }) => Number(a.original.estimatedPremium) - Number(b.original.estimatedPremium),
      },
      {
        accessorKey: "commission",
        header: t("colCommission"),
        size: 130,
        meta: { filter: "range" },
        cell: ({ getValue }) => (getValue() ? formatAmount(Number(getValue())) : "--"),
        sortingFn: (a: { original: Lead }, b: { original: Lead }) => Number(a.original.commission ?? 0) - Number(b.original.commission ?? 0),
      },
      { accessorKey: "insurerName", header: t("colInsurer"), size: 140, cell: ({ getValue }) => getValue() || "--" },
      { accessorKey: "city", header: t("colCity"), size: 100 },
      { accessorKey: "borTimestamp", header: t("colBorDate"), size: 130, meta: { filter: "month" }, cell: ({ getValue }) => date(getValue()) },
      { accessorKey: "quoteTimestamp", header: t("colQuoteDate"), size: 130, meta: { filter: "month" }, cell: ({ getValue }) => date(getValue()) },
      {
        accessorKey: "comments",
        header: t("colComments"),
        size: 200,
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v ? <span className="block max-w-[240px] truncate" title={v}>{v}</span> : "--";
        },
      },
      {
        id: "actions",
        header: "",
        size: 80,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="size-7" title={tc("edit")} aria-label={tc("edit")} onClick={() => openEdit(row.original)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-destructive hover:text-destructive"
              title={tc("delete")}
              aria-label={tc("delete")}
              onClick={() => { if (confirm(t("confirmDelete"))) deleteMutation.mutate(row.original.id); }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ),
      },
    ];
  }, [deleteMutation, t, tc, ts, tRfq, tCob, locale]);

  const editDefaults: Partial<LeadFormValues> | undefined = convertDefaults
    ? convertDefaults
    : editingLead
    ? {
        prospectName: editingLead.prospectName,
        prospectClientId: editingLead.prospectClientId ? String(editingLead.prospectClientId) : undefined,
        producerId: String(editingLead.producerId),
        startWorkingDate: editingLead.startWorkingDate,
        rfqType: editingLead.rfqType,
        cob: editingLead.cob,
        bor: editingLead.bor,
        quoted: editingLead.quoted,
        status: editingLead.status,
        estimatedPremium: editingLead.estimatedPremium,
        commission: editingLead.commission ?? "",
        currentInsurerId: editingLead.currentInsurerId ? String(editingLead.currentInsurerId) : undefined,
        city: editingLead.city,
        borTimestamp: editingLead.borTimestamp ?? "",
        quoteTimestamp: editingLead.quoteTimestamp ?? "",
        comments: editingLead.comments ?? "",
      }
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder={t("search")} className="h-9 w-56 ps-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
            {tc("clearFilters")}
          </Button>
        )}

        {selectedCount > 0 && (
          <div className="ms-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("selected", { count: selectedCount })}</span>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("Secured")}>{t("markSecured")}</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("Pending")}>{t("markPending")}</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("Lost")}>{t("markLost")}</Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">{tc("loading")}</div>
      ) : (
        <DataTable
          columns={columns}
          data={leads}
          globalFilter={search}
          onGlobalFilterChange={setSearch}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      )}

      <LeadFormDialog
        open={formOpen}
        onOpenChange={(o) => { if (!o) closeForm(); }}
        defaults={editDefaults}
        onSubmit={(values) => saveMutation.mutate({ ...values, id: editingLead?.id })}
        isPending={saveMutation.isPending}
        title={editingLead ? t("editTitle") : convertDefaults ? t("convertTitle") : t("newTitle")}
        userRole={user.role}
      />
    </div>
  );
}
