"use client";

import { randomUUID } from "@/lib/utils";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";

export type AuditEntityType =
  | "EMPLOYEE"
  | "LEAVE_REQUEST"
  | "WORKFLOW_REQUEST"
  | "ATTENDANCE"
  | "ACCOUNT"
  | "SYSTEM"
  | "PAYROLL";

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  source?: string;
};

const AUDIT_STORAGE_KEY = "hris-audit-logs";

export function loadAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch {
    return [];
  }
}

export function ensureExampleAuditLogs(): AuditLogEntry[] {
  if (typeof window === "undefined") return [];
  const existing = loadAuditLogs();
  const hasAttendance = existing.some((e) => e.entityType === "ATTENDANCE");
  const hasPayroll = existing.some((e) => e.entityType === "PAYROLL");
  if (existing.length > 0 && hasAttendance && hasPayroll) {
    return existing;
  }

  /** Older demo data may have attendance but not payroll — add payroll seed once. */
  if (existing.length > 0 && hasAttendance && !hasPayroll) {
    const now = new Date();
    const payrollSeed: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-1",
      actorName: "Maria Santos",
      actorRole: "HR_ADMIN",
      action: "PAYROLL_EXPORT_GENERATED",
      entityType: "PAYROLL",
      entityId: "RUN-DEMO-001",
      summary: "Maria Santos generated payroll export RUN-DEMO-001 (February 2026 · 1st half).",
      after: {
        format: "Excel",
        template: "Default PH Payroll",
        employeeCount: 42,
        status: "SUCCESS",
        periodLabel: "February 2026 · 1st half (1–15)",
        departmentScopeId: "ALL",
      },
      source: "WEB_APP",
    };
    const next = [payrollSeed, ...existing];
    try {
      window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    return next;
  }

  if (existing.length > 0 && hasAttendance) {
    return existing;
  }

  const now = new Date();
  const baseTime = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    9,
    0,
    0
  ).getTime();

  const seed: AuditLogEntry[] = [
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 0 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-1",
      actorName: "Maria Santos",
      actorRole: "HR_ADMIN",
      action: "EMPLOYEE_CREATED",
      entityType: "EMPLOYEE",
      entityId: "emp-21",
      summary: "Maria Santos created employee record emp-21.",
      before: {},
      after: {},
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 1 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-2",
      actorName: "Juan Dela Cruz",
      actorRole: "MANAGER",
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: "lr-3",
      summary: "Juan Dela Cruz approved leave request lr-3 for Lisa Chen.",
      before: { status: "PENDING_APPROVAL" },
      after: { status: "APPROVED" },
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 2 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-1",
      actorName: "Maria Santos",
      actorRole: "HR_ADMIN",
      action: "REQUEST_STATUS_CHANGED",
      entityType: "WORKFLOW_REQUEST",
      entityId: "req-1",
      summary: "Maria Santos approved workflow request req-1.",
      before: { status: "PENDING", title: "Promotion: Glean Ramos to Software Engineer II" },
      after: { status: "APPROVED", title: "Promotion: Glean Ramos to Software Engineer II" },
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 3 * 60 * 60 * 1000).toISOString(),
      actorId: "current",
      actorName: "Kurt Bates",
      actorRole: "Admin",
      action: "ACCOUNT_UPDATED",
      entityType: "ACCOUNT",
      entityId: "current",
      summary: "Kurt Bates updated their account profile phone number.",
      before: { personalPhone: "+63 912 345 6789" },
      after: { personalPhone: "+63 987 654 3210" },
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 4 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-1",
      actorName: "Maria Santos",
      actorRole: "HR_ADMIN",
      action: "ATTENDANCE_CORRECTED",
      entityType: "ATTENDANCE",
      entityId: "emp-4:today",
      summary: "Maria Santos corrected today’s attendance for Glean Ramos.",
      before: { clockIn: "09:30", clockOut: "17:00" },
      after: { clockIn: "09:00", clockOut: "18:00" },
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 4.5 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-4",
      actorName: "Glean Ramos",
      actorRole: "EMPLOYEE",
      action: "ATTENDANCE_CLOCKED_IN",
      entityType: "ATTENDANCE",
      entityId: "emp-4:2025-02-26",
      summary: "Glean Ramos clocked in for today.",
      before: {},
      after: { clockIn: "09:05" },
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 5 * 60 * 60 * 1000).toISOString(),
      actorId: "system",
      actorName: "System",
      actorRole: "SYSTEM",
      action: "SYSTEM_CONFIG_UPDATED",
      entityType: "SYSTEM",
      entityId: "work_schedule",
      summary: "System updated default work schedule from 9–5 to 9–6 for all employees.",
      before: { workHours: "09:00-17:00" },
      after: { workHours: "09:00-18:00" },
      source: "SYSTEM",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 5.5 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-4",
      actorName: "Glean Ramos",
      actorRole: "EMPLOYEE",
      action: "PAYSLIP_VIEWED",
      entityType: "PAYROLL",
      entityId: "2025-02-p1",
      summary: "Glean Ramos viewed payslip 2025-02-p1.",
      after: { payslipId: "2025-02-p1", subjectDepartmentId: "dept-3" },
      source: "WEB_APP",
    },
    {
      id: randomUUID(),
      timestamp: new Date(baseTime + 6 * 60 * 60 * 1000).toISOString(),
      actorId: "emp-1",
      actorName: "Maria Santos",
      actorRole: "HR_ADMIN",
      action: "PAYROLL_EXPORT_GENERATED",
      entityType: "PAYROLL",
      entityId: "RUN-DEMO-001",
      summary: "Maria Santos generated payroll export RUN-DEMO-001 (February 2026 · 1st half).",
      after: {
        format: "Excel",
        template: "Default PH Payroll",
        employeeCount: 42,
        status: "SUCCESS",
        periodLabel: "February 2026 · 1st half (1–15)",
        departmentScopeId: "ALL",
      },
      source: "WEB_APP",
    },
  ];

  const next = existing.length > 0 ? [...seed, ...existing] : seed;

  try {
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }

  return next;
}

function mapEntityTypeToTable(entityType: AuditEntityType): string | null {
  switch (entityType) {
    case "WORKFLOW_REQUEST":
      return "workflow_requests";
    case "LEAVE_REQUEST":
      return "leave_requests";
    case "EMPLOYEE":
      return "employees";
    case "PAYROLL":
      return "payroll";
    case "ATTENDANCE":
      return "attendance";
    case "ACCOUNT":
      return "profiles";
    case "SYSTEM":
      return null;
    default:
      return null;
  }
}

function isUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function insertAuditLogToSupabase(entry: AuditLogEntry) {
  if (!isSupabaseAuthConfigured()) return;
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id ?? null;
    const recordId = isUuidString(entry.entityId) ? entry.entityId : null;
    const payload = {
      clientAuditId: entry.id,
      timestamp: entry.timestamp,
      actorId: entry.actorId,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      before: entry.before ?? null,
      after: entry.after ?? null,
      reason: entry.reason ?? null,
      source: entry.source ?? null,
    };
    const { error } = await supabase.from("audit_logs").insert({
      user_id: userId,
      action: entry.action,
      table_name: mapEntityTypeToTable(entry.entityType),
      record_id: recordId,
      payload,
    });
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[audit_logs]", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[audit_logs] insert failed", e);
    }
  }
}

export function appendAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp" | "source"> & { source?: string }) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadAuditLogs();
    const full: AuditLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: entry.source ?? "WEB_APP",
      ...entry,
    };
    const next = [full, ...existing];
    window.localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(next));
    void insertAuditLogToSupabase(full);
  } catch {
    // ignore
  }
}

