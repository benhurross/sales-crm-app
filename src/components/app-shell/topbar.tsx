"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar() {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/60 px-3 backdrop-blur-xl md:px-4">
      <SidebarTrigger aria-label="Toggle sidebar" />
      <div className="ms-auto flex shrink-0 items-center gap-1">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
