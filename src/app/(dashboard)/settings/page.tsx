"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const SettingsPage = dynamic(
  () => import("@/features/settings/pages/SettingsPage").then(mod => ({ default: mod.SettingsPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <SettingsPage />;
}
