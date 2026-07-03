"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { formatLeaveRequestDate, formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import type { LeaveRequest, LeaveStatus } from "@/lib/mock";

type Props = {
  requests: LeaveRequest[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  canApprove: boolean;
  selectableStatuses?: LeaveStatus[];
  showEmployeeColumn?: boolean;
  onViewSupportingDoc?: (dataUrl: string, name: string) => void;
  loading?: boolean;
};

function resolveDocUrl(req: LeaveRequest): string | undefined {
  const primary = (req.supportingDocDataUrl ?? "").trim();
  if (primary) return primary;
  const fallback = (req.supportingDocName ?? "").trim();
  if (/^(data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(fallback)) return fallback;
  if (fallback) return `/${fallback}`;
  return undefined;
}

function statusVariant(status: LeaveStatus) {
  const map: Record<
    LeaveStatus,
    "default" | "secondary" | "success" | "destructive" | "warning" | "outline"
  > = {
    DRAFT: "secondary",
    CREATED: "secondary",
    PENDING_RECORDING: "warning",
    PENDING_FINALIZATION: "warning",
    RETURNED_FOR_REVIEW: "warning",
    PENDING_HR_ADMIN_PROCESSING: "warning",
    PENDING_HR_ADMIN_PROCESSING_HR_MANAGER: "warning",
    PENDING_HR_ADMIN_PROCESSING_EXECUTIVE: "warning",
    PENDING_HR_MANAGER_PROCESSING_HR_ADMIN: "warning",
    PENDING_HR_STAFF_PROCESSING: "warning",
    PENDING_HR_STAFF_PROCESSING_AUDITOR: "warning",
    PENDING_HR_MANAGER_APPROVAL: "warning",
    PENDING_EXECUTIVE_APPROVAL: "warning",
    PENDING_EXECUTIVE_BOARD_APPROVAL: "warning",
    PENDING_APPROVAL: "warning",
    APPROVED: "success",
    FINAL_APPROVED: "success",
    REJECTED: "destructive",
    APPLIED: "success",
    CANCELLED: "outline",
  };
  return map[status] ?? "secondary";
}

export const LeaveRequestsTable = memo(function LeaveRequestsTable({
  requests,
  selectedIds,
  onToggle,
  onToggleAll,
  canApprove,
  selectableStatuses,
  showEmployeeColumn = true,
  onViewSupportingDoc,
  loading = false,
}: Props) {
  const skeletonColumns = (canApprove ? 1 : 0) + (showEmployeeColumn ? 1 : 0) + 7;

  if (loading) {
    return (
      <Table scrollable={false} className="min-w-[960px]">
        <TableHeader>
          <TableRow>
            {canApprove && (
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  disabled
                  checked={false}
                  readOnly
                  className="size-4 rounded border border-input bg-background opacity-50"
                  aria-hidden
                />
              </TableHead>
            )}
            {showEmployeeColumn && <TableHead>Employee</TableHead>}
            <TableHead>Leave type</TableHead>
            <TableHead>Date range</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Supporting doc</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows columns={skeletonColumns} prefix="leave-rt-sk" />
        </TableBody>
      </Table>
    );
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        No leave requests in this list.
      </p>
    );
  }

  const selectableSet = new Set<LeaveStatus>(selectableStatuses ?? ["PENDING_APPROVAL"]);
  const selectableIds = requests.filter((r) => selectableSet.has(r.status)).map((r) => r.id);
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.includes(id));

  return (
    <Table scrollable={false} className="min-w-[960px]">
      <TableHeader>
        <TableRow>
          {canApprove && (
            <TableHead className="w-10 min-w-10 max-w-10">
              <input
                type="checkbox"
                className="size-4 rounded border border-input bg-background"
                checked={allChecked}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </TableHead>
          )}
          {showEmployeeColumn && <TableHead className="min-w-[140px]">Employee</TableHead>}
          <TableHead className="min-w-[120px]">Leave type</TableHead>
          <TableHead className="min-w-[140px]">Date range</TableHead>
          <TableHead className="min-w-[120px]">Reason</TableHead>
          <TableHead className="min-w-[140px]">Supporting doc</TableHead>
          <TableHead className="min-w-[180px]">Status</TableHead>
          <TableHead className="min-w-[100px] whitespace-nowrap">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((req) => (
          <TableRow key={req.id}>
            {canApprove && (
              <TableCell className="w-10 min-w-10 max-w-10 align-top">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input bg-background"
                  checked={selectedIds.includes(req.id)}
                  disabled={!selectableSet.has(req.status)}
                  onChange={() => onToggle(req.id)}
                  aria-label={`Select request for ${req.employeeName}`}
                />
              </TableCell>
            )}
            {showEmployeeColumn && (
              <TableCell className="align-top overflow-hidden">
                <div className="min-w-0">
                  <p className="font-medium break-words">{req.employeeName}</p>
                  <p className="text-xs text-muted-foreground break-all">{req.employeeNumber}</p>
                </div>
              </TableCell>
            )}
            <TableCell className="align-top break-words min-w-0">{formatLeaveType(req.type)}</TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap align-top">
              {formatLeaveRequestDate(req.startDate)} – {formatLeaveRequestDate(req.endDate)}
            </TableCell>
            <TableCell className="align-top max-w-[220px] break-words" title={req.reason}>
              {req.reason?.trim() ? req.reason : "—"}
            </TableCell>
            <TableCell className="align-top max-w-[200px]">
              {req.supportingDocName ? (
                resolveDocUrl(req) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline truncate max-w-full text-left"
                    title={`View ${req.supportingDocName}`}
                    onClick={() => onViewSupportingDoc?.(resolveDocUrl(req)!, req.supportingDocName!)}
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
            <TableCell className="align-top min-w-0">
              <Badge variant={statusVariant(req.status)} className="whitespace-normal text-left leading-snug max-w-full inline-block">
                {(req.status ?? "").replace(/_/g, " ") || "—"}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm whitespace-nowrap align-top">
              {formatLeaveRequestDate(req.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});
