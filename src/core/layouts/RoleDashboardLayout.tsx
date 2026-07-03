"use client";

import DashboardShell from "@/components/layout/DashboardShell";
import { SidebarLayoutProvider } from "@/components/layout/SidebarLayoutContext";
import { CurrentUserProvider } from "@/lib/CurrentUserContext";
import { AuthGuard } from "@/core/guards/AuthGuard";

export default function RoleDashboardLayout({
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