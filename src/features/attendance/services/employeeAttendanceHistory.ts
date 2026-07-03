import { loadAttendanceFromStorage, getAttendanceHistory } from "@/features/attendance/services/attendance.service";
import type { AttendanceRow } from "@/lib/supabase/client";

export type EmployeeAttendanceStatus = "PRESENT" | "ABSENT";

export type EmployeeAttendanceDay = {
  date: string; // YYYY-MM-DD
  clockIn: string | null; // "HH:mm" local
  clockOut: string | null;
  status: EmployeeAttendanceStatus;
  lateMinutes: number;
  undertimeMinutes: number;
  overtimeMinutes: number;
};

/** Half-hour slot end labels (row labels in dashboard heatmap). */
export const ATTENDANCE_HEATMAP_SLOT_ENDS = [
  { label: "8:00 AM", endMinutes: 8 * 60 },
  { label: "8:30 AM", endMinutes: 8 * 60 + 30 },
  { label: "9:00 AM", endMinutes: 9 * 60 },
  { label: "9:30 AM", endMinutes: 9 * 60 + 30 },
  { label: "10:00 AM", endMinutes: 10 * 60 },
  { label: "10:30 AM", endMinutes: 10 * 60 + 30 },
] as const;

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

/** Local calendar date key YYYY-MM-DD (matches history rows). */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** ISO timestamp -> "HH:mm" in local time */
export function isoToLocalHHmm(iso: string | null): string | null {
  if (!iso) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(iso)) {
    const [h, m] = iso.split(":");
    return `${pad2(Number(h))}:${pad2(Number(m))}`;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "HH:mm" -> minutes from midnight */
export function hhmmToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

export function attendanceDayFromSupabaseRow(row: AttendanceRow): EmployeeAttendanceDay {
  const clockIn = isoToLocalHHmm(row.clock_in);
  const clockOut = isoToLocalHHmm(row.clock_out);
  const status: EmployeeAttendanceStatus =
    row.clock_in != null ? "PRESENT" : "ABSENT";
  return {
    date: row.date,
    clockIn,
    clockOut,
    status,
    lateMinutes: row.total_late_minutes ?? 0,
    undertimeMinutes: row.total_undertime_minutes ?? 0,
    overtimeMinutes: row.total_overtime_minutes ?? 0,
  };
}

/** Deterministic demo history so the grid is stable between renders. */
export function buildRollingDemoAttendanceHistory(daysBack = 120): EmployeeAttendanceDay[] {
  const out: EmployeeAttendanceDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const key = `${y}-${m}-${day}`;

    let h = 0;
    for (let c = 0; c < key.length; c++) h = (h * 31 + key.charCodeAt(c)) | 0;
    const present = Math.abs(h) % 10 !== 0;

    if (!present) {
      out.push({
        date: key,
        clockIn: null,
        clockOut: null,
        status: "ABSENT",
        lateMinutes: 0,
        undertimeMinutes: 0,
        overtimeMinutes: 0,
      });
      continue;
    }

    const late = Math.abs(h >> 3) % 5 === 0 ? (Math.abs(h) % 25) + 1 : 0;
    const baseHour = 8;
    const baseMin = late > 0 ? Math.min(30 + late, 55) : Math.abs(h >> 5) % 4;
    const cin = `${pad2(baseHour)}:${pad2(baseMin)}`;
    const coutH = 17 + (Math.abs(h) % 2);
    const coutM = Math.abs(h >> 7) % 4 === 0 ? 30 : 0;

    out.push({
      date: key,
      clockIn: cin,
      clockOut: `${pad2(coutH)}:${pad2(coutM)}`,
      status: "PRESENT",
      lateMinutes: late,
      undertimeMinutes: Math.abs(h >> 9) % 3 === 0 ? 15 : 0,
      overtimeMinutes: Math.abs(h >> 11) % 4 === 0 ? 20 : 0,
    });
  }

  return out;
}

/** Same demo set as Attendance page (for parity when not using rolling demo). */
export const MOCK_ATTENDANCE_HISTORY_LEGACY: EmployeeAttendanceDay[] = [
  {
    date: "2025-02-24",
    clockIn: "09:05",
    clockOut: "18:10",
    status: "PRESENT",
    lateMinutes: 5,
    undertimeMinutes: 0,
    overtimeMinutes: 10,
  },
  {
    date: "2025-02-25",
    clockIn: "09:00",
    clockOut: "18:00",
    status: "PRESENT",
    lateMinutes: 0,
    undertimeMinutes: 0,
    overtimeMinutes: 0,
  },
  {
    date: "2025-02-26",
    clockIn: "09:20",
    clockOut: "17:30",
    status: "PRESENT",
    lateMinutes: 20,
    undertimeMinutes: 30,
    overtimeMinutes: 0,
  },
  {
    date: "2025-02-27",
    clockIn: null,
    clockOut: null,
    status: "ABSENT",
    lateMinutes: 0,
    undertimeMinutes: 0,
    overtimeMinutes: 0,
  },
  {
    date: "2025-02-28",
    clockIn: "08:55",
    clockOut: "18:30",
    status: "PRESENT",
    lateMinutes: 0,
    undertimeMinutes: 0,
    overtimeMinutes: 30,
  },
];

/** Overlay today's clock from localStorage (demo clock UI). */
export function mergeTodayFromStorage(
  history: EmployeeAttendanceDay[]
): EmployeeAttendanceDay[] {
  if (typeof window === "undefined") return history;
  const todayKey = toLocalDateKey(new Date());
  const stored = loadAttendanceFromStorage();
  if (!stored) return history;

  const todayRecord: EmployeeAttendanceDay = {
    date: todayKey,
    clockIn: stored.clockIn ?? null,
    clockOut: stored.clockOut ?? null,
    status: stored.clockIn ? "PRESENT" : "ABSENT",
    lateMinutes: 0,
    undertimeMinutes: 0,
    overtimeMinutes: 0,
  };

  const base = [...history];
  const idx = base.findIndex((d) => d.date === todayKey);
  if (idx >= 0) base[idx] = todayRecord;
  else base.unshift(todayRecord);
  return base;
}

export function historyToMap(
  history: EmployeeAttendanceDay[]
): Map<string, EmployeeAttendanceDay> {
  return new Map(history.map((d) => [d.date, d]));
}

/** Monday 00:00 of the calendar week containing `date`. */
function startOfWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/**
 * Mon–Fri dates for the week that contains the first day of `month` (year/month 0–11).
 * Each entry is in-month or adjacent month (still a valid Date).
 */
export function getWeekDaysMonFriForMonthStart(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const monday = startOfWeekMonday(first);
  const days: Date[] = [];
  for (let i = 0; i < 5; i++) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    days.push(x);
  }
  return days;
}

export type HeatmapCellVisual =
  | "empty"
  | "outOfMonth"
  | "absent"
  | "presentBefore"
  | "presentOnTime"
  | "presentLate"
  | "presentUnknown";

export function getHeatmapCellVisual(args: {
  date: Date;
  viewYear: number;
  viewMonth: number;
  slotEndMinutes: number;
  record: EmployeeAttendanceDay | undefined;
}): HeatmapCellVisual {
  const { date, viewYear, viewMonth, slotEndMinutes, record } = args;
  if (date.getMonth() !== viewMonth || date.getFullYear() !== viewYear) {
    return "outOfMonth";
  }
  if (!record) return "empty";
  if (record.status === "ABSENT") return "absent";
  if (record.status !== "PRESENT") return "empty";

  const cin = hhmmToMinutes(record.clockIn);
  if (cin == null) return "presentUnknown";

  const late = record.lateMinutes > 0;
  if (slotEndMinutes <= cin) return "presentBefore";
  if (late) return "presentLate";
  return "presentOnTime";
}

export function countMonthAttendanceStats(
  history: EmployeeAttendanceDay[],
  year: number,
  month: number
): { present: number; absent: number; withRecord: number } {
  const inMonth = history.filter((d) => {
    const [y, m] = d.date.split("-").map(Number);
    return y === year && m - 1 === month;
  });
  let present = 0;
  let absent = 0;
  for (const d of inMonth) {
    if (d.status === "PRESENT") present++;
    else if (d.status === "ABSENT") absent++;
  }
  return {
    present,
    absent,
    withRecord: present + absent,
  };
}

export function attendanceRatePercent(
  present: number,
  withRecord: number
): number | null {
  if (withRecord <= 0) return null;
  return Math.round((100 * present) / withRecord);
}

export function formatRateDelta(current: number | null, previous: number | null): string {
  if (current == null || previous == null) return "—";
  const delta = current - previous;
  if (delta === 0) return "0%";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}%`;
}

/** Load from Supabase when possible; otherwise rolling demo + storage merge. */
export async function loadEmployeeAttendanceHistory(
  employeeId: string
): Promise<EmployeeAttendanceDay[]> {
  try {
    const { data, error } = await getAttendanceHistory(employeeId);
    if (!error && data != null) {
      return mergeTodayFromStorage(data.map(attendanceDayFromSupabaseRow));
    }
  } catch {
    // fall through
  }
  return mergeTodayFromStorage(buildRollingDemoAttendanceHistory());
}
