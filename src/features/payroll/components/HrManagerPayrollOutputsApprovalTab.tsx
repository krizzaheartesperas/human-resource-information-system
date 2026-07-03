"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getPayrollPreviewRows, PAYROLL_PERIOD_OPTIONS } from "@/features/payroll/services/payroll-data";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import {
  loadExportRuns,
  updateExportRun,
  type PayrollExportRun,
} from "@/features/payroll/services/payrollExportRuns";
import {
  logPayrollExportApproved,
  logPayrollExportRejected,
} from "@/features/payroll/services/payrollAudit";
import { AlertTriangle, ClipboardCheck, RefreshCw } from "lucide-react";

function managerStatusLabel(run: PayrollExportRun): string {
  return run.approvalStatus ?? (run.status === "FAILED" ? "Rejected" : "Pending Approval");
}

export function HrManagerPayrollOutputsApprovalTab() {
  const { user } = useCurrentUser();

  const previewRows = useMemo(() => getPayrollPreviewRows(), []);
  const [runsVersion, setRunsVersion] = useState(0);
  const runs = useMemo(() => loadExportRuns(), [runsVersion]);

  const pendingRuns = useMemo(() => {
    return runs
      .filter((r) => managerStatusLabel(r) === "Pending Approval")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [runs]);

  const selectedRun = pendingRuns[0] ?? runs[0] ?? null;

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const currentPeriod = useMemo(() => {
    if (!selectedRun) return PAYROLL_PERIOD_OPTIONS[0];
    return (
      PAYROLL_PERIOD_OPTIONS.find(
        (o) => o.start === selectedRun.periodStart && o.end === selectedRun.periodEnd
      ) ?? PAYROLL_PERIOD_OPTIONS[0]
    );
  }, [selectedRun]);

  const canAct =
    selectedRun && managerStatusLabel(selectedRun) === "Pending Approval" && user.role === "HR_MANAGER";

  const handleApprove = () => {
    if (!selectedRun) return;
    const run = selectedRun;
    const mappingVersion = run.mappingVersion ?? "MAP-v1.0";

    const updated = updateExportRun(run.id, {
      approvalStatus: "Approved",
      approvedBy: user.name,
      approvedById: user.id,
      approvedAt: new Date().toISOString(),
      approvalRemarks: remarks.trim(),
      rejectionReason: undefined,
    });

    if (updated) {
      logPayrollExportApproved({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        runId: run.id,
        periodLabel: run.periodLabel,
        mappingVersion,
        remarks: remarks.trim(),
      });
    }

    setApproveOpen(false);
    setRemarks("");
    setRejectReason("");
    setRunsVersion((v) => v + 1);
  };

  const handleReject = () => {
    if (!selectedRun) return;
    const reason = rejectReason.trim();
    if (!reason) return;
    const run = selectedRun;
    const mappingVersion = run.mappingVersion ?? "MAP-v1.0";

    const updated = updateExportRun(run.id, {
      approvalStatus: "Rejected",
      approvedBy: user.name,
      approvedById: user.id,
      approvedAt: new Date().toISOString(),
      approvalRemarks: undefined,
      rejectionReason: reason,
    });

    if (updated) {
      logPayrollExportRejected({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        runId: run.id,
        periodLabel: run.periodLabel,
        mappingVersion,
        reason,
      });
    }

    setRejectOpen(false);
    setRejectReason("");
    setRunsVersion((v) => v + 1);
  };

  return (
    <div className="space-y-6">
      {!selectedRun ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No payroll outputs available for approval.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">Payroll outputs (approval view)</h3>
              <p className="text-sm text-muted-foreground">
                Review payroll readiness and approve or reject the export for the selected period.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={managerStatusLabel(selectedRun) === "Pending Approval" ? "secondary" : "outline"}>
                {managerStatusLabel(selectedRun)}
              </Badge>
              <Button type="button" variant="outline" size="sm" onClick={() => setRunsVersion((v) => v + 1)}>
                <RefreshCw className="mr-2 size-4" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-base">Payroll info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Payroll period</p>
                  <p className="font-medium">{selectedRun.periodLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cutoff start</p>
                  <p className="font-medium">{currentPeriod.start}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Cutoff end</p>
                  <p className="font-medium">{currentPeriod.end}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Employee count</p>
                  <p className="font-medium">{selectedRun.employeeCount}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Validation summary (read-only)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Attendance check</p>
                    <p className="mt-1 font-medium">Approved</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Leave approval check</p>
                    <p className="mt-1 font-medium">Approved</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Overtime check</p>
                    <p className="mt-1 font-medium">Approved</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Data completeness</p>
                    <p className="mt-1 font-medium">
                      {selectedRun.status === "PARTIAL" ? "Partial / warnings" : "Complete"}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Warnings panel
                  </p>
                  <div className="mt-2 text-sm text-muted-foreground space-y-1">
                    {selectedRun.status === "PARTIAL" ? (
                      <p>Warnings detected: export may be partial.</p>
                    ) : (
                      <p>No blocking validation issues detected.</p>
                    )}
                    {selectedRun.errors && selectedRun.errors.length > 0 ? (
                      <ul className="list-inside list-disc">
                        {selectedRun.errors.slice(0, 3).map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Data preview (read-only)</p>
                  <div className="max-h-[320px] overflow-auto scrollbar-hide rounded-md border border-border/60">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/40 text-left">
                        <tr>
                          <th className="px-3 py-2 font-medium">Employee</th>
                          <th className="px-3 py-2 font-medium text-right">Basic</th>
                          <th className="px-3 py-2 font-medium text-right">OT</th>
                          <th className="px-3 py-2 font-medium text-right">Deductions</th>
                          <th className="px-3 py-2 font-medium text-right">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 6).map((r) => (
                          <tr key={r.employeeId} className="border-t border-border/50">
                            <td className="px-3 py-2">
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-muted-foreground">{r.employeeId}</div>
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₱{r.basicPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₱{r.overtime.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₱{r.deductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₱{r.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" disabled={!canAct} onClick={() => setApproveOpen(true)}>
                    <ClipboardCheck className="mr-2 size-4" />
                    Approve Export
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!canAct}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject Export
                  </Button>
                  <Button type="button" variant="outline" disabled={!canAct} onClick={() => setApproveOpen(true)}>
                    Add Remarks
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog open={approveOpen} onOpenChange={(o) => (!o ? setApproveOpen(false) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve payroll export</DialogTitle>
          </DialogHeader>
          {selectedRun ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Confirmations
                </p>
                <ul className="mt-2 space-y-1 list-inside list-disc text-muted-foreground">
                  <li>
                    Confirm payroll period: <span className="font-medium">{selectedRun.periodLabel}</span>
                  </li>
                  <li>
                    Confirm employee count: <span className="font-medium">{selectedRun.employeeCount}</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Optional remarks (for approval notes)</p>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Add optional note for this export approval…"
                  className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setApproveOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleApprove} disabled={!canAct}>
                  Approve
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={(o) => (!o ? setRejectOpen(false) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject payroll export</DialogTitle>
          </DialogHeader>
          {selectedRun ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Required reason
                </p>
                <p className="mt-2 text-muted-foreground">
                  Please provide a reason. This will be sent back to HR Staff for correction.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Rejection reason</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter reason for rejection…"
                  className="min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" onClick={handleReject} disabled={!canAct || !rejectReason.trim()}>
                  Send back
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

