"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { employees } from "@/lib/mock";
import { getPayrollPreviewRows, PAYROLL_PERIOD_OPTIONS } from "@/features/payroll/services/payroll-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ClipboardCheck, Eye } from "lucide-react";
import { loadExportRuns } from "@/features/payroll/services/payrollExportRuns";

export function HrManagerPayrollIntegrationOverview() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const runs = loadExportRuns();
  const pendingRun = runs.find((r) => r.approvalStatus === "Pending Approval") ?? runs[0];

  const currentPeriod =
    (pendingRun &&
      PAYROLL_PERIOD_OPTIONS.find(
        (o) => o.start === pendingRun.periodStart && o.end === pendingRun.periodEnd
      )) ??
    PAYROLL_PERIOD_OPTIONS[0];

  const activeCount = employees.filter((e) => e.employmentStatus === "ACTIVE").length;
  const includedCount = pendingRun?.employeeCount ?? activeCount;

  const sample = getPayrollPreviewRows();
  const sampleGross = sample.reduce((s, r) => s + r.basicPay + r.overtime + r.allowances, 0);
  const sampleDeductions = sample.reduce((s, r) => s + r.deductions, 0);
  const sampleNet = sample.reduce((s, r) => s + r.netPay, 0);

  const scale = Math.max(1, includedCount / Math.max(1, sample.length));
  const totalGross = Math.round(sampleGross * scale);
  const totalDeductions = Math.round(sampleDeductions * scale);
  const totalNet = Math.round(sampleNet * scale);

  const exportedExists = runs.some((r) => r.approvalStatus === "Exported");
  const approvedExists = runs.some((r) => r.approvalStatus === "Approved");
  const pendingApprovalExists = runs.some(
    (r) =>
      (r.approvalStatus ?? (r.status === "FAILED" ? "Rejected" : "Pending Approval")) ===
      "Pending Approval"
  );

  const overviewStatusLabel = exportedExists
    ? "Exported"
    : approvedExists
      ? "Approved"
      : pendingApprovalExists
        ? "Ready for Approval"
        : "Pending Validation";

  const statusBadge =
    overviewStatusLabel === "Ready for Approval"
      ? { label: overviewStatusLabel, variant: "secondary" as const }
      : overviewStatusLabel === "Exported" || overviewStatusLabel === "Approved"
        ? { label: overviewStatusLabel, variant: "default" as const }
        : { label: overviewStatusLabel, variant: "destructive" as const };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">PAYROLL INTEGRATION (HR Manager View)</h2>
        <p className="text-sm text-muted-foreground">
          Review payroll readiness and approve exports (demo UI).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payroll status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{currentPeriod?.label ?? "—"}</p>
              <p className="text-xs text-muted-foreground">
                Cutoff: {currentPeriod?.start} → {currentPeriod?.end}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary cards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total employees included</p>
                <p className="text-2xl font-semibold tabular-nums">{includedCount}</p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total gross pay (estimated)</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ₱{totalGross.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total deductions</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ₱{totalDeductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Net payroll cost</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ₱{totalNet.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="size-4 text-amber-600" />
            Alerts / issues
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
            5 employees missing attendance
          </p>
          <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-muted-foreground">
            3 pending overtime approvals
          </p>
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
            Export validation failed
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" asChild className="gap-2">
          <Link href={`${paths.payroll}?tab=export`}>
            <ClipboardCheck className="size-4" />
            Review Payroll Outputs
          </Link>
        </Button>
        <Button type="button" variant="outline" asChild className="gap-2">
          <Link href={`${paths.payroll}?tab=export`} aria-label="View issues">
            <Eye className="size-4" />
            View Issues
          </Link>
        </Button>
      </div>
    </div>
  );
}

