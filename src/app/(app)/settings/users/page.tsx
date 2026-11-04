"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { LegacyColumnDef } from "@tanstack/react-table/legacy";
import { Pencil, Plus, ShieldCheck, UserX } from "lucide-react";
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

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean | null;
  banReason: string | null;
  createdAt: string;
}

const createSchema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
  role: z.enum(["admin", "manager", "salesman"]),
});

const editSchema = z.object({
  name: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["admin", "manager", "salesman"]),
  password: z.string().min(8, "Min 8 characters").or(z.literal("")).optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type EditValues = z.infer<typeof editSchema>;

export default function UsersPage() {
  const currentUser = useCurrentUser();
  const isAdmin = hasRole(currentUser.role, "admin");
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["settings-users"],
    queryFn: () => fetch("/api/settings/users").then((r) => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateValues) => {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
      toast.success("User created");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, ...values }: EditValues & { id: string }) => {
      const body: Record<string, unknown> = { name: values.name, email: values.email, role: values.role };
      if (values.password) body.password = values.password;
      const res = await fetch(`/api/settings/users/${id}`, {
        method: "PUT",
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
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
      toast.success("User updated");
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleBanMutation = useMutation({
    mutationFn: async ({ id, banned }: { id: string; banned: boolean }) => {
      const res = await fetch(`/api/settings/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banned, banReason: banned ? "Deactivated by admin" : null }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["settings-users"] });
      toast.success(vars.banned ? "User deactivated" : "User reactivated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(u: UserRow) {
    setEditing(u);
    setDialogOpen(true);
  }
  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  const columns = useMemo<LegacyColumnDef<UserRow, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "email", header: "Email" },
      {
        accessorKey: "role",
        header: "Role",
        size: 110,
        cell: ({ getValue }) => {
          const r = getValue() as string;
          return <span className="capitalize">{r}</span>;
        },
      },
      {
        id: "status",
        header: "Status",
        size: 110,
        accessorFn: (row) => (row.banned ? "Deactivated" : "Active"),
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      ...(isAdmin
        ? [
            {
              id: "actions",
              header: "",
              size: 120,
              enableSorting: false,
              cell: ({ row }) => {
                const u = row.original;
                const isSelf = u.id === currentUser.id;
                return (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(u)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    {!isSelf && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        title={u.banned ? "Reactivate" : "Deactivate"}
                        onClick={() => {
                          if (confirm(u.banned ? "Reactivate this user?" : "Deactivate this user?"))
                            toggleBanMutation.mutate({ id: u.id, banned: !u.banned });
                        }}
                      >
                        {u.banned ? <ShieldCheck className="size-3.5 text-emerald-600" /> : <UserX className="size-3.5 text-destructive" />}
                      </Button>
                    )}
                  </div>
                );
              },
            } satisfies LegacyColumnDef<UserRow, unknown>,
          ]
        : []),
    ],
    [isAdmin, currentUser.id, toggleBanMutation],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="User Management" description="Create, edit, and deactivate user accounts">
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Add User
          </Button>
        )}
      </PageHeader>
      {isLoading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground shadow-glass glass-sheen">Loading...</div>
      ) : (
        <DataTable columns={columns} data={users} />
      )}
      {editing ? (
        <EditUserDialog
          open={dialogOpen}
          onOpenChange={(o) => { if (!o) closeDialog(); }}
          user={editing}
          onSubmit={(v) => editMutation.mutate({ ...v, id: editing.id })}
          isPending={editMutation.isPending}
        />
      ) : (
        <CreateUserDialog
          open={dialogOpen}
          onOpenChange={(o) => { if (!o) closeDialog(); }}
          onSubmit={(v) => createMutation.mutate(v)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: CreateValues) => void;
  isPending: boolean;
}) {
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", role: "salesman" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
        </DialogHeader>
        <form id="create-user-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <select id="role" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("role")}>
              <option value="salesman">Salesman</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="create-user-form" disabled={isPending}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: UserRow;
  onSubmit: (v: EditValues) => void;
  isPending: boolean;
}) {
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    values: { name: user.name, email: user.email, role: user.role as EditValues["role"], password: "" },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form id="edit-user-form" onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" {...form.register("name")} />
            {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-password">New Password</Label>
            <Input id="edit-password" type="password" placeholder="Leave blank to keep current" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-role">Role</Label>
            <select id="edit-role" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...form.register("role")}>
              <option value="salesman">Salesman</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="edit-user-form" disabled={isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
