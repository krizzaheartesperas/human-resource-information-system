"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTheme } from "@/components/theme/ThemeProvider";
import { departments, getEmployeeById, type LeaveRequest, type LeaveStatus } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import { getLeaveTypeColorClasses } from "@/features/leave/utils/leaveVisuals";

const PH_HOLIDAYS: Array<{ month: number; day: number; label: string }> = [
  { month: 1, day: 1, label: "New Year's Day" },
  { month: 4, day: 9, label: "Araw ng Kagitingan" },
  { month: 5, day: 1, label: "Labor Day" },
  { month: 6, day: 12, label: "Independence Day" },
  { month: 8, day: 21, label: "Ninoy Aquino Day" },
  { month: 11, day: 1, label: "All Saints' Day" },
  { month: 11, day: 2, label: "All Souls' Day" },
  { month: 11, day: 30, label: "Bonifacio Day" },
  { month: 12, day: 8, label: "Feast of the Immaculate Conception" },
  { month: 12, day: 24, label: "Christmas Eve" },
  { month: 12, day: 25, label: "Christmas Day" },
  { month: 12, day: 30, label: "Rizal Day" },
  { month: 12, day: 31, label: "New Year's Eve" },
  { month: 3, day: 20, label: "Special Non-working Holiday" },
];

function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusVariant(status: LeaveStatus) {
  const map: Record<
    LeaveStatus,
    "default" | "secondary" | "success" | "destructive" | "warning" | "outline"
  > = {
    DRAFT: "secondary",
    CREATED: "secondary",
    PENDING_RECORDING: "warning",
    PENDING_FINALIZATION: "warning",
    RETURNED_FOR_REVIEW: "warning",
    PENDING_HR_ADMIN_PROCESSING: "warning",
    PENDING_HR_ADMIN_PROCESSING_HR_MANAGER: "warning",
    PENDING_HR_ADMIN_PROCESSING_EXECUTIVE: "warning",
    PENDING_HR_MANAGER_PROCESSING_HR_ADMIN: "warning",
    PENDING_HR_STAFF_PROCESSING: "warning",
    PENDING_HR_STAFF_PROCESSING_AUDITOR: "warning",
    PENDING_HR_MANAGER_APPROVAL: "warning",
    PENDING_EXECUTIVE_APPROVAL: "warning",
    PENDING_EXECUTIVE_BOARD_APPROVAL: "warning",
    PENDING_APPROVAL: "warning",
    APPROVED: "success",
    FINAL_APPROVED: "success",
    REJECTED: "destructive",
    APPLIED: "success",
    CANCELLED: "outline",
  };
  return map[status] ?? "secondary";
}

export function LeaveCalendar({ requests }: { requests: LeaveRequest[] }) {
  const { theme } = useTheme();
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    events: Array<{ req: LeaveRequest; departmentName: string }>;
  } | null>(null);

  const startOfMonth = month;
  const monthLabel = startOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const days = useMemo(() => {
    const firstDayOfWeek = new Date(
      startOfMonth.getFullYear(),
      startOfMonth.getMonth(),
      1
    ).getDay();
    const daysInMonth = new Date(
      startOfMonth.getFullYear(),
      startOfMonth.getMonth() + 1,
      0
    ).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) cells.push({ date: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), d),
      });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null });
    return cells;
  }, [startOfMonth]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Array<{ req: LeaveRequest; departmentName: string }>>();
    const holidayMmdd = new Set(
      PH_HOLIDAYS.map((h) => `${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`)
    );
    const monthStart = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth(), 1);
    const monthEnd = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

    for (const r of requests) {
      if (r.status === "REJECTED" || r.status === "CANCELLED") continue;
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      if (end < monthStart || start > monthEnd) continue;
      const employee = getEmployeeById(r.employeeId);
      const dept = departments.find((d) => d.id === employee?.departmentId)?.name ?? "Unknown dept";
      const cursor = new Date(Math.max(start.getTime(), monthStart.getTime()));
      const last = Math.min(end.getTime(), monthEnd.getTime());
      while (cursor.getTime() <= last) {
        const key = toLocalISODate(cursor);
        const mmdd = `${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (holidayMmdd.has(mmdd)) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push({ req: r, departmentName: dept });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [requests, startOfMonth]);

  const goMonth = (delta: number) => {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const todayKey = toLocalISODate(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div
          className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs shadow-sm ${
            theme === "dark"
              ? "bg-gradient-to-r from-[#192853] to-[#1f2c5c] text-[#FDE047]"
              : "bg-gradient-to-r from-[#e7eefb] to-[#dce7fb] text-[#192853]"
          }`}
        >
          <CalendarDays className="size-3.5" />
          <span className="font-semibold text-[13px] tracking-wide">{monthLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border bg-background hover:bg-muted text-lg font-semibold" type="button" onClick={() => goMonth(-1)}>
            <span className="sr-only">Previous month</span><span aria-hidden="true">‹</span>
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full border-border bg-background hover:bg-muted text-lg font-semibold" type="button" onClick={() => goMonth(1)}>
            <span className="sr-only">Next month</span><span aria-hidden="true">›</span>
          </Button>
        </div>
      </div>
      <div className={`rounded-3xl border shadow-sm overflow-hidden ${theme === "dark" ? "border-[#31446e] bg-gradient-to-b from-[#1B223D] to-[#17203A]" : "border-border bg-gradient-to-b from-[#eff4ff] to-[#e3edff]"}`}>
        <div className={`grid grid-cols-7 border-b text-[11px] font-semibold uppercase tracking-wide ${theme === "dark" ? "border-[#31446e] bg-[#202b4f] text-slate-200" : "border-border/60 bg-[#dde8fb] text-[#192853]"}`}>
          {weekdayLabels.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 text-xs">
          {days.map((cell, idx) => {
            if (!cell.date) return <div key={idx} className="min-h-[90px] border-b border-r border-border/40 bg-transparent" />;
            const key = toLocalISODate(cell.date);
            const events = eventsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            const hasEvents = events.length > 0;
            const monthIndex = cell.date.getMonth() + 1;
            const dayOfMonth = cell.date.getDate();
            const holiday = PH_HOLIDAYS.find((h) => h.month === monthIndex && h.day === dayOfMonth);
            return (
              <button key={key} type="button" onClick={() => hasEvents && setSelectedDay({ date: cell.date!, events })} className={`group relative min-h-[90px] border-b border-r border-border/40 p-1.5 text-left align-top transition-colors ${holiday ? (theme === "dark" ? "bg-red-950/50 hover:bg-red-900/60" : "bg-red-50 hover:bg-red-100") : hasEvents ? (theme === "dark" ? "hover:bg-[#233057]" : "hover:bg-[#dde8fb]") : (theme === "dark" ? "hover:bg-[#1d2748] cursor-default" : "hover:bg-background/60 cursor-default")} ${hasEvents ? "cursor-pointer" : ""}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isToday ? "bg-[#192853] text-[#FDE047]" : holiday ? "bg-red-600 text-white" : theme === "dark" ? "text-slate-200" : "text-[#192853]"}`}>{cell.date.getDate()}</span>
                  {holiday ? (
                    <span className="rounded-full bg-red-600 text-[10px] text-white px-1.5 py-0.5 shadow-sm">{holiday.label}</span>
                  ) : hasEvents ? (
                    <span className={`rounded-full text-[10px] px-1.5 py-0.5 shadow-sm ${theme === "dark" ? "bg-[#24345f] text-[#FDE047]" : "bg-[#192853] text-[#FDE047]"}`}>{events.length} on leave</span>
                  ) : null}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map(({ req, departmentName }) => (
                    <div key={req.id + departmentName} className={`rounded-full text-[11px] px-3 py-0.5 flex items-center justify-between gap-1.5 shadow-[0_1px_3px_rgba(15,24,40,0.35)] border ${getLeaveTypeColorClasses(req.type)}`} title={`${req.employeeName} • ${departmentName} • ${formatLeaveType(req.type)}`}>
                      <span className="truncate font-medium">{req.employeeName.split(" ")[0]} ({departmentName.split(" ")[0]})</span>
                    </div>
                  ))}
                  {events.length > 3 && <div className="text-[10px] text-muted-foreground">+{events.length - 3} more</div>}
                </div>
                {hasEvents && <span className={`pointer-events-none absolute inset-x-1 bottom-1 h-0.5 rounded-full transition-colors ${theme === "dark" ? "bg-slate-200/10 group-hover:bg-slate-200/25" : "bg-[#192853]/10 group-hover:bg-[#192853]/25"}`} />}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Employees on leave</DialogTitle>
            {selectedDay && (
              <DialogDescription>
                {selectedDay.date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-2 pt-2 max-h-[320px] overflow-auto scrollbar-hide">
              {selectedDay.events.map(({ req, departmentName }) => (
                <div key={req.id + departmentName} className="flex items-start justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-foreground text-[13px]">{req.employeeName}</div>
                    <div className="text-muted-foreground">{departmentName} • {formatLeaveType(req.type)}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}</div>
                    {req.reason && <div className="text-[11px] text-muted-foreground line-clamp-2">Reason: {req.reason}</div>}
                  </div>
                  <Badge variant={statusVariant(req.status)} className="text-[10px]">
                    {req.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
