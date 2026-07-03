import { leaveTypeMetadata, type TimeOffType } from "@/lib/mock";

export function formatLeaveType(type: TimeOffType) {
  return leaveTypeMetadata[type]?.label ?? type.replace(/_/g, " ");
}

/** Map legacy type values from localStorage to current TimeOffType. */
export function migrateLeaveType(type: string): TimeOffType {
  const normalized = type.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+/g, "_");
  const map: Record<string, TimeOffType> = {
    ANNUAL_LEAVE: "VACATION_LEAVE",
    WORK_FROM_HOME: "VACATION_LEAVE",
    MATERNITY: "MATERNITY_LEAVE",
    OTHER: "UNPAID_LEAVE",
  };
  return (map[normalized] ?? normalized) as TimeOffType;
}

/** yyyy-mm-dd or ISO timestamp → locale date, or em dash if missing/invalid. */
export function formatLeaveRequestDate(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "—";
  const d = new Date(v.includes("T") ? v : `${v}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/** Format ISO date (yyyy-mm-dd) to mm/dd/yyyy for display; empty string if invalid or empty. */
export function formatDateToDisplay(iso: string): string {
  if (!iso || !iso.trim()) return "";
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "";
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();
  return `${m.toString().padStart(2, "0")}/${day.toString().padStart(2, "0")}/${y}`;
}

/** Parse mm/dd/yyyy or m/d/yyyy to yyyy-mm-dd; return "" if invalid. */
export function parseDisplayToISO(text: string): string {
  const t = text.trim();
  if (!t) return "";
  const match = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  const [, month, day, year] = match;
  const m = parseInt(month!, 10);
  const d = parseInt(day!, 10);
  const y = parseInt(year!, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return "";
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return "";
  const yy = date.getFullYear();
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dd = date.getDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
