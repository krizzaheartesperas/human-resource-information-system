"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const LeavePage = dynamic(
  () => import("@/features/leave/pages/LeavePage").then(mod => ({ default: mod.LeavePage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <LeavePage />;
}
