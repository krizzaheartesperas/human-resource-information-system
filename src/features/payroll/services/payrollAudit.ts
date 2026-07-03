"use client";

import { appendAuditLog, type AuditEntityType } from "@/features/audit/services/audit.service";

const PAYROLL_ENTITY: AuditEntityType = "PAYROLL";

export function logPayslipViewed(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  payslipId: string;
  summary?: string;
  subjectDepartmentId?: string;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYSLIP_VIEWED",
    entityType: PAYROLL_ENTITY,
    entityId: params.payslipId,
    summary:
      params.summary ??
      `${params.actorName} viewed payslip ${params.payslipId}.`,
    after: {
      payslipId: params.payslipId,
      ...(params.subjectDepartmentId
        ? { subjectDepartmentId: params.subjectDepartmentId }
        : {}),
    },
  });
}

export function logPayrollExportGenerated(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  runId: string;
  periodLabel: string;
  format: string;
  template: string;
  employeeCount: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  errors?: string[];
  departmentScopeId?: string | null;
  dataIncluded?: Record<string, boolean>;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_EXPORT_GENERATED",
    entityType: PAYROLL_ENTITY,
    entityId: params.runId,
    summary: `Payroll export ${params.runId} (${params.periodLabel}) — ${params.status}.`,
    after: {
      format: params.format,
      template: params.template,
      employeeCount: params.employeeCount,
      status: params.status,
      errors: params.errors ?? [],
      periodLabel: params.periodLabel,
      departmentScopeId: params.departmentScopeId ?? null,
      ...(params.dataIncluded ? { dataIncluded: params.dataIncluded } : {}),
    },
  });
}

export function logPayrollExportFailed(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  reason: string;
  periodLabel?: string;
  departmentScopeId?: string | null;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_EXPORT_FAILED",
    entityType: PAYROLL_ENTITY,
    entityId: `export-attempt-${Date.now()}`,
    summary: `Payroll export failed: ${params.reason}${params.periodLabel ? ` (${params.periodLabel})` : ""}.`,
    reason: params.reason,
    after: {
      periodLabel: params.periodLabel,
      departmentScopeId: params.departmentScopeId ?? null,
    },
  });
}

export function logPayrollDataValidated(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  periodLabel: string;
  warningsCount: number;
  passed: boolean;
  departmentScopeId?: string | null;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_DATA_VALIDATED",
    entityType: PAYROLL_ENTITY,
    entityId: `validate-${Date.now()}`,
    summary: `${params.actorName} ran payroll data validation for ${params.periodLabel} (${params.passed ? "passed with warnings" : "blocked"}).`,
    after: {
      periodLabel: params.periodLabel,
      warningsCount: params.warningsCount,
      passed: params.passed,
      departmentScopeId: params.departmentScopeId ?? null,
    },
  });
}

export function logPayrollRerunExport(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  previousRunId: string;
  periodLabel?: string;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_RERUN_EXPORT",
    entityType: PAYROLL_ENTITY,
    entityId: params.previousRunId,
    summary: `${params.actorName} started re-run from export ${params.previousRunId}.`,
    after: {
      previousRunId: params.previousRunId,
      periodLabel: params.periodLabel,
    },
  });
}

export function logPayrollConfigUpdated(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  field: string;
  before: unknown;
  after: unknown;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_FIELD_MAPPING_UPDATED",
    entityType: PAYROLL_ENTITY,
    entityId: "payroll-config",
    summary: `${params.actorName} updated payroll configuration: ${params.field}.`,
    before: params.before as Record<string, unknown>,
    after: params.after as Record<string, unknown>,
  });
}

export function logPayrollUnauthorizedAttempt(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  actionAttempted: string;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_UNAUTHORIZED_ACCESS",
    entityType: PAYROLL_ENTITY,
    entityId: "access-control",
    summary: `Unauthorized payroll action attempted: ${params.actionAttempted}.`,
    reason: params.actionAttempted,
  });
}

export function logPayrollExportApproved(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  runId: string;
  periodLabel: string;
  mappingVersion: string;
  remarks?: string;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_EXPORT_APPROVED",
    entityType: PAYROLL_ENTITY,
    entityId: params.runId,
    summary: `Payroll export ${params.runId} approved (${params.periodLabel}).`,
    after: {
      periodLabel: params.periodLabel,
      mappingVersion: params.mappingVersion,
      remarks: params.remarks ?? "",
    },
  });
}

export function logPayrollExportRejected(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  runId: string;
  periodLabel: string;
  mappingVersion: string;
  reason: string;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_EXPORT_REJECTED",
    entityType: PAYROLL_ENTITY,
    entityId: params.runId,
    summary: `Payroll export ${params.runId} rejected (${params.periodLabel}).`,
    after: {
      periodLabel: params.periodLabel,
      mappingVersion: params.mappingVersion,
      reason: params.reason,
    },
  });
}

export function logPayrollExportExported(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  runId: string;
  periodLabel: string;
  mappingVersion: string;
}) {
  appendAuditLog({
    actorId: params.actorId,
    actorName: params.actorName,
    actorRole: params.actorRole,
    action: "PAYROLL_EXPORT_EXPORTED",
    entityType: PAYROLL_ENTITY,
    entityId: params.runId,
    summary: `Payroll export ${params.runId} exported (${params.periodLabel}).`,
    after: {
      periodLabel: params.periodLabel,
      mappingVersion: params.mappingVersion,
    },
  });
}
