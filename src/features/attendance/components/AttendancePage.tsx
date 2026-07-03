"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { useAttendancePage } from "@/features/attendance/hooks/useAttendancePage";
import { AttendanceCorrectionDialog } from "@/features/attendance/components/AttendanceCorrectionDialog";
import { AttendanceCorrectionsTable } from "@/features/attendance/components/AttendanceCorrectionsTable";
import { AttendanceHistoryTable } from "@/features/attendance/components/AttendanceHistoryTable";
import { AttendanceSummaryCards } from "@/features/attendance/components/AttendanceSummaryCards";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { canAccessTeamTime } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/mock";
import { TeamCorrectionRequestsTable } from "@/features/attendance/components/team-time/teamCorrectionRequestsTable";
import { TeamOvertimeRequestsTable } from "@/features/attendance/components/team-time/teamOvertimeRequestsTable";
import { employeeDisplayName } from "@/features/attendance/components/team-time/employeeDisplayName";
import { supabase } from "@/lib/supabase/client";
import { demoUsersByRole, getDemoNameForEmail } from "@/lib/mock";

type TeamStatus = "present" | "late" | "missing" | "overtime";
type TeamAttendanceRow = {
  id: string;
  isCurrentUser: boolean;
  employee: string;
  employeeNumber: string;
  department: string;
  status: TeamStatus;
  timeIn: string | null;
  timeOut: string | null;
};

type TeamTimecardStatus = "present" | "late" | "missing" | "ot";
type TeamTimecardRow = {
  id: string;
  employeeId: string | null;
  isCurrentUser: boolean;
  employee: string;
  employeeNumber: string;
  department: string;
  date: string;
  timeIn: string | null;
  timeOut: string | null;
  workedHours: string;
  ot: string;
  status: TeamTimecardStatus;
  breakDeducted: string;
  lateMinutes: string;
  undertimeMinutes: string;
};

type TeamAttendanceDbRow = {
  id: string;
  employee_id: string | null;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string | null;
  total_late_minutes: number | null;
  total_undertime_minutes: number | null;
  total_overtime_minutes: number | null;
  created_at: string | null;
};

type TeamEmployeeDisplay = {
  name: string;
  department: string;
  employeeNumber: string;
  departmentId: string | null;
};

function isLikelyUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function combineName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${(firstName ?? "").trim()} ${(lastName ?? "").trim()}`.trim();
}

/** Map `attendance.status` (Supabase) to Timecards badge — matches CSV values like PRESENT, LATE, OVERTIME. */
function timecardStatusFromAttendanceRow(row: TeamAttendanceDbRow): TeamTimecardStatus {
  const raw = (row.status ?? "").trim().toUpperCase();
  if (raw === "LATE") return "late";
  if (raw === "OVERTIME" || raw === "OT") return "ot";
  if (raw === "ABSENT" || raw === "MISSING") return "missing";
  if (!row.clock_in && !row.clock_out) return "missing";
  const lateMins = Number(row.total_late_minutes ?? 0);
  const otMins = Number(row.total_overtime_minutes ?? 0);
  if (otMins > 0) return "ot";
  if (lateMins > 0) return "late";
  return "present";
}

function formatTime12(value: string | null): string | null {
  if (!value) return null;
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw ?? 0);
  if (Number.isNaN(h) || Number.isNaN(m)) return value;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function todayKeyLocal() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function minutesBetween(date: string, start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(`${date}T${start}`);
  let e = new Date(`${date}T${end}`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  if (e < s) {
    e = new Date(e.getTime() + 24 * 60 * 60 * 1000);
  }
  return Math.max(0, Math.floor((e.getTime() - s.getTime()) / 60000));
}

function formatIsoDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
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
        "rounded-xl border border-border bg-card text-card-foreground p-6 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <SoftCard className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </SoftCard>
  );
}

function TeamStatusBadge({ status }: { status: TeamStatus }) {
  const map: Record<TeamStatus, { label: string; className: string }> = {
    present: {
      label: "Present",
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
    overtime: {
      label: "Overtime",
      className:
        "bg-orange-500/15 text-orange-900 ring-orange-500/30 dark:text-orange-100 dark:ring-orange-400/35",
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

function TimecardStatusBadge({ status }: { status: TeamTimecardStatus }) {
  const map: Record<TeamTimecardStatus, { label: string; className: string }> = {
    present: {
      label: "Present",
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
    ot: {
      label: "OT",
      className:
        "bg-orange-500/15 text-orange-900 ring-orange-500/30 dark:text-orange-100 dark:ring-orange-400/35",
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

function TeamTimeModule({ currentUser }: { currentUser: CurrentUser }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const canSeeTimecardsTab = [
    "DEPARTMENT_MANAGER",
    "MANAGER",
    "HR_STAFF",
    "HR_ADMIN",
    "HR_MANAGER",
    "AUDITOR",
    "EXECUTIVE",
    "SUPER_ADMIN",
  ].includes(currentUser.role);
  const canSeeOvertimeRequestsTab = ["DEPARTMENT_MANAGER", "MANAGER", "HR_MANAGER", "EXECUTIVE", "HR_ADMIN"].includes(
    currentUser.role
  );
  const canSeeAttendanceReviewTab = ["HR_STAFF", "HR_MANAGER", "HR_ADMIN"].includes(currentUser.role);
  const canEditTeamTimecards = !["AUDITOR", "EXECUTIVE"].includes(currentUser.role);

  const activeTab =
    tabParam === "timecards"
      ? canSeeTimecardsTab
        ? "timecards"
        : "overview"
      : tabParam === "overtime-requests"
        ? canSeeOvertimeRequestsTab
          ? "overtime-requests"
          : "overview"
        : tabParam === "attendance-review"
          ? canSeeAttendanceReviewTab
            ? "attendance-review"
            : "overview"
          : "overview";

  const selectedEmployee = searchParams.get("employee");
  const selectedDate = searchParams.get("date");
  const selectedStatus = (searchParams.get("status") ?? "all").toLowerCase();
  const selectedDepartment = searchParams.get("dept") ?? "";

  const [expandedTimecardId, setExpandedTimecardId] = useState<string | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<TeamAttendanceDbRow[]>([]);
  const [employeeNames, setEmployeeNames] = useState<Map<string, TeamEmployeeDisplay>>(new Map());
  const [pendingCorrectionsCount, setPendingCorrectionsCount] = useState(0);
  const [loadingTeamData, setLoadingTeamData] = useState(true);
  const [hasLoadedTeamData, setHasLoadedTeamData] = useState(false);
  const [timecardPage, setTimecardPage] = useState(1);
  const TIMECARD_PAGE_SIZE = 25;

  const setTab = (next: "overview" | "timecards" | "overtime-requests" | "attendance-review") => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", next);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const setSelectedDate = (nextDate: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (nextDate) {
      q.set("date", nextDate);
    } else {
      q.delete("date");
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const setQueryParam = (key: string, value: string | null) => {
    const q = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && value !== "__all__") q.set(key, value);
    else q.delete(key);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const employeeFilterOptions = useMemo(() => {
    const ids = Array.from(
      new Set(attendanceRows.map((r) => r.employee_id).filter((id): id is string => Boolean(id)))
    );
    return ids
      .map((id) => {
        const meta = employeeNames.get(id);
        return {
          id,
          label: meta ? `${meta.name} · ${meta.employeeNumber}` : id,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [attendanceRows, employeeNames]);

  const departmentFilterOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of attendanceRows) {
      if (!row.employee_id) continue;
      const m = employeeNames.get(row.employee_id);
      if (m?.department && m.department !== "—") names.add(m.department);
    }
    return Array.from(names).sort();
  }, [attendanceRows, employeeNames]);

  const loadTeamData = useCallback(async () => {
    setLoadingTeamData(true);
    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 120);
    const lookbackDate = lookback.toISOString().slice(0, 10);

    const attendanceQuery = supabase
      .from("attendance")
      .select(
        "id, employee_id, date, clock_in, clock_out, status, total_late_minutes, total_undertime_minutes, total_overtime_minutes, created_at"
      )
      .gte("date", lookbackDate)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    const pendingCorrectionsQuery = supabase
      .from("attendance_correction_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING");

    const [{ data: attData, error: attErr }, { count: pendingCorrectionsCountResult }] = await Promise.all([
      attendanceQuery,
      pendingCorrectionsQuery,
    ]);

    if (attErr) {
      console.warn("Team Time attendance load failed:", attErr.message);
      setAttendanceRows([]);
      setEmployeeNames(new Map());
      setPendingCorrectionsCount(pendingCorrectionsCountResult ?? 0);
      setLoadingTeamData(false);
      return;
    }

    const sortedRows = (attData ?? []) as TeamAttendanceDbRow[];

    const employeeIds = Array.from(
      new Set(sortedRows.map((row) => row.employee_id).filter((id): id is string => Boolean(id)))
    );

    let peopleMap = new Map<string, TeamEmployeeDisplay>();

    if (employeeIds.length) {
      const { data: employeesData } = await supabase
        .from("employees")
        .select("id, first_name, last_name, full_name, name, employee_number, employee_code, email, department_id")
        .in("id", employeeIds);

      const deptIds = Array.from(
        new Set((employeesData ?? []).map((e) => e.department_id).filter((id): id is string => Boolean(id)))
      );
      let deptMap = new Map<string, string>();
      if (deptIds.length) {
        const { data: departments } = await supabase.from("departments").select("id, name").in("id", deptIds);
        deptMap = new Map((departments ?? []).map((d) => [d.id, d.name]));
      }

      const nextMap = new Map<string, TeamEmployeeDisplay>();
      for (const e of employeesData ?? []) {
        const empNo =
          (((e as { employee_number?: string | null }).employee_number ?? "") ||
            ((e as { employee_code?: string | null }).employee_code ?? "")).trim();
        const name = employeeDisplayName({
          first_name: (e as { first_name?: string | null }).first_name ?? null,
          last_name: (e as { last_name?: string | null }).last_name ?? null,
          full_name: (e as { full_name?: string | null }).full_name ?? null,
          name: (e as { name?: string | null }).name ?? null,
          employee_number: (e as { employee_number?: string | null }).employee_number ?? null,
          employee_code: (e as { employee_code?: string | null }).employee_code ?? null,
          email: (e as { email?: string | null }).email ?? null,
          id: (e as { id: string }).id,
        });
        const depId = ((e as { department_id?: string | null }).department_id ?? null) as string | null;
        const department = depId ? (deptMap.get(depId) ?? "—") : "—";
        nextMap.set((e as { id: string }).id, {
          name,
          department,
          employeeNumber: empNo || "-",
          departmentId: depId,
        });
      }
      peopleMap = nextMap;

      // Fallback for hosted schemas where direct employees query is partially restricted:
      // use /api/employees hydration endpoint (same auth user) to resolve names/EMP numbers.
      if (peopleMap.size < employeeIds.length) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const accessToken = session?.access_token ?? "";
        if (accessToken) {
          try {
            const res = await fetch("/api/employees?includeAuthEmail=1", {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) {
              const json = (await res.json()) as {
                employees?: Array<{
                  id: string;
                  firstName?: string;
                  lastName?: string;
                  employeeNumber?: string;
                  departmentId?: string;
                  jobTitle?: string;
                }>;
              };
              const apiEmployees = (json.employees ?? []).filter((e) => employeeIds.includes(e.id));
              const missingDeptIds = Array.from(
                new Set(
                  apiEmployees
                    .map((e) => (e.departmentId ?? "").trim())
                    .filter((v): v is string => Boolean(v && !deptMap.has(v)))
                )
              );
              if (missingDeptIds.length) {
                const { data: missingDepts } = await supabase
                  .from("departments")
                  .select("id, name")
                  .in("id", missingDeptIds);
                for (const d of missingDepts ?? []) deptMap.set(d.id, d.name);
              }
              for (const e of apiEmployees) {
                if (peopleMap.has(e.id)) continue;
                const empNo = (e.employeeNumber ?? "").trim();
                const name = employeeDisplayName({
                  first_name: e.firstName ?? null,
                  last_name: e.lastName ?? null,
                  employee_number: e.employeeNumber ?? null,
                  employee_code: e.employeeNumber ?? null,
                  id: e.id,
                });
                const depId = (e.departmentId ?? "").trim() || null;
                peopleMap.set(e.id, {
                  name,
                  department: depId ? (deptMap.get(depId) ?? "—") : "—",
                  employeeNumber: empNo || "-",
                  departmentId: depId,
                });
              }
            }
          } catch {
            // No-op fallback; table still renders with attendance metrics.
          }
        }
      }
    }

    const isManagerView = currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "MANAGER";
    const managerDeptId = (currentUser.departmentId ?? "").trim();
    const scopedRows = isManagerView
      ? sortedRows.filter((row) => {
          if (!row.employee_id) return false;
          const info = peopleMap.get(row.employee_id);
          if (!info?.departmentId || !managerDeptId) return false;
          return info.departmentId === managerDeptId;
        })
      : sortedRows;

    setEmployeeNames(peopleMap);
    setAttendanceRows(scopedRows);
    setPendingCorrectionsCount(pendingCorrectionsCountResult ?? 0);
    setLoadingTeamData(false);
    setHasLoadedTeamData(true);
  }, [currentUser.departmentId, currentUser.employeeId, currentUser.role]);

  useEffect(() => {
    const shouldLoad = activeTab === "overview" || activeTab === "timecards";
    if (!shouldLoad || hasLoadedTeamData) return;
    void loadTeamData();
  }, [activeTab, hasLoadedTeamData, loadTeamData]);

  const teamAttendanceToday = useMemo<TeamAttendanceRow[]>(() => {
    const today = todayKeyLocal();
    return attendanceRows
      .filter((row) => row.date === today)
      .map((row) => {
        const person = row.employee_id ? employeeNames.get(row.employee_id) : undefined;
        const raw = (row.status ?? "").trim().toUpperCase();
        const missing = !row.clock_in && !row.clock_out;
        const overtime =
          raw === "OVERTIME" || raw === "OT" || Number(row.total_overtime_minutes ?? 0) > 0;
        const late = raw === "LATE" || Number(row.total_late_minutes ?? 0) > 0;
        const status: TeamStatus = missing ? "missing" : overtime ? "overtime" : late ? "late" : "present";
        return {
          id: row.id,
          isCurrentUser: row.employee_id === currentUser.employeeId,
          employee: person?.name ?? "—",
          employeeNumber: person?.employeeNumber ?? "-",
          department: person?.department ?? "—",
          status,
          timeIn: formatTime12(row.clock_in),
          timeOut: formatTime12(row.clock_out),
        };
      });
  }, [attendanceRows, currentUser.employeeId, employeeNames]);

  const timecards = useMemo<TeamTimecardRow[]>(() => {
    const mapped = attendanceRows.map((row) => {
      const person = row.employee_id ? employeeNames.get(row.employee_id) : undefined;
      const grossMins = minutesBetween(row.date, row.clock_in, row.clock_out);
      const breakMins = grossMins >= 360 ? 60 : 0;
      const workedMins = Math.max(0, grossMins - breakMins);
      const overtimeMins = Math.max(0, Number(row.total_overtime_minutes ?? 0));
      const lateMins = Math.max(0, Number(row.total_late_minutes ?? 0));
      const undertimeMins = Math.max(0, Number(row.total_undertime_minutes ?? 0));
      const status = timecardStatusFromAttendanceRow(row);
      return {
        id: row.id,
        employeeId: row.employee_id,
        isCurrentUser: row.employee_id === currentUser.employeeId,
        employee: person?.name ?? "—",
        employeeNumber: person?.employeeNumber ?? "-",
        department: person?.department ?? "—",
        date: row.date,
        timeIn: formatTime12(row.clock_in),
        timeOut: formatTime12(row.clock_out),
        workedHours: `${(workedMins / 60).toFixed(1)}h`,
        ot: `${(overtimeMins / 60).toFixed(1)}h`,
        status,
        breakDeducted: `${Math.floor(breakMins / 60)}h`,
        lateMinutes: `${lateMins} mins`,
        undertimeMinutes: `${undertimeMins} mins`,
      };
    });

    return mapped
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((row) => {
        if (selectedEmployee) {
          if (isLikelyUuid(selectedEmployee)) {
            if (row.employeeId !== selectedEmployee) return false;
          } else if (row.employee !== selectedEmployee) {
            return false;
          }
        }
        if (selectedDate && row.date !== selectedDate) return false;
        if (selectedStatus !== "all" && row.status !== selectedStatus) return false;
        if (selectedDepartment && row.department !== selectedDepartment) return false;
        return true;
      });
  }, [
    attendanceRows,
    currentUser.employeeId,
    employeeNames,
    selectedEmployee,
    selectedDate,
    selectedStatus,
    selectedDepartment,
  ]);

  const timecardTotalPages = Math.max(1, Math.ceil(timecards.length / TIMECARD_PAGE_SIZE));
  const safeTimecardPage = Math.min(timecardPage, timecardTotalPages);
  const paginatedTimecards = useMemo(
    () => timecards.slice((safeTimecardPage - 1) * TIMECARD_PAGE_SIZE, safeTimecardPage * TIMECARD_PAGE_SIZE),
    [timecards, safeTimecardPage]
  );

  useEffect(() => {
    setTimecardPage(1);
  }, [selectedEmployee, selectedDate, selectedStatus, selectedDepartment]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search team attendance" />
        <EmployeeSectionHeader
          title="Time & Attendance"
          tabs={[
            { id: "overview", label: "Overview" },
            ...(canSeeTimecardsTab ? [{ id: "timecards" as const, label: "Timecards" }] : []),
            ...(canSeeOvertimeRequestsTab
              ? [{ id: "overtime-requests" as const, label: "Overtime Requests" }]
              : []),
            ...(canSeeAttendanceReviewTab
              ? [{ id: "attendance-review" as const, label: "Attendance Review" }]
              : []),
          ]}
          activeTab={activeTab}
          onTabChange={(id) =>
            setTab(
              id as
                | "overview"
                | "timecards"
                | "overtime-requests"
                | "attendance-review"
            )
          }
        />
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Team Time Overview
            </h2>
            <p className="text-sm text-muted-foreground">
              Monitor employee attendance, issues, and activity in real time
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Total Employees"
              value={String(new Set(attendanceRows.map((r) => r.employee_id).filter(Boolean)).size)}
            />
            <MetricCard
              label="Present Today"
              value={String(
                teamAttendanceToday.filter((r) => r.status === "present" || r.status === "late" || r.status === "overtime")
                  .length
              )}
            />
            <MetricCard label="Late" value={String(teamAttendanceToday.filter((r) => r.status === "late").length)} />
            <MetricCard label="Missing Logs" value={String(pendingCorrectionsCount)} />
            <MetricCard
              label="On Overtime"
              value={String(teamAttendanceToday.filter((r) => r.status === "overtime").length)}
            />
          </div>
          <SoftCard className="p-0 overflow-hidden">
            <div className="border-b border-border/70 px-6 py-4">
              <h3 className="text-sm font-semibold text-foreground">Today&apos;s Attendance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[900px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3">Time Out</th>
                  </tr>
                </thead>
                <tbody>
                  {(loadingTeamData ? [] : teamAttendanceToday).map((row) => (
                    <tr key={row.id} className="border-t border-border/60 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{row.employee}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.department}</td>
                      <td className="px-4 py-3">
                        <TeamStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {row.timeIn ?? "--"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {row.timeOut ?? "--"}
                      </td>
                    </tr>
                  ))}
                  {!loadingTeamData && teamAttendanceToday.length === 0 ? (
                    <tr className="border-t border-border/60">
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                        No attendance records for today.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SoftCard>
        </div>
      )}

      {activeTab === "timecards" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Employee Timecards
            </h2>
            <p className="text-sm text-muted-foreground">
              View and manage all attendance records
            </p>
          </div>
          <SoftCard className="p-0 overflow-hidden">
            <div className="border-b border-border/70 p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input
                  type="date"
                  value={selectedDate ?? ""}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                />
                <select
                  value={selectedDepartment || "__all__"}
                  onChange={(e) => setQueryParam("dept", e.target.value === "__all__" ? null : e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="__all__">All departments</option>
                  {departmentFilterOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedStatus === "all" ? "all" : selectedStatus}
                  onChange={(e) => setQueryParam("status", e.target.value === "all" ? null : e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All status</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="missing">Missing</option>
                  <option value="ot">OT</option>
                </select>
                <select
                  value={selectedEmployee || "__all__"}
                  onChange={(e) => setQueryParam("employee", e.target.value === "__all__" ? null : e.target.value)}
                  className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="__all__">All employees</option>
                  {employeeFilterOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {(selectedEmployee || selectedDate || selectedDepartment || selectedStatus !== "all") && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Filters: date {selectedDate || "any"}
                  {selectedDepartment ? ` · dept ${selectedDepartment}` : ""}
                  {selectedStatus !== "all" ? ` · status ${selectedStatus}` : ""}
                  {selectedEmployee ? ` · employee ${selectedEmployee}` : ""}.
                </p>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Time In</th>
                    <th className="px-4 py-3">Time Out</th>
                    <th className="px-4 py-3">Worked Hours</th>
                    <th className="px-4 py-3">OT</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(loadingTeamData ? [] : paginatedTimecards).map((row) => {
                    const expanded = expandedTimecardId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className="cursor-pointer border-t border-border/60 hover:bg-muted/20"
                          onClick={() =>
                            setExpandedTimecardId((prev) => (prev === row.id ? null : row.id))
                          }
                        >
                          <td className="px-4 py-3 text-foreground">
                            <div className="font-medium">
                              {row.employee}
                              {row.isCurrentUser ? " (You)" : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">{row.employeeNumber}</div>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            <div className="flex items-center gap-2">
                              {expanded ? (
                                <ChevronUp className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              )}
                              {formatIsoDate(row.date)}
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {row.timeIn ?? "--"}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-muted-foreground">
                            {row.timeOut ?? "--"}
                          </td>
                          <td className="px-4 py-3">{row.workedHours}</td>
                          <td className="px-4 py-3">{row.ot}</td>
                          <td className="px-4 py-3">
                            <TimecardStatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" className="rounded-sm">
                                View Details
                              </Button>
                              {canEditTeamTimecards ? (
                                <Button size="sm" className="rounded-sm">
                                  Adjust Time
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        <tr className="border-t border-border/40">
                          <td colSpan={8} className="p-0">
                            <div
                              className={cn(
                                "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                                expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                              )}
                            >
                              <div className="overflow-hidden bg-muted/20">
                                <div className="grid gap-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                                  <p>
                                    <span className="text-muted-foreground">Break Deducted:</span>{" "}
                                    <span className="font-semibold">{row.breakDeducted}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Worked Hours:</span>{" "}
                                    <span className="font-semibold">{row.workedHours}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Overtime:</span>{" "}
                                    <span className="font-semibold">{row.ot}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Late:</span>{" "}
                                    <span className="font-semibold">{row.lateMinutes}</span>
                                  </p>
                                  <p>
                                    <span className="text-muted-foreground">Undertime:</span>{" "}
                                    <span className="font-semibold">{row.undertimeMinutes}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                  {!loadingTeamData && timecards.length === 0 ? (
                    <tr className="border-t border-border/60">
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No timecards found for the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {timecards.length > TIMECARD_PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-border/70 px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {((safeTimecardPage - 1) * TIMECARD_PAGE_SIZE) + 1}–{Math.min(safeTimecardPage * TIMECARD_PAGE_SIZE, timecards.length)} of {timecards.length}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeTimecardPage <= 1}
                    onClick={() => setTimecardPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="px-2 text-sm text-muted-foreground">
                    Page {safeTimecardPage} of {timecardTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeTimecardPage >= timecardTotalPages}
                    onClick={() => setTimecardPage(p => Math.min(timecardTotalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </SoftCard>
        </div>
      )}

      {activeTab === "overtime-requests" && <TeamOvertimeRequestsTable currentUser={currentUser} />}

      {activeTab === "attendance-review" && <TeamCorrectionRequestsTable currentUser={currentUser} />}
    </div>
  );
}

export default function AttendancePage() {
  const { user: currentUser } = useCurrentUser();
  const canSeeTeamTime = canAccessTeamTime(currentUser.role);
  const {
    isEmployee,
    history,
    summary,
    corrections,
    tablesReady,
    correctionOpen,
    setCorrectionOpen,
    correctionDate,
    setCorrectionDate,
    correctionType,
    setCorrectionType,
    correctionReason,
    setCorrectionReason,
    correctionProofUrl,
    setCorrectionProofUrl,
    error,
    handleSubmitCorrection,
  } = useAttendancePage();

  if (canSeeTeamTime) {
    return <TeamTimeModule currentUser={currentUser} />;
  }

  return (
    <div className="space-y-6 -mt-2">
      <section className="mt-[10px] space-y-4" aria-label="Attendance">
        {isEmployee || currentUser.role === "HR_STAFF" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title={
                isEmployee
                  ? "My Attendance"
                  : currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE"
                    ? "Time & Attendance"
                    : "Attendance"
              }
              actions={
                isEmployee ? (
                  <Button size="sm" onClick={() => setCorrectionOpen(true)}>
                    Submit attendance correction
                  </Button>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Attendance</h1>
            </div>
          </div>
        )}

        <AttendanceSummaryCards summary={summary} />
        <AttendanceHistoryTable history={history} tablesReady={tablesReady} />
      </section>

      {isEmployee && (
        <>
          <AttendanceCorrectionsTable corrections={corrections} tablesReady={tablesReady} />
          <AttendanceCorrectionDialog
            open={correctionOpen}
            onOpenChange={setCorrectionOpen}
            correctionDate={correctionDate}
            setCorrectionDate={setCorrectionDate}
            correctionType={correctionType}
            setCorrectionType={setCorrectionType}
            correctionReason={correctionReason}
            setCorrectionReason={setCorrectionReason}
            correctionProofUrl={correctionProofUrl}
            setCorrectionProofUrl={setCorrectionProofUrl}
            error={error}
            onSubmit={handleSubmitCorrection}
          />
        </>
      )}
    </div>
  );
}
