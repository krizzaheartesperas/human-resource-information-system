"use client";

import { Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditLogEntry } from "@/features/leave/services/leaveAuditService";
import { departments, getEmployeeById, type LeaveRequest, type LeaveStatus, type TimeOffType } from "@/lib/mock";
import { AUDITOR_REPORTS, type AuditorReportKey } from "@/features/leave/types/auditorReports";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type BalanceAdjustment = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: TimeOffType;
  previousBalance: number;
  newBalance: number;
  reason: string;
  adjustedBy: string;
  adjustedByRole: string;
  dateAdjusted: string;
};

type Props = {
  currentUserRole: string;
  theme: string;
  requests: LeaveRequest[];
  balanceAdjustments: BalanceAdjustment[];
  auditLogs: AuditLogEntry[];
  requiredAttachmentsFor: TimeOffType[];
  calculateInclusiveDays: (start: string, end: string) => number;
  getStatusVariant: (status: LeaveStatus) => "default" | "secondary" | "success" | "destructive" | "warning" | "outline";
  setDetailRequest: (req: LeaveRequest) => void;
  handleExport: () => void;
  exportAuditReportCsv: (key: AuditorReportKey) => void;
  printAuditReport: (key: AuditorReportKey) => void;
};

export function LeaveAuditorTabs({
  currentUserRole,
  theme,
  requests,
  balanceAdjustments,
  auditLogs,
  requiredAttachmentsFor,
  calculateInclusiveDays,
  getStatusVariant,
  setDetailRequest,
  handleExport,
  exportAuditReportCsv,
  printAuditReport,
}: Props) {
  if (currentUserRole !== "AUDITOR") return null;

  return (
    <>
      <TabsContent value="audit-records" className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card className={`border-0 shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
            <CardContent className="pt-5">
              <div className="text-xs opacity-80">Total Leave Records</div>
              <div className="mt-1 text-2xl font-semibold">{requests.length}</div>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
            <CardContent className="pt-5">
              <div className="text-xs opacity-80">Open Compliance Issues</div>
              <div className="mt-1 text-2xl font-semibold">
                {requests.filter((r) => (r.status === "FINAL_APPROVED" || r.status === "PENDING_FINALIZATION") && !r.supportingDocName).length}
              </div>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
            <CardContent className="pt-5">
              <div className="text-xs opacity-80">Balance Adjustments This Month</div>
              <div className="mt-1 text-2xl font-semibold">
                {balanceAdjustments.filter((a) => new Date(a.dateAdjusted).getMonth() === new Date().getMonth()).length}
              </div>
            </CardContent>
          </Card>
          <Card className={`border-0 shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
            <CardContent className="pt-5">
              <div className="text-xs opacity-80">Missing Trail</div>
              <div className="mt-1 text-2xl font-semibold">
                {requests.filter((r) => auditLogs.filter((e) => e.entityType === "LEAVE_REQUEST" && e.entityId === r.id).length === 0).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Leave records</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Archive view of all leave requests and outcomes. Read-only.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={handleExport} className="rounded-full h-9 px-4 border-border/70 bg-background/60 hover:bg-accent/15 hover:text-primary transition-all">
                <Download className="size-4 text-muted-foreground" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-[#FFE14E] hover:bg-[#FFE14E] text-[#192853] border-border shadow-[0_1px_0_0_var(--border)]">
                    <TableHead className="text-[#192853] font-semibold">Employee</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Role</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Department</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Leave Type</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Date Range</TableHead>
                    <TableHead className="text-[#192853] font-semibold text-right">Days</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Final Status</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Finalized</TableHead>
                    <TableHead className="text-[#192853] font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const emp = getEmployeeById(req.employeeId);
                    const deptName = departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                    const finalized = req.status === "FINAL_APPROVED" ? (req.approvedAt ?? req.createdAt) : "—";
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.employeeName}</TableCell>
                        <TableCell className="text-muted-foreground">{emp?.role ?? "—"}</TableCell>
                        <TableCell>{deptName}</TableCell>
                        <TableCell>{formatLeaveType(req.type)}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">{calculateInclusiveDays(req.startDate, req.endDate)}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{finalized !== "—" ? new Date(finalized).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailRequest(req)}>View Details</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audit-trail" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Approval trail</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Full history of each leave request from audit logs (submitted, validated, approved, finalized).</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Validated by</TableHead>
                    <TableHead>Approved by</TableHead>
                    <TableHead>Finalized by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const logs = auditLogs
                      .filter((e) => e.entityType === "LEAVE_REQUEST" && e.entityId === req.id)
                      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                    const submitted = logs.find((e) => e.action === "LEAVE_REQUEST_CREATED");
                    const statusAfter = (entry: AuditLogEntry) =>
                      (entry.after as { status?: string } | undefined)?.status;
                    const validated = logs.find((e) => {
                      const status = statusAfter(e);
                      return status === "PENDING_APPROVAL" || status === "PENDING_HR_MANAGER_APPROVAL";
                    });
                    const approved = logs.find((e) => statusAfter(e) === "PENDING_FINALIZATION");
                    const finalized = logs.find((e) => statusAfter(e) === "FINAL_APPROVED");
                    return (
                      <TableRow key={req.id}>
                        <TableCell className="font-mono text-xs">{req.id}</TableCell>
                        <TableCell className="font-medium">{req.employeeName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{submitted ? new Date(submitted.timestamp).toLocaleDateString() : new Date(req.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{validated ? `${validated.actorName}` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{approved ? `${approved.actorName}` : "—"}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{finalized ? `${finalized.actorName}` : "—"}</TableCell>
                        <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status.replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailRequest(req)}>View</Button></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audit-adjustments" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Balance adjustments</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Tracks changes to leave balances (including deductions during finalization). Read-only.</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Leave Type</TableHead><TableHead className="text-right">Previous</TableHead><TableHead className="text-right">New</TableHead><TableHead>Reason</TableHead><TableHead>Adjusted By</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {balanceAdjustments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No balance adjustments logged yet.</TableCell></TableRow>
                  ) : (
                    balanceAdjustments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.employeeName}</TableCell>
                        <TableCell>{formatLeaveType(a.leaveType)}</TableCell>
                        <TableCell className="text-right">{a.previousBalance}</TableCell>
                        <TableCell className="text-right">{a.newBalance}</TableCell>
                        <TableCell className="text-muted-foreground">{a.reason}</TableCell>
                        <TableCell className="text-muted-foreground">{a.adjustedBy} ({a.adjustedByRole})</TableCell>
                        <TableCell className="text-muted-foreground">{new Date(a.dateAdjusted).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audit-compliance" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Policy compliance</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Auto-detected policy/process issues. Read-only.</p>
          </CardHeader>
          <CardContent className="pt-2">
            {(() => {
              const issues = requests.flatMap((r) => {
                const list: Array<{ id: string; requestId: string; employeeName: string; issue: string; severity: "Low" | "Medium" | "High"; detected: string; status: "Open" | "Under Review" | "Resolved" }> = [];
                const needsDoc = requiredAttachmentsFor.includes(r.type);
                if (needsDoc && !r.supportingDocName && (r.status === "PENDING_FINALIZATION" || r.status === "FINAL_APPROVED")) {
                  list.push({ id: `${r.id}-missing-doc`, requestId: r.id, employeeName: r.employeeName, issue: "Approved/finalized without required document", severity: "High", detected: new Date().toISOString(), status: "Open" });
                }
                if (r.status === "FINAL_APPROVED" && !r.approvedBy) {
                  list.push({ id: `${r.id}-missing-approver`, requestId: r.id, employeeName: r.employeeName, issue: "Finalized without approval metadata (approvedBy missing)", severity: "Medium", detected: new Date().toISOString(), status: "Open" });
                }
                if (r.status === "REJECTED" && !r.rejectionReason) {
                  list.push({ id: `${r.id}-missing-reject-reason`, requestId: r.id, employeeName: r.employeeName, issue: "Rejected without rejection reason", severity: "Low", detected: new Date().toISOString(), status: "Open" });
                }
                return list;
              });
              return (
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Request ID</TableHead><TableHead>Employee</TableHead><TableHead>Compliance issue</TableHead><TableHead>Severity</TableHead><TableHead>Detected</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {issues.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No compliance issues detected.</TableCell></TableRow>
                      ) : (
                        issues.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="font-mono text-xs">{i.requestId}</TableCell>
                            <TableCell className="font-medium">{i.employeeName}</TableCell>
                            <TableCell className="text-muted-foreground">{i.issue}</TableCell>
                            <TableCell><Badge variant={i.severity === "High" ? "destructive" : i.severity === "Medium" ? "warning" : "secondary"}>{i.severity}</Badge></TableCell>
                            <TableCell className="text-muted-foreground">{new Date(i.detected).toLocaleDateString()}</TableCell>
                            <TableCell><Badge variant="secondary">{i.status}</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audit-reports" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Audit reports</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Generate audit-ready summaries (export/print).</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AUDITOR_REPORTS.map((rep) => (
                  <div key={rep.key} className="rounded-lg border border-border bg-background p-4 flex items-center justify-between">
                    <div className="text-sm font-medium">{rep.label}</div>
                    <div className="flex items-center gap-2">
                      <Button type="button" size="default" variant="outline" className="rounded-full h-9 px-4 border-border/70 bg-background/60 hover:bg-accent/15 hover:text-primary transition-all" onClick={() => exportAuditReportCsv(rep.key)}>
                        <Download className="size-4 text-muted-foreground" />
                        Export
                      </Button>
                      <Button type="button" size="default" variant="outline" className="rounded-full h-9 px-4 border-border/70 bg-background/60 hover:bg-accent/15 hover:text-primary transition-all" onClick={() => printAuditReport(rep.key)}>
                        <Printer className="size-4 text-muted-foreground" />
                        Print
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}
