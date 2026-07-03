"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const ReportsAttendancePage = dynamic(
  () => import("@/features/reports/pages/ReportsAttendancePage").then(mod => ({ default: mod.ReportsAttendancePage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <ReportsAttendancePage />;
}
