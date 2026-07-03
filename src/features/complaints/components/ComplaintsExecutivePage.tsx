"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { TrendingUp } from "lucide-react";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "INVESTIGATED"
  | "FURTHER_INVESTIGATION_REQUIRED"
  | "INVESTIGATION_COMPLETED"
  | "RESOLVED"
  | "WITHDRAWN"
  | "ESCALATED";

type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type StoredComplaint = {
  id: string;
  title?: string;
  description?: string;
  type?: string;
  departmentName?: string;
  employeeName?: string;
  isAnonymous?: boolean;
  assignedHr?: string;
  status: ComplaintStatus | string;
  priority?: ComplaintPriority;
  submittedAt?: string;
  resolvedAt?: string;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaints(): StoredComplaint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredComplaint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function daysBetween(start?: string, end?: string) {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diffMs = e.getTime() - s.getTime();
  return diffMs <= 0 ? 0 : diffMs / (1000 * 60 * 60 * 24);
}

export default function ExecutiveComplaintsPage() {
  const { user } = useCurrentUser();
  const { theme } = useTheme();
  const complaintsCardClass = cn(
    "rounded-2xl shadow-sm",
    theme === "dark"
      ? "border-none bg-[#1B223D] text-slate-50"
      : "border border-[#c8d4e6] bg-[#e3eaf4] text-[#192853]"
  );
  const kpiCardClass = cn(
    "rounded-2xl shadow-sm border border-[#26335f] bg-[#1B2447] text-slate-100"
  );
  const analyticsCardClass = cn(
    "rounded-2xl shadow-sm",
    theme === "dark"
      ? "border border-[#2e3d62] bg-[#1B223D]"
      : "border border-[#c8d4e6] bg-[#e3eaf4]"
  );
  const [complaints] = useState<StoredComplaint[]>(() => loadComplaints());

  const metrics = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((c) => c.status === "RESOLVED").length;
    const pending = complaints.filter(
      (c) => c.status !== "RESOLVED" && c.status !== "WITHDRAWN",
    ).length;
    const highPriority = complaints.filter(
      (c) => c.priority === "HIGH" || c.priority === "URGENT",
    ).length;

    const resolutionTimes: number[] = [];
    const byDeptCount: Record<string, number> = {};
    const byDeptResolution: Record<string, number[]> = {};

    for (const c of complaints) {
      const dept = c.departmentName || "Unspecified";
      byDeptCount[dept] = (byDeptCount[dept] ?? 0) + 1;

      if (c.status === "RESOLVED") {
        const days = daysBetween(c.submittedAt, c.resolvedAt);
        if (days != null) {
          resolutionTimes.push(days);
          if (!byDeptResolution[dept]) byDeptResolution[dept] = [];
          byDeptResolution[dept].push(days);
        }
      }
    }

    const avgResolution =
      resolutionTimes.length === 0
        ? null
        : resolutionTimes.reduce((s, d) => s + d, 0) / resolutionTimes.length;

    const deptSummary = Object.entries(byDeptCount)
      .map(([dept, count]) => {
        const times = byDeptResolution[dept] ?? [];
        const avgDept =
          times.length === 0 ? null : times.reduce((s, d) => s + d, 0) / times.length;
        return {
          department: dept,
          count,
          avgResolutionDays: avgDept,
        };
      })
      .sort((a, b) => b.count - a.count);

    const maxDeptCount = deptSummary[0]?.count ?? 0;
    const maxAvgResolutionDays = deptSummary.reduce((max, d) => {
      if (d.avgResolutionDays == null) return max;
      return Math.max(max, d.avgResolutionDays);
    }, 0);

    return {
      total,
      resolved,
      pending,
      highPriority,
      avgResolution,
      deptSummary,
      maxDeptCount,
      maxAvgResolutionDays,
    };
  }, [complaints]);

  // Only allow EXECUTIVE, SUPER_ADMIN, and BOARD to see this high-level view
  if (
    user.role !== "EXECUTIVE" &&
    user.role !== "SUPER_ADMIN" &&
    user.role !== "BOARD"
  ) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaints – Executive View
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              This high-level complaints analytics dashboard is reserved for Executive and
              Board roles.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const topDepts = metrics.deptSummary.slice(0, 5);

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-4">
      {/* Topbar + navbar – match HR Staff Complaints layout */}
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search complaints..." />
        <EmployeeSectionHeader
          title="Complaints"
          description="High-level, privacy-safe view of complaint trends. No employee names or case details are shown."
        />




      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className={kpiCardClass}>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-300">Total Complaints</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card className={kpiCardClass}>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-300">Resolved</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.resolved}</p>
          </CardContent>
        </Card>
        <Card className={kpiCardClass}>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-300">Pending</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.pending}</p>
          </CardContent>
        </Card>
        <Card className={kpiCardClass}>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-300">Avg Resolution Time</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">
              {metrics.avgResolution == null ? "—" : `${metrics.avgResolution.toFixed(1)}d`}
            </p>
          </CardContent>
        </Card>
        <Card className={kpiCardClass}>
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-300">High Priority (High / Urgent)</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{metrics.highPriority}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Complaints by department */}
        <Card className={analyticsCardClass}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base font-semibold">
              Complaints by department (this period)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            {topDepts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No complaint data available yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topDepts.map((dept) => {
                  const ratio =
                    metrics.maxDeptCount === 0
                      ? 0
                      : Math.max(0.12, dept.count / metrics.maxDeptCount);
                  return (
                    <div key={dept.department} className="grid grid-cols-[180px_minmax(0,1fr)_36px] items-center gap-3">
                      <span className={cn("truncate text-sm", theme === "dark" ? "text-slate-100" : "text-slate-900")}>
                        {dept.department}
                      </span>
                      <div
                        className={cn(
                          "h-2 overflow-hidden rounded-full",
                          theme === "dark" ? "bg-slate-700/70" : "bg-slate-200/90"
                        )}
                      >
                        <div
                          className={cn(
                            "h-2 rounded-full bg-linear-to-r transition-[width] duration-500",
                            theme === "dark"
                              ? "from-[#FFE14E] via-[#FFD84A] to-[#FACC15]"
                              : "from-[#192853] via-[#24396a] to-[#2b457f]",
                          )}
                          style={{ width: `${ratio * 100}%` }}
                        />
                      </div>
                      <span
                        className={cn(
                          "text-right text-sm",
                          theme === "dark" ? "text-slate-100" : "text-[#192853]"
                        )}
                      >
                        {dept.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Average resolution time per department */}
        <Card className={analyticsCardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Avg resolution time by department
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1">
            {topDepts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No resolved complaints yet to calculate resolution times.
              </p>
            ) : (
              <div className="space-y-2.5">
                {topDepts.map((dept) => (
                  <div
                    key={dept.department}
                    className="grid grid-cols-[180px_minmax(0,1fr)_64px] items-center gap-3"
                  >
                    <span className={cn("truncate text-sm", theme === "dark" ? "text-slate-100" : "text-slate-900")}>
                      {dept.department}
                    </span>
                    <div
                      className={cn(
                        "h-2 overflow-hidden rounded-full",
                        theme === "dark" ? "bg-slate-700/70" : "bg-slate-200/90"
                      )}
                    >
                      <div
                        className={cn(
                          "h-2 rounded-full bg-linear-to-r transition-[width] duration-500",
                          theme === "dark"
                            ? "from-[#FFE14E] via-[#FFD84A] to-[#FACC15]"
                            : "from-[#192853] via-[#24396a] to-[#2b457f]",
                        )}
                        style={{
                          width:
                            dept.avgResolutionDays == null || metrics.maxAvgResolutionDays === 0
                              ? "0%"
                              : `${Math.max(
                                  12,
                                  (dept.avgResolutionDays / metrics.maxAvgResolutionDays) * 100
                                )}%`,
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-right text-sm",
                        theme === "dark" ? "text-slate-100" : "text-[#192853]"
                      )}
                    >
                      {dept.avgResolutionDays == null
                        ? "—"
                        : `${dept.avgResolutionDays.toFixed(1)}d`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend / insight note */}
        <Card className={complaintsCardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="size-4" />
            Executive Insight
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This dashboard is designed for strategic oversight only. It intentionally
            hides employee identities and case-level details, focusing instead on trends,
            volumes, and resolution performance across the organization.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
