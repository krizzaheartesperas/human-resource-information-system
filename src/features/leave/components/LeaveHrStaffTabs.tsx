"use client";

import { FileCheck, Inbox } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeaveRequestsTable } from "@/features/leave/components/LeaveRequestsTable";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import type { LeaveRequest, LeaveStatus } from "@/lib/mock";

type Props = {
  currentUserRole: string;
  theme: string;
  leaveDataLoading: boolean;
  staffAllStatusFilter: LeaveStatus | "ALL";
  setStaffAllStatusFilter: (value: LeaveStatus | "ALL") => void;
  staffAllLeaveRequestsFiltered: LeaveRequest[];
  selectedIds: string[];
  toggleSelected: (id: string) => void;
  toggleAllFor: (rows: LeaveRequest[], statuses: LeaveStatus[], checked: boolean) => void;
  openDocPreview: (dataUrl: string, name: string) => void;
  staffPendingValidationList: LeaveRequest[];
  bulkRouteHrStaffProcessing: () => void;
  staffApprovedRequests: LeaveRequest[];
  forwardedForHrStaff: Array<{ request: LeaveRequest; forwardedToName: string }>;
  getStatusVariant: (status: LeaveStatus) => "default" | "secondary" | "success" | "destructive" | "warning" | "outline";
};

export function LeaveHrStaffTabs({
  currentUserRole,
  theme,
  leaveDataLoading,
  staffAllStatusFilter,
  setStaffAllStatusFilter,
  staffAllLeaveRequestsFiltered,
  selectedIds,
  toggleSelected,
  toggleAllFor,
  openDocPreview,
  staffPendingValidationList,
  bulkRouteHrStaffProcessing,
  staffApprovedRequests,
  forwardedForHrStaff,
  getStatusVariant,
}: Props) {
  if (currentUserRole !== "HR_STAFF") return null;

  const renderEmptyStateWithHeader = (showSelectColumn: boolean) => (
    <div className="h-full flex flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            {showSelectColumn && <TableHead className="w-10 min-w-10 max-w-10" />}
            <TableHead>Employee</TableHead>
            <TableHead>Leave type</TableHead>
            <TableHead>Date range</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Supporting doc</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
      </Table>
      <div className="flex-1 flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-4 flex size-20 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
          <Inbox className="size-10 text-primary/70" aria-hidden />
        </div>
        <p className="text-base font-semibold text-foreground">No Requests found</p>
        <p className="mt-1 text-sm text-muted-foreground">No leave requests match this workplace queue yet.</p>
      </div>
    </div>
  );

  return (
    <>
      <TabsContent value="staff-all" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="size-4 text-muted-foreground" />
                All leave requests
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Company-wide view of leave requests. Use filters and actions to validate, forward, or reject.
              </p>
            </div>
            <div className="flex items-center gap-2" />
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Status</span>
                <select
                  value={staffAllStatusFilter}
                  onChange={(e) => setStaffAllStatusFilter(e.target.value as LeaveStatus | "ALL")}
                  className="flex h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="ALL">All</option>
                  <option value="PENDING_HR_STAFF_PROCESSING">Pending HR Staff</option>
                  <option value="PENDING_HR_STAFF_PROCESSING_AUDITOR">Pending HR Staff (Auditor)</option>
                  <option value="PENDING_APPROVAL">Pending department approval</option>
                  <option value="PENDING_HR_MANAGER_APPROVAL">Pending HR Manager</option>
                  <option value="APPROVED">Approved</option>
                  <option value="FINAL_APPROVED">Final approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </label>
            </div>
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              {leaveDataLoading ? (
                <LeaveRequestsTable
                  loading={leaveDataLoading}
                  requests={[]}
                  selectedIds={[]}
                  onToggle={() => {}}
                  onToggleAll={() => {}}
                  canApprove={false}
                  showEmployeeColumn={true}
                  onViewSupportingDoc={openDocPreview}
                />
              ) : staffAllLeaveRequestsFiltered.length === 0 ? (
                renderEmptyStateWithHeader(false)
              ) : (
                <LeaveRequestsTable
                  loading={false}
                  requests={staffAllLeaveRequestsFiltered}
                  selectedIds={selectedIds}
                  onToggle={toggleSelected}
                  onToggleAll={(checked) => toggleAllFor(staffAllLeaveRequestsFiltered, ["PENDING_HR_STAFF_PROCESSING"], checked)}
                  canApprove={false}
                  showEmployeeColumn={true}
                  onViewSupportingDoc={openDocPreview}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="staff-pending" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="size-4 text-muted-foreground" />
                Pending validation
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                After the department manager (where applicable), HR Staff validates balances and policy, then either
                finalizes approval or forwards department-head leave to the HR Manager.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Select rows, then process: team member leave is finalized here; department manager leave goes to HR
                Manager.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => bulkRouteHrStaffProcessing()}
                disabled={selectedIds.length === 0}
                title={selectedIds.length === 0 && staffPendingValidationList.length > 0 ? "Select one or more rows with the checkboxes first." : undefined}
              >
                Process selected
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              {leaveDataLoading ? (
                <LeaveRequestsTable
                  loading={leaveDataLoading}
                  requests={[]}
                  selectedIds={[]}
                  onToggle={() => {}}
                  onToggleAll={() => {}}
                  canApprove={true}
                  selectableStatuses={["PENDING_HR_STAFF_PROCESSING", "PENDING_HR_STAFF_PROCESSING_AUDITOR", "PENDING_APPROVAL"]}
                  showEmployeeColumn={true}
                  onViewSupportingDoc={openDocPreview}
                />
              ) : staffPendingValidationList.length === 0 ? (
                renderEmptyStateWithHeader(true)
              ) : (
                <LeaveRequestsTable
                  loading={false}
                  requests={staffPendingValidationList}
                  selectedIds={selectedIds}
                  onToggle={toggleSelected}
                  onToggleAll={(checked) =>
                    toggleAllFor(
                      staffPendingValidationList,
                      ["PENDING_HR_STAFF_PROCESSING", "PENDING_HR_STAFF_PROCESSING_AUDITOR", "PENDING_APPROVAL"],
                      checked
                    )
                  }
                  canApprove={true}
                  selectableStatuses={["PENDING_HR_STAFF_PROCESSING", "PENDING_HR_STAFF_PROCESSING_AUDITOR", "PENDING_APPROVAL"]}
                  showEmployeeColumn={true}
                  onViewSupportingDoc={openDocPreview}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="staff-approved" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="size-4 text-muted-foreground" />
              Approved requests
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Requests that have been approved/finalized in the workflow.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              {leaveDataLoading ? (
                <LeaveRequestsTable
                  loading={leaveDataLoading}
                  requests={[]}
                  selectedIds={[]}
                  onToggle={() => {}}
                  onToggleAll={() => {}}
                  canApprove={false}
                  showEmployeeColumn={true}
                  onViewSupportingDoc={openDocPreview}
                />
              ) : staffApprovedRequests.length === 0 ? (
                renderEmptyStateWithHeader(false)
              ) : (
                <LeaveRequestsTable
                  loading={false}
                  requests={staffApprovedRequests}
                  selectedIds={[]}
                  onToggle={() => {}}
                  onToggleAll={() => {}}
                  canApprove={false}
                  showEmployeeColumn={true}
                  onViewSupportingDoc={openDocPreview}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="staff-forwarded" className="space-y-4">
        <Card className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"}`}>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="size-4 text-muted-foreground" />
                Forwarded requests
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Requests currently with another approver (department manager, HR Manager, or Executive) or already
                decided.
              </p>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              {forwardedForHrStaff.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No forwarded requests yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Leave type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Forwarded to</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {forwardedForHrStaff.map(({ request, forwardedToName }) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{request.employeeNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatLeaveType(request.type)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(request.startDate).toLocaleDateString()} – {new Date(request.endDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm">{forwardedToName}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(request.status)}>
                            {request.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}
