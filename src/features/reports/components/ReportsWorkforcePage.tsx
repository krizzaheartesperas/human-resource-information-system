"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { employees, departments, type Department, type Employee } from "@/lib/mock";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme/ThemeProvider";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import { Search, Sun, Moon } from "lucide-react";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";

type DepartmentWithCount = {
  id: string;
  name: string;
  headcount: number;
};

type PositionWithCount = {
  title: string;
  headcount: number;
};

export default function WorkforceAnalyticsPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const searchParams = useSearchParams();
  const { theme, toggleTheme } = useTheme();

  const totalEmployees = employees.length;
  const totalDepartments = departments.length;

  const byDepartment: DepartmentWithCount[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of employees) {
      counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1);
    }
    const result: DepartmentWithCount[] = departments.map((d: Department) => ({
      id: d.id,
      name: d.name,
      headcount: counts.get(d.id) ?? 0,
    }));
    return result.sort((a, b) => b.headcount - a.headcount);
  }, []);

  const [deptSearch, setDeptSearch] = useState("");
  const [deptSort, setDeptSort] = useState<"headcount" | "name">("headcount");

  const visibleDepartments = useMemo(() => {
    let rows = byDepartment;
    const q = deptSearch.trim().toLowerCase();
    if (q) {
      rows = rows.filter((row) => row.name.toLowerCase().includes(q));
    }
    if (deptSort === "name") {
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      rows = [...rows].sort((a, b) => b.headcount - a.headcount);
    }
    return rows;
  }, [byDepartment, deptSearch, deptSort]);

  const panel = searchParams.get("panel") ?? "dept-distribution";

  const panelTitleByKey: Record<string, string> = {
    "dept-distribution": "Employee Distribution by Department",
    "position-distribution": "Employee Distribution by Position",
    "leave-trends": "Leave Usage Trends",
    "monthly-leave-requests": "Monthly Leave Requests",
    "workforce-growth": "Workforce Growth Trend",
  };

  const headerTitle = panelTitleByKey[panel] ?? "Employee Distribution by Department";

  const byPosition: PositionWithCount[] = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of employees as Employee[]) {
      const key = e.jobTitle || "—";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const result: PositionWithCount[] = Array.from(counts.entries()).map(
      ([title, headcount]) => ({ title, headcount })
    );
    return result.sort((a, b) => b.headcount - a.headcount);
  }, []);

  const canViewWorkforce =
    user.role === "SUPER_ADMIN" ||
    user.role === "HR_ADMIN" ||
    user.role === "HR_MANAGER" ||
    user.role === "HR_STAFF" ||
    user.role === "DEPARTMENT_MANAGER";

  if (!canViewWorkforce) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Workforce Analytics
        </h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              You do not have permission to view workforce analytics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 -mt-2">
      {/* Topbar + navbar (similar to Organization / Departments layout) */}
      <div className="space-y-3 mt-[10px]">
        {user.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader title={headerTitle} />
          </div>
        ) : (
          <>
            {/* Top row */}
            <div className="flex items-center gap-4">
              {/* Breadcrumb */}
              <div className="flex flex-1 items-center gap-1.5 text-base text-muted-foreground">
                <span className="font-semibold">Workforce Analytics</span>
                <span className="opacity-70">&gt;</span>
                <span className="font-semibold text-foreground">{headerTitle}</span>
              </div>

              {/* Center search bar */}
              <div className="hidden">
                <div className="w-full max-w-lg">
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
                    <Search className="size-5 opacity-70" />
                    <input
                      type="text"
                      placeholder="Search workforce analytics..."
                      className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:border-transparent topbar-search-input"
                    />
                  </div>
                </div>
              </div>

              {/* Right icons + account menu */}
              <div className="flex-1 flex justify-end items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
                  aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                >
                  {theme === "dark" ? (
                    <Sun className="size-5" />
                  ) : (
                    <Moon className="size-5" />
                  )}
                </button>
                <NotificationsBellMenu iconClassName="size-5" />
                <SettingsIconLink iconClassName="size-5" />
                <TopbarAccountMenu />
              </div>
            </div>
          </>
        )}

        {/* Workforce Analytics navbar */}
        <div className="flex items-center gap-4 border-b border-slate-200/70 pb-1 text-sm text-slate-600 overflow-x-auto scrollbar-hide">
          <Link
            href={`${paths.reportsWorkforce}?panel=dept-distribution`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              panel === "dept-distribution"
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            Employee Distribution by Department
          </Link>
          <Link
            href={`${paths.reportsWorkforce}?panel=position-distribution`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              panel === "position-distribution"
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            Employee Distribution by Position
          </Link>
          <Link
            href={`${paths.reportsWorkforce}?panel=leave-trends`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              panel === "leave-trends"
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            Leave Usage Trends
          </Link>
          <Link
            href={`${paths.reportsWorkforce}?panel=monthly-leave-requests`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              panel === "monthly-leave-requests"
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            Monthly Leave Requests
          </Link>
          <Link
            href={`${paths.reportsWorkforce}?panel=workforce-growth`}
            className={`px-3 py-1.5 border-b-2 text-xs sm:text-sm ${
              panel === "workforce-growth"
                ? "border-[#192853] text-[#192853] font-semibold"
                : "border-transparent hover:text-[#111827]"
            }`}
          >
            Workforce Growth Trend
          </Link>
        </div>
      </div>

      {/* Employee Distribution by Department */}
      {panel === "dept-distribution" && (
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle>Employee Distribution by Department</CardTitle>
              <CardDescription>
                Headcount per department based on the current employee list.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Total employees</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {totalEmployees}
                </span>
              </div>
              <div className="h-8 w-px bg-border" />
              <div className="flex flex-col">
                <span className="text-muted-foreground">Departments</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {totalDepartments}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full max-w-xs">
              <Input
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                placeholder="Search department..."
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <span className="text-muted-foreground">Sort by:</span>
              <button
                type="button"
                onClick={() => setDeptSort("headcount")}
                className={`rounded-full px-3 py-1 ${
                  deptSort === "headcount"
                    ? "bg-[#192853] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Headcount
              </button>
              <button
                type="button"
                onClick={() => setDeptSort("name")}
                className={`rounded-full px-3 py-1 ${
                  deptSort === "name"
                    ? "bg-[#192853] text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                Department name
              </button>
            </div>
          </div>

          <div className="rounded-md border border-border overflow-x-auto max-h-[320px] overflow-y-auto scrollbar-hide">
            <Table scrollable={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-32 text-right">Employees</TableHead>
                  <TableHead className="w-1/2">Share of workforce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleDepartments.map((row) => {
                  const percent =
                    totalEmployees > 0 ? Math.round((row.headcount / totalEmployees) * 100) : 0;
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.headcount}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-slate-100">
                            <div
                              className="h-2 rounded-full bg-[#192853]"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-12 text-xs text-muted-foreground tabular-nums text-right">
                            {percent}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Employee Distribution by Position */}
      {panel === "position-distribution" && (
      <Card>
        <CardHeader>
          <CardTitle>Employee Distribution by Position</CardTitle>
          <CardDescription>
            Top roles in the company and how many employees are in each position.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto max-h-[320px] overflow-y-auto scrollbar-hide">
            <Table scrollable={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Position</TableHead>
                  <TableHead className="w-32 text-right">Employees</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPosition.slice(0, 12).map((row) => (
                  <TableRow key={row.title}>
                    <TableCell>{row.title}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.headcount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This is an initial snapshot. Future versions can add filters for department, location,
            and employment type.
          </p>
        </CardContent>
      </Card>
      )}

      {/* Leave Usage Trends – placeholder */}
      {panel === "leave-trends" && (
      <Card>
        <CardHeader>
          <CardTitle>Leave Usage Trends</CardTitle>
          <CardDescription>
            A high-level placeholder for tracking how employees use leave over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This section will eventually display charts showing monthly leave usage,
            most common leave types, and peak leave periods. For now, it describes the
            intended analysis so designers and stakeholders can validate the layout.
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Monthly trend of approved leave days vs. available leave balance.</li>
            <li>Top departments with the highest leave utilization.</li>
            <li>Seasonality (for example, spikes around holidays and year-end).</li>
          </ul>
        </CardContent>
      </Card>
      )}

      {/* Monthly Leave Requests – placeholder */}
      {panel === "monthly-leave-requests" && (
      <Card>
        <CardHeader>
          <CardTitle>Monthly Leave Requests</CardTitle>
          <CardDescription>
            Initial copy for a future dashboard summarizing how many requests are submitted each month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            In a full implementation, this panel will draw from the leave request data model
            and show how many requests were submitted, approved, and rejected per month.
          </p>
          <p className="text-sm text-muted-foreground">
            Use this area to review volumes, spot processing bottlenecks, and plan staffing
            during periods with high time-off requests.
          </p>
        </CardContent>
      </Card>
      )}

      {/* Workforce Growth Trend – placeholder */}
      {panel === "workforce-growth" && (
      <Card>
        <CardHeader>
          <CardTitle>Workforce Growth Trend</CardTitle>
          <CardDescription>
            Placeholder content for tracking overall headcount growth over time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This panel will eventually plot headcount month by month based on hire dates and
            termination records. It is useful for understanding whether the organization is
            growing, shrinking, or staying stable.
          </p>
          <p className="text-sm text-muted-foreground">
            Future enhancements can also show trends by department and employment type
            (for example, full-time vs. contractors).
          </p>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

