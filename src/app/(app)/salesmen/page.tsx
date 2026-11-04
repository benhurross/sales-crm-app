"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { DataTable } from "@/components/data-table";
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
  code: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email").or(z.literal("")).optional(),
  region: z.string().min(1, "Required"),
  title: z.string().optional(),
  employmentStatus: z.enum(["Active", "Resigned", "Transferred"]),
  joinDate: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function SalesmenPage() {
  const user = useCurrentUser();
  const canEdit = hasRole(user.role, "manager");
  const queryClient = useQueryClient();
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
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producers"] });
      toast.success(editing ? "Salesman updated" : "Salesman added");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/producers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["producers"] });
      toast.success("Salesman deleted");
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
      { accessorKey: "code", header: "Code", size: 80 },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email", cell: ({ getValue }) => (getValue() as string) || "--" },
      { accessorKey: "region", header: "Region", size: 100 },
      { accessorKey: "title", header: "Title", cell: ({ getValue }) => (getValue() as string) || "--" },
      {
        accessorKey: "employmentStatus",
        header: "Status",
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
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(row.original)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  {hasRole(user.role, "admin") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => { if (confirm("Delete this salesman?")) deleteMutation.mutate(row.original.id); }}
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
    [canEdit, user.role, deleteMutation],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Salesmen" description="Manage sales team members">
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Salesman
          </Button>
        )}
      </PageHeader>
      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">Loading...</div>
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
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing
      ? { code: editing.code, name: editing.name, email: editing.email ?? "", region: editing.region, title: editing.title ?? "", employmentStatus: editing.employmentStatus as FormValues["employmentStatus"], joinDate: editing.joinDate ?? "" }
      : { code: "", name: "", email: "", region: "Jeddah", title: "", employmentStatus: "Active", joinDate: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Salesman" : "Add Salesman"}</DialogTitle>
        </DialogHeader>
        <form id="salesman-form" onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="e.g. J-2" {...form.register("code")} />
            {form.formState.errors.code && <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="region">Region</Label>
            <Input id="region" {...form.register("region")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...form.register("title")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="employmentStatus">Status</Label>
            <select id="employmentStatus" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("employmentStatus")}>
              <option value="Active">Active</option>
              <option value="Resigned">Resigned</option>
              <option value="Transferred">Transferred</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="joinDate">Join Date</Label>
            <Input id="joinDate" type="date" {...form.register("joinDate")} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="salesman-form" disabled={isPending}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
