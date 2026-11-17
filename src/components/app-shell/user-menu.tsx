"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setSoundEnabled, soundEnabled } from "@/components/celebration/sound";
import { authClient } from "@/lib/auth-client";
import { useCurrentUser } from "./current-user";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager",
  salesman: "Salesman",
};

export function UserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [changingPassword, setChangingPassword] = useState(false);
  const [sound, setSound] = useState(soundEnabled);

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    router.replace("/sign-in");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={user.name}>
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {initials(user.name)}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="space-y-0.5">
            <div className="truncate text-sm font-medium">{user.name}</div>
            <div className="truncate text-xs font-normal text-muted-foreground">{user.email}</div>
            <div className="text-xs font-normal text-muted-foreground">{(user.role && ROLE_LABELS[user.role]) ?? user.role}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setChangingPassword(true)}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setSoundEnabled(!sound);
              setSound(!sound);
            }}
          >
            {sound ? <Volume2 /> : <VolumeX />}
            Celebration sound: {sound ? "On" : "Off"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={signOut}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
    </>
  );
}

function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const schema = z
    .object({
      currentPassword: z.string().min(1, "Required"),
      newPassword: z.string().min(8, "Password must be at least 8 characters"),
      confirmPassword: z.string().min(1, "Required"),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: "Passwords do not match",
      path: ["confirmPassword"],
    });
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" } });

  const submit = form.handleSubmit(async (values) => {
    const { error } = await authClient.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword, revokeOtherSessions: true });
    if (error) {
      form.setError("currentPassword", { message: "Current password is incorrect" });
      return;
    }
    toast.success("Password changed successfully");
    form.reset();
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <form id="change-password" onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input id="current-password" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
            {form.formState.errors.currentPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.currentPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" autoComplete="new-password" {...form.register("newPassword")} />
            {form.formState.errors.newPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="change-password" disabled={form.formState.isSubmitting}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
