"use client";

import { usePathname } from "next/navigation";
import { getDashboardLoadingVariant } from "@/components/layout/dashboard-loading-variants";
import { DashboardLoadingByVariant } from "@/components/layout/dashboard-loading-placeholders";

/** Route-aware loading UI for `(dashboard)/loading.tsx`. */
export default function DashboardSegmentLoading() {
  const pathname = usePathname();
  const variant = getDashboardLoadingVariant(pathname);
  return <DashboardLoadingByVariant variant={variant} />;
}
