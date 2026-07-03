import type { LeaveStatus } from "@/lib/mock";

export const leaveStatusVariant: Record<
  LeaveStatus,
  "default" | "secondary" | "success" | "destructive" | "warning" | "outline"
> = {
  DRAFT: "secondary",
  CREATED: "secondary",
  PENDING_RECORDING: "warning",
  PENDING_FINALIZATION: "warning",
  RETURNED_FOR_REVIEW: "warning",
  PENDING_HR_ADMIN_PROCESSING: "warning",
  PENDING_HR_ADMIN_PROCESSING_HR_MANAGER: "warning",
  PENDING_HR_ADMIN_PROCESSING_EXECUTIVE: "warning",
  PENDING_HR_MANAGER_PROCESSING_HR_ADMIN: "warning",
  PENDING_HR_STAFF_PROCESSING: "warning",
  PENDING_HR_STAFF_PROCESSING_AUDITOR: "warning",
  PENDING_HR_MANAGER_APPROVAL: "warning",
  PENDING_EXECUTIVE_APPROVAL: "warning",
  PENDING_EXECUTIVE_BOARD_APPROVAL: "warning",
  PENDING_APPROVAL: "warning",
  APPROVED: "success",
  FINAL_APPROVED: "success",
  REJECTED: "destructive",
  APPLIED: "success",
  CANCELLED: "outline",
};
