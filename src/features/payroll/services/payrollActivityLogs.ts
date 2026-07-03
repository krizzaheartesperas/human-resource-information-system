"use client";

import type { AuditLogEntry } from "@/features/audit/services/audit.service";
import { loadAuditLogs } from "@/features/audit/services/audit.service";
import type { CurrentUser, Role } from "@/lib/mock";

export type PayrollActivityStatus = "Success" | "Failed" | "Warning" | "Info";

export type PayrollActivityActionFilter =
  | "ALL"
  | "PAYROLL_EXPORT_GENERATED"
  | "PAYROLL_EXPORT_FAILED"
  | "PAYROLL_DATA_VALIDATED"
  | "PAYROLL_EXPORT_APPROVED"
  | "PAYROLL_EXPORT_REJECTED"
  | "PAYROLL_EXPORT_EXPORTED"
  | "PAYSLIP_VIEWED"
  | "PAYROLL_RERUN_EXPORT"
  | "OTHER";

export type PayrollActivityRow = {
  logId: string;
  displayRef: string;
  technicalRef: string;
  action: string;
  actionLabel: string;
  performedBy: string;
  performedRole: string;
  timestamp: string;
  status: PayrollActivityStatus;
  summary: string;
  entry: AuditLogEntry;
};

const ACTION_LABELS: Record<string, string> = {
  PAYROLL_EXPORT_GENERATED: "Export Generated",
  PAYROLL_EXPORT_FAILED: "Export Failed",
  PAYROLL_DATA_VALIDATED: "Data Validated",
  PAYROLL_EXPORT_APPROVED: "Export Approved",
  PAYROLL_EXPORT_REJECTED: "Export Rejected",
  PAYROLL_EXPORT_EXPORTED: "Exported",
  PAYSLIP_VIEWED: "Payslip Viewed",
  PAYROLL_RERUN_EXPORT: "Re-run Export",
  PAYROLL_FIELD_MAPPING_UPDATED: "Configuration Updated",
  PAYROLL_UNAUTHORIZED_ACCESS: "Unauthorized Attempt",
};

function displayRefFor(entry: AuditLogEntry): string {
  const raw = entry.id.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `PX-${raw}`;
}

function statusFor(entry: AuditLogEntry): PayrollActivityStatus {
  const after = entry.after as Record<string, unknown> | undefined;
  switch (entry.action) {
    case "PAYROLL_EXPORT_GENERATED": {
      const s = String(after?.status ?? "");
      if (s === "FAILED") return "Failed";
      if (s === "PARTIAL") return "Warning";
      return "Success";
    }
    case "PAYROLL_EXPORT_FAILED":
    case "PAYROLL_UNAUTHORIZED_ACCESS":
      return "Failed";
    case "PAYROLL_DATA_VALIDATED": {
      const passed = after?.passed !== false;
      const w = Number(after?.warningsCount ?? 0);
      if (!passed) return "Failed";
      if (w > 0) return "Warning";
      return "Success";
    }
    case "PAYSLIP_VIEWED":
    case "PAYROLL_RERUN_EXPORT":
    case "PAYROLL_FIELD_MAPPING_UPDATED":
      return "Info";
    case "PAYROLL_EXPORT_APPROVED":
      return "Success";
    case "PAYROLL_EXPORT_REJECTED":
      return "Failed";
    case "PAYROLL_EXPORT_EXPORTED":
      return "Success";
    default:
      return "Info";
  }
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/_/g, " ");
}

export function matchesActionFilter(
  entryAction: string,
  filter: PayrollActivityActionFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "OTHER") {
    return !Object.keys(ACTION_LABELS).includes(entryAction);
  }
  return entryAction === filter;
}

export function payrollActivityVisibleForUser(entry: AuditLogEntry, user: CurrentUser): boolean {
  if (user.role === "AUDITOR") return false;
  if (user.role === "EMPLOYEE") {
    return entry.actorId === user.employeeId;
  }
  if (user.role !== "DEPARTMENT_MANAGER") return true;

  const after = entry.after as Record<string, unknown> | undefined;
  const scope = after?.departmentScopeId as string | null | undefined;

  if (scope && scope !== "ALL" && scope !== user.departmentId) {
    return false;
  }

  if (entry.action === "PAYSLIP_VIEWED") {
    const subj = after?.subjectDepartmentId as string | undefined;
    if (subj && subj !== user.departmentId) return false;
  }

  if (
    (entry.action === "PAYROLL_EXPORT_GENERATED" || entry.action === "PAYROLL_EXPORT_FAILED") &&
    (scope == null || scope === "ALL")
  ) {
    return entry.actorId === user.employeeId;
  }

  if (entry.action === "PAYROLL_DATA_VALIDATED" && (scope == null || scope === "ALL")) {
    return entry.actorId === user.employeeId;
  }

  if (entry.action === "PAYROLL_UNAUTHORIZED_ACCESS") {
    return entry.actorId === user.employeeId;
  }

  if (entry.action === "PAYROLL_FIELD_MAPPING_UPDATED") {
    return entry.actorId === user.employeeId;
  }

  return true;
}

export function buildPayrollActivityRows(logs: AuditLogEntry[]): PayrollActivityRow[] {
  return logs
    .filter((e) => e.entityType === "PAYROLL")
    .map((entry) => ({
      logId: entry.id,
      displayRef: displayRefFor(entry),
      technicalRef: entry.entityId,
      action: entry.action,
      actionLabel: actionLabel(entry.action),
      performedBy: entry.actorName,
      performedRole: entry.actorRole,
      timestamp: entry.timestamp,
      status: statusFor(entry),
      summary: entry.summary,
      entry,
    }))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export function loadPayrollActivityRowsForUser(user: CurrentUser): PayrollActivityRow[] {
  const all = buildPayrollActivityRows(loadAuditLogs());
  return all.filter((row) => payrollActivityVisibleForUser(row.entry, user));
}

export function canAccessPayrollActivityLogs(role: Role): boolean {
  return (
    role === "EMPLOYEE" ||
    role === "HR_ADMIN" ||
    role === "HR_STAFF" ||
    role === "HR_MANAGER" ||
    role === "SUPER_ADMIN" ||
    role === "DEPARTMENT_MANAGER"
  );
}
