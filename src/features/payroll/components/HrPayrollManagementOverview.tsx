"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { employees } from "@/lib/mock";
import { PAYROLL_PERIOD_OPTIONS, getPayrollPreviewRows } from "@/features/payroll/services/payroll-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ClipboardCheck, Upload } from "lucide-react";

/**
 * HR payroll overview (demo data).
 * Shows operational snapshot + totals + alerts + quick actions.
 */
export function HrPayrollManagementOverview({
  viewRole = "HR_STAFF",
}: {
  viewRole?: "HR_STAFF" | "HR_ADMIN" | "EXECUTIVE";
}) {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const currentPeriod = PAYROLL_PERIOD_OPTIONS[0];

  const activeCount = employees.filter((e) => e.employmentStatus === "ACTIVE").length;
  const sample = getPayrollPreviewRows();

  const sampleGross = sample.reduce((s, r) => s + r.basicPay + r.overtime + r.allowances, 0);
  const sampleDeductions = sample.reduce((s, r) => s + r.deductions, 0);
  const sampleNet = sample.reduce((s, r) => s + r.netPay, 0);

  const scale = Math.max(1, activeCount / sample.length);

  const totalGross = Math.round(sampleGross * scale);
  const totalDeductions = Math.round(sampleDeductions * scale);
  const totalNet = Math.round(sampleNet * scale);
  const profile =
    viewRole === "HR_ADMIN"
    ? {
        title: "PAYROLL INTEGRATION (HR Admin View)",
        subtitle: "For HR Admin governance and oversight (demo).",
        status: "Ready for approval",
        gross: Math.round(totalGross * 1.04),
        deductions: Math.round(totalDeductions * 1.03),
        net: Math.round(totalNet * 1.05),
        alertA: "2 payroll batches are waiting final HR Admin validation.",
        alertB: "1 export is blocked by unresolved approval note.",
      }
    : viewRole === "EXECUTIVE"
      ? {
          title: "PAYROLL OVERVIEW (Executive View)",
          subtitle: "Executive-level payroll visibility for decision support (demo).",
          status: "Completed",
          gross: Math.round(totalGross * 1.08),
          deductions: Math.round(totalDeductions * 1.01),
          net: Math.round(totalNet * 1.09),
          alertA: "Payroll release completed for current cycle.",
          alertB: "No critical payroll exceptions reported.",
        }
    : {
        title: "PAYROLL MANAGEMENT (HR Staff View)",
        subtitle: "For HR Staff as payroll processor (demo).",
        status: "Processing",
        gross: totalGross,
        deductions: totalDeductions,
        net: totalNet,
        alertA: "3 employees have pending overtime approval before this period can close.",
        alertB: "2 employees are missing attendance records for the current cutoff window.",
      };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{profile.title}</h2>
        <p className="text-sm text-muted-foreground">{profile.subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Current payroll period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">{currentPeriod?.label ?? "—"}</p>
            <p className="text-xs text-muted-foreground">
              Cutoff: {currentPeriod?.start} → {currentPeriod?.end}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Payroll status</span>
              <Badge variant="secondary">{profile.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Summary (estimated run)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total employees in payroll</p>
                <p className="text-2xl font-semibold tabular-nums">{activeCount}</p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total gross pay</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ₱{profile.gross.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total deductions</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ₱{profile.deductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                <p className="text-xs text-slate-300">Total net pay</p>
                <p className="text-2xl font-semibold tabular-nums">
                  ₱{profile.net.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
            Alerts (missing data, pending approvals)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
            {profile.alertA}
          </p>
          <p className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-muted-foreground">
            {profile.alertB}
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" asChild>
          <Link href={`${paths.payroll}?tab=export&exportStep=validate`} className="gap-2">
            <ClipboardCheck className="size-4" />
            Validate payroll
          </Link>
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={`${paths.payroll}?tab=export&exportStep=prepare`} className="gap-2">
            <Upload className="size-4" />
            Go to export
          </Link>
        </Button>
      </div>
    </div>
  );
}

