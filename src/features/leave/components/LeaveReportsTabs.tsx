"use client";

import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLeaveRequestDate, formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import type { LeaveRequest, LeaveStatus } from "@/lib/mock";

type Variant = "default" | "secondary" | "success" | "destructive" | "warning" | "outline";

type Props = {
  currentRole: string;
  statusFilter: LeaveStatus | "ALL";
  onStatusFilterChange: (value: LeaveStatus | "ALL") => void;
  onRequestLeave: () => void;
  myLeaveReportFiltered: LeaveRequest[];
  companyLeaveReportFiltered: LeaveRequest[];
  onSetDetailRequest: (request: LeaveRequest) => void;
  onCancelRequest: (id: string) => void;
  onOpenDocPreview: (dataUrl: string, name: string) => void;
  calculateInclusiveDays: (start: string, end: string) => number;
  getRecordedByName: (approvedBy?: string) => string;
  getStatusVariant: (status: LeaveStatus) => Variant;
};

function resolveDocUrl(req: LeaveRequest): string | undefined {
  const primary = (req.supportingDocDataUrl ?? "").trim();
  if (primary) return primary;
  const fallback = (req.supportingDocName ?? "").trim();
  if (/^(data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(fallback)) return fallback;
  if (fallback) return `/${fallback}`;
  return undefined;
}

export function LeaveReportsTabs({
  currentRole,
  statusFilter,
  onStatusFilterChange,
  onRequestLeave,
  myLeaveReportFiltered,
  companyLeaveReportFiltered,
  onSetDetailRequest,
  onCancelRequest,
  onOpenDocPreview,
  calculateInclusiveDays,
  getRecordedByName,
  getStatusVariant,
}: Props) {
  return (
    <>
      <TabsContent value="my-report" className="space-y-4">
        <Card className="pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm">
          <CardHeader className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">My Leave Request</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Overview of your leave requests. Use the actions to request, search, and manage your leave.
              </p>
            </div>
            <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              {currentRole === "EMPLOYEE" && (
                <Button size="sm" onClick={onRequestLeave}>
                  <Plus className="mr-2 size-4" />
                  Request leave
                </Button>
              )}
              <label htmlFor="my-report-status-filter" className="text-xs font-medium text-muted-foreground sm:text-sm">
                Status:
              </label>
              <select
                id="my-report-status-filter"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as LeaveStatus | "ALL")}
                className="flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm sm:min-w-[10rem] sm:w-auto"
              >
                <option value="ALL">All</option>
                {currentRole === "EXECUTIVE" ? (
                  <>
                    <option value="PENDING_RECORDING">Pending recording</option>
                    <option value="FINAL_APPROVED">Final approved</option>
                    <option value="CANCELLED">Cancelled</option>
                  </>
                ) : (
                  <>
                    <option value="DRAFT">Draft</option>
                    <option value="CREATED">Created</option>
                    <option value="PENDING_FINALIZATION">Pending finalization</option>
                    <option value="RETURNED_FOR_REVIEW">Returned for review</option>
                    <option value="PENDING_HR_ADMIN_PROCESSING">Pending processing</option>
                    <option value="PENDING_HR_STAFF_PROCESSING">Pending HR Staff processing</option>
                    <option value="PENDING_HR_STAFF_PROCESSING_AUDITOR">Pending HR Staff (Auditor)</option>
                    <option value="PENDING_HR_MANAGER_APPROVAL">Pending HR Manager approval</option>
                    <option value="PENDING_HR_ADMIN_PROCESSING_HR_MANAGER">Pending HR Admin (HR Mgr)</option>
                    <option value="PENDING_HR_MANAGER_PROCESSING_HR_ADMIN">Pending HR Manager (HR Admin)</option>
                    <option value="PENDING_HR_ADMIN_PROCESSING_EXECUTIVE">Pending HR Admin (Executive)</option>
                    <option value="PENDING_EXECUTIVE_APPROVAL">Pending Executive approval</option>
                    <option value="PENDING_EXECUTIVE_BOARD_APPROVAL">Pending Executive/Board approval</option>
                    <option value="PENDING_APPROVAL">Pending approval</option>
                    <option value="APPROVED">Approved</option>
                    <option value="FINAL_APPROVED">Final approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="APPLIED">Applied</option>
                    <option value="CANCELLED">Cancelled</option>
                  </>
                )}
              </select>
            </div>
          </CardHeader>
          <CardContent className="min-w-0 pt-2">
            {currentRole === "EXECUTIVE" && (
              <div className="mb-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                Executive leave requests are automatically approved and forwarded to HR Admin for recording.
              </div>
            )}
            <div className="max-h-[calc(100dvh-12rem)] min-h-[480px] h-[62vh] min-w-0 overflow-x-auto overflow-y-auto scrollbar-hide rounded-md border border-border p-0 sm:max-h-none">
              <Table scrollable={false} className="min-w-[920px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Leave type</TableHead>
                    {currentRole === "EXECUTIVE" ? (
                      <>
                        <TableHead>Date range</TableHead>
                        <TableHead className="text-right">Total days</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recorded by</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </>
                    ) : (
                      <>
                        <TableHead className="w-[110px]">Start</TableHead>
                        <TableHead className="w-[110px]">End</TableHead>
                        <TableHead className="w-[220px]">Reason</TableHead>
                        <TableHead className="w-[260px]">Supporting doc</TableHead>
                        <TableHead className="w-[190px]">Status</TableHead>
                        <TableHead className="w-[110px]">Created</TableHead>
                        <TableHead className="w-[140px] text-right">Actions</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myLeaveReportFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={currentRole === "EXECUTIVE" ? 7 : 8} className="text-center text-muted-foreground py-8">
                        No leave requests to report.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myLeaveReportFiltered.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>{formatLeaveType(req.type)}</TableCell>
                        {currentRole === "EXECUTIVE" ? (
                          <>
                            <TableCell>
                              {formatLeaveRequestDate(req.startDate)} – {formatLeaveRequestDate(req.endDate)}
                            </TableCell>
                            <TableCell className="text-right">{calculateInclusiveDays(req.startDate, req.endDate)}</TableCell>
                            <TableCell className="max-w-[240px] truncate" title={req.reason}>
                              {req.reason}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(req.status)}>
                                {req.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {getRecordedByName(req.approvedBy)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onSetDetailRequest(req)}>
                                  View details
                                </Button>
                                {req.status === "PENDING_RECORDING" && (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onCancelRequest(req.id)}>
                                    Cancel request
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="whitespace-nowrap">{formatLeaveRequestDate(req.startDate)}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatLeaveRequestDate(req.endDate)}</TableCell>
                            <TableCell className="max-w-[180px] truncate" title={req.reason}>
                              {req.reason}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              {req.supportingDocName ? (
                                resolveDocUrl(req) ? (
                                  <button
                                    type="button"
                                    className="inline-flex max-w-full items-center gap-1.5 text-left text-sm text-primary hover:underline"
                                    title={`View ${req.supportingDocName}`}
                                    onClick={() =>
                                      onOpenDocPreview(resolveDocUrl(req)!, req.supportingDocName!)
                                    }
                                  >
                                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                                    <span className="truncate">{req.supportingDocName}</span>
                                  </button>
                                ) : (
                                  <span className="inline-flex max-w-full items-center gap-1.5 text-sm text-muted-foreground" title={req.supportingDocName}>
                                    <FileText className="size-4 shrink-0" />
                                    <span className="truncate">{req.supportingDocName}</span>
                                  </span>
                                )
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge variant={getStatusVariant(req.status)} className="whitespace-normal wrap-break-word leading-tight text-[11px]">
                                {req.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                              {new Date(req.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-full border-primary/25 bg-white px-3 text-xs font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
                                  onClick={() => onSetDetailRequest(req)}
                                >
                                  View
                                </Button>
                                {req.status !== "REJECTED" &&
                                  req.status !== "APPLIED" &&
                                  req.status !== "CANCELLED" &&
                                  req.status !== "APPROVED" &&
                                  req.status !== "FINAL_APPROVED" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 rounded-full px-3 text-xs font-semibold text-destructive transition-all hover:-translate-y-0.5 hover:bg-destructive/10 hover:shadow-sm"
                                      onClick={() => onCancelRequest(req.id)}
                                    >
                                      Cancel
                                    </Button>
                                  )}
                              </div>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="company-report" className="space-y-4">
        <Card className="pt-1 pb-2 min-h-[72vh]">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Company Report</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Overview of leave taken across the company. Use Export above to download.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="company-report-status-filter" className="text-sm text-muted-foreground">
                Status:
              </label>
              <select
                id="company-report-status-filter"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as LeaveStatus | "ALL")}
                className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="ALL">All</option>
                <option value="DRAFT">Draft</option>
                <option value="CREATED">Created</option>
                <option value="PENDING_FINALIZATION">Pending finalization</option>
                <option value="RETURNED_FOR_REVIEW">Returned for review</option>
                <option value="PENDING_HR_ADMIN_PROCESSING">Pending processing</option>
                <option value="PENDING_HR_STAFF_PROCESSING">Pending HR Staff processing</option>
                <option value="PENDING_HR_STAFF_PROCESSING_AUDITOR">Pending HR Staff (Auditor)</option>
                <option value="PENDING_HR_MANAGER_APPROVAL">Pending HR Manager approval</option>
                <option value="PENDING_HR_ADMIN_PROCESSING_HR_MANAGER">Pending HR Admin (HR Mgr)</option>
                <option value="PENDING_HR_MANAGER_PROCESSING_HR_ADMIN">Pending HR Manager (HR Admin)</option>
                <option value="PENDING_HR_ADMIN_PROCESSING_EXECUTIVE">Pending HR Admin (Executive)</option>
                <option value="PENDING_EXECUTIVE_APPROVAL">Pending Executive approval</option>
                <option value="PENDING_EXECUTIVE_BOARD_APPROVAL">Pending Executive/Board approval</option>
                <option value="PENDING_APPROVAL">Pending approval</option>
                <option value="APPROVED">Approved</option>
                <option value="FINAL_APPROVED">Final approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="APPLIED">Applied</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              <Table scrollable={false}>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-accent hover:bg-accent text-accent-foreground border-border [&>th:first-child]:rounded-tl-lg [&>th:last-child]:rounded-tr-lg shadow-[0_1px_0_0_var(--border)]">
                    <TableHead className="text-accent-foreground font-semibold">Employee</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Leave type</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Start</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">End</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Reason</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Supporting doc</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Created</TableHead>
                    {currentRole === "HR_ADMIN" && <TableHead className="text-accent-foreground font-semibold text-right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyLeaveReportFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={currentRole === "HR_ADMIN" ? 9 : 8} className="text-center text-muted-foreground py-8">
                        No leave requests to report.
                      </TableCell>
                    </TableRow>
                  ) : (
                    companyLeaveReportFiltered.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{req.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{req.employeeNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatLeaveType(req.type)}</TableCell>
                        <TableCell>{formatLeaveRequestDate(req.startDate)}</TableCell>
                        <TableCell>{formatLeaveRequestDate(req.endDate)}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={req.reason}>
                          {req.reason}
                        </TableCell>
                        <TableCell className="max-w-[160px]">
                          {req.supportingDocName ? (
                            resolveDocUrl(req) ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline truncate max-w-full text-left"
                                title={`View ${req.supportingDocName}`}
                                onClick={() =>
                                  onOpenDocPreview(resolveDocUrl(req)!, req.supportingDocName!)
                                }
                              >
                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{req.supportingDocName}</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground truncate" title={req.supportingDocName}>
                                <FileText className="size-4 shrink-0" />
                                {req.supportingDocName}
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(req.status)}>
                            {req.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </TableCell>
                        {currentRole === "HR_ADMIN" && (
                          <TableCell className="text-right">
                            {req.status !== "REJECTED" && req.status !== "APPLIED" && req.status !== "CANCELLED" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => onCancelRequest(req.id)}
                              >
                                Cancel
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        )}
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
