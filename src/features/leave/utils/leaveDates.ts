export { calculateInclusiveDays, toLocalISODate } from "./leavePageHelpers";

export function getMonthWindow(d: Date) {
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function inWindow(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t >= start.getTime() && t <= end.getTime();
}

/** Overlap in calendar days between [startIso, endIso] and [start, end] (inclusive). */
export function overlapDays(startIso: string, endIso: string, start: Date, end: Date) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const left = s.getTime() > start.getTime() ? s : start;
  const right = e.getTime() < end.getTime() ? e : end;
  if (right.getTime() < left.getTime()) return 0;
  const diffMs = right.getTime() - left.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}
