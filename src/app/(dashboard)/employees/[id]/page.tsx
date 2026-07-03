"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const EmployeeDetailPage = dynamic(
  () => import("@/features/employees/pages/EmployeeDetailPage").then(mod => ({ default: mod.EmployeeDetailPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <EmployeeDetailPage params={params} />;
}
