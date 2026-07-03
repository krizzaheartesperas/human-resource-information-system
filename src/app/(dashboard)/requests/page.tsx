"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const RequestsPage = dynamic(
  () => import("@/features/workflow/pages/RequestsPage").then(mod => ({ default: mod.RequestsPage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <RequestsPage />;
}
