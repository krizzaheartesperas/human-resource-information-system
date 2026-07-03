"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye } from "lucide-react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { employees, getDepartmentById } from "@/lib/mock";
import { PAYROLL_PERIOD_OPTIONS } from "@/features/payroll/services/payroll-data";

export function DepartmentManagerTeamPayrollOverview() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);

  const team = useMemo(
    () =>
      employees.filter(
        (e) => e.departmentId === user.departmentId && e.employmentStatus !== "OFFBOARDED"
      ),
    [user.departmentId]
  );

  const currentPeriod = PAYROLL_PERIOD_OPTIONS[0];
  const departmentName = getDepartmentById(user.departmentId)?.name ?? "Your department";

  const metrics = useMemo(() => {
    const totalTeamMembers = team.length;
    const totalPaidEmployees = team.filter((e) => e.employmentStatus === "ACTIVE").length;
    const payrollStatus =
      totalPaidEmployees === totalTeamMembers ? "Completed" : "Processing";
    const notIncludedCount = Math.max(0, totalTeamMembers - totalPaidEmployees);

    return {
      totalTeamMembers,
      totalPaidEmployees,
      payrollStatus,
      notIncludedCount,
    };
  }, [team]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Team Payroll (Department Manager)</h2>
        <p className="text-sm text-muted-foreground">
          Team-scope visibility only for <strong>{departmentName}</strong>.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payroll info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium">{currentPeriod.label}</p>
            <p className="text-xs text-muted-foreground">
              Cutoff: {currentPeriod.start} - {currentPeriod.end}
            </p>
            <p className="text-xs text-muted-foreground">
              Status: <span className="font-medium text-foreground">{metrics.payrollStatus}</span>
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary cards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total team members</p>
                <p className="text-2xl font-semibold tabular-nums">{metrics.totalTeamMembers}</p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total paid employees</p>
                <p className="text-2xl font-semibold tabular-nums">{metrics.totalPaidEmployees}</p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Payroll status</p>
                <p className="text-2xl font-semibold tabular-nums">{metrics.payrollStatus}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600" />
            Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
            {metrics.notIncludedCount > 0
              ? `${metrics.notIncludedCount} employees not yet included in payroll`
              : "All team employees are included in payroll"}
          </p>
          {metrics.payrollStatus === "Processing" ? (
            <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-muted-foreground">
              Payroll is still processing for this period.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div>
        <Button type="button" asChild>
          <Link href={`${paths.payroll}?tab=payslips`} className="gap-2">
            <Eye className="size-4" />
            View Team Payslips
          </Link>
        </Button>
      </div>
    </div>
  );
}

