"use client";

import { Building2, Users } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCurrentUser } from "@/components/app-shell/current-user";
import { PageHeader } from "@/components/page-header";
import { hasRole } from "@/lib/permissions";

const cards = [
  {
    key: "users",
    icon: Users,
    href: "/settings/users",
    adminOnly: true,
  },
  {
    key: "insurers",
    icon: Building2,
    href: "/settings/insurers",
    adminOnly: true,
  },
];

export default function SettingsPage() {
  const user = useCurrentUser();
  const isAdmin = hasRole(user.role, "admin");
  const t = useTranslations("settings");

  const visible = cards.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />
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
                <h3 className="font-medium group-hover:text-primary">{t(`${card.key}Title`)}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t(`${card.key}Description`)}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
