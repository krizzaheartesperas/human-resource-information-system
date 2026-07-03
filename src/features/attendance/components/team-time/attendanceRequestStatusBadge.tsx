"use client";

import { cn } from "@/lib/utils";

export type RequestWorkflowStatus = "PENDING" | "APPROVED" | "REJECTED";

export function AttendanceRequestStatusBadge({ status }: { status: RequestWorkflowStatus }) {
  const map: Record<
    RequestWorkflowStatus,
    { label: string; className: string }
  > = {
    PENDING: {
      label: "Pending",
      className:
        "bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-100 dark:ring-amber-400/35",
    },
    APPROVED: {
      label: "Approved",
      className:
        "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/30",
    },
    REJECTED: {
      label: "Rejected",
      className:
        "bg-red-500/15 text-red-800 ring-red-500/25 dark:text-red-200 dark:ring-red-400/30",
    },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}
