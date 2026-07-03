"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const HelpPage = dynamic(
  () => import("@/features/help/pages/HelpPage").then(mod => ({ default: mod.HelpPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <HelpPage />;
}
