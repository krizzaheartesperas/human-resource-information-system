"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const PayrollPayslipDetailPage = dynamic(
  () => import("@/features/payroll/pages/PayrollPayslipDetailPage").then(mod => ({ default: mod.PayrollPayslipDetailPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <PayrollPayslipDetailPage />;
}
