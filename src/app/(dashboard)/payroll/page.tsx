"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const PayrollPage = dynamic(
  () => import("@/features/payroll/pages/PayrollPage").then(mod => ({ default: mod.PayrollPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <PayrollPage />;
}
