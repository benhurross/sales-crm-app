"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { ArrowRightLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount } from "@/lib/format";
import { ProspectFormDialog, type ProspectFormValues } from "./prospect-form";

interface Prospect {
  id: number;
  producerId: number;
  clientName: string;
  premiums: string | null;
  month: string | null;
  currentInsurerId: number | null;
  lob: "General" | "Medical" | "Motor" | null;
  status: "prospect" | "converted" | "inactive";
  producerName: string | null;
  insurerName: string | null;
}

export default function ProspectsPage() {
  const user = useCurrentUser();
  const queryClient = useQueryClient();
  const router = useRouter();
  const t = useTranslations("prospects");
  const tc = useTranslations("common");
  const tCob = useTranslations("cob");
  const ts = useTranslations("status");

  const [search, setSearch] = useState("");
  const [lobFilter, setLobFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingProspect, setEditingProspect] = useState<Prospect | null>(null);

  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (query) params.set("q", query);
  if (lobFilter) params.set("lob", lobFilter);
  if (statusFilter) params.set("status", statusFilter);
  if (sorting[0]) {
    params.set("sort", sorting[0].id);
    params.set("dir", sorting[0].desc ? "desc" : "asc");
  }

  const { data, isLoading } = useQuery<{ rows: Prospect[]; total: number }>({
    queryKey: ["prospects", params.toString()],
    queryFn: () => fetch(`/api/prospects?${params}`).then((r) => r.json()),
    placeholderData: keepPreviousData,
  });

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
      if (!res.ok) throw new Error((await res.json()).error || tc("failed"));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success(editingProspect ? t("updated") : t("created"));
      closeForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/prospects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(tc("deleteFailed"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success(t("deleted"));
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
      { accessorKey: "clientName", header: t("colClient") },
      {
        id: "producer",
        header: t("colProducer"),
        accessorFn: (row) => row.producerName,
        size: 160,
      },
      {
        accessorKey: "premiums",
        header: t("colPremiums"),
        size: 130,
        cell: ({ getValue }) => {
          const v = getValue() as string | null;
          return v && Number(v) > 0 ? formatAmount(Number(v)) : "--";
        },
        sortingFn: (a: { original: Prospect }, b: { original: Prospect }) =>
          Number(a.original.premiums ?? 0) - Number(b.original.premiums ?? 0),
      },
      { accessorKey: "month", header: t("colMonth"), size: 100, cell: ({ getValue }) => getValue() || "--" },
      { accessorKey: "lob", header: t("colLob"), size: 90, cell: ({ getValue }) => (getValue() ? tCob(getValue() as string) : "--") },
      {
        accessorKey: "insurerName",
        header: t("colInsurer"),
        size: 140,
        cell: ({ getValue }) => getValue() || "--",
      },
      {
        accessorKey: "status",
        header: t("colStatus"),
        size: 110,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        id: "actions",
        header: "",
        size: 120,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.status === "prospect" && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-primary hover:text-primary"
                title={t("convert")}
                aria-label={t("convert")}
                onClick={() => router.push(`/leads?convertProspect=${row.original.id}`)}
              >
                <ArrowRightLeft className="size-3.5" />
              </Button>
            )}
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
    [deleteMutation, router, t, tc, tCob],
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
      <PageHeader title={t("title")} description={t("description")}>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input placeholder={t("search")} className="h-9 w-56 ps-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={lobFilter} onChange={(e) => { setLobFilter(e.target.value); setPage(0); }} aria-label={t("colLob")}>
          <option value="">{t("allLob")}</option>
          <option value="General">{tCob("General")}</option>
          <option value="Medical">{tCob("Medical")}</option>
          <option value="Motor">{tCob("Motor")}</option>
        </select>
        <select className="flex h-9 rounded-md border border-input bg-popover px-3 text-sm shadow-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} aria-label={t("colStatus")}>
          <option value="">{t("allStatus")}</option>
          <option value="prospect">{ts("prospect")}</option>
          <option value="converted">{ts("converted")}</option>
          <option value="inactive">{ts("inactive")}</option>
        </select>
        {(lobFilter || statusFilter || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setLobFilter(""); setStatusFilter(""); setSearch(""); setPage(0); }}>
            {tc("clearFilters")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">{tc("loading")}</div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.rows ?? []}
          server={{ rowCount: data?.total ?? 0, pageIndex: page, onPageIndexChange: setPage, sorting, onSortingChange: (s) => { setSorting(s); setPage(0); } }}
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
        title={editingProspect ? t("editTitle") : t("newTitle")}
        userRole={user.role}
      />
    </div>
  );
}
