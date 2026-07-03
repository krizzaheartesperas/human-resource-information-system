import type { AuditEntityType } from "@/features/audit/services/audit.service";

export function formatEntityType(type: AuditEntityType) {
  switch (type) {
    case "LEAVE_REQUEST":
      return "Leave request";
    case "WORKFLOW_REQUEST":
      return "Workflow request";
    case "EMPLOYEE":
      return "Employee";
    case "ACCOUNT":
      return "Account";
    case "ATTENDANCE":
      return "Attendance";
    case "SYSTEM":
      return "System";
    case "PAYROLL":
      return "Payroll";
    default:
      return type;
  }
}

export function formatAction(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatFieldName(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function formatSummary(summary: string): string {
  // Keep only the leading activity description, cut off any extra details.
  const lower = summary.toLowerCase();
  const cutPoints: number[] = [];
  const parenIdx = summary.indexOf(" (");
  if (parenIdx > 0) cutPoints.push(parenIdx);
  const fromIdx = lower.indexOf(" from ");
  if (fromIdx > 0) cutPoints.push(fromIdx);
  if (!cutPoints.length) return summary.trim();
  const cut = Math.min(...cutPoints);
  return summary.slice(0, cut).trim();
}
