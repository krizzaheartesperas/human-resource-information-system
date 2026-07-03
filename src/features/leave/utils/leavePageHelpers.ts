import type { LeaveRequest, LeaveStatus, Role } from "@/lib/mock";

const LEAVE_REQUESTS_STORAGE_KEY = "hris-leave-requests";

export function loadLeaveRequestsFromStorage(): LeaveRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEAVE_REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaveRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLeaveRequestsToStorage(items: LeaveRequest[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEAVE_REQUESTS_STORAGE_KEY,
      JSON.stringify(items)
    );
  } catch {
    // ignore
  }
}

export function clearLeaveRequestsStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEAVE_REQUESTS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function calculateInclusiveDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mapStatusToStep(status: LeaveStatus): 1 | 2 | 3 | 4 {
  if (status === "DRAFT") return 1;
  if (status === "REJECTED" || status === "CANCELLED" || status === "APPLIED") {
    return 4;
  }
  if (
    status === "APPROVED" ||
    status === "FINAL_APPROVED" ||
    status === "PENDING_FINALIZATION" ||
    status === "RETURNED_FOR_REVIEW" ||
    status === "PENDING_EXECUTIVE_APPROVAL" ||
    status === "PENDING_EXECUTIVE_BOARD_APPROVAL" ||
    status === "PENDING_HR_MANAGER_APPROVAL" ||
    status === "PENDING_APPROVAL"
  ) {
    return 3;
  }
  if (
    status === "PENDING_HR_STAFF_PROCESSING" ||
    status === "PENDING_HR_STAFF_PROCESSING_AUDITOR" ||
    status === "PENDING_HR_ADMIN_PROCESSING" ||
    status === "PENDING_HR_ADMIN_PROCESSING_HR_MANAGER" ||
    status === "PENDING_HR_ADMIN_PROCESSING_EXECUTIVE" ||
    status === "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN"
  ) {
    return 2;
  }
  return 1;
}

/**
 * Role-aware status progression used by request detail dialogs.
 * This keeps the visual steps aligned with the revised approval matrix.
 */
export function mapStatusToStepForRole(status: LeaveStatus, submitterRole: Role): 1 | 2 | 3 | 4 {
  if (status === "DRAFT") return 1;
  if (status === "REJECTED" || status === "CANCELLED" || status === "APPLIED" || status === "FINAL_APPROVED") {
    return 4;
  }

  // Executive self-leave can be optional/auto and effectively final on submit confirm.
  if (submitterRole === "EXECUTIVE") {
    return status === "PENDING_EXECUTIVE_APPROVAL" ? 3 : 2;
  }

  // Employee / Auditor / default individual-contributor flow:
  // Submit -> Department Manager -> HR Staff -> Final
  if (submitterRole === "EMPLOYEE" || submitterRole === "AUDITOR" || submitterRole === "SUPER_ADMIN" || submitterRole === "BOARD") {
    if (status === "PENDING_HR_STAFF_PROCESSING" || status === "PENDING_HR_STAFF_PROCESSING_AUDITOR") return 3;
    if (status === "PENDING_APPROVAL") return 1;
    return 1;
  }

  // Department managers: Submit -> HR Staff -> HR Manager -> Final
  if (submitterRole === "DEPARTMENT_MANAGER" || submitterRole === "MANAGER") {
    if (status === "PENDING_HR_MANAGER_APPROVAL") return 3;
    // Backward-compat: older DM self-requests may still carry PENDING_APPROVAL.
    if (status === "PENDING_APPROVAL") return 1;
    if (status === "PENDING_HR_STAFF_PROCESSING") return 1;
    return 1;
  }

  // HR Staff: Submit -> HR Manager -> Final
  if (submitterRole === "HR_STAFF") {
    if (status === "PENDING_HR_MANAGER_APPROVAL") return 2;
    return 1;
  }

  // HR Admin: Submit -> HR Manager -> Executive -> Final
  if (submitterRole === "HR_ADMIN") {
    if (status === "PENDING_EXECUTIVE_APPROVAL") return 3;
    if (status === "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN" || status === "PENDING_HR_MANAGER_APPROVAL") return 2;
    return 1;
  }

  // HR Manager: Submit -> Executive -> Final
  if (submitterRole === "HR_MANAGER") {
    if (status === "PENDING_EXECUTIVE_APPROVAL") return 2;
    return 1;
  }

  return mapStatusToStep(status);
}
