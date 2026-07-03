"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const OffboardingWorkspace = dynamic(
  () => import("@/features/offboarding/components/OffboardingWorkspace").then(mod => ({ default: mod.OffboardingWorkspace })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <OffboardingWorkspace view="tasks" />;
}
