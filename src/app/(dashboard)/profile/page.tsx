"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";

const ProfilePage = dynamic(
  () => import("@/features/profile/pages/ProfilePage").then(mod => ({ default: mod.ProfilePage })),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  return <ProfilePage />;
}
