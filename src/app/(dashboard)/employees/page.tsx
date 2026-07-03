"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const EmployeesPage = dynamic(
  () => import("@/features/employees/pages/EmployeesPage").then(mod => ({ default: mod.EmployeesPage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <EmployeesPage />;
}
