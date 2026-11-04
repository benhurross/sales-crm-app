"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
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
  producerName: string | null;
  producerCode: string | null;
  insurerName: string | null;
}

export default function LeadsPage() {
  const user = useCurrentUser();
  const canManage = hasRole(user.role, "manager");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cobFilter, setCobFilter] = useState("");
  const [rfqFilter, setRfqFilter] = useState("");
  const [rowSelection, setRowSelection] = useState<Record<string, true>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetch("/api/leads").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);
    if (cobFilter) result = result.filter((l) => l.cob === cobFilter);
    if (rfqFilter) result = result.filter((l) => l.rfqType === rfqFilter);
    return result;
  }, [leads, statusFilter, cobFilter, rfqFilter]);

  const saveMutation = useMutation({
    mutationFn: async (values: LeadFormValues & { id?: number }) => {
      const { id, producerId, currentInsurerId, ...rest } = values;
      const body = {
        ...rest,
        producerId: Number(producerId),
        currentInsurerId: currentInsurerId ? Number(currentInsurerId) : null,
      };
      const res = await fetch(id ? `/api/leads/${id}` : "/api/leads", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(editingLead ? "Lead updated" : "Lead created");
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/leads/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success("Lead deleted");
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
      if (!res.ok) throw new Error("Bulk update failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      setRowSelection({});
      toast.success(`${data.updated} leads updated`);
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
      { accessorKey: "prospectName", header: "Prospect" },
      {
        id: "producer",
        header: "Producer",
        accessorFn: (row) => row.producerCode ? `${row.producerCode} - ${row.producerName}` : row.producerName,
        size: 160,
      },
      {
        accessorKey: "startWorkingDate",
        header: "Date",
        size: 110,
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      { accessorKey: "rfqType", header: "RFQ", size: 80 },
      { accessorKey: "cob", header: "COB", size: 90 },
      {
        accessorKey: "status",
        header: "Status",
        size: 100,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        accessorKey: "estimatedPremium",
        header: "Premium",
        size: 130,
        cell: ({ getValue }) => formatAmount(Number(getValue())),
        sortingFn: (a: { original: Lead }, b: { original: Lead }) => Number(a.original.estimatedPremium) - Number(b.original.estimatedPremium),
      },
      { accessorKey: "city", header: "City", size: 100 },
      {
        accessorKey: "bor",
        header: "BOR",
        size: 60,
        cell: ({ getValue }) => getValue() ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground/40" />,
      },
      {
        accessorKey: "quoted",
        header: "Quoted",
        size: 70,
        cell: ({ getValue }) => getValue() ? <Check className="size-4 text-emerald-500" /> : <X className="size-4 text-muted-foreground/40" />,
      },
      {
        accessorKey: "insurerName",
        header: "Insurer",
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
            <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(row.original)}>
              <Pencil className="size-3.5" />
            </Button>
            {canManage && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                onClick={() => { if (confirm("Delete this lead?")) deleteMutation.mutate(row.original.id); }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canManage, deleteMutation],
  );

  const editDefaults: Partial<LeadFormValues> | undefined = editingLead
    ? {
        prospectName: editingLead.prospectName,
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
      <PageHeader title="Leads" description="Manage sales leads and prospects">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Lead
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search prospects..." className="h-9 w-56 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="Secured">Secured</option>
          <option value="Pending">Pending</option>
          <option value="Lost">Lost</option>
        </select>
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" value={cobFilter} onChange={(e) => setCobFilter(e.target.value)}>
          <option value="">All COB</option>
          <option value="General">General</option>
          <option value="Medical">Medical</option>
          <option value="Motor">Motor</option>
        </select>
        <select className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm" value={rfqFilter} onChange={(e) => setRfqFilter(e.target.value)}>
          <option value="">All RFQ</option>
          <option value="New">New</option>
          <option value="Renewal">Renewal</option>
        </select>
        {(statusFilter || cobFilter || rfqFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setStatusFilter(""); setCobFilter(""); setRfqFilter(""); }}>
            Clear filters
          </Button>
        )}

        {selectedCount > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedCount} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("Secured")}>Mark Secured</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("Pending")}>Mark Pending</Button>
            <Button size="sm" variant="outline" onClick={() => bulkMutation.mutate("Lost")}>Mark Lost</Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">Loading...</div>
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
        title={editingLead ? "Edit Lead" : "New Lead"}
        userRole={user.role}
      />
    </div>
  );
}
