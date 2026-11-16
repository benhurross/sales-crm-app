"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useCurrentUser } from "@/components/app-shell/current-user";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const isAdmin = user.role === "admin";

  useEffect(() => {
    if (!isAdmin) router.replace("/");
  }, [isAdmin, router]);

  return isAdmin ? children : null;
}
