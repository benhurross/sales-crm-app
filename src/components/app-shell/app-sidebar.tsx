"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { activeHref, navFor } from "@/lib/nav";
import { useCurrentUser } from "./current-user";

export function AppSidebar() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const groups = navFor(user.role ?? undefined);
  const active = activeHref(groups, pathname);
  const t = useTranslations("nav");
  const rtl = useLocale() === "ar";

  return (
    <Sidebar collapsible="icon" side={rtl ? "right" : "left"}>
      <SidebarHeader className="h-14 justify-center px-3">
        <Link href="/" className="flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Image
            src="/brand/applus-white.svg"
            alt="AP Plus"
            width={129}
            height={40}
            className="h-9 w-auto group-data-[collapsible=icon]:hidden"
          />
          <span className="hidden size-8 place-items-center rounded-md bg-sidebar-primary group-data-[collapsible=icon]:grid">
            <Image src="/brand/ap_head.svg" alt="AP Plus" width={16} height={18} />
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.key}>
            <SidebarGroupLabel className="text-sidebar-muted">{t(group.key)}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.href === active}
                    tooltip={t(item.key)}
                    className="data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                  >
                    <Link href={item.href} aria-current={item.href === active ? "page" : undefined}>
                      <item.icon />
                      <span>{t(item.key)}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
