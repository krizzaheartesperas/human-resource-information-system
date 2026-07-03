"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const DepartmentsPage = dynamic(
  () => import("@/features/organization/pages/DepartmentsPage").then(mod => ({ default: mod.DepartmentsPage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <DepartmentsPage />;
}
