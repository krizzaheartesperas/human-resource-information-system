"use client";

import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/ui/page-skeleton";
import { useCurrentUser } from "@/lib/CurrentUserContext";

const OffboardingPageClient = dynamic(
  () => import("@/features/offboarding/components/OffboardingPageClient"),
  { loading: () => <DashboardPageSkeleton />, ssr: false }
);

export default function Page() {
  const { user: currentUser } = useCurrentUser();

  if (!currentUser) return null;

  return <OffboardingPageClient />;
}
