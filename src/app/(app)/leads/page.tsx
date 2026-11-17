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
  const [statusFilter, setStatusFilter] = useState("");
  const [cobFilter, setCobFilter] = useState("");
  const [rfqFilter, setRfqFilter] = useState("");
  const [producerFilter, setProducerFilter] = useState("");
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

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);
    if (cobFilter) result = result.filter((l) => l.cob === cobFilter);
    if (rfqFilter) result = result.filter((l) => l.rfqType === rfqFilter);
    if (producerFilter) result = result.filter((l) => l.producerId === Number(producerFilter));
    return result;
  }, [leads, statusFilter, cobFilter, rfqFilter, producerFilter]);

  const producerOptions = useMemo(
    () =>
      [...new Map(leads.map((l) => [l.producerId, l.producerName ?? `#${l.producerId}`])).entries()].sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [leads],
  );
  const showProducerFilter = hasRole(user.role, "manager");

  // Selection keys are positions in `filtered`, so a filter change must clear them.
  function changeFilter(set: (value: string) => void) {
    return (value: string) => {
      set(value);
      setRowSelection({});
    };
  }
  const hasFilters = statusFilter || cobFilter || rfqFilter || producerFilter || search;

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
      const ids = Object.keys(rowSelection).map((idx) => filtered[Number(idx)].id);
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

  const columns = useMemo<LegacyColumnDef<Lead, unknown>[]>(
    () => [
      {
        id: "select",
        size: 40,
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
        ),
      },
      { accessorKey: "prospectName", header: t("colProspect") },
      {
        id: "producer",
        header: t("colProducer"),
        accessorFn: (row) => row.producerName,
        size: 160,
      },
      {
        accessorKey: "startWorkingDate",
        header: t("colDate"),
        size: 110,
        cell: ({ getValue }) => formatDate(getValue() as string, locale),
      },
      { accessorKey: "rfqType", header: t("colRfq"), size: 80, cell: ({ getValue }) => tRfq(getValue() as string) },
      { accessorKey: "cob", header: t("colCob"), size: 90, cell: ({ getValue }) => tCob(getValue() as string) },
      {
        accessorKey: "status",
        header: t("colStatus"),
        size: 100,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "estimatedPremium",
        header: t("colPremium"),
        size: 130,
        cell: ({ getValue }) => formatAmount(Number(getValue())),
        sortingFn: (a: { original: Lead }, b: { original: Lead }) => Number(a.original.estimatedPremium) - Number(b.original.estimatedPremium),
      },
      { accessorKey: "city", header: t("colCity"), size: 100 },
      {
        accessorKey: "bor",
        header: t("colBor"),
        size: 60,
        cell: ({ getValue }) => getValue() ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground/40" />,
      },
      {
        accessorKey: "quoted",
        header: t("colQuoted"),
        size: 70,
        cell: ({ getValue }) => getValue() ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground/40" />,
      },
      {
        accessorKey: "insurerName",
        header: t("colInsurer"),
        size: 120,
        cell: ({ getValue }) => getValue() || "--",
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
    ],
    [deleteMutation, t, tc, tRfq, tCob, locale],
  );

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
        {showProducerFilter && (
          <select aria-label={t("colProducer")} className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={producerFilter} onChange={(e) => changeFilter(setProducerFilter)(e.target.value)}>
            <option value="">{tc("allProducers")}</option>
            {producerOptions.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        )}
        <select aria-label={t("colStatus")} className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={statusFilter} onChange={(e) => changeFilter(setStatusFilter)(e.target.value)}>
          <option value="">{t("allStatus")}</option>
          <option value="Secured">{ts("Secured")}</option>
          <option value="Pending">{ts("Pending")}</option>
          <option value="Lost">{ts("Lost")}</option>
        </select>
        <select className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={cobFilter} onChange={(e) => changeFilter(setCobFilter)(e.target.value)} aria-label={t("colCob")}>
          <option value="">{t("allCob")}</option>
          <option value="General">{tCob("General")}</option>
          <option value="Medical">{tCob("Medical")}</option>
          <option value="Motor">{tCob("Motor")}</option>
        </select>
        <select className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={rfqFilter} onChange={(e) => changeFilter(setRfqFilter)(e.target.value)} aria-label={t("colRfq")}>
          <option value="">{t("allRfq")}</option>
          <option value="New">{tRfq("New")}</option>
          <option value="Renewal">{tRfq("Renewal")}</option>
        </select>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setCobFilter(""); setRfqFilter(""); setProducerFilter(""); setSearch(""); setRowSelection({}); }}>
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
          data={filtered}
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
