import { randomUUID } from "@/lib/utils";
import type { Role, WorkflowRequest } from "@/lib/mock";

const NOTIFICATION_STORAGE_KEY = "hris-account-notifications";

export type NotificationPrefs = { email: boolean; inApp: boolean };
export type RequestField =
  | "EMAIL"
  | "PERSONAL_EMAIL"
  | "NAME"
  | "BIRTHDAY"
  | "PHONE"
  | "CURRENT_ADDRESS"
  | "PERMANENT_ADDRESS"
  | "GENDER"
  | "CIVIL_STATUS"
  | "NATIONALITY"
  | "SSS"
  | "PHILHEALTH"
  | "PAGIBIG"
  | "TIN";

export function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return { email: true, inApp: true };
  try {
    const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return { email: true, inApp: true };
    const parsed = JSON.parse(raw) as NotificationPrefs;
    return { email: parsed.email ?? true, inApp: parsed.inApp ?? true };
  } catch {
    return { email: true, inApp: true };
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(prefs));
}

export function formatBirthday(dateStr: string) {
  if (!dateStr) return "";
  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatEmploymentType(type: string) {
  return type.replace(/_/g, " ");
}

function getProfileChangeApproverRole(role: Role): Role | "SYSTEM" {
  if (role === "EXECUTIVE" || role === "SUPER_ADMIN") return "SYSTEM";
  if (role === "HR_ADMIN" || role === "AUDITOR") return "HR_MANAGER";
  if (role === "EMPLOYEE" || role === "DEPARTMENT_MANAGER" || role === "MANAGER") return "HR_ADMIN";
  if (role === "HR_STAFF") return "HR_ADMIN";
  return "HR_ADMIN";
}

export function buildProfileChangeRequest(
  user: { employeeId: string; name: string; role: Role },
  fieldLabel: string,
  beforeValue: string,
  afterValue: string
): WorkflowRequest {
  const approver = getProfileChangeApproverRole(user.role);
  const status = approver === "SYSTEM" ? "APPROVED" : "PENDING";
  const suffix =
    approver === "SYSTEM"
      ? "auto-approved by system"
      : `for ${approver.replace(/_/g, " ")} approval`;
  return {
    id: `req-${Date.now()}-${randomUUID().slice(0, 6)}`,
    type: "PERSONAL_INFO_CHANGE",
    title: `Profile change request: ${fieldLabel}`,
    createdBy: user.employeeId,
    createdByName: user.name,
    status,
    createdAt: new Date().toISOString(),
    entityId: user.employeeId,
    entityType: "employee",
    description: `${fieldLabel} change ${suffix}. From "${beforeValue}" to "${afterValue}".`,
    effectiveDate: new Date().toISOString().slice(0, 10),
    attachmentName: undefined,
    attachmentDataUrl: undefined,
  };
}
