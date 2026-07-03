"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const AuditPage = dynamic(
  () => import("@/features/audit/pages/AuditPage").then(mod => ({ default: mod.AuditPage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <AuditPage />;
}
