"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CurrentUser } from "@/lib/mock";
import type { AttendanceCorrectionRequestRow, EmployeeRow } from "@/lib/supabase/client";
import { approveCorrection } from "@/actions/attendance/approveCorrection";
import { Button } from "@/components/ui/button";
import { AttendanceApprovalConfirmDialog } from "@/features/attendance/components/team-time/attendanceApprovalConfirmDialog";
import { AttendanceRequestStatusBadge } from "@/features/attendance/components/team-time/attendanceRequestStatusBadge";
import { employeeDisplayName } from "@/features/attendance/components/team-time/employeeDisplayName";
import { canApproveByMatrix } from "@/lib/attendance/approverMatrix";

type Row = AttendanceCorrectionRequestRow & {
  employee?: Pick<
    EmployeeRow,
    | "first_name"
    | "last_name"
    | "full_name"
    | "name"
    | "employee_number"
    | "employee_code"
    | "email"
    | "role"
    | "position"
    | "job_title"
  > & { employee_number: string | null };
  current_clock_in: string | null;
  current_clock_out: string | null;
};

function formatRequestDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatTimeValue(value: string | null): string {
  if (!value) return "-";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function getIssueType(row: Row): string {
  const missingIn = !row.current_clock_in && !!row.requested_clock_in;
  const missingOut = !row.current_clock_out && !!row.requested_clock_out;
  if (missingIn && missingOut) return "Missing In/Out";
  if (missingIn) return "Missing Time In";
  if (missingOut) return "Missing Time Out";
  return "Time Adjustment";
}

function normalizeRoleOrTitle(row: Row): string {
  const role = (row.employee?.role ?? "").toString().trim().toUpperCase();
  if (role) return role;
  const title = (row.employee?.job_title ?? row.employee?.position ?? "").toString().trim().toUpperCase();
  if (!title) return "";
  if (title.includes("HR STAFF")) return "HR_STAFF";
  if (title.includes("HR ADMIN")) return "HR_ADMIN";
  if (title.includes("HR MANAGER")) return "HR_MANAGER";
  if (title.includes("EXECUTIVE")) return "EXECUTIVE";
  if (title.includes("AUDITOR") || title.includes("AUDIT")) return "AUDITOR";
  if (title.includes("SYSTEM ADMIN") || title.includes("SUPER ADMIN")) return "SYSTEM_ADMIN";
  if (title.includes("MANAGER")) return "DEPARTMENT_MANAGER";
  return "";
}

export function TeamCorrectionRequestsTable({ currentUser }: { currentUser: CurrentUser }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 120);
    const lookbackDate = lookback.toISOString().slice(0, 10);

    const { data: reqRows, error: reqErr } = await supabase
      .from("attendance_correction_requests")
      .select("id, employee_id, attendance_id, attendance_date, requested_clock_in, requested_clock_out, reason, attachment_name, status, remarks, approved_by, approved_at, created_at, updated_at")
      .gte("attendance_date", lookbackDate)
      .order("created_at", { ascending: false });

    if (reqErr) {
      setListError(reqErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (reqRows ?? []) as AttendanceCorrectionRequestRow[];
    const employeeIds = new Set<string>();
    const attendanceIds = new Set<string>();
    const attendanceDates = new Set<string>();

    for (const row of list) {
      employeeIds.add(row.employee_id);
      if (row.attendance_id) attendanceIds.add(row.attendance_id);
      attendanceDates.add(row.attendance_date);
    }

    const allPeople = Array.from(new Set([...employeeIds]));

    let people: EmployeeRow[] = [];
    let peopleErr: { message: string } | null = null;
    if (allPeople.length) {
      let employeeCols = [
        "id",
        "first_name",
        "last_name",
        "full_name",
        "name",
        "employee_number",
        "employee_code",
        "email",
        "role",
        "position",
        "job_title",
      ];
      for (let i = 0; i < 12; i++) {
        const { data, error } = await supabase
          .from("employees")
          .select(employeeCols.join(", "))
          .in("id", allPeople);
        if (!error) {
          people = ((data as unknown as EmployeeRow[]) ?? []);
          peopleErr = null;
          break;
        }
        const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
        if (!missingColumn) {
          peopleErr = { message: error.message };
          break;
        }
        employeeCols = employeeCols.filter((c) => c !== missingColumn);
        if (employeeCols.length === 0) {
          peopleErr = { message: error.message };
          break;
        }
      }
    }

    const [
      { data: attendanceRowsById, error: attendanceByIdErr },
      { data: attendanceRowsByDate, error: attendanceByDateErr },
    ] = await Promise.all([
        attendanceIds.size
          ? supabase
              .from("attendance")
              .select("id, clock_in, clock_out")
              .in("id", Array.from(attendanceIds))
          : Promise.resolve({ data: [], error: null }),
        employeeIds.size && attendanceDates.size
          ? supabase
              .from("attendance")
              .select("id, employee_id, date, clock_in, clock_out, created_at")
              .in("employee_id", Array.from(employeeIds))
              .in("date", Array.from(attendanceDates))
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ] as const);

    if (peopleErr) setListError(peopleErr.message);
    if (attendanceByIdErr) setListError(attendanceByIdErr.message);
    if (attendanceByDateErr) setListError(attendanceByDateErr.message);

    const peopleMap = new Map<string, Row["employee"]>();
    for (const person of people) {
      const employee_number = (person.employee_number ?? person.employee_code ?? null) as string | null;
      peopleMap.set(person.id, {
        first_name: person.first_name ?? null,
        last_name: person.last_name ?? null,
        full_name: person.full_name ?? null,
        name: person.name ?? null,
        email: person.email ?? null,
        employee_number,
        employee_code: person.employee_code ?? null,
        role: person.role ?? null,
        position: person.position ?? null,
        job_title: person.job_title ?? null,
      });
    }

    const attendanceByIdMap = new Map<string, { clock_in: string | null; clock_out: string | null }>();
    for (const att of attendanceRowsById ?? []) {
      attendanceByIdMap.set(att.id, {
        clock_in: att.clock_in,
        clock_out: att.clock_out,
      });
    }

    const attendanceByEmployeeDateMap = new Map<string, { clock_in: string | null; clock_out: string | null }>();
    for (const att of attendanceRowsByDate ?? []) {
      const key = `${att.employee_id}|${att.date}`;
      if (!attendanceByEmployeeDateMap.has(key)) {
        attendanceByEmployeeDateMap.set(key, {
          clock_in: att.clock_in,
          clock_out: att.clock_out,
        });
      }
    }

    setRows(
      list.map((row) => {
        const byId = row.attendance_id ? attendanceByIdMap.get(row.attendance_id) : undefined;
        const byDate = attendanceByEmployeeDateMap.get(`${row.employee_id}|${row.attendance_date}`);
        const att = byId ?? byDate;
        return {
          ...row,
          employee: peopleMap.get(row.employee_id),
          current_clock_in: att?.clock_in ?? null,
          current_clock_out: att?.clock_out ?? null,
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canActOn = useCallback(
    (row: Row) => {
      const requesterRole = normalizeRoleOrTitle(row);
      const matrixAllowed = canApproveByMatrix({
        requesterEmployeeNumber: row.employee?.employee_number ?? row.employee?.employee_code,
        actorEmployeeNumber: currentUser.employeeNumber,
        requestType: "attendanceIssue",
      });
      const hrStaffRoleOverride = requesterRole === "SYSTEM_ADMIN";
      const hrAdminRoleOverride = requesterRole === "EXECUTIVE";
      if (row.status !== "PENDING") return false;
      if (row.employee_id === currentUser.employeeId) return false;
      if (currentUser.role === "HR_MANAGER") {
        // HR Manager approvals are matrix-assigned (e.g. HR Staff -> HR Manager).
        return matrixAllowed;
      }
      if (currentUser.role === "HR_ADMIN") {
        // HR Admin handles matrix-assigned higher-level requests and Executive requests.
        return matrixAllowed || hrAdminRoleOverride;
      }
      if (currentUser.role === "HR_STAFF") return matrixAllowed || hrStaffRoleOverride;
      return false;
    },
    [currentUser.employeeId, currentUser.employeeNumber, currentUser.role]
  );

  const visibleRows = rows.filter((row) => {
    const requesterRole = normalizeRoleOrTitle(row);
    const matrixAllowed = canApproveByMatrix({
      requesterEmployeeNumber: row.employee?.employee_number ?? row.employee?.employee_code,
      actorEmployeeNumber: currentUser.employeeNumber,
      requestType: "attendanceIssue",
    });
    if (currentUser.role === "HR_MANAGER") {
      // Keep non-self and matrix-assigned only; works even when role/title columns are absent.
      return row.employee_id !== currentUser.employeeId && matrixAllowed;
    }
    if (currentUser.role === "HR_STAFF") {
      // Includes Auditor/System Admin requests for HR Staff review.
      return row.employee_id !== currentUser.employeeId && (matrixAllowed || requesterRole === "SYSTEM_ADMIN");
    }
    if (currentUser.role === "HR_ADMIN") {
      // HR Admin review list includes matrix-assigned requests and Executive requesters.
      return (
        row.employee_id !== currentUser.employeeId &&
        (matrixAllowed || requesterRole === "EXECUTIVE")
      );
    }
    return true;
  });

  const openDialog = (requestId: string, mode: "APPROVED" | "REJECTED") => {
    setActiveRequestId(requestId);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Attendance Review</h2>
        <p className="text-sm text-muted-foreground">
          Employees can submit their own requests. Assigned approvers can approve or reject.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        {listError ? <p className="p-4 text-sm text-destructive">{listError}</p> : null}
        <div>
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee Name</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Issue Type</th>
                <th className="px-4 py-3 font-medium">Current Time In/Out</th>
                <th className="px-4 py-3 font-medium">Requested Time In/Out</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Loading requests...
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No correction requests to show.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const name = row.employee ? employeeDisplayName(row.employee) : "-";
                  const employeeNo = row.employee?.employee_number ?? row.employee?.employee_code ?? "-";
                  const showActions = canActOn(row);
                  return (
                    <tr key={row.id} className="border-t border-border/60 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 text-foreground">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{employeeNo}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatRequestDate(row.attendance_date)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{getIssueType(row)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatTimeValue(row.current_clock_in)} / {formatTimeValue(row.current_clock_out)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatTimeValue(row.requested_clock_in)} / {formatTimeValue(row.requested_clock_out)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{row.reason?.trim() ? row.reason : "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceRequestStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {showActions ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" className="rounded-[5px]" onClick={() => openDialog(row.id, "APPROVED")}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-[5px]"
                              onClick={() => openDialog(row.id, "REJECTED")}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AttendanceApprovalConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "APPROVED" ? "Approve correction" : "Reject correction"}
        description={
          dialogMode === "APPROVED"
            ? "Confirm approval for this attendance correction request."
            : "Confirm rejection for this attendance correction request."
        }
        confirmLabel={dialogMode === "APPROVED" ? "Confirm approval" : "Confirm rejection"}
        confirmVariant={dialogMode === "REJECTED" ? "destructive" : "default"}
        onConfirm={async (remarks) => {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error("You must be signed in to perform this action.");
          if (!activeRequestId) throw new Error("No request selected.");
          const res = await approveCorrection(token, {
            requestId: activeRequestId,
            status: dialogMode,
            remarks: remarks.trim() || null,
          });
          if (!res.ok) throw new Error(res.error);
          await load();
        }}
      />
    </div>
  );
}
