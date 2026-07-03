"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const DashboardHomePage = dynamic(
  () => import("@/features/dashboard/pages/DashboardHomePage").then(mod => ({ default: mod.DashboardHomePage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <DashboardHomePage />;
}
