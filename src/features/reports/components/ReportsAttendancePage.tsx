"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { employees, departments, type EmploymentType, type Employee } from "@/lib/mock";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/ThemeProvider";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import { Search, Sun, Moon } from "lucide-react";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";

function formatEmploymentType(type?: EmploymentType): string {
  if (!type) return "—";
  const map: Record<EmploymentType, string> = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    CONTRACT: "Contract",
    INTERNSHIP: "Internship",
    PROBATION: "Probationary",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function formatEmploymentStatus(status: Employee["employmentStatus"]): string {
  if (status === "ACTIVE") return "Active";
  if (status === "ONBOARDING") return "Onboarding";
  if (status === "OFFBOARDED") return "Offboarded";
  return status;
}

function formatDate(date: string): string {
  if (!date) return "—";
  return new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    month: "numeric",
    day: "2-digit",
    year: "numeric",
  });
}

type EmploymentStatus = Employee["employmentStatus"];

const EMPLOYMENT_TYPES: EmploymentType[] = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "INTERNSHIP",
  "PROBATION",
];

const EMPLOYMENT_STATUSES: EmploymentStatus[] = ["ACTIVE", "ONBOARDING", "OFFBOARDED"];

export default function AttendanceReportsPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { theme, toggleTheme } = useTheme();
  const searchParams = useSearchParams();
  const [query] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<EmploymentType | "">("");
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | "">("");
  const [hiredFrom, setHiredFrom] = useState<string>("");
  const [newHiresDept, setNewHiresDept] = useState<string>("");
  const [newHiresType, setNewHiresType] = useState<EmploymentType | "">("");
  const [newHiresFrom, setNewHiresFrom] = useState<string>("");
  const [newHiresTo, setNewHiresTo] = useState<string>("");

  const reportKey = searchParams.get("report");
  const isEmployeeList = !reportKey || reportKey === "employee-list";
  const isNewHires = reportKey === "new-hires";

  const headerTitleByReport: Record<string, string> = {
    "employee-list": "Employee List Report",
    "new-hires": "New Hires Report",
    "employee-status": "Employee Status Report",
    "employee-leave-summary": "Employee Leave Summary",
    "department-leave-summary": "Department Leave Summary",
    "leave-balance": "Leave Balance Report",
    "workflow-request": "Workflow Request Report",
  };

  const headerTitle =
    headerTitleByReport[reportKey ?? "employee-list"] ?? "Employee List Report";

  const deptById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) {
      map.set(d.id, d.name);
    }
    return map;
  }, []);

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    for (const e of employees) {
      map.set(e.id, e);
    }
    return map;
  }, []);

  const rows = useMemo(() => {
    const base = employees.map((e) => ({
      employeeId: e.employeeNumber,
      name: `${e.firstName} ${e.lastName}`,
      department: deptById.get(e.departmentId) ?? "—",
      position: e.jobTitle,
      employmentType: formatEmploymentType(e.employmentType),
      employmentStatus: formatEmploymentStatus(e.employmentStatus),
      hireDate: formatDate(e.startDate),
      workEmail: e.email,
      contactNumber: e.personalPhone ?? "—",
      _departmentId: e.departmentId,
      _employmentType: e.employmentType,
      _employmentStatus: e.employmentStatus as EmploymentStatus,
      _startDate: e.startDate,
    }));

    let filtered = base;

    if (departmentFilter) {
      filtered = filtered.filter((row) => row._departmentId === departmentFilter);
    }
    if (typeFilter) {
      filtered = filtered.filter((row) => row._employmentType === typeFilter);
    }
    if (statusFilter) {
      filtered = filtered.filter((row) => row._employmentStatus === statusFilter);
    }
    if (hiredFrom) {
      const from = new Date(hiredFrom + "T00:00:00").getTime();
      filtered = filtered.filter((row) => {
        if (!row._startDate) return false;
        const d = new Date(row._startDate + "T00:00:00").getTime();
        return d >= from;
      });
    }

    const q = query.trim().toLowerCase();
    if (!q) {
      return filtered;
    }
    return filtered.filter((row) => {
      return (
        row.employeeId.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.position.toLowerCase().includes(q) ||
        row.workEmail.toLowerCase().includes(q)
      );
    });
  }, [deptById, departmentFilter, typeFilter, statusFilter, hiredFrom, query]);

  const newHiresRows = useMemo(() => {
    let base = employees;

    if (newHiresDept) {
      base = base.filter((e) => e.departmentId === newHiresDept);
    }
    if (newHiresType) {
      base = base.filter((e) => e.employmentType === newHiresType);
    }
    if (newHiresFrom) {
      const from = new Date(newHiresFrom + "T00:00:00").getTime();
      base = base.filter((e) => {
        if (!e.startDate) return false;
        const d = new Date(e.startDate + "T00:00:00").getTime();
        return d >= from;
      });
    }
    if (newHiresTo) {
      const to = new Date(newHiresTo + "T23:59:59").getTime();
      base = base.filter((e) => {
        if (!e.startDate) return false;
        const d = new Date(e.startDate + "T00:00:00").getTime();
        return d <= to;
      });
    }

    return base.map((e) => {
      const manager = e.managerId ? employeeById.get(e.managerId) : undefined;
      const managerName = manager
        ? `${manager.firstName} ${manager.lastName}`
        : "—";
      return {
        employeeId: e.employeeNumber,
        name: `${e.firstName} ${e.lastName}`,
        department: deptById.get(e.departmentId) ?? "—",
        position: e.jobTitle,
        employmentType: formatEmploymentType(e.employmentType),
        hireDate: formatDate(e.startDate),
        manager: managerName,
      };
    });
  }, [deptById, employeeById, newHiresDept, newHiresType, newHiresFrom, newHiresTo]);

  const canViewReports =
    user.role === "SUPER_ADMIN" ||
    user.role === "HR_ADMIN" ||
    user.role === "HR_MANAGER" ||
    user.role === "HR_STAFF" ||
    user.role === "DEPARTMENT_MANAGER";

  if (!canViewReports) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          HR Reports
        </h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              You do not have permission to view HR reports.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNewHires) {
    return (
      <div className="space-y-6 -mt-2">
        {/* Topbar + navbar for HR Reports (matches Complaints layout) */}
        <div className="space-y-3">
          {/* Top row: breadcrumb, search bar, and right-side icons */}
          <div className="flex items-center gap-4">
            {/* Breadcrumb on the left */}
            <div className="flex flex-1 items-center gap-1.5 text-base text-muted-foreground">
              <span className="font-semibold">HR Reports</span>
              <span className="opacity-70">&gt;</span>
              <span className="font-semibold text-foreground">{headerTitle}</span>
            </div>

            {/* Centered search bar */}
            <div className="hidden">
              <div className="w-full max-w-lg">
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
                  <Search className="size-5 opacity-70" />
                  <input
                    type="text"
                    placeholder="Search HR reports..."
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:border-transparent topbar-search-input"
                  />
                </div>
              </div>
            </div>

            {/* Icons on the right */}
            <div className="flex-1 flex justify-end items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </Button>
              <NotificationsBellMenu iconClassName="size-5" />
              <SettingsIconLink iconClassName="size-5" />
              <TopbarAccountMenu />
            </div>
          </div>

          {/* HR Reports navbar */}
          <div className="flex items-center gap-4 border-b border-slate-200/70 pb-1 text-sm text-slate-600 overflow-x-auto scrollbar-hide">
            <Link
              href={`${paths.reportsAttendance}?report=employee-list`}
              className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
                isEmployeeList
                  ? "border-[#192853] text-[#192853] font-semibold"
                  : "border-transparent hover:text-[#111827]"
              }`}
            >
              Employee List Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=new-hires`}
              className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
                isNewHires
                  ? "border-[#192853] text-[#192853] font-semibold"
                  : "border-transparent hover:text-[#111827]"
              }`}
            >
              New Hires Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=employee-status`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Employee Status Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=employee-leave-summary`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Employee Leave Summary
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=department-leave-summary`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Department Leave Summary
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=leave-balance`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Leave Balance Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=workflow-request`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Workflow Request Report
            </Link>
          </div>

          {/* Filters row for New Hires */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Date hired (from)
              </label>
              <Input
                type="date"
                value={newHiresFrom}
                onChange={(e) => setNewHiresFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Date hired (to)
              </label>
              <Input
                type="date"
                value={newHiresTo}
                onChange={(e) => setNewHiresTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Department
              </label>
              <select
                value={newHiresDept}
                onChange={(e) => setNewHiresDept(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Employment Type
              </label>
              <select
                value={newHiresType}
                onChange={(e) => setNewHiresType(e.target.value as EmploymentType | "")}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All types</option>
                {EMPLOYMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {formatEmploymentType(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              New hires ({newHiresRows.length})
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              List of employees hired within the selected period.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-border overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-hide">
              <Table scrollable={false}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Employment Type</TableHead>
                    <TableHead>Hire Date</TableHead>
                    <TableHead>Manager / Supervisor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newHiresRows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-mono text-xs">
                        {row.employeeId}
                      </TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.department}</TableCell>
                      <TableCell>{row.position}</TableCell>
                      <TableCell>{row.employmentType}</TableCell>
                      <TableCell>{row.hireDate}</TableCell>
                      <TableCell>{row.manager}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isEmployeeList) {
    return (
      <div className="space-y-6 -mt-2">
        {/* Topbar + navbar reused for unsupported reports */}
        <div className="space-y-3 mt-[10px]">
          <div className="flex items-center gap-4">
            <div className="flex flex-1 items-center gap-1.5 text-base text-muted-foreground">
              <span className="font-semibold">HR Reports</span>
              <span className="opacity-70">&gt;</span>
              <span className="font-semibold text-foreground">{headerTitle}</span>
            </div>
            <div className="hidden">
              <div className="w-full max-w-lg">
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
                  <Search className="size-5 opacity-70" />
                  <input
                    type="text"
                    placeholder="Search HR reports..."
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:border-transparent topbar-search-input"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 flex justify-end items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </Button>
              <NotificationsBellMenu iconClassName="size-5" />
              <SettingsIconLink iconClassName="size-5" />
              <TopbarAccountMenu />
            </div>
          </div>
          <div className="flex items-center gap-4 border-b border-slate-200/70 pb-1 text-sm text-slate-600 overflow-x-auto scrollbar-hide">
            <Link
              href={`${paths.reportsAttendance}?report=employee-list`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Employee List Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=new-hires`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              New Hires Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=employee-status`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Employee Status Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=employee-leave-summary`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Employee Leave Summary
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=department-leave-summary`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Department Leave Summary
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=leave-balance`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Leave Balance Report
            </Link>
            <Link
              href={`${paths.reportsAttendance}?report=workflow-request`}
              className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
            >
              Workflow Request Report
            </Link>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report not available</CardTitle>
            <CardDescription>
              Only the Employee List and New Hires reports are available in this demo. Other HR reports will be added later.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 -mt-2">
      {/* Shared topbar + navbar for Employee List */}
      <div className="space-y-3 mt-[10px]">
        {user.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader title={headerTitle} />
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex flex-1 items-center gap-1.5 text-base text-muted-foreground">
              <span className="font-semibold">HR Reports</span>
              <span className="opacity-70">&gt;</span>
              <span className="font-semibold text-foreground">{headerTitle}</span>
            </div>
            <div className="hidden">
              <div className="w-full max-w-lg">
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
                  <Search className="size-5 opacity-70" />
                  <input
                    type="text"
                    placeholder="Search HR reports..."
                    className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:border-transparent topbar-search-input"
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 flex justify-end items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={toggleTheme}
                aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
              >
                {theme === "dark" ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
              </Button>
              <NotificationsBellMenu iconClassName="size-5" />
              <SettingsIconLink iconClassName="size-5" />
              <TopbarAccountMenu />
            </div>
          </div>
        )}

        <div className="flex items-center gap-4 border-b border-slate-200/70 pb-1 text-sm text-slate-600 overflow-x-auto scrollbar-hide">
          <Link
            href={`${paths.reportsAttendance}?report=employee-list`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              isEmployeeList
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            Employee List Report
          </Link>
          <Link
            href={`${paths.reportsAttendance}?report=new-hires`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              isNewHires
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            New Hires Report
          </Link>
          <Link
            href={`${paths.reportsAttendance}?report=employee-status`}
            className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
          >
            Employee Status Report
          </Link>
          <Link
            href={`${paths.reportsAttendance}?report=employee-leave-summary`}
            className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
          >
            Employee Leave Summary
          </Link>
          <Link
            href={`${paths.reportsAttendance}?report=department-leave-summary`}
            className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
          >
            Department Leave Summary
          </Link>
          <Link
            href={`${paths.reportsAttendance}?report=leave-balance`}
            className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
          >
            Leave Balance Report
          </Link>
          <Link
            href={`${paths.reportsAttendance}?report=workflow-request`}
            className="px-3 py-1.5 border-b-2 text-xs sm:text-sm border-transparent hover:text-[#111827]"
          >
            Workflow Request Report
          </Link>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Employment Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as EmploymentType | "")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All types</option>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatEmploymentType(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Employment Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as EmploymentStatus | "")}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All statuses</option>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {formatEmploymentStatus(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Date hired (from)
            </label>
            <Input
              type="date"
              value={hiredFrom}
              onChange={(e) => setHiredFrom(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </div>

        <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Employees ({rows.length})</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Filter or export this table once connected to your live employee database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-hide">
            <Table scrollable={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Employment Type</TableHead>
                  <TableHead>Employment Status</TableHead>
                  <TableHead>Hire Date</TableHead>
                  <TableHead>Work Email</TableHead>
                  <TableHead>Contact Number</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-mono text-xs">{row.employeeId}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.department}</TableCell>
                    <TableCell>{row.position}</TableCell>
                    <TableCell>{row.employmentType}</TableCell>
                    <TableCell>{row.employmentStatus}</TableCell>
                    <TableCell>{row.hireDate}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.workEmail}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.contactNumber}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
