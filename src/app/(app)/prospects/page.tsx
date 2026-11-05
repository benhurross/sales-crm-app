"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/format";
import { hasRole } from "@/lib/permissions";
import { ProspectFormDialog, type ProspectFormValues } from "./prospect-form";

interface Prospect {
  id: number;
  producerId: number;
  clientName: string;
  premiums: string | null;
  month: string | null;
  currentInsurerId: number | null;
  lob: "General" | "Medical" | "Motor" | null;
  producerName: string | null;
  producerCode: string | null;
  insurerName: string | null;
}

export default function ProspectsPage() {
  const user = useCurrentUser();
  const canManage = hasRole(user.role, "manager");
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [lobFilter, setLobFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);

  const { data: prospects = [], isLoading } = useQuery<Prospect[]>({
    queryKey: ["prospects"],
    queryFn: () => fetch("/api/prospects").then((r) => r.json()),
  });

  const filtered = useMemo(() => {
    let result = prospects;
    if (lobFilter) result = result.filter((p) => p.lob === lobFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.clientName.toLowerCase().includes(q) ||
          p.producerName?.toLowerCase().includes(q) ||
          p.producerCode?.toLowerCase().includes(q) ||
          p.insurerName?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [prospects, lobFilter, search]);

  const saveMutation = useMutation({
    mutationFn: async (values: ProspectFormValues & { id?: number }) => {
      const { id, producerId, currentInsurerId, ...rest } = values;
      const body = {
        ...rest,
        producerId: Number(producerId),
        currentInsurerId: currentInsurerId ? Number(currentInsurerId) : null,
        lob: rest.lob || null,
      };
      const res = await fetch(id ? `/api/prospects/${id}` : "/api/prospects", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success(editingProspect ? "Prospect updated" : "Prospect created");
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditingProspect(null);
    setFormOpen(true);
  }
  function openEdit(prospect: Prospect) {
    setEditingProspect(prospect);
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingProspect(null);
  }

  const columns = useMemo<LegacyColumnDef<Prospect, unknown>[]>(
    () => [
      { accessorKey: "clientName", header: "Client Name" },
      {
        id: "producer",
        header: "Producer",
        accessorFn: (row) => row.producerName,
        size: 160,
      },
      {
        accessorKey: "premiums",
        header: "Premiums",
        size: 130,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v && Number(v) > 0 ? formatAmount(Number(v)) : "--";
        },
        sortingFn: (a: { original: Prospect }, b: { original: Prospect }) =>
          Number(a.original.premiums ?? 0) - Number(b.original.premiums ?? 0),
      },
      { accessorKey: "month", header: "Month", size: 100, cell: ({ getValue }) => getValue() || "--" },
      { accessorKey: "lob", header: "LOB", size: 90, cell: ({ getValue }) => getValue() || "--" },
      {
        accessorKey: "insurerName",
        header: "Current Insurer",
        size: 140,
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
                onClick={() => { if (confirm("Delete this prospect?")) deleteMutation.mutate(row.original.id); }}
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

  const editDefaults: Partial<ProspectFormValues> | undefined = editingProspect
    ? {
        clientName: editingProspect.clientName,
        producerId: String(editingProspect.producerId),
        premiums: editingProspect.premiums ?? "",
        month: editingProspect.month ?? "",
        currentInsurerId: editingProspect.currentInsurerId ? String(editingProspect.currentInsurerId) : undefined,
        lob: editingProspect.lob ?? undefined,
      }
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title="Prospects" description="Client pipeline tracking">
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add Prospect
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder="Search clients..." className="h-9 w-56 pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={lobFilter} onChange={(e) => setLobFilter(e.target.value)}>
          <option value="">All LOB</option>
          <option value="General">General</option>
          <option value="Medical">Medical</option>
          <option value="Motor">Motor</option>
        </select>
        {(lobFilter || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setLobFilter(""); setSearch(""); }}>
            Clear filters
          </Button>
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
        />
      )}

      <ProspectFormDialog
        open={formOpen}
        onOpenChange={(o) => { if (!o) closeForm(); }}
        defaults={editDefaults}
        onSubmit={(values) =>
          saveMutation.mutate(editingProspect ? { ...values, id: editingProspect.id } : values)
        }
        isPending={saveMutation.isPending}
        title={editingProspect ? "Edit Prospect" : "New Prospect"}
        userRole={user.role}
      />
    </div>
  );
}
