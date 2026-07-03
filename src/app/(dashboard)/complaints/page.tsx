"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";
import { useCurrentUser } from "@/lib/CurrentUserContext";

const ComplaintsPage = dynamic(
  () => import("@/features/complaints/pages/ComplaintsPage"),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  const { user } = useCurrentUser();
  return <ComplaintsPage role={user.role} />;
}
