"use client";

import dynamic from "next/dynamic";
import type { Role } from "@/lib/mock";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const ComplaintsHubPage = dynamic(
  () => import("@/features/complaints/components/ComplaintsHubPage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false },
);
const ComplaintsAdminPage = dynamic(
  () => import("@/features/complaints/components/ComplaintsAdminPage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false },
);
const ComplaintsStaffPage = dynamic(
  () => import("@/features/complaints/components/ComplaintsStaffPage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false },
);
const ComplaintsManagerPage = dynamic(
  () => import("@/features/complaints/components/ComplaintsManagerPage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false },
);
const ComplaintsAuditPage = dynamic(
  () => import("@/features/complaints/components/ComplaintsAuditPage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false },
);
const ComplaintsExecutivePage = dynamic(
  () => import("@/features/complaints/components/ComplaintsExecutivePage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false },
);

export function ComplaintsPageForRole({ role }: { role: Role }) {
  switch (role) {
    case "SUPER_ADMIN":
    case "HR_ADMIN":
      return <ComplaintsAdminPage />;
    case "HR_STAFF":
      return <ComplaintsStaffPage />;
    case "HR_MANAGER":
    case "DEPARTMENT_MANAGER":
      return <ComplaintsManagerPage />;
    case "AUDITOR":
      return <ComplaintsAuditPage />;
    case "EXECUTIVE":
      return <ComplaintsExecutivePage />;
    default:
      return <ComplaintsHubPage />;
  }
}

export default function ComplaintsPage({ role }: { role: Role }) {
  return <ComplaintsPageForRole role={role} />;
}
