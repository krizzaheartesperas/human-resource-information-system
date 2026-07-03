"use client";

import LeaveWorkspacePage from "@/features/leave/components/LeaveWorkspacePage";
import type { LeavePageViewModel } from "@/features/leave/hooks/useLeavePage";

export function LeavePageMainView({ model }: { model: LeavePageViewModel }) {
  void model;
  return <LeaveWorkspacePage />;
}
