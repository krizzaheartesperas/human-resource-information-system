import type { LeaveStatus, Role } from "@/lib/mock";

/**
 * Initial workflow status when a user submits their own leave request.
 * Mirrors the approval matrix (employee → manager → HR staff → …).
 */
export function getInitialLeaveStatusOnSubmit(role: Role): LeaveStatus {
  switch (role) {
    case "HR_STAFF":
      return "PENDING_HR_MANAGER_APPROVAL";
    case "DEPARTMENT_MANAGER":
    case "MANAGER":
      return "PENDING_HR_STAFF_PROCESSING";
    case "HR_ADMIN":
      return "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN";
    case "HR_MANAGER":
      return "PENDING_EXECUTIVE_APPROVAL";
    case "SUPER_ADMIN":
    case "AUDITOR":
    case "BOARD":
      return "PENDING_HR_STAFF_PROCESSING";
    case "EXECUTIVE":
      // Confirmation step auto-finalizes to FINAL_APPROVED (optional / self-service path).
      return "PENDING_EXECUTIVE_APPROVAL";
    default:
      return "PENDING_APPROVAL";
  }
}

/** Dept heads’ own leave: HR Staff forwards to HR Manager after review. */
export function submitterRoutedToHrManagerAfterHrStaff(submitterRole: Role | undefined): boolean {
  const r = submitterRole ?? "EMPLOYEE";
  return r === "DEPARTMENT_MANAGER" || r === "MANAGER";
}
