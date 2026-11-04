"use client";

import { Building2, KeyRound, Users } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { PageHeader } from "@/components/page-header";
import { hasRole } from "@/lib/permissions";

const cards = [
  {
    title: "User Management",
    description: "Create, edit, and deactivate user accounts",
    icon: Users,
    href: "/settings/users",
    adminOnly: true,
  },
  {
    title: "Insurance Companies",
    description: "Manage the list of insurance companies",
    icon: Building2,
    href: "/settings/insurers",
    adminOnly: true,
  },
  {
    title: "Change Password",
    description: "Update your account password",
    icon: KeyRound,
    href: "/settings/password",
    adminOnly: false,
  },
];

export default function SettingsPage() {
  const user = useCurrentUser();
  const isAdmin = hasRole(user.role, "admin");

  const visible = cards.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="System configuration and account management" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border bg-card p-6 shadow-glass glass-sheen transition-colors hover:bg-accent/50"
          >
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <card.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-medium group-hover:text-primary">{card.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
