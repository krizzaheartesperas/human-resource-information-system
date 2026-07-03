import { supabase } from "@/lib/supabase/client";

/* ================================
   UI Types (keep these)
================================ */

export type AttendanceStatus = "IN" | "OUT";

export type Attendance = {
  status: AttendanceStatus;
  clockIn?: string;
  clockOut?: string;
};

/* ================================
   Local demo storage (optional)
================================ */

export const ATTENDANCE_STORAGE_KEY = "hris-attendance-today";

/** Load today's attendance from localStorage (demo-only). */
export function loadAttendanceFromStorage(): Attendance | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Attendance;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

/* ================================
   Helpers
================================ */

export function getTodayDateKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nowToTimeOnly() {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, "0");
  const mm = now.getMinutes().toString().padStart(2, "0");
  const ss = now.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/* ================================
   Supabase Functions
================================ */

export async function clockIn(employeeId: string) {
  const today = getTodayDateKey();

  // Prevent duplicate clock-in
  const { data: existing } = await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("date", today)
    .maybeSingle();

  if (existing) {
    return { data: existing, error: null };
  }

  return await supabase
    .from("attendance")
    .insert({
      employee_id: employeeId,
      date: today,
      clock_in: nowToTimeOnly(),
      total_late_minutes: 0,
      total_undertime_minutes: 0,
      total_overtime_minutes: 0,
    })
    .select()
    .single();
}

export async function clockOut(employeeId: string) {
  const today = getTodayDateKey();

  return await supabase
    .from("attendance")
    .update({
      clock_out: nowToTimeOnly(),
    })
    .eq("employee_id", employeeId)
    .eq("date", today);
}

export async function getTodayAttendance(employeeId: string) {
  const today = getTodayDateKey();

  return await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("date", today)
    .maybeSingle();
}

export async function getAttendanceHistory(employeeId: string) {
  return await supabase
    .from("attendance")
    .select("*")
    .eq("employee_id", employeeId)
    .order("date", { ascending: false });
}