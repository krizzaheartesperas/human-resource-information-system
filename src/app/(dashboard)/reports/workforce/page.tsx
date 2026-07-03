"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const ReportsWorkforcePage = dynamic(
  () => import("@/features/reports/pages/ReportsWorkforcePage").then(mod => ({ default: mod.ReportsWorkforcePage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <ReportsWorkforcePage />;
}
