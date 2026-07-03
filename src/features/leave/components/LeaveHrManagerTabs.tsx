"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { departments, getEmployeeById, type LeaveRequest, type LeaveStatus } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type Props = {
  currentUserRole: string;
  theme: string;
  hmHighLevelApprovals: LeaveRequest[];
  hmEscalatedRequests: LeaveRequest[];
  requests: LeaveRequest[];
  hmDepartmentOverview: Array<{
    deptId: string;
    deptName: string;
    total: number;
    approved: number;
    rejected: number;
    pending: number;
    onLeaveToday: number;
  }>;
  hmOverridesQueue: LeaveRequest[];
  calculateInclusiveDays: (start: string, end: string) => number;
  getStatusVariant: (status: LeaveStatus) => "default" | "secondary" | "success" | "destructive" | "warning" | "outline";
  setDetailRequest: (request: LeaveRequest) => void;
  setHmRemarks: (value: string) => void;
  setHmException: (value: boolean) => void;
  setHmApproveTarget: (request: LeaveRequest | null) => void;
  setHmReturnReason: (value: string) => void;
  setHmReturnTarget: (request: LeaveRequest | null) => void;
  setHmRejectReason: (value: string) => void;
  setHmRejectTarget: (request: LeaveRequest | null) => void;
  hmApproveRequest: (requestId: string, remarks?: string, asException?: boolean) => void;
};

export function LeaveHrManagerTabs({
  currentUserRole,
  theme,
  hmHighLevelApprovals,
  hmEscalatedRequests,
  requests,
  hmDepartmentOverview,
  hmOverridesQueue,
  calculateInclusiveDays,
  getStatusVariant,
  setDetailRequest,
  setHmRemarks,
  setHmException,
  setHmApproveTarget,
  setHmReturnReason,
  setHmReturnTarget,
  setHmRejectReason,
  setHmRejectTarget,
  hmApproveRequest,
}: Props) {
  if (currentUserRole !== "HR_MANAGER") return null;

  return (
    <>
      <TabsContent value="hm-high" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">High-level approvals</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Approve or reject leave for department heads, HR Staff, and HR Admin. HR Admin submissions go to the
              Executive; other approved requests are finalized here.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table className="min-w-[1050px]">
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-[#FFE14E] hover:bg-[#FFE14E] text-[#192853] border-border shadow-[0_1px_0_0_var(--border)]">
                    <TableHead className="text-[#192853] font-semibold">Employee Name</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Role</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Department</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Leave Type</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Date Range</TableHead>
                    <TableHead className="text-[#192853] font-semibold text-right">Total Days</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Validation</TableHead>
                    <TableHead className="text-[#192853] font-semibold">Status</TableHead>
                    <TableHead className="text-[#192853] font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hmHighLevelApprovals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No high-level approvals waiting.</TableCell>
                    </TableRow>
                  ) : (
                    hmHighLevelApprovals.map((req) => {
                      const emp = getEmployeeById(req.employeeId);
                      const deptName = departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                      const days = calculateInclusiveDays(req.startDate, req.endDate);
                      const hasDoc = !!req.supportingDocName;
                      const validationLabel = hasDoc ? "Complete" : "Missing document";
                      const validationVariant: "success" | "warning" = hasDoc ? "success" : "warning";
                      return (
                        <TableRow key={req.id} className="odd:bg-background even:bg-muted/20">
                          <TableCell><div className="font-medium">{req.employeeName}</div><div className="text-xs text-muted-foreground">{req.employeeNumber}</div></TableCell>
                          <TableCell className="text-muted-foreground">{emp?.role ?? "—"}</TableCell>
                          <TableCell>{deptName}</TableCell>
                          <TableCell>{formatLeaveType(req.type)}</TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">{days}</TableCell>
                          <TableCell><Badge variant={validationVariant}>{validationLabel}</Badge></TableCell>
                          <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex flex-col lg:flex-row items-stretch lg:items-center justify-end gap-1.5">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailRequest(req)}>View</Button>
                              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { setHmRemarks(""); setHmException(false); setHmApproveTarget(req); }}>Approve</Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setHmReturnReason(""); setHmReturnTarget(req); }}>Return</Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => { setHmRejectReason(""); setHmRemarks(""); setHmRejectTarget(req); }}>Reject</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hm-escalated" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Escalated requests</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Special cases (returned for review). Review and decide.</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Issue type</TableHead><TableHead>Leave type</TableHead><TableHead>Date range</TableHead><TableHead>Escalation reason</TableHead><TableHead>Escalated by</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {hmEscalatedRequests.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No escalated requests.</TableCell></TableRow>
                  ) : (
                    hmEscalatedRequests.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.employeeName}</TableCell>
                        <TableCell>Returned for review</TableCell>
                        <TableCell>{formatLeaveType(req.type)}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">{new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[260px] truncate" title={req.remarks ?? ""}>{req.remarks ?? "—"}</TableCell>
                        <TableCell>{req.returnedTo ?? "—"}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailRequest(req)}>Review</Button></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hm-all" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">All leave requests</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Monitoring view across all departments.</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Leave type</TableHead><TableHead>Status</TableHead><TableHead>Date submitted</TableHead></TableRow></TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No requests found.</TableCell></TableRow>
                  ) : (
                    requests.map((req) => {
                      const emp = getEmployeeById(req.employeeId);
                      const deptName = departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.employeeName}</TableCell>
                          <TableCell className="text-muted-foreground">{emp?.role ?? "—"}</TableCell>
                          <TableCell>{deptName}</TableCell>
                          <TableCell>{formatLeaveType(req.type)}</TableCell>
                          <TableCell><Badge variant={getStatusVariant(req.status)}>{req.status.replace(/_/g, " ")}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hm-overview" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Department leave overview</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Department-level impact: total, approved vs rejected, pending, and on-leave today.</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Department</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Approved</TableHead><TableHead className="text-right">Rejected</TableHead><TableHead className="text-right">Pending</TableHead><TableHead className="text-right">On leave today</TableHead></TableRow></TableHeader>
                <TableBody>
                  {hmDepartmentOverview.map((row) => (
                    <TableRow key={row.deptId}>
                      <TableCell className="font-medium">{row.deptName}</TableCell>
                      <TableCell className="text-right">{row.total}</TableCell>
                      <TableCell className="text-right">{row.approved}</TableCell>
                      <TableCell className="text-right">{row.rejected}</TableCell>
                      <TableCell className="text-right">{row.pending}</TableCell>
                      <TableCell className="text-right">{row.onLeaveToday}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="hm-overrides" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base">Override requests</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Requests flagged for override (contains keyword “override” in remarks).</p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Original decision</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {hmOverridesQueue.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No override requests.</TableCell></TableRow>
                  ) : (
                    hmOverridesQueue.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.employeeName}</TableCell>
                        <TableCell>Rejected</TableCell>
                        <TableCell className="text-muted-foreground max-w-[260px] truncate" title={req.remarks ?? ""}>{req.remarks ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" className="h-7 px-2 text-xs" onClick={() => hmApproveRequest(req.id, "Override approved", true)}>Approve override</Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}
