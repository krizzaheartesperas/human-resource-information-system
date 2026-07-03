"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CurrentUser } from "@/lib/mock";
import type { EmployeeRow, OvertimeRequestRow } from "@/lib/supabase/client";
import { approveOvertime } from "@/actions/attendance/approveOvertime";
import { Button } from "@/components/ui/button";
import { AttendanceApprovalConfirmDialog } from "@/features/attendance/components/team-time/attendanceApprovalConfirmDialog";
import { AttendanceRequestStatusBadge } from "@/features/attendance/components/team-time/attendanceRequestStatusBadge";
import { employeeDisplayName } from "@/features/attendance/components/team-time/employeeDisplayName";
import { canApproveByMatrix } from "@/lib/attendance/approverMatrix";

type Row = OvertimeRequestRow & {
  employee?: Pick<
    EmployeeRow,
    | "first_name"
    | "last_name"
    | "full_name"
    | "name"
    | "employee_number"
    | "employee_code"
    | "department_id"
    | "role"
    | "position"
    | "job_title"
  > & { employee_number: string | null };
};

function formatPgTime(t: string | null | undefined): string {
  if (!t) return "—";
  const parts = t.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (Number.isNaN(h)) return t;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatRequestDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function minutesBetween(date: string, start: string | null | undefined, end: string | null | undefined): number {
  if (!start || !end) return 0;
  const s = new Date(`${date}T${start}`);
  let e = new Date(`${date}T${end}`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  if (e < s) e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 60000));
}

function normalizeRoleOrTitle(row: Row): string {
  const role = (row.employee?.role ?? "").toString().trim().toUpperCase();
  const title = (row.employee?.job_title ?? row.employee?.position ?? "").toString().trim().toUpperCase();
  // Prefer semantic title mapping when role is generic/mis-set (e.g. EMPLOYEE + Engineering Manager).
  if (title.includes("HR MANAGER")) return "HR_MANAGER";
  if (title.includes("HR ADMIN")) return "HR_ADMIN";
  if (title.includes("HR STAFF")) return "HR_STAFF";
  if (title.includes("AUDITOR") || title.includes("AUDIT")) return "AUDITOR";
  if (title.includes("EXECUTIVE")) return "EXECUTIVE";
  if (title.includes("SYSTEM ADMIN") || title.includes("SUPER ADMIN")) return "SUPER_ADMIN";
  if (title.includes("ENGINEERING MANAGER") || title.includes("DEPARTMENT MANAGER") || title.includes("MANAGER")) {
    return "DEPARTMENT_MANAGER";
  }
  if (role) return role;
  if (!title) return "";
  if (title.includes("MANAGER")) return "DEPARTMENT_MANAGER";
  return "";
}

function roleLabel(role: string): string {
  const v = role.trim().toUpperCase();
  if (v === "DEPARTMENT_MANAGER") return "Department Manager";
  if (v === "MANAGER") return "Department Manager";
  if (v === "HR_ADMIN") return "HR Admin";
  if (v === "HR_STAFF") return "HR Staff";
  if (v === "HR_MANAGER") return "HR Manager";
  if (v === "AUDITOR") return "Auditor";
  if (v === "SYSTEM_ADMIN" || v === "SUPER_ADMIN") return "System Admin";
  if (v === "EXECUTIVE") return "Executive";
  if (v === "EMPLOYEE") return "Employee";
  if (v === "MANAGER") return "Manager";
  return v || "—";
}

export function TeamOvertimeRequestsTable({ currentUser }: { currentUser: CurrentUser }) {
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

    const { data: otRows, error: otErr } = await supabase
      .from("overtime_requests")
      .select("id, employee_id, attendance_id, date, start_time, end_time, ot_type, category, reason, status, remarks, created_at")
      .gte("date", lookbackDate)
      .order("created_at", { ascending: false });

    if (otErr) {
      setListError(otErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = (otRows ?? []) as OvertimeRequestRow[];
    const ids = Array.from(new Set(list.map((r) => r.employee_id)));
    let empMap = new Map<string, Row["employee"]>();
    if (ids.length) {
      let emps: EmployeeRow[] = [];
      let empErr: string | null = null;
      let employeeCols = [
        "id",
        "first_name",
        "last_name",
        "full_name",
        "name",
        "employee_number",
        "employee_code",
        "department_id",
        "role",
        "position",
        "job_title",
      ];
      for (let i = 0; i < 12; i++) {
        const { data, error } = await supabase
          .from("employees")
          .select(employeeCols.join(", "))
          .in("id", ids);
        if (!error) {
          emps = ((data as EmployeeRow[] | null) ?? []);
          empErr = null;
          break;
        }
        const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
        if (!missingColumn) {
          empErr = error.message;
          break;
        }
        employeeCols = employeeCols.filter((c) => c !== missingColumn);
        if (employeeCols.length === 0) {
          empErr = error.message;
          break;
        }
      }

      if (empErr) {
        setListError(empErr);
      } else {
        empMap = new Map(
          emps.map((e: EmployeeRow) => {
            const employee_number = (e.employee_number ?? e.employee_code ?? null) as string | null;
            return [
              e.id,
              {
                first_name: e.first_name ?? null,
                last_name: e.last_name ?? null,
                full_name: e.full_name ?? null,
                name: e.name ?? null,
                employee_number,
                employee_code: e.employee_code ?? null,
                department_id: e.department_id ?? null,
                role: e.role ?? null,
                position: e.position ?? null,
                job_title: e.job_title ?? null,
              },
            ];
          })
        );
      }
    }

    setRows(
      list.map((r) => ({
        ...r,
        employee: empMap.get(r.employee_id),
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canManageDeptOvertime = useCallback(
    (row: Row) => {
      const requesterRole = normalizeRoleOrTitle(row);
      const blockedRoles = new Set([
        "HR_STAFF",
        "HR_ADMIN",
        "HR_MANAGER",
        "AUDITOR",
        "EXECUTIVE",
        "SUPER_ADMIN",
        "SYSTEM_ADMIN",
      ]);
      const requesterDeptId = (row.employee?.department_id ?? "").toString().trim();
      const sameDepartment =
        requesterDeptId.length > 0 && requesterDeptId === (currentUser.departmentId ?? "").trim();
      if (!sameDepartment) return false;
      if (blockedRoles.has(requesterRole)) return false;
      return true;
    },
    [currentUser.departmentId]
  );

  const canActOn = useCallback(
    (row: Row) => {
      const requesterRole = normalizeRoleOrTitle(row);
      if (row.status !== "PENDING") return false;
      if (row.employee_id === currentUser.employeeId) return false;

      if (currentUser.role === "DEPARTMENT_MANAGER") {
        if (!canManageDeptOvertime(row)) return false;
        // Keep matrix as final guard so manager's own OT routes to HR Manager.
        return canApproveByMatrix({
          requesterEmployeeNumber: row.employee?.employee_number,
          actorEmployeeNumber: currentUser.employeeNumber,
          requestType: "overtime",
        });
      }

      if (currentUser.role === "HR_MANAGER") {
        const allowed = new Set([
          "DEPARTMENT_MANAGER",
          "MANAGER",
          "HR_ADMIN",
          "HR_STAFF",
          "AUDITOR",
          "SYSTEM_ADMIN",
          "SUPER_ADMIN",
        ]);
        return allowed.has(requesterRole);
      }

      if (currentUser.role === "EXECUTIVE") {
        return requesterRole === "HR_MANAGER";
      }

      if (currentUser.role === "HR_ADMIN") {
        return requesterRole === "EXECUTIVE";
      }

      return false;
    },
    [canManageDeptOvertime, currentUser.employeeId, currentUser.employeeNumber, currentUser.role]
  );

  const visibleRows = rows.filter((row) => {
    const requesterRole = normalizeRoleOrTitle(row);
    if (currentUser.role === "DEPARTMENT_MANAGER") {
      return canManageDeptOvertime(row) || row.employee_id === currentUser.employeeId;
    }
    if (currentUser.role === "HR_MANAGER") {
      const allowed = new Set([
        "DEPARTMENT_MANAGER",
        "MANAGER",
        "HR_ADMIN",
        "HR_STAFF",
        "AUDITOR",
        "SYSTEM_ADMIN",
        "SUPER_ADMIN",
      ]);
      // Keep self excluded, but don't hide rows when requester role metadata is unavailable.
      // RLS already limits what HR Manager can read; action buttons remain strict below.
      return row.employee_id !== currentUser.employeeId && (allowed.has(requesterRole) || !requesterRole);
    }
    if (currentUser.role === "EXECUTIVE") {
      return row.employee_id !== currentUser.employeeId && requesterRole === "HR_MANAGER";
    }
    if (currentUser.role === "HR_ADMIN") {
      return row.employee_id !== currentUser.employeeId && requesterRole === "EXECUTIVE";
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
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Overtime Requests</h2>
        <p className="text-sm text-muted-foreground">
          Employees can submit their own requests. Assigned approvers can approve or reject.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
        {listError ? (
          <p className="p-4 text-sm text-destructive">{listError}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Start Time</th>
                <th className="px-4 py-3 font-medium">End Time</th>
                <th className="px-4 py-3 font-medium">Total OT Hours</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Loading requests…
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    No overtime requests to show.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => {
                  const name = row.employee ? employeeDisplayName(row.employee) : "—";
                  const employeeNo = row.employee?.employee_number ?? row.employee?.employee_code ?? "-";
                  const requesterRole = normalizeRoleOrTitle(row);
                  const showActions = canActOn(row);
                  const totalOtMins = minutesBetween(row.date, row.start_time, row.end_time);
                  const totalOtHours = `${(totalOtMins / 60).toFixed(1)}h`;
                  return (
                    <tr key={row.id} className="border-t border-border/60 transition-colors hover:bg-muted/20">
                      <td className="px-4 py-3 text-foreground">
                        <div className="font-medium">{name}</div>
                        <div className="text-xs text-muted-foreground">{employeeNo}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{roleLabel(requesterRole)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatRequestDate(row.date)}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatPgTime(row.start_time)}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatPgTime(row.end_time)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{totalOtHours}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.category || "Regular OT"}</td>
                      <td className="max-w-[320px] px-4 py-3 text-muted-foreground">
                        <span className="line-clamp-2">{row.reason?.trim() ? row.reason : "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <AttendanceRequestStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {showActions ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              className="rounded-md"
                              onClick={() => openDialog(row.id, "APPROVED")}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="rounded-md"
                              onClick={() => openDialog(row.id, "REJECTED")}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
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
        title={dialogMode === "APPROVED" ? "Approve overtime" : "Reject overtime"}
        description={
          dialogMode === "APPROVED"
            ? "This will mark the request as approved for payroll and attendance."
            : "The employee will be notified that this overtime request was rejected."
        }
        confirmLabel={dialogMode === "APPROVED" ? "Confirm approval" : "Confirm rejection"}
        confirmVariant={dialogMode === "REJECTED" ? "destructive" : "default"}
        onConfirm={async (remarks) => {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData.session?.access_token;
          if (!token) throw new Error("You must be signed in to perform this action.");
          if (!activeRequestId) throw new Error("No request selected.");
          const res = await approveOvertime(token, {
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
