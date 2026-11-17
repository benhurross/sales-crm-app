"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasRole } from "@/lib/permissions";

interface Insurer {
  id: number;
  name: string;
  createdAt: string;
}

const schema = z.object({
  name: z.string().min(1, "required"),
});
type FormValues = z.infer<typeof schema>;

export default function InsurersPage() {
  const user = useCurrentUser();
  const isAdmin = hasRole(user.role, "admin");
  const queryClient = useQueryClient();
  const t = useTranslations("insurers");
  const tc = useTranslations("common");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Insurer | null>(null);

  const { data: insurers = [], isLoading } = useQuery<Insurer[]>({
    queryKey: ["settings-insurers"],
    queryFn: () => fetch("/api/settings/insurers").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues & { id?: number }) => {
      const { id, ...body } = values;
      const res = await fetch(id ? `/api/settings/insurers/${id}` : "/api/settings/insurers", {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tc("failed"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-insurers"] });
      toast.success(editing ? t("updated") : t("added"));
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/settings/insurers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || tc("deleteFailed"));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-insurers"] });
      toast.success(t("deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(i: Insurer) {
    setEditing(i);
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  const columns = useMemo<LegacyColumnDef<Insurer, unknown>[]>(
    () => [
      { accessorKey: "id", header: "ID", size: 80, meta: { filter: "range" } },
      { accessorKey: "name", header: t("colName") },
      ...(isAdmin
        ? [
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
                    onClick={() => {
                      if (confirm(t("confirmDelete"))) deleteMutation.mutate(row.original.id);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ),
            } satisfies LegacyColumnDef<Insurer, unknown>,
          ]
        : []),
    ],
    [isAdmin, deleteMutation, t, tc],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        )}
      </PageHeader>
      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">{tc("loading")}</div>
      ) : (
        <DataTable columns={columns} data={insurers} />
      )}
      <InsurerFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { if (!o) closeDialog(); }}
        editing={editing}
        onSubmit={(v) => mutation.mutate({ ...v, id: editing?.id })}
        isPending={mutation.isPending}
      />
    </div>
  );
}

function InsurerFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Insurer | null;
  onSubmit: (v: FormValues) => void;
  isPending: boolean;
}) {
  const t = useTranslations("insurers");
  const tc = useTranslations("common");
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing ? { name: editing.name } : { name: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("add")}</DialogTitle>
        </DialogHeader>
        <form id="insurer-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="insurer-name">{t("companyName")}</Label>
            <Input id="insurer-name" {...form.register("name")} />
            {form.formState.errors.name?.message && <p className="text-xs text-destructive">{tc(form.formState.errors.name.message)}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button type="submit" form="insurer-form" disabled={isPending}>{editing ? tc("save") : tc("add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
