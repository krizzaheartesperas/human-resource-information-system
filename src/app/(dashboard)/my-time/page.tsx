"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { canAccessMyTime } from "@/lib/auth/permissions";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { supabase } from "@/lib/supabase/client";
import type { CurrentUser } from "@/lib/mock";

// -----------------------------------------------------------------------------
// Types & mock data (replace with API later)
// -----------------------------------------------------------------------------

type TimelineKind = "clock_in" | "clock_out";

type TimelineEntry = { kind: TimelineKind; at: Date };

type TimecardStatus = "complete" | "late" | "missing" | "pending";

type TimecardRow = {
  id: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  status: TimecardStatus;
};

type OvertimeCategory = "Regular OT" | "Rest Day OT" | "Holiday OT";
type OvertimeRequestStatus = "pending" | "approved" | "rejected";
type OvertimeType = "pre_ot" | "post_ot";
type OvertimeModalPrefill = {
  date: string;
  startTime?: string;
  endTime?: string;
  otType?: OvertimeType;
};
type OvertimeRequestRow = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  otType: OvertimeType;
  category: OvertimeCategory;
  reason: string;
  status: OvertimeRequestStatus;
  remarks: string;
};

type AttendanceCorrectionSubmitPayload = {
  date: string;
  inTime: string;
  outTime: string;
  reason: string;
  attachmentName?: string;
};

/** UI row for `attendance_correction_requests` */
type CorrectionRequestRow = {
  id: string;
  attendanceDate: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  reason: string;
  attachmentName: string | null;
  status: OvertimeRequestStatus;
  remarks: string;
  createdAt: string;
};

type AttendanceCorrectionDbRow = {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  attendance_date: string;
  requested_clock_in: string | null;
  requested_clock_out: string | null;
  reason: string;
  attachment_name: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
};

type OvertimeRequestDbRow = {
  id: string;
  employee_id: string;
  attendance_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  ot_type: string;
  category: string;
  reason: string | null;
  status: string;
  remarks: string | null;
  created_at: string;
};

type AttendanceDbRow = {
  id: string;
  employee_id: string;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
  total_late_minutes: number | null;
  total_undertime_minutes: number | null;
  total_overtime_minutes: number | null;
};

// -----------------------------------------------------------------------------
// Formatting helpers
// -----------------------------------------------------------------------------

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatTime(d: Date) {
  let h = d.getHours();
  const m = d.getMinutes();
  const am = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad2(m)} ${am ? "PM" : "AM"}`;
}

function formatClock(d: Date) {
  let h = d.getHours();
  const pm = h >= 12;
  h = h % 12;
  if (h === 0) h = 12;
  return `${pad2(h)}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${pm ? "PM" : "AM"}`;
}

function formatTime12h(hhmm: string) {
  const [hRaw, mRaw] = hhmm.split(":");
  const parsedH = Number(hRaw);
  const parsedM = Number(mRaw);
  if (Number.isNaN(parsedH) || Number.isNaN(parsedM)) return hhmm;
  const am = parsedH < 12;
  const h12 = parsedH % 12 === 0 ? 12 : parsedH % 12;
  return `${h12}:${pad2(parsedM)} ${am ? "AM" : "PM"}`;
}

function normalizeDbOvertimeStatus(
  status: string | null | undefined
): OvertimeRequestStatus {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function normalizeDbOvertimeType(type: string | null | undefined): OvertimeType {
  return (type ?? "").toLowerCase() === "pre_ot" ? "pre_ot" : "post_ot";
}

function normalizeDbOvertimeCategory(
  category: string | null | undefined
): OvertimeCategory {
  if (category === "Rest Day OT" || category === "Holiday OT") return category;
  return "Regular OT";
}

function dbTimeToHhmm(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = String(t).trim();
  if (!s) return null;
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function mapCorrectionDbRow(row: AttendanceCorrectionDbRow): CorrectionRequestRow {
  return {
    id: row.id,
    attendanceDate: row.attendance_date,
    requestedClockIn: dbTimeToHhmm(row.requested_clock_in),
    requestedClockOut: dbTimeToHhmm(row.requested_clock_out),
    reason: row.reason,
    attachmentName: row.attachment_name,
    status: normalizeDbOvertimeStatus(row.status),
    remarks: row.remarks ?? "—",
    createdAt: row.created_at,
  };
}

function formatCorrectionSubmittedAt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatHoursHms(totalMs: number) {
  if (totalMs < 0) totalMs = 0;
  const s = Math.floor(totalMs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${pad2(m)}m ${pad2(sec)}s`;
}

function minutesLate(clockIn: Date, shiftStart: Date) {
  const diff = Math.floor((clockIn.getTime() - shiftStart.getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

function formatHoursDecimal(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function formatDurationHm(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${pad2(m)}m`;
}

/** Banner-style late duration: ~45m, ~2h, ~3h 42m */
function formatApproxLateDuration(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(totalMinutes));
  if (mins === 0) return "~0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `~${m}m`;
  if (m === 0) return `~${h}h`;
  return `~${h}h ${m}m`;
}

function formatMinutesWithHours(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(totalMinutes));
  return {
    compact: formatDurationHm(mins),
    withMinutes: `(${mins.toLocaleString()} mins)`,
  };
}

function autoBreakDeductionMinutes(totalMinutes: number) {
  return totalMinutes >= 360 ? 60 : 0;
}

/** Global Timeclock / attendance simulation (frontend-only) */
type CurrentStatus = "not_clocked_in" | "working" | "completed";

type TodayRecord = {
  time_in: Date | null;
  time_out: Date | null;
};

function formatDateKeyLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function dateToHhmm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dateToHhmmss(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function parseAttendanceDateTime(dateYmd: string, timeValue: string | null) {
  if (!timeValue) return null;
  const raw = timeValue.trim();
  if (!raw) return null;
  const hasAmPm = /\b(am|pm)\b/i.test(raw);
  if (!hasAmPm && /^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    const normalized = raw.length === 5 ? `${raw}:00` : raw;
    return new Date(`${dateYmd}T${normalized}`);
  }
  const fromIso = new Date(raw);
  if (!Number.isNaN(fromIso.getTime())) return fromIso;
  return null;
}

/** Total duration in minutes between two timestamps */
function calculateHours(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

/** Minutes late after 09:00 on the attendance date */
function calculateLate(clockIn: Date, attendanceDateYmd: string) {
  const shiftStart = parseDateTime(attendanceDateYmd, "09:00");
  return minutesLate(clockIn, shiftStart);
}

/** Minutes short of 8h paid time (after break), for undertime display */
function calculateUndertime(workedMinutesAfterBreak: number) {
  return Math.max(0, 480 - workedMinutesAfterBreak);
}

function parseDateTime(date: string, hhmm: string) {
  return new Date(`${date}T${hhmm}:00`);
}

/** Hydrate Timeclock from an existing same-day record (e.g. mock data). */
function getInitialTodayFromRecords(records: TimecardRow[]): {
  status: CurrentStatus;
  today: TodayRecord;
} {
  const key = formatDateKeyLocal(new Date());
  const row = records.find((r) => r.date === key && r.timeIn && r.timeOut);
  if (!row?.timeIn || !row?.timeOut) {
    return {
      status: "not_clocked_in",
      today: { time_in: null, time_out: null },
    };
  }
  const inAt = parseDateTime(row.date, row.timeIn);
  let outAt = parseDateTime(row.date, row.timeOut);
  if (outAt < inAt) outAt = new Date(outAt.getTime() + 24 * 60 * 60 * 1000);
  return {
    status: "completed",
    today: { time_in: inAt, time_out: outAt },
  };
}

function deriveTimecardStatus(lateMinutes: number): TimecardStatus {
  return lateMinutes > 0 ? "late" : "complete";
}

function normalizeDbStatusToTimecard(status: string | null | undefined): TimecardStatus {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "late") return "late";
  if (normalized === "complete" || normalized === "present") return "complete";
  if (normalized === "missing") return "missing";
  return "pending";
}

function overlapMinutes(startA: Date, endA: Date, startB: Date, endB: Date) {
  const s = Math.max(startA.getTime(), startB.getTime());
  const e = Math.min(endA.getTime(), endB.getTime());
  if (e <= s) return 0;
  return Math.floor((e - s) / 60000);
}

function computeNightMinutes(start: Date, end: Date) {
  if (end <= start) return 0;

  let total = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  while (cursor < end) {
    const nightStart = new Date(cursor);
    nightStart.setHours(22, 0, 0, 0);
    const nightEnd = new Date(nightStart);
    nightEnd.setDate(nightEnd.getDate() + 1);
    nightEnd.setHours(6, 0, 0, 0);
    total += overlapMinutes(start, end, nightStart, nightEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

type ComputedTimecard = TimecardRow & {
  workedMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
  nightOvertimeMinutes: number;
  lateMinutes: number;
  undertimeMinutes: number;
};

function computeTimecardMetrics(row: TimecardRow): ComputedTimecard {
  if (!row.timeIn || !row.timeOut) {
    return {
      ...row,
      workedMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      nightMinutes: 0,
      nightOvertimeMinutes: 0,
      lateMinutes: 0,
      undertimeMinutes: 480,
    };
  }

  const inAt = parseDateTime(row.date, row.timeIn);
  let outAt = parseDateTime(row.date, row.timeOut);
  if (outAt < inAt) outAt = new Date(outAt.getTime() + 24 * 60 * 60 * 1000);

  /** Gross span (total duration) in minutes — used for Total Duration + break rule */
  const workedMinutes = Math.max(
    0,
    Math.floor((outAt.getTime() - inAt.getTime()) / 60000)
  );
  const breakM = autoBreakDeductionMinutes(workedMinutes);
  const netWorkedMinutes = Math.max(0, workedMinutes - breakM);
  /** OT on paid hours after automatic break */
  const overtimeMinutes = Math.max(0, netWorkedMinutes - 480);
  const regularMinutes = Math.max(0, Math.min(netWorkedMinutes, 480));
  const shiftStart = parseDateTime(row.date, "09:00");
  const lateMinutes = minutesLate(inAt, shiftStart);
  const undertimeMinutes = Math.max(0, 480 - netWorkedMinutes);
  const nightMinutes = computeNightMinutes(inAt, outAt);
  const overtimeStart = new Date(inAt.getTime() + 480 * 60 * 1000);
  const nightOvertimeMinutes =
    overtimeMinutes > 0 ? computeNightMinutes(overtimeStart, outAt) : 0;

  return {
    ...row,
    workedMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes,
    nightOvertimeMinutes,
    lateMinutes,
    undertimeMinutes,
  };
}

// -----------------------------------------------------------------------------
// Small presentational pieces (same file)
// -----------------------------------------------------------------------------

function StatusBadge({ status }: { status: TimecardStatus }) {
  const map: Record<
    TimecardStatus,
    { label: string; className: string }
  > = {
    complete: {
      label: "Complete",
      className:
        "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/30",
    },
    late: {
      label: "Late",
      className:
        "bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-100 dark:ring-amber-400/35",
    },
    missing: {
      label: "Missing",
      className:
        "bg-red-500/15 text-red-800 ring-red-500/25 dark:text-red-200 dark:ring-red-400/30",
    },
    pending: {
      label: "Pending Adjustment",
      className:
        "bg-blue-500/15 text-blue-900 ring-blue-500/25 dark:text-blue-100 dark:ring-blue-400/35",
    },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function SoftCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  subLabel,
  emphasis = "secondary",
}: {
  label: string;
  value: string;
  subLabel?: string;
  emphasis?: "primary" | "secondary";
}) {
  return (
    <SoftCard className="rounded-xl border-0 bg-card p-4 shadow-sm ring-1 ring-border/60">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-tight tabular-nums text-foreground",
          emphasis === "primary" ? "text-3xl" : "text-2xl"
        )}
      >
        {value}
      </p>
      {subLabel ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{subLabel}</p>
      ) : null}
    </SoftCard>
  );
}

function RequestModal({
  open,
  onOpenChange,
  mode,
  onSubmit,
  initialDate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  mode: "ot" | "correction";
  onSubmit: (payload: AttendanceCorrectionSubmitPayload) => void;
  initialDate: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  // Reset modal fields when opened — standard controlled-dialog pattern.
  /* eslint-disable react-hooks/set-state-in-effect -- sync form to props when dialog opens */
  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setInTime("");
    setOutTime("");
    setReason("");
    setAttachmentName("");
  }, [open, initialDate]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-xl" showClose>
        <DialogHeader>
          <DialogTitle>
            {mode === "ot" ? "Request overtime" : "Request correction"}
          </DialogTitle>
          <DialogDescription>
            {mode === "ot"
              ? "Submit overtime details for review and payroll processing."
              : "Submit corrected times for approval. Raw attendance is never directly edited."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-date`}>Date</Label>
            <Input
              id={`${mode}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-start`}>
                {mode === "ot" ? "OT Start Time" : "Correct Time In"}
              </Label>
              <Input
                id={`${mode}-start`}
                type="time"
                value={inTime}
                onChange={(e) => setInTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`${mode}-end`}>
                {mode === "ot" ? "OT End Time" : "Correct Time Out"}
              </Label>
              <Input
                id={`${mode}-end`}
                type="time"
                value={outTime}
                onChange={(e) => setOutTime(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${mode}-reason`}>Reason</Label>
            <textarea
              id={`${mode}-reason`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className={cn(
                "w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              placeholder={
                mode === "ot"
                  ? "Explain why overtime is needed…"
                  : "Explain why this attendance record should be corrected…"
              }
            />
          </div>
          {mode === "ot" ? (
            <div className="space-y-1.5">
              <Label htmlFor="ot-attachment">Attachment (optional)</Label>
              <label
                htmlFor="ot-attachment"
                className="flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Paperclip className="size-4" />
                  {attachmentName || "Attach supporting file (UI only)"}
                </span>
                <span className="text-xs font-medium text-foreground">Browse</span>
              </label>
              <input
                id="ot-attachment"
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? "")}
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-sm"
            onClick={() => {
              onSubmit({
                date,
                inTime,
                outTime,
                reason,
                attachmentName,
              });
              onOpenChange(false);
            }}
          >
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpandableRow({
  row,
  expanded,
  onToggle,
  onRequestCorrection,
}: {
  row: ComputedTimecard;
  expanded: boolean;
  onToggle: () => void;
  onRequestCorrection: () => void;
}) {
  const breakDeductedMinutes = autoBreakDeductionMinutes(row.workedMinutes);
  const workedAfterBreakMinutes = Math.max(0, row.workedMinutes - breakDeductedMinutes);
  const lateDisplay = formatMinutesWithHours(row.lateMinutes);
  const undertimeDisplay = formatMinutesWithHours(row.undertimeMinutes);

  return (
    <Fragment>
      <tr
        className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/20"
        onClick={onToggle}
      >
        <td className="px-4 py-3 !text-center font-medium tabular-nums text-foreground">
          <div className="flex items-center justify-center gap-2">
            {expanded ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
            {row.date}
          </div>
        </td>
        <td className="px-4 py-3 !text-center tabular-nums text-muted-foreground">
          {row.timeIn ? formatTime12h(row.timeIn) : "—"}
        </td>
        <td className="px-4 py-3 !text-center tabular-nums text-muted-foreground">
          {row.timeOut ? formatTime12h(row.timeOut) : "—"}
        </td>
        <td className="px-4 py-3 !text-center tabular-nums">{formatHoursDecimal(workedAfterBreakMinutes)}</td>
        <td className="px-4 py-3 !text-center tabular-nums">
          {formatHoursDecimal(row.overtimeMinutes)}
        </td>
        <td className="px-4 py-3 !text-center">
          <StatusBadge status={row.status} />
        </td>
      </tr>
      <tr className="border-t border-border/40">
        <td colSpan={6} className="p-0">
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
              expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden bg-muted/20 dark:bg-[#161b30]">
              <div className="grid gap-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <p>
                  <span className="text-muted-foreground">Total Duration:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatDurationHm(row.workedMinutes)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Break Deducted:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatDurationHm(breakDeductedMinutes)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Worked Hours:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatDurationHm(workedAfterBreakMinutes)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Overtime:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatDurationHm(row.overtimeMinutes)}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Late Hour & Minutes:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {lateDisplay.compact}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Undertime Hour & Minutes:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {undertimeDisplay.compact}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestCorrection();
                  }}
                >
                  Request Edit
                </Button>
              </div>
            </div>
          </div>
        </td>
      </tr>
    </Fragment>
  );
}

function TimecardTable({
  rows,
  expandedId,
  onToggleRow,
  onRequestCorrection,
}: {
  rows: ComputedTimecard[];
  expandedId: string | null;
  onToggleRow: (id: string) => void;
  onRequestCorrection: (date: string) => void;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-xl bg-card shadow-sm ring-1 ring-border/60">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="!text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 !text-center">Date</th>
            <th className="px-4 py-3 !text-center">Time In</th>
            <th className="px-4 py-3 !text-center">Time Out</th>
            <th className="px-4 py-3 !text-center">Worked Hours</th>
            <th className="px-4 py-3 !text-center">OT</th>
            <th className="px-4 py-3 !text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ExpandableRow
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggle={() => onToggleRow(row.id)}
              onRequestCorrection={() => onRequestCorrection(row.date)}
            />
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No timecards match these filters.
        </p>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Timeclock tab
// -----------------------------------------------------------------------------

function StatusHeader({
  greeting,
  displayName,
  statusLabel,
  shiftLabel,
  roleLabel,
  tone,
}: {
  greeting: string;
  displayName: string;
  statusLabel: string;
  shiftLabel: string;
  roleLabel?: string;
  tone: "idle" | "working" | "done";
}) {
  const toneClass: Record<"idle" | "working" | "done", string> = {
    idle: "bg-slate-400",
    working: "bg-emerald-500",
    done: "bg-blue-500",
  };

  return (
    <div className="space-y-3 text-center transition-colors duration-200">
      <p className="text-sm font-medium text-muted-foreground/90">
        {greeting}, {displayName}
      </p>
      <div className="flex items-center justify-center gap-2.5">
        <span className="relative inline-flex size-2.5">
          <span
            className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", toneClass[tone])}
            aria-hidden
          />
          <span className={cn("relative inline-flex size-2.5 rounded-full", toneClass[tone])} />
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-foreground transition-colors duration-200 sm:text-4xl">
          {statusLabel}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">Shift: {shiftLabel}</p>
      {roleLabel ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Role: {roleLabel}
        </p>
      ) : null}
    </div>
  );
}

type ClockActionKind =
  | "clock_in"
  | "clock_out"
  | "done";

function ClockActionButton({
  action,
  label,
  onClick,
}: {
  action: ClockActionKind;
  label: string;
  onClick: () => void;
}) {
  const toneClass: Record<ClockActionKind, string> = {
    clock_in:
      "bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 dark:from-emerald-500 dark:to-emerald-600 text-white",
    clock_out:
      "bg-gradient-to-b from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white",
    done: "bg-muted text-muted-foreground shadow-none",
  };

  return (
    <Button
      type="button"
      disabled={action === "done"}
      onClick={onClick}
      className={cn(
        "mx-auto w-full max-w-[380px] rounded-sm py-6 text-base font-bold shadow-md transition-colors duration-200",
        toneClass[action]
      )}
    >
      <Clock className="mr-2 size-5" />
      {label}
    </Button>
  );
}

function LiveStats({
  currentTime,
  worked,
}: {
  currentTime: string;
  worked: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <SoftCard className="rounded-xl border-0 bg-card/90 p-3 text-center shadow-sm ring-1 ring-border/50 transition-all duration-200">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
          Current Time
        </p>
        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
          {currentTime}
        </p>
      </SoftCard>
      <SoftCard className="rounded-xl border-0 bg-card/90 p-3 text-center shadow-sm ring-1 ring-border/50 transition-all duration-200">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground/90">
          Worked Hours
        </p>
        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
          {worked}
        </p>
      </SoftCard>
    </div>
  );
}

function ActivityTimeline({
  timeline,
  timelineLabel,
  postOtContent,
}: {
  timeline: TimelineEntry[];
  timelineLabel: (k: TimelineKind) => string;
  postOtContent?: React.ReactNode;
}) {
  const steps = ["clock_in", "clock_out"] as TimelineKind[];

  return (
    <SoftCard className="rounded-xl border-0 bg-card/90 p-5 shadow-sm ring-1 ring-border/50 transition-all duration-200">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Today&apos;s activity</h3>
      </div>
      <ul className="relative space-y-3.5 pl-1">
        <span className="absolute left-[7px] top-1 h-[calc(100%-10px)] w-px bg-border/70" aria-hidden />
        {steps.map((kind) => {
          const entry = timeline.find((e) => e.kind === kind);
          const done = Boolean(entry);
          return (
            <li key={kind} className="flex items-center justify-between gap-3 text-sm transition-all duration-200">
              <span className="inline-flex items-center gap-2.5 text-muted-foreground">
                <span
                  className={cn(
                    "relative z-1 size-3 rounded-full border-2 border-muted-foreground/50 bg-background transition-all duration-200",
                    done && "border-emerald-500 bg-emerald-500"
                  )}
                />
                {timelineLabel(kind)}
              </span>
              <span className="font-mono tabular-nums text-foreground">{entry ? formatTime(entry.at) : "--:--"}</span>
            </li>
          );
        })}
      </ul>
      {postOtContent ? <div className="mt-4 border-t border-border/60 pt-4">{postOtContent}</div> : null}
    </SoftCard>
  );
}

function AlertBanner({ text }: { text: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl bg-amber-500/12 px-3.5 py-3 text-xs text-amber-900 transition-all duration-200 dark:bg-amber-400/15 dark:text-amber-100"
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600/80 dark:text-amber-300/90" />
      <p className="font-medium">{text}</p>
    </div>
  );
}

function TimeclockTab({
  displayName,
  currentStatus,
  todayRecord,
  overtimeRequests,
  mockTime,
  mockModeEnabled,
  roleLabel,
  onClockIn,
  onClockOut,
  onApplyPostOt,
  onSetMockTime,
  onSetMockModeEnabled,
  onResetDay,
}: {
  displayName: string;
  currentStatus: CurrentStatus;
  todayRecord: TodayRecord;
  overtimeRequests: OvertimeRequestRow[];
  mockTime: Date;
  mockModeEnabled: boolean;
  roleLabel?: string;
  onClockIn: () => void;
  onClockOut: () => void;
  onApplyPostOt: (prefill: OvertimeModalPrefill) => void;
  onSetMockTime: (next: Date) => void;
  onSetMockModeEnabled: (next: boolean) => void;
  onResetDay?: () => void;
}) {
  const shiftLabel = "9:00 AM – 6:00 PM";
  const [liveNow, setLiveNow] = useState(() => new Date());
  useEffect(() => {
    if (mockModeEnabled) return;
    const id = window.setInterval(() => setLiveNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [mockModeEnabled]);
  const now = mockModeEnabled ? mockTime : liveNow;
  const nowCalendarYear = now.getFullYear();
  const nowCalendarMonth = now.getMonth();
  const nowCalendarDate = now.getDate();
  const shiftStart = useMemo(
    () => new Date(nowCalendarYear, nowCalendarMonth, nowCalendarDate, 9, 0, 0, 0),
    [nowCalendarYear, nowCalendarMonth, nowCalendarDate]
  );

  const timeline = useMemo((): TimelineEntry[] => {
    const out: TimelineEntry[] = [];
    if (todayRecord.time_in) out.push({ kind: "clock_in", at: todayRecord.time_in });
    if (todayRecord.time_out) out.push({ kind: "clock_out", at: todayRecord.time_out });
    return out;
  }, [todayRecord.time_in, todayRecord.time_out]);

  const lateMinutesAtClockIn = useMemo(() => {
    if (!todayRecord.time_in) return 0;
    const key = formatDateKeyLocal(todayRecord.time_in);
    return calculateLate(todayRecord.time_in, key);
  }, [todayRecord.time_in]);

  const grossWorkedMs = useMemo(() => {
    if (!todayRecord.time_in) return 0;
    if (currentStatus === "working") {
      return Math.max(0, now.getTime() - todayRecord.time_in.getTime());
    }
    if (todayRecord.time_out) {
      return Math.max(0, todayRecord.time_out.getTime() - todayRecord.time_in.getTime());
    }
    return 0;
  }, [todayRecord.time_in, todayRecord.time_out, currentStatus, now]);

  const grossWorkedMinutes = Math.floor(grossWorkedMs / 60000);

  const workedMs = useMemo(() => {
    if (currentStatus === "completed") {
      const br = autoBreakDeductionMinutes(grossWorkedMinutes) * 60 * 1000;
      return Math.max(0, grossWorkedMs - br);
    }
    if (currentStatus === "working") {
      const liveGrossMin = Math.floor(grossWorkedMs / 60000);
      const br = autoBreakDeductionMinutes(liveGrossMin) * 60 * 1000;
      return Math.max(0, grossWorkedMs - br);
    }
    return 0;
  }, [currentStatus, grossWorkedMs, grossWorkedMinutes]);

  const overtimeMs = useMemo(() => {
    if (currentStatus !== "completed") return 0;
    return Math.max(0, workedMs - 8 * 60 * 60 * 1000);
  }, [currentStatus, workedMs]);

  const statusLabel = useMemo(() => {
    switch (currentStatus) {
      case "not_clocked_in":
        return "Not Clocked In";
      case "working":
        return "Working";
      case "completed":
        return "Completed";
      default:
        return "";
    }
  }, [currentStatus]);

  const primary = useMemo<{ label: string; action: ClockActionKind }>(() => {
    if (currentStatus === "not_clocked_in") return { label: "Clock In", action: "clock_in" };
    if (currentStatus === "working") return { label: "Clock Out", action: "clock_out" };
    return { label: "Completed", action: "done" };
  }, [currentStatus]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return "Good Morning";
    if (h < 18) return "Good Afternoon";
    return "Good Evening";
  }, [now]);

  const onPrimary = () => {
    if (currentStatus === "not_clocked_in") {
      onClockIn();
      return;
    }
    if (currentStatus === "working") {
      onClockOut();
    }
  };

  const timelineLabel = (k: TimelineKind) => {
    switch (k) {
      case "clock_in":
        return "Clock In";
      case "clock_out":
        return "Clock Out";
    }
  };

  const showLateBanner =
    (currentStatus === "working" || currentStatus === "completed") && lateMinutesAtClockIn > 0;
  const showNotInBanner = currentStatus === "not_clocked_in" && now > shiftStart;
  const statusTone: "idle" | "working" | "done" =
    currentStatus === "not_clocked_in"
      ? "idle"
      : currentStatus === "working"
        ? "working"
        : "done";

  const breakPreviewMs =
    currentStatus === "working"
      ? autoBreakDeductionMinutes(Math.floor(grossWorkedMs / 60000)) * 60 * 1000
      : currentStatus === "completed"
        ? autoBreakDeductionMinutes(grossWorkedMinutes) * 60 * 1000
        : 0;
  const setMockClock = useCallback(
    (hours: number, minutes: number) => {
      const base = todayRecord.time_in ?? mockTime;
      const next = new Date(base);
      next.setHours(hours, minutes, 0, 0);
      onSetMockTime(next);
    },
    [todayRecord.time_in, mockTime, onSetMockTime]
  );

  const postOtDate = useMemo(() => {
    if (todayRecord.time_out) return formatDateKeyLocal(todayRecord.time_out);
    if (todayRecord.time_in) return formatDateKeyLocal(todayRecord.time_in);
    return formatDateKeyLocal(now);
  }, [todayRecord.time_out, todayRecord.time_in, now]);

  const detectedOvertimeMinutes = Math.max(0, Math.floor(overtimeMs / 60000));
  const showPostOtSection =
    currentStatus === "completed" &&
    Boolean(todayRecord.time_out) &&
    detectedOvertimeMinutes > 0;

  const submittedPostOtRequest = useMemo(
    () =>
      overtimeRequests.find(
        (row) =>
          row.otType === "post_ot" &&
          row.date === postOtDate &&
          row.endTime === (todayRecord.time_out ? dateToHhmm(todayRecord.time_out) : row.endTime)
      ),
    [overtimeRequests, postOtDate, todayRecord.time_out]
  );

  return (
    <div className="mx-auto flex min-h-[72vh] w-full max-w-[480px] flex-col justify-center space-y-7 px-2 sm:px-0">
      <StatusHeader
        greeting={greeting}
        displayName={displayName}
        statusLabel={statusLabel}
        shiftLabel={shiftLabel}
        roleLabel={roleLabel}
        tone={statusTone}
      />

      <ClockActionButton action={primary.action} label={primary.label} onClick={onPrimary} />
      <p className="text-center text-xs text-muted-foreground">
        Includes 1-hour unpaid break automatically deducted.
      </p>

      <SoftCard className="rounded-xl border border-dashed border-amber-400/40 bg-amber-50/50 p-3 dark:border-amber-300/25 dark:bg-amber-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
          Mock Time Testing Mode
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={mockModeEnabled ? "default" : "outline"}
            className="rounded-sm"
            onClick={() => onSetMockModeEnabled(!mockModeEnabled)}
          >
            {mockModeEnabled ? "Disable Mock Time" : "Enable Mock Time"}
          </Button>
          <span className="text-xs text-amber-900/90 dark:text-amber-100/90">
            {mockModeEnabled ? "Using mock clock" : "Using real-time clock"}
          </span>
        </div>
        <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
          Current mock time: <span className="font-mono">{now.toLocaleString()}</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={() => setMockClock(9, 0)}>
            Set 9:00 AM
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={() => setMockClock(18, 0)}>
            Set 6:00 PM
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={() => setMockClock(19, 30)}>
            Set 7:30 PM
          </Button>
          <Button type="button" size="sm" variant="outline" className="rounded-sm" onClick={() => setMockClock(8, 15)}>
            Set 8:15 AM
          </Button>
        </div>
      </SoftCard>

      <LiveStats
        currentTime={formatClock(now)}
        worked={todayRecord.time_in ? formatHoursHms(workedMs) : "--h --m --s"}
      />
      {currentStatus === "completed" && (
        <p className="text-center text-xs text-muted-foreground">
          Total duration: {formatHoursHms(grossWorkedMs)} | Break deduction:{" "}
          {breakPreviewMs > 0 ? "1h" : "0h"} | Overtime (after break): {formatHoursHms(overtimeMs)}
        </p>
      )}

      <ActivityTimeline
        timeline={timeline}
        timelineLabel={timelineLabel}
        postOtContent={
          showPostOtSection ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Overtime Detected
                </p>
                {submittedPostOtRequest ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-amber-900 dark:text-amber-100">
                      OT Request Submitted
                    </span>
                    <OvertimeStatusBadge status={submittedPostOtRequest.status} />
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-sm border-amber-400/50 bg-amber-100/50 text-amber-900 hover:bg-amber-100 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100"
                    onClick={() =>
                      onApplyPostOt({
                        date: postOtDate,
                        startTime: "18:00",
                        endTime: todayRecord.time_out ? dateToHhmm(todayRecord.time_out) : undefined,
                        otType: "post_ot",
                      })
                    }
                  >
                    Apply for Post OT
                  </Button>
                )}
              </div>
              <p className="text-sm text-amber-800/90 dark:text-amber-200/90">
                <span className="font-semibold tabular-nums">
                  {formatHoursDecimal(detectedOvertimeMinutes)}
                </span>{" "}
                hours beyond regular working hours
              </p>
            </div>
          ) : null
        }
      />

      {onResetDay ? (
        <div className="flex justify-center">
          <Button type="button" variant="ghost" size="sm" className="rounded-sm text-xs text-muted-foreground" onClick={onResetDay}>
            Simulate new day (reset today)
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {showLateBanner && (
          <AlertBanner
            text={`You're ${formatApproxLateDuration(lateMinutesAtClockIn)} late.`}
          />
        )}
        {showNotInBanner && <AlertBanner text="You have not clocked in yet." />}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Time correction requests tab
// -----------------------------------------------------------------------------

function CorrectionRequestsTable({ rows }: { rows: CorrectionRequestRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl bg-card shadow-sm ring-1 ring-border/60">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="!text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 !text-center">Attendance date</th>
            <th className="px-4 py-3 !text-center">Requested time in</th>
            <th className="px-4 py-3 !text-center">Requested time out</th>
            <th className="px-4 py-3 !text-center">Status</th>
            <th className="px-4 py-3 !text-center">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <Fragment key={row.id}>
                <tr
                  className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/20"
                  onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id))}
                >
                  <td className="px-4 py-3 !text-center font-medium tabular-nums text-foreground">
                    <div className="flex items-center justify-center gap-2">
                      {expanded ? (
                        <ChevronUp className="size-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="size-4 text-muted-foreground" />
                      )}
                      {row.attendanceDate}
                    </div>
                  </td>
                  <td className="px-4 py-3 !text-center tabular-nums text-muted-foreground">
                    {row.requestedClockIn ? formatTime12h(row.requestedClockIn) : "—"}
                  </td>
                  <td className="px-4 py-3 !text-center tabular-nums text-muted-foreground">
                    {row.requestedClockOut ? formatTime12h(row.requestedClockOut) : "—"}
                  </td>
                  <td className="px-4 py-3 !text-center">
                    <OvertimeStatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 !text-center tabular-nums text-muted-foreground">
                    {formatCorrectionSubmittedAt(row.createdAt)}
                  </td>
                </tr>
                <tr className="border-t border-border/40">
                  <td colSpan={5} className="p-0">
                    <div
                      className={cn(
                        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      )}
                    >
                      <div className="overflow-hidden bg-muted/20 dark:bg-[#161b30]">
                        <div className="grid gap-2 p-4 text-sm sm:grid-cols-2">
                          <p className="sm:col-span-2">
                            <span className="text-muted-foreground">Reason:</span>{" "}
                            <span className="font-semibold">{row.reason}</span>
                          </p>
                          <p className="sm:col-span-2">
                            <span className="text-muted-foreground">Remarks:</span>{" "}
                            <span className="font-semibold">{row.remarks}</span>
                          </p>
                          <p className="sm:col-span-2">
                            <span className="text-muted-foreground">Attachment:</span>{" "}
                            <span className="font-semibold">{row.attachmentName ?? "—"}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No time correction requests yet. Use Request Edit on a timecard row, or + Request correction on the
          Corrections tab.
        </p>
      )}
    </div>
  );
}

function CorrectionsTab({
  rows,
  loading,
  canSyncDb,
  onRequestCorrection,
  onGoToTimecards,
}: {
  rows: CorrectionRequestRow[];
  loading: boolean;
  canSyncDb: boolean;
  onRequestCorrection: (date?: string) => void;
  onGoToTimecards: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Time corrections
          </h2>
          <p className="text-sm text-muted-foreground">
            View requests to change recorded clock in or clock out times. You can submit from here or
            use Request Edit on a row in Timecards.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="rounded-sm" onClick={onGoToTimecards}>
            View timecards
          </Button>
          <Button
            type="button"
            className="rounded-sm bg-[#192853] text-white hover:bg-[#141c3d] dark:bg-accent dark:text-accent-foreground"
            onClick={() => onRequestCorrection()}
          >
            + Request correction
          </Button>
        </div>
      </div>
      {!canSyncDb ? (
        <SoftCard className="border-0 bg-card/80 p-4 text-sm text-muted-foreground shadow-sm ring-1 ring-border/60">
          Time correction requests are saved when your account is linked to an employee record in HR.
        </SoftCard>
      ) : loading ? (
        <SoftCard className="border-0 bg-card/80 p-4 text-sm text-muted-foreground shadow-sm ring-1 ring-border/60">
          Loading correction requests…
        </SoftCard>
      ) : (
        <CorrectionRequestsTable rows={rows} />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Timecards tab
// -----------------------------------------------------------------------------

function TimecardsTab({
  rows,
  teamTimeHref,
  teamTimeEmployee,
  onRequestCorrection,
}: {
  rows: TimecardRow[];
  teamTimeHref?: string;
  teamTimeEmployee?: string;
  onRequestCorrection: (date?: string) => void;
}) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return formatDateKeyLocal(d);
  });
  const [to, setTo] = useState(() => formatDateKeyLocal(new Date()));
  const [statusFilter, setStatusFilter] = useState<"all" | TimecardStatus>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const computed = useMemo(() => rows.map(computeTimecardMetrics), [rows]);

  const filtered = useMemo(() => {
    return computed.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (r.date < from || r.date > to) return false;
      return true;
    });
  }, [computed, statusFilter, from, to]);

  const summary = useMemo(() => {
    let daysWorked = 0;
    let totalWorkedMinutes = 0;
    let overtimeMinutes = 0;
    let nightMinutes = 0;
    let lateMinutes = 0;
    let undertimeMinutes = 0;

    for (const r of filtered) {
      if (r.workedMinutes > 0) daysWorked += 1;
      totalWorkedMinutes += r.workedMinutes;
      overtimeMinutes += r.overtimeMinutes;
      nightMinutes += r.nightMinutes;
      lateMinutes += r.lateMinutes;
      undertimeMinutes += r.undertimeMinutes;
    }

    return {
      daysWorked,
      totalWorkedMinutes,
      overtimeMinutes,
      nightMinutes,
      lateMinutes,
      undertimeMinutes,
    };
  }, [filtered]);

  const lateDisplay = useMemo(
    () => formatMinutesWithHours(summary.lateMinutes),
    [summary.lateMinutes]
  );
  const undertimeDisplay = useMemo(
    () => formatMinutesWithHours(summary.undertimeMinutes),
    [summary.undertimeMinutes]
  );
  const teamTimeLink = useMemo(() => {
    if (!teamTimeHref) return undefined;
    const q = new URLSearchParams();
    q.set("tab", "timecards");
    if (teamTimeEmployee) q.set("employee", teamTimeEmployee);
    q.set("date", to);
    return `${teamTimeHref}?${q.toString()}`;
  }, [teamTimeHref, teamTimeEmployee, to]);

  const openCorrection = useCallback(
    (date?: string) => {
      onRequestCorrection(date);
    },
    [onRequestCorrection]
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Timecards
          </h2>
          <p className="text-sm text-muted-foreground">
            History, payroll-ready metrics, and request actions.
          </p>
        </div>
        {teamTimeLink ? (
          <Button asChild type="button" variant="outline" className="rounded-sm">
            <Link href={teamTimeLink}>View Team Time</Link>
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Days Worked"
            value={String(summary.daysWorked)}
            subLabel="Selected range"
            emphasis="primary"
          />
          <SummaryCard
            label="Worked Hours"
            value={formatHoursDecimal(summary.totalWorkedMinutes)}
            subLabel="Includes automatic 1-hour unpaid break deduction"
            emphasis="primary"
          />
          <SummaryCard
            label="Overtime Hours"
            value={formatHoursDecimal(summary.overtimeMinutes)}
            subLabel="Beyond 8h/day"
            emphasis="primary"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Late Time"
            value={lateDisplay.compact}
            subLabel={lateDisplay.withMinutes}
          />
          <SummaryCard
            label="Undertime"
            value={undertimeDisplay.compact}
            subLabel={undertimeDisplay.withMinutes}
          />
          <SummaryCard
            label="Night Shift Hours"
            value={formatHoursDecimal(summary.nightMinutes)}
            subLabel="10:00 PM - 6:00 AM"
          />
        </div>
      </div>

      <SoftCard className="overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <div className="sticky top-0 z-10 rounded-xl bg-card/95 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="range-from" className="text-xs uppercase tracking-wide">
                  From
                </Label>
                <Input
                  id="range-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="range-to" className="text-xs uppercase tracking-wide">
                  To
                </Label>
                <Input
                  id="range-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status-filter" className="text-xs uppercase tracking-wide">
                  Status
                </Label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as "all" | TimecardStatus)
                  }
                  className={cn(
                    "flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-sm",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  )}
                >
                  <option value="all">All</option>
                  <option value="late">Late</option>
                  <option value="complete">Complete</option>
                  <option value="missing">Missing</option>
                  <option value="pending">Pending Adjustment</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <TimecardTable
          rows={filtered}
          expandedId={expandedId}
          onToggleRow={(id) => setExpandedId((prev) => (prev === id ? null : id))}
          onRequestCorrection={openCorrection}
        />
      </SoftCard>
    </div>
  );
}

function OvertimeStatusBadge({ status }: { status: OvertimeRequestStatus }) {
  const map: Record<OvertimeRequestStatus, { label: string; className: string }> = {
    pending: {
      label: "Pending",
      className:
        "bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-100 dark:ring-amber-400/35",
    },
    approved: {
      label: "Approved",
      className:
        "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/30",
    },
    rejected: {
      label: "Rejected",
      className:
        "bg-red-500/15 text-red-800 ring-red-500/25 dark:text-red-200 dark:ring-red-400/30",
    },
  };
  const cfg = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

type OvertimeSubmitPayload = {
  date: string;
  startTime: string;
  endTime: string;
  otType: OvertimeType;
  category: OvertimeCategory;
  reason: string;
};

function OvertimeTypeBadge({ type }: { type?: OvertimeType }) {
  const map: Record<OvertimeType, { label: string; className: string }> = {
    pre_ot: {
      label: "Pre-OT",
      className:
        "bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-100 dark:ring-amber-400/35",
    },
    post_ot: {
      label: "Post-OT",
      className:
        "bg-blue-500/15 text-blue-900 ring-blue-500/30 dark:text-blue-100 dark:ring-blue-400/35",
    },
  };
  const cfg = map[type ?? "post_ot"];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

function OvertimeRequestModal({
  open,
  onOpenChange,
  onSubmit,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialOtType,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSubmit: (payload: OvertimeSubmitPayload) => void;
  initialDate: string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialOtType?: OvertimeType;
}) {
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<OvertimeCategory>("Regular OT");
  const [reason, setReason] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const isPostOtFlow = initialOtType === "post_ot";
  const isPreOtFlow = !isPostOtFlow;
  const SHIFT_END_MINUTES = 18 * 60;
  const parseMinutes = useCallback((hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }, []);
  const overtimeMinutes = useMemo(() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
    const startM = sh * 60 + sm;
    let endM = eh * 60 + em;
    if (endM < startM) endM += 24 * 60;
    return Math.max(0, endM - startM);
  }, [startTime, endTime]);
  const preOtErrors = useMemo(() => {
    if (!isPreOtFlow) return { startTime: "", endTime: "", reason: "" };
    const startM = parseMinutes(startTime);
    const endM = parseMinutes(endTime);
    const startTimeError =
      !startTime
        ? "Start time is required."
        : startM !== null && startM < SHIFT_END_MINUTES
          ? "Start time must be 6:00 PM or later."
          : "";
    const endTimeError =
      !endTime
        ? "End time is required."
        : startM !== null && endM !== null && endM <= startM
          ? "End time must be after start time."
          : "";
    const reasonError = !reason.trim() ? "Reason is required." : "";
    return { startTime: startTimeError, endTime: endTimeError, reason: reasonError };
  }, [isPreOtFlow, startTime, endTime, reason, parseMinutes, SHIFT_END_MINUTES]);
  const isEndTimeMissing = isPreOtFlow && submitAttempted && !endTime;
  const isReasonMissing = isPreOtFlow && submitAttempted && !reason.trim();
  const hasPreOtErrors = Boolean(
    preOtErrors.startTime || preOtErrors.endTime || preOtErrors.reason
  );

  // Reset modal fields when opened — standard controlled-dialog pattern.
  /* eslint-disable react-hooks/set-state-in-effect -- sync form to props when dialog opens */
  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setStartTime(initialStartTime ?? (initialOtType === "post_ot" ? "" : "18:00"));
    setEndTime(initialEndTime ?? "");
    setCategory("Regular OT");
    setReason("");
    setSubmitAttempted(false);
  }, [open, initialDate, initialStartTime, initialEndTime, initialOtType]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-xl p-0" showClose>
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Request Overtime
          </DialogTitle>
          <DialogDescription className="mt-1">
            Submit overtime details for approval.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 px-6 py-5">
          {isPostOtFlow ? (
            <div className="rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-3 dark:border-amber-400/25 dark:bg-amber-500/10">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                Overtime Detected
              </p>
              <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                You worked{" "}
                <span className="font-semibold tabular-nums">
                  {formatHoursDecimal(overtimeMinutes)}
                </span>{" "}
                hours beyond regular working hours ({formatTime12h(startTime || "00:00")} -{" "}
                {formatTime12h(endTime || "00:00")}).
              </p>
              <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                This overtime was automatically detected from your attendance logs.
              </p>
            </div>
          ) : null}
          {isPreOtFlow ? (
            <div className="rounded-lg border border-amber-300/40 bg-amber-50/60 px-4 py-3 dark:border-amber-400/25 dark:bg-amber-500/10">
              <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                This is a planned overtime request and must be approved before work is
                performed.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                OT Type
              </Label>
              {isPostOtFlow ? (
                <div className="rounded-lg border border-amber-300/50 bg-amber-100/50 px-3 py-2 text-sm font-medium text-amber-900 dark:border-amber-300/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Post-Overtime (auto-detected)
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
                  Pre-OT (Planned)
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="ot-date"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Date
              </Label>
              <Input
                id="ot-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                readOnly={isPostOtFlow}
                disabled={isPostOtFlow}
                className={cn("rounded-lg", isPostOtFlow && "bg-muted/50")}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label
                htmlFor="ot-start"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Start Time
              </Label>
              <Input
                id="ot-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                readOnly={isPostOtFlow}
                disabled={isPostOtFlow}
                className={cn(
                  "rounded-lg",
                  isPostOtFlow && "bg-muted/50",
                  isPreOtFlow && preOtErrors.startTime && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {isPreOtFlow ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Planned overtime starts after shift end (6:00 PM).
                </p>
              ) : null}
              {isPreOtFlow && preOtErrors.startTime ? (
                <p className="text-xs font-medium text-red-600">{preOtErrors.startTime}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label
                htmlFor="ot-end"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                End Time
              </Label>
              <Input
                id="ot-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                readOnly={isPostOtFlow}
                disabled={isPostOtFlow}
                className={cn(
                  "rounded-lg",
                  isPostOtFlow && "bg-muted/50",
                  isEndTimeMissing && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {isPreOtFlow ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  End time must be later than start time.
                </p>
              ) : null}
              {isPreOtFlow && submitAttempted && preOtErrors.endTime ? (
                <p
                  className={cn(
                    "text-xs font-medium",
                    isEndTimeMissing ? "text-red-600" : "text-amber-700"
                  )}
                >
                  {preOtErrors.endTime}
                </p>
              ) : null}
            </div>
          </div>
          {isPreOtFlow ? (
            <div className="rounded-lg border border-amber-300/50 bg-amber-100/50 px-4 py-2.5 text-sm dark:border-amber-300/30 dark:bg-amber-500/10">
              <span className="text-amber-900 dark:text-amber-100">
                Estimated Overtime Hours:{" "}
              </span>
              <span className="font-semibold tabular-nums text-amber-900 dark:text-amber-100">
                {preOtErrors.startTime || preOtErrors.endTime
                  ? "--"
                  : formatHoursDecimal(overtimeMinutes)}
              </span>
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1">
              <Label
                htmlFor="ot-category"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Category
              </Label>
              <select
                id="ot-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as OvertimeCategory)}
                className={cn(
                  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                <option>Regular OT</option>
                <option>Rest Day OT</option>
                <option>Holiday OT</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label
                htmlFor="ot-reason"
                className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Reason
              </Label>
              <textarea
                id="ot-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className={cn(
                  "w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm shadow-sm",
                  isReasonMissing && "border-red-500 focus-visible:ring-red-500",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
                placeholder="Describe why overtime is needed..."
              />
              {isPreOtFlow && submitAttempted && preOtErrors.reason ? (
                <p className="text-xs font-medium text-red-600">{preOtErrors.reason}</p>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-sm px-5"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-sm px-5"
            onClick={() => {
              setSubmitAttempted(true);
              if (isPreOtFlow && hasPreOtErrors) return;
              onSubmit({
                date,
                startTime,
                endTime,
                otType: isPostOtFlow ? "post_ot" : "pre_ot",
                category,
                reason,
              });
              onOpenChange(false);
            }}
          >
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OvertimeTab({
  rows,
  onOpenRequest,
}: {
  rows: OvertimeRequestRow[];
  onOpenRequest: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Overtime Requests
          </h2>
          <p className="text-sm text-muted-foreground">
            View submitted requests and file new overtime requests.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-sm bg-[#192853] text-white hover:bg-[#141c3d] dark:bg-accent dark:text-accent-foreground"
          onClick={onOpenRequest}
        >
          + Request Overtime
        </Button>
      </div>

      <SoftCard className="overflow-hidden border-0 bg-transparent p-0 shadow-none">
        <div className="overflow-x-auto rounded-xl bg-card shadow-sm ring-1 ring-border/60">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="!text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 !text-center">Date</th>
                <th className="px-4 py-3 !text-center">OT Time</th>
                <th className="px-4 py-3 !text-center">OT Type</th>
                <th className="px-4 py-3 !text-center">Category</th>
                <th className="px-4 py-3 !text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const expanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/20"
                      onClick={() => setExpandedId((prev) => (prev === row.id ? null : row.id))}
                    >
                      <td className="px-4 py-3 !text-center font-medium tabular-nums text-foreground">
                        <div className="flex items-center justify-center gap-2">
                          {expanded ? (
                            <ChevronUp className="size-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="size-4 text-muted-foreground" />
                          )}
                          {row.date}
                        </div>
                      </td>
                      <td className="px-4 py-3 !text-center tabular-nums text-muted-foreground">
                        {formatTime12h(row.startTime)} - {formatTime12h(row.endTime)}
                      </td>
                      <td className="px-4 py-3 !text-center">
                        <OvertimeTypeBadge type={row.otType} />
                      </td>
                      <td className="px-4 py-3 !text-center text-muted-foreground">{row.category}</td>
                      <td className="px-4 py-3 !text-center">
                        <OvertimeStatusBadge status={row.status} />
                      </td>
                    </tr>
                    <tr className="border-t border-border/40">
                      <td colSpan={5} className="p-0">
                        <div
                          className={cn(
                            "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                          )}
                        >
                          <div className="overflow-hidden bg-muted/20 dark:bg-[#161b30]">
                            <div className="grid gap-2 p-4 text-sm sm:grid-cols-2">
                              <p>
                                <span className="text-muted-foreground">OT Type:</span>{" "}
                                <OvertimeTypeBadge type={row.otType} />
                              </p>
                              <p>
                                <span className="text-muted-foreground">OT Start Time:</span>{" "}
                                <span className="font-semibold">{formatTime12h(row.startTime)}</span>
                              </p>
                              <p>
                                <span className="text-muted-foreground">OT End Time:</span>{" "}
                                <span className="font-semibold">{formatTime12h(row.endTime)}</span>
                              </p>
                              <p>
                                <span className="text-muted-foreground">Category:</span>{" "}
                                <span className="font-semibold">{row.category}</span>
                              </p>
                              <p className="sm:col-span-2">
                                <span className="text-muted-foreground">Reason:</span>{" "}
                                <span className="font-semibold">{row.reason}</span>
                              </p>
                              <p>
                                <span className="text-muted-foreground">Status:</span>{" "}
                                <OvertimeStatusBadge status={row.status} />
                              </p>
                              <p className="sm:col-span-2">
                                <span className="text-muted-foreground">Remarks:</span>{" "}
                                <span className="font-semibold">{row.remarks}</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </SoftCard>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

function MyTimePageContent({ user }: { user: CurrentUser }) {
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const isHrStaff = user.role === "HR_STAFF";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  type MyTimeTabId = "timeclock" | "timecards" | "corrections" | "overtime";
  const tabParam = searchParams.get("tab");
  const tab: MyTimeTabId =
    tabParam === "timecards" || tabParam === "overtime" || tabParam === "corrections"
      ? tabParam
      : "timeclock";

  const setTab = (next: MyTimeTabId) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const firstName = user.name.trim().split(/\s+/)[0] || user.name;
  const [mockTime, setMockTime] = useState(() => new Date());
  const [mockModeEnabled, setMockModeEnabled] = useState(false);
  const getNow = useCallback(
    () => (mockModeEnabled ? new Date(mockTime.getTime()) : new Date()),
    [mockModeEnabled, mockTime]
  );
  /** Persist only when the auth user is linked to an employee row. */
  const canSyncAttendanceWithDb = Boolean(user.employeeId);

  const [attendanceRecords, setAttendanceRecords] = useState<TimecardRow[]>([]);
  const initToday = useMemo(() => getInitialTodayFromRecords([]), []);
  const [currentStatus, setCurrentStatus] = useState<CurrentStatus>(initToday.status);
  const [todayRecord, setTodayRecord] = useState<TodayRecord>(initToday.today);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestRow[]>([]);

  const [otModalOpen, setOtModalOpen] = useState(false);
  const [otModalPrefill, setOtModalPrefill] = useState<OvertimeModalPrefill>(() => ({
    date: formatDateKeyLocal(new Date()),
    otType: "pre_ot",
  }));
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [corrModalDate, setCorrModalDate] = useState(() => formatDateKeyLocal(new Date()));
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  const [isOvertimeLoading, setIsOvertimeLoading] = useState(false);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequestRow[]>([]);
  const [isCorrectionsLoading, setIsCorrectionsLoading] = useState(false);
  const [hasLoadedAttendance, setHasLoadedAttendance] = useState(false);
  const [hasLoadedOvertime, setHasLoadedOvertime] = useState(false);
  const [hasLoadedCorrections, setHasLoadedCorrections] = useState(false);

  const loadCorrectionRequests = useCallback(async () => {
    if (!canSyncAttendanceWithDb || !user.employeeId) {
      setCorrectionRequests([]);
      setIsCorrectionsLoading(false);
      return;
    }
    setIsCorrectionsLoading(true);
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 120);
    const lookbackDate = lookback.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("attendance_correction_requests")
      .select(
        "id, employee_id, attendance_id, attendance_date, requested_clock_in, requested_clock_out, reason, attachment_name, status, remarks, created_at"
      )
      .eq("employee_id", user.employeeId)
      .gte("attendance_date", lookbackDate)
      .order("attendance_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !data) {
      setIsCorrectionsLoading(false);
      return;
    }
    setCorrectionRequests((data as AttendanceCorrectionDbRow[]).map(mapCorrectionDbRow));
    setIsCorrectionsLoading(false);
    setHasLoadedCorrections(true);
  }, [canSyncAttendanceWithDb, user.employeeId]);

  const timecardRows = useMemo(() => {
    const key = formatDateKeyLocal(new Date());
    const hasCompleteToday = attendanceRecords.some(
      (r) => r.date === key && r.timeIn && r.timeOut
    );
    if (hasCompleteToday || currentStatus === "completed") {
      return attendanceRecords;
    }
    if (currentStatus === "working" && todayRecord.time_in) {
      const synthetic: TimecardRow = {
        id: `${key}-in-progress`,
        date: key,
        timeIn: dateToHhmm(todayRecord.time_in),
        timeOut: null,
        status: "pending",
      };
      return [synthetic, ...attendanceRecords.filter((r) => r.date !== key)];
    }
    return attendanceRecords;
  }, [attendanceRecords, currentStatus, todayRecord.time_in]);

  const loadAttendanceRows = useCallback(async () => {
    if (!canSyncAttendanceWithDb || !user.employeeId) {
      setAttendanceRecords([]);
      setTodayRecord({ time_in: null, time_out: null });
      setCurrentStatus("not_clocked_in");
      setIsAttendanceLoading(false);
      setHasLoadedAttendance(true);
      return;
    }
    setIsAttendanceLoading(true);
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 120);
    const lookbackDate = lookback.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("attendance")
      .select(
        "id, employee_id, date, clock_in, clock_out, status, total_late_minutes, total_undertime_minutes, total_overtime_minutes"
      )
      .eq("employee_id", user.employeeId)
      .gte("date", lookbackDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error || !data) {
      setIsAttendanceLoading(false);
      setHasLoadedAttendance(true);
      return;
    }

    const rows = data as AttendanceDbRow[];
    const mapped = rows.map((row) => {
      const inAt = parseAttendanceDateTime(row.date, row.clock_in);
      const outAt = parseAttendanceDateTime(row.date, row.clock_out);
      return {
        id: row.id,
        date: row.date,
        timeIn: inAt ? dateToHhmm(inAt) : null,
        timeOut: outAt ? dateToHhmm(outAt) : null,
        status: normalizeDbStatusToTimecard(row.status),
      } as TimecardRow;
    });
    setAttendanceRecords(mapped);

    const todayKey = formatDateKeyLocal(getNow());
    const today = rows.find((r) => r.date === todayKey);
    if (today?.clock_in) {
      const inAt = parseAttendanceDateTime(today.date, today.clock_in);
      const outAt = parseAttendanceDateTime(today.date, today.clock_out);
      if (inAt) {
        setTodayRecord({ time_in: inAt, time_out: outAt });
        setCurrentStatus(outAt ? "completed" : "working");
      }
    } else {
      setTodayRecord({ time_in: null, time_out: null });
      setCurrentStatus("not_clocked_in");
    }
    setIsAttendanceLoading(false);
    setHasLoadedAttendance(true);
  }, [canSyncAttendanceWithDb, user.employeeId, getNow]);

  /* eslint-disable react-hooks/set-state-in-effect -- client fetch + hydrate (setState after async I/O) */
  useEffect(() => {
    const shouldLoadAttendance = tab === "timeclock" || tab === "timecards";
    if (!shouldLoadAttendance || hasLoadedAttendance) return;
    let cancelled = false;
    void (async () => {
      await loadAttendanceRows();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLoadedAttendance, loadAttendanceRows, tab]);

  useEffect(() => {
    const shouldLoadOvertime = tab === "timeclock" || tab === "overtime";
    if (!shouldLoadOvertime || hasLoadedOvertime) return;
    if (!canSyncAttendanceWithDb) return;
    let cancelled = false;
    void (async () => {
      setIsOvertimeLoading(true);
      const lookback = new Date();
      lookback.setDate(lookback.getDate() - 120);
      const lookbackDate = lookback.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("overtime_requests")
        .select(
          "id, employee_id, attendance_id, date, start_time, end_time, ot_type, category, reason, status, remarks, created_at"
        )
        .eq("employee_id", user.employeeId!)
        .gte("date", lookbackDate)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error || !data) {
        setIsOvertimeLoading(false);
        setHasLoadedOvertime(true);
        return;
      }

      const mapped = (data as OvertimeRequestDbRow[]).map((row) => ({
        id: row.id,
        date: row.date,
        startTime: row.start_time.slice(0, 5),
        endTime: row.end_time.slice(0, 5),
        otType: normalizeDbOvertimeType(row.ot_type),
        category: normalizeDbOvertimeCategory(row.category),
        reason: row.reason ?? "No reason provided.",
        status: normalizeDbOvertimeStatus(row.status),
        remarks: row.remarks ?? "Pending review.",
      }));
      setOvertimeRequests(mapped);
      setIsOvertimeLoading(false);
      setHasLoadedOvertime(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [canSyncAttendanceWithDb, hasLoadedOvertime, tab, user.employeeId]);

  useEffect(() => {
    if (tab !== "corrections" || hasLoadedCorrections) return;
    void loadCorrectionRequests();
  }, [hasLoadedCorrections, loadCorrectionRequests, tab]);

  useEffect(() => {
    const key = formatDateKeyLocal(new Date());
    const row = attendanceRecords.find((r) => r.date === key && r.timeIn && r.timeOut);
    if (!row || currentStatus !== "not_clocked_in") return;
    const hydrated = getInitialTodayFromRecords(attendanceRecords);
    if (hydrated.status === "completed") {
      setCurrentStatus("completed");
      setTodayRecord(hydrated.today);
    }
  }, [attendanceRecords, currentStatus]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleClockIn = useCallback(() => {
    void (async () => {
      const t = new Date(getNow().getTime());
      setTodayRecord({ time_in: t, time_out: null });
      setCurrentStatus("working");
      if (!canSyncAttendanceWithDb) return;
      const dateKey = formatDateKeyLocal(t);
      const lateMin = calculateLate(t, dateKey);
      const { data: existingRow, error: existingError } = await supabase
        .from("attendance")
        .select("id")
        .eq("employee_id", user.employeeId!)
        .eq("date", dateKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) {
        console.warn("Clock in lookup failed:", existingError.message);
        return;
      }

      const payload = {
        employee_id: user.employeeId!,
        date: dateKey,
        clock_in: dateToHhmmss(t),
        clock_out: null,
        status: lateMin > 0 ? "LATE" : "PRESENT",
        total_late_minutes: lateMin,
        total_undertime_minutes: 0,
        total_overtime_minutes: 0,
      };
      const { error } = existingRow?.id
        ? await supabase.from("attendance").update(payload).eq("id", existingRow.id)
        : await supabase.from("attendance").insert(payload);
      if (error) {
        console.warn("Clock in save failed:", error.message);
        return;
      }
      await loadAttendanceRows();
    })();
  }, [getNow, canSyncAttendanceWithDb, user.employeeId, loadAttendanceRows]);

  const handleClockOut = useCallback(() => {
    void (async () => {
      if (!todayRecord.time_in) return;
      const time_in = todayRecord.time_in;
      const time_out = new Date(getNow().getTime());
      const dateKey = formatDateKeyLocal(time_in);

      const totalMin = calculateHours(time_in, time_out);
      const breakMin = totalMin >= 360 ? 60 : 0;
      const workedMin = Math.max(0, totalMin - breakMin);
      const overtimeMin = Math.max(0, workedMin - 480);
      const lateMin = calculateLate(time_in, dateKey);
      const undertimeMin = calculateUndertime(workedMin);
      const status = deriveTimecardStatus(lateMin);

      const newRow: TimecardRow = {
        id: `day-${dateKey}`,
        date: dateKey,
        timeIn: dateToHhmm(time_in),
        timeOut: dateToHhmm(time_out),
        status,
      };

      setAttendanceRecords((prev) => {
        const next = prev.filter((r) => r.date !== dateKey);
        return [newRow, ...next].sort((a, b) => b.date.localeCompare(a.date));
      });
      setTodayRecord({ time_in, time_out });
      setCurrentStatus("completed");

      if (!canSyncAttendanceWithDb) return;
      const { data: existingRow, error: existingError } = await supabase
        .from("attendance")
        .select("id")
        .eq("employee_id", user.employeeId!)
        .eq("date", dateKey)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) {
        console.warn("Clock out lookup failed:", existingError.message);
        return;
      }
      const payload = {
        employee_id: user.employeeId!,
        date: dateKey,
        clock_in: dateToHhmmss(time_in),
        clock_out: dateToHhmmss(time_out),
        status: status.toUpperCase(),
        total_late_minutes: lateMin,
        total_undertime_minutes: undertimeMin,
        total_overtime_minutes: overtimeMin,
      };
      const { error } = existingRow?.id
        ? await supabase.from("attendance").update(payload).eq("id", existingRow.id)
        : await supabase.from("attendance").insert(payload);
      if (error) {
        console.warn("Clock out save failed:", error.message);
        return;
      }
      await loadAttendanceRows();
    })();
  }, [todayRecord.time_in, getNow, canSyncAttendanceWithDb, user.employeeId, loadAttendanceRows]);

  const handleResetDay = useCallback(() => {
    const key = formatDateKeyLocal(new Date());
    setTodayRecord({ time_in: null, time_out: null });
    setCurrentStatus("not_clocked_in");
    setAttendanceRecords((prev) => prev.filter((r) => r.date !== key));
    if (canSyncAttendanceWithDb) {
      void supabase.from("attendance").delete().eq("employee_id", user.employeeId!).eq("date", key);
    }
  }, [canSyncAttendanceWithDb, user.employeeId]);

  const openOtModal = useCallback((prefill?: Partial<OvertimeModalPrefill>) => {
    setOtModalPrefill({
      date: prefill?.date ?? formatDateKeyLocal(new Date()),
      startTime: prefill?.startTime,
      endTime: prefill?.endTime,
      otType: prefill?.otType ?? "pre_ot",
    });
    setOtModalOpen(true);
  }, []);

  const openCorrModal = useCallback((date?: string) => {
    setCorrModalDate(date ?? formatDateKeyLocal(new Date()));
    setCorrModalOpen(true);
  }, []);

  const handleOvertimeSubmit = useCallback(
    (payload: OvertimeSubmitPayload) => {
      void (async () => {
        const isPre = payload.otType === "pre_ot";
        const optimisticRow: OvertimeRequestRow = {
          id: `ot-${Date.now()}`,
          date: payload.date,
          startTime: payload.startTime,
          endTime: payload.endTime,
          otType: payload.otType,
          category: payload.category,
          reason: payload.reason,
          status: "pending",
          remarks: isPre
            ? "Pending approval before execution."
            : "Pending attendance log validation.",
        };
        setOvertimeRequests((prev) => [optimisticRow, ...prev]);

        if (!canSyncAttendanceWithDb) return;
        const { data, error } = await supabase
          .from("overtime_requests")
          .insert({
            employee_id: user.employeeId!,
            date: payload.date,
            start_time: `${payload.startTime}:00`,
            end_time: `${payload.endTime}:00`,
            ot_type: payload.otType.toUpperCase(),
            category: payload.category,
            reason: payload.reason,
            status: "PENDING",
            remarks: isPre
              ? "Pending approval before execution."
              : "Pending attendance log validation.",
          })
          .select(
            "id, employee_id, attendance_id, date, start_time, end_time, ot_type, category, reason, status, remarks, created_at"
          )
          .single();

        if (error || !data) {
          console.warn("Overtime request save failed:", error?.message ?? "Unknown error");
          return;
        }

        const saved = data as OvertimeRequestDbRow;
        setOvertimeRequests((prev) => {
          const remaining = prev.filter((row) => row.id !== optimisticRow.id);
          const persisted: OvertimeRequestRow = {
            id: saved.id,
            date: saved.date,
            startTime: saved.start_time.slice(0, 5),
            endTime: saved.end_time.slice(0, 5),
            otType: normalizeDbOvertimeType(saved.ot_type),
            category: normalizeDbOvertimeCategory(saved.category),
            reason: saved.reason ?? payload.reason,
            status: normalizeDbOvertimeStatus(saved.status),
            remarks:
              saved.remarks ??
              (isPre
                ? "Pending approval before execution."
                : "Pending attendance log validation."),
          };
          return [persisted, ...remaining];
        });
      })();
    },
    [canSyncAttendanceWithDb, user.employeeId]
  );

  const handleCorrectionSubmit = useCallback(
    (payload: AttendanceCorrectionSubmitPayload) => {
      void (async () => {
        if (!canSyncAttendanceWithDb) return;

        const normalizedIn = payload.inTime?.trim() ? `${payload.inTime}:00` : null;
        const normalizedOut = payload.outTime?.trim() ? `${payload.outTime}:00` : null;
        const reason = payload.reason?.trim() ?? "";
        if (!reason || (!normalizedIn && !normalizedOut)) {
          console.warn("Correction request requires reason and at least one corrected time.");
          return;
        }

        const { data: attendanceRow } = await supabase
          .from("attendance")
          .select("id")
          .eq("employee_id", user.employeeId!)
          .eq("date", payload.date)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const { error } = await supabase.from("attendance_correction_requests").insert({
          employee_id: user.employeeId!,
          attendance_id: attendanceRow?.id ?? null,
          attendance_date: payload.date,
          requested_clock_in: normalizedIn,
          requested_clock_out: normalizedOut,
          reason,
          attachment_name: payload.attachmentName?.trim() || null,
          status: "PENDING",
          remarks: "Pending review.",
        });

        if (error) {
          console.warn("Correction request save failed:", error.message);
          return;
        }
        await loadCorrectionRequests();
      })();
    },
    [canSyncAttendanceWithDb, user.employeeId, loadCorrectionRequests]
  );

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search" />

        <EmployeeSectionHeader
          title="My Time"
          tabs={[
            { id: "timeclock", label: "Timeclock" },
            { id: "timecards", label: "Timecards" },
            { id: "corrections", label: "Corrections" },
            { id: "overtime", label: "Overtime" },
          ]}
          activeTab={tab}
          onTabChange={(id) => setTab(id as MyTimeTabId)}
        />
      </div>

      {tab === "timeclock" ? (
        <TimeclockTab
          displayName={firstName}
          currentStatus={currentStatus}
          todayRecord={todayRecord}
          overtimeRequests={overtimeRequests}
          mockTime={mockTime}
          mockModeEnabled={mockModeEnabled}
          roleLabel={isHrStaff ? "HR Staff" : undefined}
          onClockIn={handleClockIn}
          onClockOut={handleClockOut}
          onApplyPostOt={openOtModal}
          onSetMockTime={setMockTime}
          onSetMockModeEnabled={setMockModeEnabled}
          onResetDay={handleResetDay}
        />
      ) : tab === "timecards" ? (
        isAttendanceLoading ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Loading attendance records...
          </div>
        ) : (
          <TimecardsTab
            rows={timecardRows}
            teamTimeHref={isHrStaff ? paths.teamTime : undefined}
            teamTimeEmployee={isHrStaff ? user.name : undefined}
            onRequestCorrection={openCorrModal}
          />
        )
      ) : tab === "corrections" ? (
        <CorrectionsTab
          rows={correctionRequests}
          loading={isCorrectionsLoading}
          canSyncDb={canSyncAttendanceWithDb}
          onRequestCorrection={openCorrModal}
          onGoToTimecards={() => setTab("timecards")}
        />
      ) : isOvertimeLoading ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading overtime requests...
        </div>
      ) : (
        <OvertimeTab rows={overtimeRequests} onOpenRequest={() => openOtModal()} />
      )}

      <OvertimeRequestModal
        open={otModalOpen}
        onOpenChange={setOtModalOpen}
        initialDate={otModalPrefill.date}
        initialStartTime={otModalPrefill.startTime}
        initialEndTime={otModalPrefill.endTime}
        initialOtType={otModalPrefill.otType}
        onSubmit={handleOvertimeSubmit}
      />
      <RequestModal
        open={corrModalOpen}
        onOpenChange={setCorrModalOpen}
        mode="correction"
        initialDate={corrModalDate}
        onSubmit={handleCorrectionSubmit}
      />

      <p className="text-center text-xs text-muted-foreground">
        Looking for the legacy attendance summary?{" "}
        <Link href={paths.attendance} className="font-medium text-foreground underline-offset-4 hover:underline">
          Open Attendance
        </Link>
      </p>
    </div>
  );
}

export default function MyTimePage() {
  const { user } = useCurrentUser();
  if (!canAccessMyTime(user.role)) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        My Time is only available for employee accounts.
      </div>
    );
  }
  return <MyTimePageContent user={user} />;
}
