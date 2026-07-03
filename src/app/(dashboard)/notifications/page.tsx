"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const NotificationsPage = dynamic(
  () => import("@/features/notifications/pages/NotificationsPage").then(mod => ({ default: mod.NotificationsPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <NotificationsPage />;
}
