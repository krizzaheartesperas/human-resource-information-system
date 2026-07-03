"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const OrganizationPage = dynamic(
  () => import("@/features/organization/pages/OrganizationPage").then(mod => ({ default: mod.OrganizationPage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <OrganizationPage />;
}
