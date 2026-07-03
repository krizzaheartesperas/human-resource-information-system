"use client";

import { CurrentUserProvider } from "@/lib/CurrentUserContext";
import { SidebarLayoutProvider } from "@/components/layout/SidebarLayoutContext";
import { AuthGuard } from "@/core/guards/AuthGuard";
import DashboardShell from "@/components/layout/DashboardShell";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CurrentUserProvider>
      <SidebarLayoutProvider>
        <AuthGuard>
          <DashboardShell>{children}</DashboardShell>
        </AuthGuard>
      </SidebarLayoutProvider>
    </CurrentUserProvider>
  );
}