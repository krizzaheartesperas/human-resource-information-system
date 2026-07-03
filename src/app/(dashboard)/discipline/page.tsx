"use client";

import dynamic from "next/dynamic";
import { TablePageSkeleton } from "@/components/ui/page-skeleton";

const DisciplinePage = dynamic(
  () => import("@/features/discipline/pages/DisciplinePage").then(mod => ({ default: mod.DisciplinePage })),
  { loading: () => <TablePageSkeleton />, ssr: false }
);

export default function Page() {
  return <DisciplinePage />;
}
