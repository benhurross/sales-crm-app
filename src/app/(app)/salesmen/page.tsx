"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
import { BadgeIcons, useHighlights } from "@/components/celebration/badges";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hasRole } from "@/lib/permissions";

interface Producer {
  id: number;
  code: string;
  name: string;
  email: string | null;
  employmentStatus: string;
  region: string;
  title: string | null;
  annualTarget: string;
  monthlyTarget: string;
  joinDate: string | null;
}

const schema = z.object({
  name: z.string().min(1, "required"),
  email: z.string().email("invalidEmail").or(z.literal("")).optional(),
  region: z.string().min(1, "required"),
  title: z.string().optional(),
  employmentStatus: z.enum(["Active", "Resigned", "Transferred"]),
  joinDate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function SalesmenPage() {
  const user = useCurrentUser();
  const canEdit = hasRole(user.role, "manager");
  const queryClient = useQueryClient();
  const t = useTranslations("salesmen");
  const tc = useTranslations("common");
  const { data: highlights } = useHighlights();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Producer | null>(null);

  const { data: producers = [], isLoading } = useQuery<Producer[]>({
    queryKey: ["producers"],
    queryFn: () => fetch("/api/producers").then((r) => r.json()),
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues & { id?: number }) => {
      const { id, ...body } = values;
      const res = await fetch(id ? `/api/producers/${id}` : "/api/producers", {
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
      queryClient.invalidateQueries({ queryKey: ["producers"] });
      toast.success(editing ? t("updated") : t("added"));
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/producers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || tc("deleteFailed"));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producers"] });
      toast.success(t("deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(p: Producer) {
    setEditing(p);
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  const columns = useMemo<LegacyColumnDef<Producer, unknown>[]>(
    () => [
      { accessorKey: "name", header: t("colName") },
      { accessorKey: "email", header: t("colEmail"), cell: ({ getValue }) => (getValue() as string) || "--" },
      { accessorKey: "region", header: t("colRegion"), size: 100 },
      {
        id: "badges",
        header: t("colBadges"),
        enableSorting: false,
        cell: ({ row }) => <BadgeIcons badges={highlights?.badges[row.original.id]} />,
      },
      { accessorKey: "title", header: t("colTitle"), cell: ({ getValue }) => (getValue() as string) || "--" },
      {
        accessorKey: "employmentStatus",
        header: t("colStatus"),
        size: 120,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      ...(canEdit
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
                  {hasRole(user.role, "admin") && (
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
                  )}
                </div>
              ),
            } satisfies LegacyColumnDef<Producer, unknown>,
          ]
        : []),
    ],
    [canEdit, user.role, deleteMutation, t, tc, highlights],
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")}>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t("add")}
          </Button>
        )}
      </PageHeader>
      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">{tc("loading")}</div>
      ) : (
        <DataTable columns={columns} data={producers} />
      )}
      <SalesmanFormDialog
        open={dialogOpen}
        onOpenChange={(o) => { if (!o) closeDialog(); }}
        editing={editing}
        onSubmit={(values) => mutation.mutate({ ...values, id: editing?.id })}
        isPending={mutation.isPending}
      />
    </div>
  );
}

function SalesmanFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Producer | null;
  onSubmit: (v: FormValues) => void;
  isPending: boolean;
}) {
  const t = useTranslations("salesmen");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const err = (message?: string) => (message ? <p className="text-xs text-destructive">{tc(message)}</p> : null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing
      ? { name: editing.name, email: editing.email ?? "", region: editing.region, title: editing.title ?? "", employmentStatus: editing.employmentStatus as FormValues["employmentStatus"], joinDate: editing.joinDate ?? "" }
      : { name: "", email: "", region: "Jeddah", title: "", employmentStatus: "Active", joinDate: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("add")}</DialogTitle>
        </DialogHeader>
        <form id="salesman-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("colName")}</Label>
            <Input id="name" {...form.register("name")} />
            {err(form.formState.errors.name?.message)}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="email">{t("colEmail")}</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {err(form.formState.errors.email?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">{t("colRegion")}</Label>
            <Input id="region" {...form.register("region")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">{t("colTitle")}</Label>
            <Input id="title" {...form.register("title")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employmentStatus">{t("colStatus")}</Label>
            <select id="employmentStatus" className="flex h-9 w-full rounded-md border border-input bg-popover px-3 py-1 text-sm shadow-sm" {...form.register("employmentStatus")}>
              <option value="Active">{ts("Active")}</option>
              <option value="Resigned">{ts("Resigned")}</option>
              <option value="Transferred">{ts("Transferred")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="joinDate">{t("joinDate")}</Label>
            <Input id="joinDate" type="date" {...form.register("joinDate")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tc("cancel")}</Button>
          <Button type="submit" form="salesman-form" disabled={isPending}>{editing ? tc("save") : tc("add")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
