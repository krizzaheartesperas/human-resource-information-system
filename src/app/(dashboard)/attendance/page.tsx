"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const AttendancePage = dynamic(
  () => import("@/features/attendance/pages/AttendancePage").then(mod => ({ default: mod.AttendancePage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <AttendancePage />;
}
