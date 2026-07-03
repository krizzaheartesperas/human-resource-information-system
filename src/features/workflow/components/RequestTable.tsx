"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import type { RequestStatus, WorkflowRequest } from "@/lib/mock";
import { Check, Inbox, X } from "lucide-react";

const modernOutlineBtn =
  "h-8 rounded-full border-primary/25 bg-white px-3 text-xs font-semibold text-primary shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md";
const modernCancelBtn =
  "h-8 rounded-full px-3 text-xs font-semibold text-destructive transition-all hover:-translate-y-0.5 hover:bg-destructive/10 hover:shadow-sm";
const modernApproveIconBtn =
  "size-8 rounded-full border border-emerald-200 bg-white p-0 text-emerald-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow";
const modernRejectIconBtn =
  "size-8 rounded-full border border-red-200 bg-white p-0 text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-700 hover:shadow";
const workflowTableHeaderClass =
  "sticky top-0 z-10 bg-[#142347] hover:bg-[#142347] text-slate-100 [&>th]:text-slate-100 [&>th]:font-semibold [&>th:first-child]:rounded-tl-lg [&>th:last-child]:rounded-tr-lg";
const workflowTableRowClass =
  "border-[#22335f] bg-[#0f1b3d] text-slate-100 hover:bg-[#142347]/80 data-[state=selected]:bg-[#142347]/90";

const statusVariant: Record<
  RequestStatus,
  "default" | "secondary" | "success" | "destructive" | "warning" | "outline"
> = {
  CREATED: "secondary",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "destructive",
  APPLIED: "success",
  CLOSED: "outline",
};

export interface RequestTableProps {
  requests: WorkflowRequest[];
  selectable?: boolean;
  selectedIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: (checked: boolean) => void;
  showRowActions?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onCancelCreated?: (id: string) => void;
  onEditDraft?: (id: string) => void;
  /** Use yellow accent sticky header (matches Company Leave Report style) */
  accentHeader?: boolean;
  /** Show skeleton rows while request data is loading */
  loading?: boolean;
}

export const RequestTable = memo(function RequestTable({
  requests,
  selectable,
  selectedIds = [],
  onToggle,
  onToggleAll,
  showRowActions,
  onApprove,
  onReject,
  onViewDetails,
  onCancelCreated,
  onEditDraft,
  accentHeader = false,
  loading = false,
}: RequestTableProps) {
  const columnCount = (selectable ? 1 : 0) + 6 + (showRowActions ? 1 : 0);

  if (loading) {
    return (
      <Table scrollable={!accentHeader}>
        <TableHeader>
          <TableRow className={accentHeader ? workflowTableHeaderClass : undefined}>
            {selectable && (
              <TableHead className={accentHeader ? "text-accent-foreground font-semibold w-[40px]" : "w-[40px]"}>
                <input
                  type="checkbox"
                  disabled
                  className="size-4 rounded border border-input bg-background opacity-50"
                  aria-hidden
                />
              </TableHead>
            )}
            <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Title</TableHead>
            <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Type</TableHead>
            <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Date Created</TableHead>
            <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Status</TableHead>
            <TableHead className={accentHeader ? "text-slate-100 font-semibold w-[110px]" : "w-[110px]"}>Details</TableHead>
            <TableHead className={accentHeader ? "text-slate-100 font-semibold w-[120px]" : "w-[120px]"}>Action</TableHead>
            {showRowActions && (
              <TableHead className={accentHeader ? "text-slate-100 font-semibold w-[120px]" : "w-[120px]"}>Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableSkeletonRows columns={columnCount} prefix="workflow-req-sk" />
        </TableBody>
      </Table>
    );
  }

  const selectableIds = requests
    .filter((r) => r.status === "PENDING")
    .map((r) => r.id);
  const allChecked =
    selectableIds.length > 0 &&
    selectableIds.every((id) => selectedIds.includes(id));

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in duration-500">
        <div className="relative mb-4 flex size-20 items-center justify-center rounded-2xl border border-primary/15 bg-primary/5 shadow-sm">
          <Inbox className="size-10 text-primary/70" aria-hidden />
        </div>
        <p className="text-base font-semibold text-foreground">No Requests found</p>
        <p className="mt-1 text-sm text-muted-foreground">Create a request to get started.</p>
      </div>
    );
  }

  return (
    <Table scrollable={!accentHeader}>
      <TableHeader>
        <TableRow className={accentHeader ? workflowTableHeaderClass : undefined}>
          {selectable && (
            <TableHead className={accentHeader ? "text-accent-foreground font-semibold w-[40px]" : "w-[40px]"}>
              <input
                type="checkbox"
                className="size-4 rounded border border-input bg-background"
                checked={allChecked}
                onChange={(e) => onToggleAll?.(e.target.checked)}
                aria-label="Select all pending"
              />
            </TableHead>
          )}
          <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Title</TableHead>
          <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Type</TableHead>
          <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Date Created</TableHead>
          <TableHead className={accentHeader ? "text-slate-100 font-semibold" : ""}>Status</TableHead>
          <TableHead className={accentHeader ? "text-slate-100 font-semibold w-[110px]" : "w-[110px]"}>Details</TableHead>
          <TableHead className={accentHeader ? "text-slate-100 font-semibold w-[120px]" : "w-[120px]"}>Action</TableHead>
          {showRowActions && <TableHead className={accentHeader ? "text-slate-100 font-semibold w-[120px]" : "w-[120px]"}>Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((req) => (
          <TableRow key={req.id} className={accentHeader ? workflowTableRowClass : undefined}>
            {selectable && (
              <TableCell>
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input bg-background"
                  checked={selectedIds.includes(req.id)}
                  disabled={req.status !== "PENDING"}
                  onChange={() => onToggle?.(req.id)}
                  aria-label={`Select ${req.title}`}
                />
              </TableCell>
            )}
            <TableCell className="font-medium">{req.title}</TableCell>
            <TableCell>{req.type.replace(/_/g, " ")}</TableCell>
            <TableCell className={accentHeader ? "text-slate-300" : "text-muted-foreground"}>
              {new Date(req.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Badge
                variant={statusVariant[req.status]}
                className={
                  req.status === "CREATED"
                    ? "rounded-full border-transparent bg-zinc-500 px-3 py-1 font-bold text-white"
                    : req.status === "PENDING"
                    ? "rounded-full border-transparent bg-blue-600 px-3 py-1 font-bold text-white"
                    : req.status === "APPROVED"
                    ? "rounded-full border-transparent bg-emerald-700 px-3 py-1 font-bold text-white"
                    : req.status === "REJECTED"
                    ? "rounded-full border-transparent bg-red-600 px-3 py-1 font-bold text-white"
                    : "rounded-full border-transparent bg-zinc-700 px-3 py-1 font-bold text-white"
                }
              >
                {req.status}
              </Badge>
            </TableCell>
            <TableCell>
              <Button size="sm" variant="outline" className={modernOutlineBtn} onClick={() => onViewDetails?.(req.id)}>
                Details
              </Button>
            </TableCell>
            <TableCell>
              {req.status === "CREATED" ? (
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className={modernOutlineBtn} onClick={() => onEditDraft?.(req.id)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" className={modernCancelBtn} onClick={() => onCancelCreated?.(req.id)}>
                    Delete
                  </Button>
                </div>
              ) : req.status === "CLOSED" ? (
                <Button size="sm" variant="ghost" className={modernCancelBtn} onClick={() => onCancelCreated?.(req.id)}>
                  Delete
                </Button>
              ) : req.status === "PENDING" ? (
                <Button size="sm" variant="ghost" className={modernCancelBtn} onClick={() => onCancelCreated?.(req.id)}>
                  Cancel
                </Button>
              ) : (
                "—"
              )}
            </TableCell>
            {showRowActions && (
              <TableCell>
                {req.status === "PENDING" ? (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className={modernApproveIconBtn}
                      onClick={() => onApprove?.(req.id)}
                      aria-label="Approve"
                    >
                      <Check className="size-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={modernRejectIconBtn}
                      onClick={() => onReject?.(req.id)}
                      aria-label="Reject"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});
