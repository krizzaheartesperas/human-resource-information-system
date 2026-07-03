"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const HandbookClient = dynamic(
  () => import("@/features/handbook/components/HandbookClient").then(mod => ({ default: mod.HandbookClient })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function HandbookPage() {
  return <HandbookClient />;
}
