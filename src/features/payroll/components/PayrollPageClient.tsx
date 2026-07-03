"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { PayrollExportWizard, type ExportStep } from "@/features/payroll/components/PayrollExportWizard";
import { PayslipsTab } from "@/features/payroll/components/PayslipsTab";
import { HrAllEmployeesPayslipsTab } from "@/features/payroll/components/HrAllEmployeesPayslipsTab";
import { HrPayrollManagementOverview } from "@/features/payroll/components/HrPayrollManagementOverview";
import { HrManagerPayrollIntegrationOverview } from "@/features/payroll/components/HrManagerPayrollIntegrationOverview";
import { DepartmentManagerTeamPayrollOverview } from "@/features/payroll/components/DepartmentManagerTeamPayrollOverview";
import { PayrollConfigurationTab } from "@/features/payroll/components/PayrollConfigurationTab";
import { PayrollActivityLogsTab } from "@/features/payroll/components/PayrollActivityLogsTab";
import { HrManagerPayrollOutputsApprovalTab } from "@/features/payroll/components/HrManagerPayrollOutputsApprovalTab";
import { DepartmentManagerTeamPayslipsTab } from "@/features/payroll/components/DepartmentManagerTeamPayslipsTab";
import { MyPayslipDashboard } from "@/features/employees/components/MyPayslipDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getDepartmentById, type Role } from "@/lib/mock";
import { PAYSLIPS } from "@/features/payroll/services/payroll-data";
import {
  loadExportRuns,
  updateExportRun,
  seedExportRunsIfEmpty,
  type PayrollExportRun,
} from "@/features/payroll/services/payrollExportRuns";
import { logPayrollExportExported, logPayrollUnauthorizedAttempt } from "@/features/payroll/services/payrollAudit";
import { cn } from "@/lib/utils";
import {
  canSeeTab,
  canUseMockRuns,
  MAIN_TABS,
  parseExportStep,
  parseMainTab,
  roleMockRuns,
  type MainTab,
} from "@/features/payroll/services/payrollPageService";
import { ScrollText } from "lucide-react";

export default function PayrollPageClient() {
  const { user } = useCurrentUser();
  const router = useRouter();
  const sp = useSearchParams();
  const mode = sp.get("mode");
  const myPayslipsMode = mode === "my-payslips";
  const executiveOverviewQueryMode = mode === "payroll-overview";
  const rawTab = sp.get("tab");
  const hrIntegrationMode = user.role === "HR_STAFF" && !myPayslipsMode;
  const hrManagerIntegrationMode = user.role === "HR_MANAGER" && !myPayslipsMode;
  const systemAdminIntegrationMode = user.role === "SUPER_ADMIN" && !myPayslipsMode;
  const auditorNonMyPayslipMode = user.role === "AUDITOR" && !myPayslipsMode;
  const departmentManagerTeamMode = user.role === "DEPARTMENT_MANAGER" && !myPayslipsMode;
  const executivePayrollMode =
    user.role === "EXECUTIVE" && (executiveOverviewQueryMode || !myPayslipsMode);
  const tab = useMemo(() => {
    const parsed = parseMainTab(rawTab);
    if (systemAdminIntegrationMode && (!rawTab || parsed === "overview" || parsed === "payslips")) {
      return "export";
    }
    if (hrIntegrationMode && (!rawTab || parsed === "overview" || parsed === "payslips")) {
      return "export";
    }
    return parsed;
  }, [rawTab, hrIntegrationMode, systemAdminIntegrationMode]);
  const exportStep = useMemo(() => parseExportStep(sp.get("exportStep")), [sp]);
  const activityRunFilter = sp.get("run");
  const effectiveRole: Role = myPayslipsMode ? "EMPLOYEE" : user.role;
  const modeQuery = myPayslipsMode ? "&mode=my-payslips" : "";

  const [runs, setRuns] = useState<PayrollExportRun[]>(() => {
    seedExportRunsIfEmpty();
    const loaded = loadExportRuns();
    if (loaded.length > 0) return loaded;
    if (canUseMockRuns(user.role)) {
      return roleMockRuns(user.role, user.name, user.employeeId);
    }
    return [];
  });
  const [historyDetailRun, setHistoryDetailRun] = useState<PayrollExportRun | null>(null);
  const [historyNotesMode, setHistoryNotesMode] = useState(false);

  useEffect(() => {
    if (tab === "export" && !canSeeTab("export", effectiveRole)) {
      logPayrollUnauthorizedAttempt({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionAttempted: "Open Payroll Export tab",
      });
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
    if (departmentManagerTeamMode && (tab === "export" || tab === "activity" || tab === "config")) {
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
    if (executivePayrollMode && tab === "payslips") {
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
    if ((systemAdminIntegrationMode || auditorNonMyPayslipMode) && tab === "payslips") {
      logPayrollUnauthorizedAttempt({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionAttempted: "Open All-Employees Payslips tab",
      });
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
    if (tab === "config" && (hrManagerIntegrationMode || !canSeeTab("config", effectiveRole))) {
      logPayrollUnauthorizedAttempt({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionAttempted: "Open Payroll Configuration tab",
      });
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
    if (tab === "integration" && !canSeeTab("integration", effectiveRole)) {
      logPayrollUnauthorizedAttempt({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionAttempted: "Open Payroll Integration Settings tab",
      });
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
    if (tab === "activity" && !canSeeTab("activity", effectiveRole)) {
      logPayrollUnauthorizedAttempt({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        actionAttempted: "Open Payroll Activity Logs tab",
      });
      router.replace(`/payroll?tab=overview${modeQuery}`);
    }
  }, [
    tab,
    user.employeeId,
    user.name,
    user.role,
    router,
    effectiveRole,
    modeQuery,
    departmentManagerTeamMode,
    executivePayrollMode,
    auditorNonMyPayslipMode,
    hrManagerIntegrationMode,
    systemAdminIntegrationMode,
  ]);

  const HR_INTEGRATION_TAB_IDS: MainTab[] = ["export", "history", "activity"];
  const SYSTEM_ADMIN_INTEGRATION_TAB_IDS: MainTab[] = [
    "export",
    "history",
    "activity",
    "config",
    "integration",
  ];
  const visibleTabsBase = MAIN_TABS.filter((t) => canSeeTab(t.id, effectiveRole));
  const visibleTabs = executivePayrollMode
    ? visibleTabsBase
        .filter((t) => ["overview", "history", "activity"].includes(t.id))
        .map((t) => {
          if (t.id === "history") return { ...t, label: "Payroll Overview History" };
          return t;
        })
    : departmentManagerTeamMode
    ? visibleTabsBase
        .filter((t) => ["overview", "payslips"].includes(t.id))
        .map((t) => {
          if (t.id === "payslips") return { ...t, label: "Team Payslips" };
          return t;
        })
    : systemAdminIntegrationMode
    ? visibleTabsBase
        .filter((t) => SYSTEM_ADMIN_INTEGRATION_TAB_IDS.includes(t.id))
        .map((t) => {
          if (t.id === "export") return { ...t, label: "Payroll Outputs" };
          if (t.id === "history") return { ...t, label: "Export History" };
          if (t.id === "integration") return { ...t, label: "Integration Settings" };
          return t;
        })
    : auditorNonMyPayslipMode
    ? visibleTabsBase.filter((t) => ["history", "activity"].includes(t.id))
    : hrManagerIntegrationMode
    ? visibleTabsBase
        .filter((t) => ["overview", "export", "history", "activity"].includes(t.id))
        .map((t) => {
          if (t.id === "export") return { ...t, label: "Payroll Outputs (Approval View)" };
          if (t.id === "history") return { ...t, label: "Export History" };
          return t;
        })
    : hrIntegrationMode
      ? visibleTabsBase
          .filter((t) => HR_INTEGRATION_TAB_IDS.includes(t.id))
          .map((t) => {
            if (t.id === "export") return { ...t, label: "Payroll Outputs" };
            if (t.id === "history") return { ...t, label: "Export History" };
            return t;
          })
      : visibleTabsBase;

  const setTab = (next: MainTab) => {
    if (!canSeeTab(next, effectiveRole)) {
      router.replace(`/payroll?tab=overview${modeQuery}`);
      return;
    }
    const p = new URLSearchParams(sp.toString());
    p.set("tab", next);
    if (next !== "export") p.delete("exportStep");
    p.delete("run");
    router.push(`/payroll?${p.toString()}`);
  };

  const setExportStep = (step: ExportStep) => {
    const p = new URLSearchParams(sp.toString());
    p.set("tab", "export");
    p.set("exportStep", step);
    p.delete("run");
    router.push(`/payroll?${p.toString()}`);
  };

  if (myPayslipsMode) {
    return <MyPayslipDashboard />;
  }

  const headerTitle =
    tab === "overview"
      ? "Overview"
      : tab === "payslips"
        ? departmentManagerTeamMode
          ? "Team Payslips"
          : "Payslips"
        : tab === "export"
          ? hrManagerIntegrationMode
            ? "Payroll Outputs (Approval View)"
            : departmentManagerTeamMode
              ? "Team Payroll"
            : hrIntegrationMode
              ? "Payroll Outputs"
              : "Payroll Export"
          : tab === "history"
            ? hrManagerIntegrationMode
              ? "Export History"
              : hrIntegrationMode
                ? "Export History"
                : "Payroll History"
            : tab === "activity"
              ? "Payroll Activity Logs"
            : tab === "integration"
              ? "Integration Settings"
              : "Configuration";

  const ytdNet = PAYSLIPS.reduce((s, p) => s + p.netPay, 0);

  const activityRunHref = (runId: string) =>
    `/payroll?tab=activity&run=${encodeURIComponent(runId)}${modeQuery}`;

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <div className="min-w-0 space-y-3">
        {user.role === "EMPLOYEE" || user.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title="My Pay"
              titleClassName="text-3xl font-semibold tracking-tight"
              tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label }))}
              activeTab={tab}
              onTabChange={(id) => setTab(id as MainTab)}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Payroll</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">{headerTitle}</span>
                </>
              }
              searchPlaceholder="Search payroll..."
            />

            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                {visibleTabs.map((t) => {
                  const Icon = t.icon;
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base",
                        active
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-primary"
                      )}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{t.label}</span>
                      <span
                        className={cn(
                          "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200",
                          active ? "scale-x-100" : "scale-x-0"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {tab === "overview" &&
        (effectiveRole === "EMPLOYEE" ? (
          <section className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Payroll overview</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Employee profile: {user.name} · {user.employeeNumber || user.employeeId} · {user.jobTitle},{" "}
                  {getDepartmentById(user.departmentId)?.name ?? "Unknown department"}
                </p>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                  <p className="text-xs text-slate-300">Latest net pay (demo)</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    ₱
                    {PAYSLIPS[0]?.netPay.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    }) ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {PAYSLIPS[0]?.payPeriodLabel}
                  </p>
                </div>
                <div className="rounded-xl border border-[#26335f] bg-[#1B2447] p-4 text-slate-100">
                  <p className="text-xs text-slate-300">YTD net (sample list)</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    ₱{ytdNet.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                  <Button
                    type="button"
                    variant="link"
                    className="mt-2 h-auto p-0 text-sm"
                    asChild
                  >
                    <Link href={`/payroll?tab=payslips${modeQuery}`}>View payslips</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Activity &amp; traceability</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {canSeeTab("activity", effectiveRole) ? (
                  <>
                    <p>
                      Payslip views, exports, and validations are listed under{" "}
                      <strong>Payroll Activity Logs</strong> (payroll module only).
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <Link href={`/payroll?tab=activity${modeQuery}`}>
                        <ScrollText className="mr-2 size-4" />
                        Payroll Activity Logs
                      </Link>
                    </Button>
                  </>
                ) : (
                  <p>For payslip or payroll questions, contact your HR team.</p>
                )}
              </CardContent>
            </Card>
          </section>
        ) : departmentManagerTeamMode ? (
          <DepartmentManagerTeamPayrollOverview />
        ) : hrManagerIntegrationMode ? (
          <HrManagerPayrollIntegrationOverview />
        ) : (
          <HrPayrollManagementOverview
            viewRole={
              user.role === "HR_ADMIN"
                ? "HR_ADMIN"
                : user.role === "EXECUTIVE"
                  ? "EXECUTIVE"
                  : "HR_STAFF"
            }
          />
        ))}

      {tab === "payslips" &&
        !executivePayrollMode &&
        (effectiveRole === "EMPLOYEE" ? (
          <PayslipsTab mode="payslips" from={myPayslipsMode ? "my-payslips" : undefined} />
        ) : departmentManagerTeamMode ? (
          <DepartmentManagerTeamPayslipsTab />
        ) : (
          <HrAllEmployeesPayslipsTab />
        ))}

      {tab === "export" && canSeeTab("export", effectiveRole) && !departmentManagerTeamMode && (
        hrManagerIntegrationMode ? (
          <HrManagerPayrollOutputsApprovalTab />
        ) : (
          <PayrollExportWizard
            initialStep={exportStep}
            onStepChange={(s) => setExportStep(s)}
          />
        )
      )}

      {tab === "history" && (
        <div className="space-y-6">
          {!departmentManagerTeamMode &&
          !hrIntegrationMode &&
          !hrManagerIntegrationMode &&
          !systemAdminIntegrationMode ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Annual summary (demo)</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-semibold">2025</p>
                  <p className="text-xs text-muted-foreground">
                    Total net (listed payslips): ₱{ytdNet.toLocaleString("en-PH")}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Adjustment note: promotion and allowance changes appear in full payroll close (API).
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-semibold">Exports</p>
                  <p className="text-xs text-muted-foreground">
                    Use <strong>Payroll Export → Export Results</strong> for run IDs, or the table below.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!departmentManagerTeamMode ? (
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Export run history</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Trace who generated each file. Open activity logs for full payroll-only history.
                </p>
              </div>
              {canSeeTab("activity", effectiveRole) ? (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={`/payroll?tab=activity${modeQuery}`}>View activity</Link>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Period</TableHead>
                      {hrManagerIntegrationMode ? (
                        <>
                          <TableHead>Approved By</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </>
                      ) : systemAdminIntegrationMode ? (
                        <>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead>Generated by</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date</TableHead>
                        </>
                      )}
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{r.id}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{r.periodLabel}</TableCell>
                        {hrManagerIntegrationMode ? (
                          <>
                            <TableCell>{r.approvedBy ?? "—"}</TableCell>
                            <TableCell>
                              {(() => {
                                const ms =
                                  r.approvalStatus ??
                                  (r.status === "FAILED" ? "Rejected" : "Pending Approval");
                                const variant =
                                  ms === "Rejected" ? "destructive" : ms === "Pending Approval" ? "secondary" : "default";
                                return <Badge variant={variant}>{ms}</Badge>;
                              })()}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(r.exportedAt ?? r.approvedAt ?? r.createdAt).toLocaleString()}
                            </TableCell>
                          </>
                        ) : systemAdminIntegrationMode ? (
                          <>
                            <TableCell>
                              <Badge variant={r.status === "SUCCESS" ? "default" : "secondary"}>
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(r.createdAt).toLocaleString()}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell>{r.generatedBy}</TableCell>
                            <TableCell>
                              <Badge variant={r.status === "SUCCESS" ? "default" : "secondary"}>
                                {r.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {new Date(r.createdAt).toLocaleString()}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-right">
                          {hrManagerIntegrationMode ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setHistoryNotesMode(false);
                                  setHistoryDetailRun(r);
                                }}
                              >
                                View Details
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setHistoryNotesMode(true);
                                  setHistoryDetailRun(r);
                                }}
                              >
                                View Approval Notes
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  (r.approvalStatus ??
                                    (r.status === "FAILED" ? "Rejected" : "Pending Approval")) !==
                                  "Approved"
                                }
                                onClick={() => {
                                  updateExportRun(r.id, {
                                    approvalStatus: "Exported",
                                    exportedAt: new Date().toISOString(),
                                  });
                                  logPayrollExportExported({
                                    actorId: user.employeeId,
                                    actorName: user.name,
                                    actorRole: user.role,
                                    runId: r.id,
                                    periodLabel: r.periodLabel,
                                    mappingVersion: r.mappingVersion,
                                  });

                                  // Demo download (would come from backend).
                                  const blob = new Blob(
                                    [
                                      `Payroll Export (demo)\nRun ID: ${r.id}\nPeriod: ${r.periodLabel}\nMapping Version: ${r.mappingVersion}\nStatus: Exported`,
                                    ],
                                    { type: "text/plain" }
                                  );
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `payroll-export-${r.id}.txt`;
                                  a.click();
                                  URL.revokeObjectURL(url);

                                  setHistoryDetailRun(null);
                                  setRuns(loadExportRuns());
                                }}
                              >
                                Download Export
                              </Button>
                            </div>
                          ) : systemAdminIntegrationMode ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryDetailRun(r)}
                              >
                                View details
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const blob = new Blob(
                                    [
                                      `Payroll Export (demo)\nRun ID: ${r.id}\nPeriod: ${r.periodLabel}\nMapping Version: ${r.mappingVersion}\nStatus: ${r.status}`,
                                    ],
                                    { type: "text/plain" }
                                  );
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = `payroll-export-${r.id}.txt`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                }}
                              >
                                Download export
                              </Button>
                              <Button type="button" variant="ghost" size="sm" asChild>
                                <Link
                                  href={`/payroll?tab=export&exportStep=prepare&rerun=${encodeURIComponent(
                                    r.id
                                  )}${modeQuery}`}
                                >
                                  Re-run export
                                </Link>
                              </Button>
                              {r.status !== "SUCCESS" ? (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setTab("integration")}
                                >
                                  Troubleshoot
                                </Button>
                              ) : null}
                            </div>
                          ) : hrIntegrationMode ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setHistoryDetailRun(r)}
                              >
                                Details
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled
                                title="Demo — connect to export file download"
                              >
                                Download
                              </Button>
                              <Button type="button" variant="ghost" size="sm" asChild>
                                <Link
                                  href={`/payroll?tab=export&exportStep=prepare&rerun=${encodeURIComponent(
                                    r.id
                                  )}${modeQuery}`}
                                >
                                  Re-run
                                </Link>
                              </Button>
                            </div>
                          ) : canSeeTab("activity", effectiveRole) ? (
                            <Button type="button" variant="ghost" size="sm" asChild>
                              <Link href={activityRunHref(r.id)}>View activity</Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {runs.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">No export runs yet.</p>
              )}
            </CardContent>
          </Card>
          ) : null}
        </div>
      )}

      {tab === "activity" && canSeeTab("activity", effectiveRole) && !departmentManagerTeamMode && (
        <PayrollActivityLogsTab
          initialRunFilter={activityRunFilter}
          ownOnly={myPayslipsMode}
          hrStaffActionsOnly={effectiveRole === "HR_STAFF" && !myPayslipsMode}
          integrationActionsOnly={hrIntegrationMode || hrManagerIntegrationMode}
        />
      )}

      {tab === "config" &&
        canSeeTab("config", effectiveRole) &&
        !hrManagerIntegrationMode &&
        !departmentManagerTeamMode && <PayrollConfigurationTab />}

      {tab === "integration" && canSeeTab("integration", effectiveRole) && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connection Setup</CardTitle>
              <p className="text-sm text-muted-foreground">Manage HRIS to payroll system connectivity.</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>API Endpoint:</strong> https://api.payroll.example/v1/export</p>
              <p><strong>API Key / Token:</strong> ************a9c1</p>
              <div className="flex items-center gap-2">
                <strong>Connection Status:</strong>
                <Badge variant="default">Connected</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync Settings</CardTitle>
              <p className="text-sm text-muted-foreground">Control automated sync behavior and schedule.</p>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Auto Export:</strong> Enabled</p>
              <p><strong>Schedule:</strong> Every cutoff day, 6:00 PM</p>
              <p><strong>Timezone:</strong> Asia/Manila</p>
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Integration Logs</CardTitle>
              <p className="text-sm text-muted-foreground">
                API request outcomes and retry controls for failed exports.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      {
                        ts: "2026-03-31 18:05",
                        runId: "RUN-ROLE-001",
                        endpoint: "/v1/export",
                        result: "Success",
                        message: "200 OK",
                      },
                      {
                        ts: "2026-03-30 18:07",
                        runId: "RUN-ROLE-002",
                        endpoint: "/v1/export",
                        result: "Failed",
                        message: "504 Gateway Timeout",
                      },
                    ].map((row) => (
                      <TableRow key={`${row.ts}-${row.runId}`}>
                        <TableCell className="whitespace-nowrap">{row.ts}</TableCell>
                        <TableCell className="font-mono text-xs">{row.runId}</TableCell>
                        <TableCell>{row.endpoint}</TableCell>
                        <TableCell>
                          <Badge variant={row.result === "Success" ? "default" : "destructive"}>
                            {row.result}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.message}</TableCell>
                        <TableCell className="text-right">
                          {row.result === "Failed" ? (
                            <Button type="button" size="sm" variant="outline">
                              Retry export
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <Dialog
        open={!!historyDetailRun}
        onOpenChange={(o) => {
          if (!o) setHistoryDetailRun(null);
          if (!o) setHistoryNotesMode(false);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export run details</DialogTitle>
          </DialogHeader>
          {historyDetailRun ? (
            <div className="space-y-3 text-sm">
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Run ID</span>
                <span className="font-mono text-xs">{historyDetailRun.id}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Period</span>
                <span>{historyDetailRun.periodLabel}</span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Generated by</span>
                <span>
                  {historyDetailRun.generatedBy} ({historyDetailRun.generatedById})
                </span>
              </div>
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Status</span>
                <span>
                  {hrManagerIntegrationMode
                    ? historyDetailRun.approvalStatus ??
                      (historyDetailRun.status === "FAILED" ? "Rejected" : "Pending Approval")
                    : historyDetailRun.status}
                </span>
              </div>
              {hrManagerIntegrationMode ? (
                <>
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Mapping version</span>
                    <span>{historyDetailRun.mappingVersion}</span>
                  </div>
                  <div className="grid gap-1">
                    <span className="text-xs text-muted-foreground">Approved by</span>
                    <span>{historyDetailRun.approvedBy ?? "—"}</span>
                  </div>
                  {historyNotesMode ? (
                    <>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Approval remarks</span>
                        <span>{historyDetailRun.approvalRemarks?.trim() ? historyDetailRun.approvalRemarks : "—"}</span>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Rejection reason</span>
                        <span>{historyDetailRun.rejectionReason?.trim() ? historyDetailRun.rejectionReason : "—"}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Approval remarks</span>
                        <span>{historyDetailRun.approvalRemarks?.trim() ? historyDetailRun.approvalRemarks : "—"}</span>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Rejection reason</span>
                        <span>{historyDetailRun.rejectionReason?.trim() ? historyDetailRun.rejectionReason : "—"}</span>
                      </div>
                      <div className="grid gap-1">
                        <span className="text-xs text-muted-foreground">Approval date</span>
                        <span>
                          {new Date(
                            historyDetailRun.exportedAt ?? historyDetailRun.approvedAt ?? historyDetailRun.createdAt
                          ).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : null}
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Format / template</span>
                <span>
                  {historyDetailRun.format} · {historyDetailRun.template}
                </span>
              </div>
              {historyDetailRun.errors && historyDetailRun.errors.length > 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-xs font-medium text-destructive">Errors</p>
                  <ul className="mt-1 list-inside list-disc text-xs">
                    {historyDetailRun.errors.map((e, idx) => (
                      <li key={idx}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
