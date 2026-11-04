"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  name: z.string().min(1, "Required"),
});
type FormValues = z.infer<typeof schema>;

export default function InsurersPage() {
  const user = useCurrentUser();
  const isAdmin = hasRole(user.role, "admin");
  const queryClient = useQueryClient();
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
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-insurers"] });
      toast.success(editing ? "Insurer updated" : "Insurer added");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/settings/insurers/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Delete failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-insurers"] });
      toast.success("Insurer deleted");
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
      { accessorKey: "id", header: "ID", size: 60 },
      { accessorKey: "name", header: "Name" },
      ...(isAdmin
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this insurance company?")) deleteMutation.mutate(row.original.id);
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
    [isAdmin, deleteMutation],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Insurance Companies" description="Manage the list of insurance companies">
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add Insurer
          </Button>
        )}
      </PageHeader>
      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">Loading...</div>
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
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: editing ? { name: editing.name } : { name: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Insurer" : "Add Insurer"}</DialogTitle>
        </DialogHeader>
        <form id="insurer-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="insurer-name">Company Name</Label>
            <Input id="insurer-name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="insurer-form" disabled={isPending}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
