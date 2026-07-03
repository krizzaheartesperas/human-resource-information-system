"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const ReportsWorkflowPage = dynamic(
  () => import("@/features/reports/pages/ReportsWorkflowPage").then(mod => ({ default: mod.ReportsWorkflowPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <ReportsWorkflowPage />;
}
