"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const UserManagementPage = dynamic(
  () => import("@/features/user-management/pages/UserManagementPage"),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <UserManagementPage />;
}
