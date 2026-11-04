"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { AppSidebar } from "./app-sidebar";
import { CurrentUserProvider } from "./current-user";
import { MeshBackground } from "./mesh-background";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) router.replace("/sign-in");
  }, [isPending, session, router]);

  if (!session) {
    return (
      <div className="flex min-h-dvh">
        <div className="hidden w-64 bg-sidebar md:block" />
        <div className="flex-1 space-y-4 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <CurrentUserProvider value={session.user}>
      <MeshBackground />
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0 bg-transparent">
          <Topbar />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </CurrentUserProvider>
  );
}
