"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const ComplaintByIdPage = dynamic(
  () => import("@/features/complaints/pages/ComplaintByIdPage"),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <ComplaintByIdPage />;
}
