"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Maximize2, Minimize2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatLeaveRequestDate, formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import { leaveTypeMetadata, type LeaveRequest, type LeaveStatus, type Role, type TimeOffType } from "@/lib/mock";

type LeaveTypeOption = { value: TimeOffType; label: string };

type DraftBalanceRow = {
  type: TimeOffType;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  balanceDays: number;
};

type Props = {
  detailRequest: LeaveRequest | null;
  setDetailRequest: (value: LeaveRequest | null) => void;
  mapStatusToStep?: (status: LeaveStatus, submitterRole?: Role) => 1 | 2 | 3 | 4;
  getSubmitterRole?: (request: LeaveRequest) => Role;
  currentUserRole: Role;
  currentResolvedSubmitterRole?: Role;
  currentUserName: string;
  currentUserEmployeeNumber?: string;
  isOwnRequest?: (request: LeaveRequest) => boolean;
  calculateInclusiveDays: (start: string, end: string) => number;
  leaveTypeOptions?: LeaveTypeOption[];
  draftBalanceRows?: DraftBalanceRow[];
  onSubmitLeaveDraft?: (payload: {
    draft: LeaveRequest;
    type: TimeOffType;
    startDate: string;
    endDate: string;
    reason: string;
    attachFile: File | null;
  }) => void;
  detailDraftSubmitError?: string;
  openDocPreview: (dataUrl: string, name: string) => void;
  docPreview: { url: string; name: string } | null;
  docMaximized: boolean;
  setDocMaximized: Dispatch<SetStateAction<boolean>>;
  closeDocPreview: () => void;
};

function DraftLeaveDetailForm({
  draft,
  leaveTypeOptions,
  draftBalanceRows,
  detailDraftSubmitError,
  onSubmit,
  openDocPreview,
}: {
  draft: LeaveRequest;
  leaveTypeOptions: LeaveTypeOption[];
  draftBalanceRows: DraftBalanceRow[];
  detailDraftSubmitError?: string;
  onSubmit: NonNullable<Props["onSubmitLeaveDraft"]>;
  openDocPreview: (dataUrl: string, name: string) => void;
}) {
  const [type, setType] = useState<TimeOffType>(draft.type);
  const [start, setStart] = useState(draft.startDate ?? "");
  const [end, setEnd] = useState(draft.endDate ?? "");
  const [reason, setReason] = useState(draft.reason ?? "");
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setType(draft.type);
    setStart(draft.startDate ?? "");
    setEnd(draft.endDate ?? "");
    setReason(draft.reason ?? "");
    setAttachFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }, [draft.id]);

  const resolvedExistingDocUrl = (draft.supportingDocDataUrl ?? "").trim();

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Draft</span>
        {" — "}
        Edit your request below. Submit request opens the same confirmation dialog as Request leave, then follows the
        standard approval flow.
      </div>

      <div className="space-y-1 text-sm">
        <div className="text-xs text-muted-foreground">Employee</div>
        <div className="font-medium">
          {draft.employeeName}{" "}
          <span className="text-muted-foreground font-normal">({draft.employeeNumber})</span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-detail-type">Leave type</Label>
        <select
          id="draft-detail-type"
          value={type}
          onChange={(e) => setType(e.target.value as TimeOffType)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          {leaveTypeOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="text-sm font-medium text-foreground">Leave policy for {leaveTypeMetadata[type].label}</div>
          <dl className="grid gap-1.5 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Paid or Unpaid:</dt>
              <dd className="font-medium">{leaveTypeMetadata[type].paid ? "Paid" : "Unpaid"}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Salary status:</dt>
              <dd>{leaveTypeMetadata[type].salaryStatus}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Notes:</dt>
              <dd>{leaveTypeMetadata[type].notes}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="draft-detail-start">Start date</Label>
          <Input id="draft-detail-start" type="date" className="h-10" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="draft-detail-end">End date</Label>
          <Input id="draft-detail-end" type="date" className="h-10" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        {(() => {
          const b = draftBalanceRows.find((r) => r.type === type);
          const total = b?.totalDays ?? 0;
          const used = b?.usedDays ?? 0;
          const pending = b?.pendingDays ?? 0;
          const balance = b?.balanceDays ?? Math.max(0, total - used - pending);
          if (!total && !used && !pending && !balance) {
            return "No configured balance for this leave type yet.";
          }
          return `For ${formatLeaveType(type)} you have ${balance} day(s) remaining (Used ${used}, Pending ${pending}, Total ${total}).`;
        })()}
      </div>

      <div className="space-y-2">
        <Label htmlFor="draft-detail-reason">Reason</Label>
        <Input
          id="draft-detail-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Family trip, medical appointment"
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-muted-foreground font-normal">
          <Upload className="size-4" />
          Supporting document (optional)
        </Label>
        <div className="flex h-10 items-center rounded-md border border-input bg-background overflow-hidden">
          <input
            ref={fileRef}
            id="draft-detail-doc"
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(e) => setAttachFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-full rounded-r-none border-0 border-r border-input bg-muted/50 px-4 font-medium shrink-0"
            onClick={() => fileRef.current?.click()}
          >
            Choose file
          </Button>
          <span className="flex-1 min-w-0 px-3 py-2 text-sm text-muted-foreground truncate">
            {attachFile?.name ?? "No new file chosen"}
          </span>
        </div>
        {!attachFile && draft.supportingDocName ? (
          <div className="rounded-md border border-border bg-muted/30 p-3 flex flex-wrap items-center gap-2 text-sm">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <span className="truncate font-medium flex-1 min-w-0" title={draft.supportingDocName}>
              Current: {draft.supportingDocName}
            </span>
            {resolvedExistingDocUrl || /^https?:\/\//i.test(draft.supportingDocDataUrl ?? "") ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 shrink-0"
                onClick={() =>
                  openDocPreview(
                    resolvedExistingDocUrl || (draft.supportingDocDataUrl ?? "").trim(),
                    draft.supportingDocName!
                  )
                }
              >
                <ExternalLink className="size-4" />
                Open current
              </Button>
            ) : null}
          </div>
        ) : null}
        {attachFile ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-destructive"
            onClick={() => {
              setAttachFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            <X className="size-4 mr-1" />
            Remove new file
          </Button>
        ) : null}
      </div>

      {detailDraftSubmitError ? <p className="text-sm text-destructive">{detailDraftSubmitError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          onClick={() => onSubmit({ draft, type, startDate: start, endDate: end, reason, attachFile })}
        >
          Submit request
        </Button>
      </div>
    </div>
  );
}

export function LeaveDetailAndPreviewDialogs({
  detailRequest,
  setDetailRequest,
  mapStatusToStep: _mapStatusToStep,
  getSubmitterRole,
  currentUserRole,
  currentResolvedSubmitterRole,
  currentUserName,
  currentUserEmployeeNumber,
  isOwnRequest,
  calculateInclusiveDays,
  leaveTypeOptions,
  draftBalanceRows,
  onSubmitLeaveDraft,
  detailDraftSubmitError,
  openDocPreview,
  docPreview,
  docMaximized,
  setDocMaximized,
  closeDocPreview,
}: Props) {
  const isFinalState = (status: LeaveStatus) =>
    status === "FINAL_APPROVED" ||
    status === "APPLIED" ||
    status === "APPROVED" ||
    status === "PENDING_FINALIZATION" ||
    status === "PENDING_RECORDING";

  const isRejectedState = (status: LeaveStatus) =>
    status === "REJECTED" || status === "CANCELLED";

  const normalizeSubmitterRoleForFlow = (
    status: LeaveStatus,
    submitterRole: Role,
    isLikelyOwnRequest: boolean
  ): Role => {
    // For own requests, always trust the resolved current-user role lane.
    // This avoids stale/inferred role mismatches in historical records.
    if (isLikelyOwnRequest) {
      const ownRole = currentResolvedSubmitterRole ?? currentUserRole;
      return ownRole;
    }

    // Legacy DM rows can miss submitter role metadata.
    if (
      submitterRole === "EMPLOYEE" &&
      (status === "PENDING_HR_MANAGER_APPROVAL" || status === "PENDING_HR_STAFF_PROCESSING")
    ) {
      return currentUserRole === "DEPARTMENT_MANAGER" || currentUserRole === "MANAGER"
        ? currentUserRole
        : submitterRole;
    }

    return submitterRole;
  };

  const resolveStepForDisplay = (
    status: LeaveStatus,
    submitterRole: Role,
    isLikelyOwnRequest: boolean
  ): 1 | 2 | 3 | 4 => {
    if (status === "DRAFT") return 1;
    if (isRejectedState(status) || status === "FINAL_APPROVED" || status === "APPLIED") return 4;

    const role = normalizeSubmitterRoleForFlow(status, submitterRole, isLikelyOwnRequest);

    // Department Manager / Manager own flow:
    // 1 Submitted -> 2 HR Staff forward -> 3 HR Manager finalize -> 4 Finalized
    if (role === "DEPARTMENT_MANAGER" || role === "MANAGER") {
      if (status === "PENDING_HR_MANAGER_APPROVAL") return 3;
      if (isFinalState(status)) return 4;
      // Just submitted DM own request should remain on step 1 until HR Staff forwards.
      if (status === "PENDING_HR_STAFF_PROCESSING" || status === "PENDING_APPROVAL") return 1;
      return 1;
    }

    if (role === "EMPLOYEE") {
      if (status === "PENDING_HR_STAFF_PROCESSING" || status === "PENDING_HR_STAFF_PROCESSING_AUDITOR") return 3;
      // Just submitted employee request should remain on step 1
      // until Department Manager action happens.
      if (status === "PENDING_APPROVAL") return 1;
      if (isFinalState(status)) return 4;
      return 1;
    }
    if (role === "HR_STAFF") {
      if (status === "PENDING_HR_MANAGER_APPROVAL") return 2;
      if (isFinalState(status)) return 4;
      return 1;
    }
    if (role === "HR_ADMIN") {
      if (status === "PENDING_EXECUTIVE_APPROVAL") return 3;
      if (status === "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN" || status === "PENDING_HR_MANAGER_APPROVAL") return 2;
      if (isFinalState(status)) return 4;
      return 1;
    }
    if (role === "HR_MANAGER") {
      if (status === "PENDING_EXECUTIVE_APPROVAL") return 2;
      if (isFinalState(status)) return 4;
      return 1;
    }

    if (status === "PENDING_HR_STAFF_PROCESSING" || status === "PENDING_HR_MANAGER_APPROVAL" || status === "PENDING_EXECUTIVE_APPROVAL") {
      return 3;
    }
    if (status === "PENDING_APPROVAL") return 2;
    return 1;
  };

  const getFlowLabels = (
    status: LeaveStatus,
    submitterRole: Role,
    isFinalRejected: boolean
  ): [string, string, string, string] => {
    const finalLabel = isFinalRejected ? "Finalized (Rejected/Cancelled)" : "Finalized";

    // Regular employee flow: Submitted -> Dept Manager Approve -> HR Staff Process -> Finalized
    if (submitterRole === "EMPLOYEE") {
      return ["Submitted", "Department Manager approve", "HR Staff process", finalLabel];
    }
    if (submitterRole === "AUDITOR" || submitterRole === "SUPER_ADMIN" || submitterRole === "BOARD") {
      return ["Submitted", "HR Staff process", "Final decision", finalLabel];
    }
    if (submitterRole === "DEPARTMENT_MANAGER" || submitterRole === "MANAGER") {
      return ["Submitted", "HR Staff forward", "HR Manager finalize", finalLabel];
    }
    if (submitterRole === "HR_STAFF") {
      return ["Submitted", "HR Manager review", "Final decision", finalLabel];
    }
    if (submitterRole === "HR_ADMIN") {
      return ["Submitted", "HR Manager approve", "Executive review", finalLabel];
    }
    if (submitterRole === "HR_MANAGER") {
      return ["Submitted", "Executive review", "Final decision", finalLabel];
    }
    if (submitterRole === "EXECUTIVE") {
      return ["Submitted", "Auto/optional executive confirmation", "Final decision", finalLabel];
    }
    // Fallback keeps the regular employee chain.
    void status;
    return ["Submitted", "Department Manager approve", "HR Staff process", finalLabel];
  };

  const getRealStageSummary = (status: LeaveStatus, submitterRole: Role): string => {
    if (status === "DRAFT") return "Real stage: Draft (not submitted for approval)";
    if (status === "REJECTED") return "Real stage: Rejected";
    if (status === "CANCELLED") return "Real stage: Cancelled";
    if (status === "FINAL_APPROVED" || status === "APPLIED" || status === "APPROVED") {
      return "Real stage: Finalized";
    }
    if (submitterRole === "EMPLOYEE") {
      if (status === "PENDING_APPROVAL") return "Real stage: Awaiting Department Manager approval";
      if (status === "PENDING_HR_STAFF_PROCESSING") return "Real stage: Awaiting HR Staff processing";
    }
    if (submitterRole === "DEPARTMENT_MANAGER" || submitterRole === "MANAGER") {
      if (status === "PENDING_APPROVAL") return "Real stage: Awaiting HR Staff forwarding";
      if (status === "PENDING_HR_STAFF_PROCESSING") return "Real stage: Awaiting HR Staff forwarding";
      if (status === "PENDING_HR_MANAGER_APPROVAL") return "Real stage: Awaiting HR Manager finalization";
      if (isFinalState(status)) return "Real stage: Finalized by HR Manager";
    }
    return `Real stage: ${status.replace(/_/g, " ")}`;
  };

  const draftEditorActive =
    detailRequest?.status === "DRAFT" &&
    typeof onSubmitLeaveDraft === "function" &&
    Array.isArray(leaveTypeOptions) &&
    leaveTypeOptions.length > 0 &&
    Array.isArray(draftBalanceRows) &&
    draftBalanceRows.length > 0;

  return (
    <>
      <Dialog open={!!detailRequest} onOpenChange={(open) => !open && setDetailRequest(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {draftEditorActive ? "Edit draft leave request" : "Leave request details"}
            </DialogTitle>
            {detailRequest && !draftEditorActive && (
              <DialogDescription>
                {formatLeaveType(detailRequest.type)} • {formatLeaveRequestDate(detailRequest.startDate)} –{" "}
                {formatLeaveRequestDate(detailRequest.endDate)}
              </DialogDescription>
            )}
            {detailRequest && draftEditorActive && (
              <DialogDescription>
                {formatLeaveType(detailRequest.type)} — saved {new Date(detailRequest.createdAt).toLocaleString()}
              </DialogDescription>
            )}
          </DialogHeader>
          {detailRequest && draftEditorActive && onSubmitLeaveDraft && leaveTypeOptions && draftBalanceRows ? (
            <DraftLeaveDetailForm
              draft={detailRequest}
              leaveTypeOptions={leaveTypeOptions}
              draftBalanceRows={draftBalanceRows}
              detailDraftSubmitError={detailDraftSubmitError}
              onSubmit={onSubmitLeaveDraft}
              openDocPreview={openDocPreview}
            />
          ) : null}
          {detailRequest && !draftEditorActive && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Status flow
                </div>
                {(() => {
                  if (detailRequest.status === "DRAFT") {
                    return (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        This entry is a draft and has not been submitted for approval. When you are ready, use{" "}
                        <span className="font-medium text-foreground">Request leave</span>, enter the same details, and
                        choose <span className="font-medium text-foreground">Submit request</span>.
                      </p>
                    );
                  }
                  const baseSubmitterRole =
                    typeof getSubmitterRole === "function"
                      ? getSubmitterRole(detailRequest)
                      : "EMPLOYEE";
                  const reqName = (detailRequest.employeeName ?? "").trim().toLowerCase();
                  const curName = (currentUserName ?? "").trim().toLowerCase();
                  const reqNo = (detailRequest.employeeNumber ?? "").trim().toUpperCase();
                  const curNo = (currentUserEmployeeNumber ?? "").trim().toUpperCase();
                  const isLikelyOwnRequest =
                    (isOwnRequest?.(detailRequest) ?? false) ||
                    (!!reqNo && !!curNo && reqNo === curNo) ||
                    (!!reqName && !!curName && reqName === curName);
                  const submitterRole = normalizeSubmitterRoleForFlow(
                    detailRequest.status,
                    baseSubmitterRole,
                    isLikelyOwnRequest
                  );
                  const step = resolveStepForDisplay(
                    detailRequest.status,
                    submitterRole,
                    isLikelyOwnRequest
                  );
                  const isFinalRejected =
                    detailRequest.status === "REJECTED" ||
                    detailRequest.status === "CANCELLED";
                  const labels = getFlowLabels(detailRequest.status, submitterRole, isFinalRejected);
                  const steps = [
                    { id: 1, label: labels[0] },
                    { id: 2, label: labels[1] },
                    { id: 3, label: labels[2] },
                    { id: 4, label: labels[3] },
                  ];
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        {steps.map((s) => {
                          const active = s.id <= step;
                          return (
                            <div key={s.id} className="flex-1 flex flex-col items-center">
                              <div
                                className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-semibold border ${
                                  active
                                    ? isFinalRejected && s.id === step
                                      ? "bg-destructive text-destructive-foreground border-destructive"
                                      : "bg-primary text-primary-foreground border-primary"
                                    : "bg-background text-muted-foreground border-border"
                                }`}
                              >
                                {s.id}
                              </div>
                              <span className="mt-1 text-[11px] text-center text-muted-foreground">
                                {s.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center gap-1 px-3">
                        <div className="h-0.5 flex-1 rounded-full bg-primary/40" />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Current status:{" "}
                        <span className="font-medium">
                          {detailRequest.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {getRealStageSummary(detailRequest.status, submitterRole)}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Employee</div>
                  <div className="font-medium">{detailRequest.employeeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {detailRequest.employeeNumber}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Leave type</div>
                  <div className="font-medium">
                    {formatLeaveType(detailRequest.type)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {calculateInclusiveDays(detailRequest.startDate, detailRequest.endDate)} day(s)
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Date range</div>
                  <div>
                    {formatLeaveRequestDate(detailRequest.startDate)} – {formatLeaveRequestDate(detailRequest.endDate)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div>
                    {new Date(detailRequest.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Reason</div>
                  <div className="whitespace-pre-wrap">{detailRequest.reason}</div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <div className="text-xs text-muted-foreground">Supporting document</div>
                  {(() => {
                    const fallbackDocUrl = (detailRequest.supportingDocName ?? "").trim();
                    const resolvedDocUrl = (detailRequest.supportingDocDataUrl ?? "").trim()
                      || (/^(data:|blob:|https?:\/\/)/i.test(fallbackDocUrl) ? fallbackDocUrl : "");
                    if (!detailRequest.supportingDocName) {
                      return <span className="text-xs text-muted-foreground">No document attached.</span>;
                    }
                    if (!resolvedDocUrl) {
                      return (
                        <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                          <FileText className="size-4" />
                          <span>{detailRequest.supportingDocName}</span>
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        onClick={() => openDocPreview(resolvedDocUrl, detailRequest.supportingDocName!)}
                      >
                        <FileText className="size-4" />
                        <span>{detailRequest.supportingDocName}</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!docPreview} onOpenChange={(open) => { if (!open) closeDocPreview(); }}>
        <DialogContent
          className={`flex flex-col p-0 gap-0 max-w-4xl max-h-[90vh] ${docMaximized ? "w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] rounded-xl overflow-hidden" : ""}`}
        >
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-muted-foreground" />
              {docPreview?.name ?? "Document preview"}
            </DialogTitle>
          </DialogHeader>
          <button
            type="button"
            aria-label={docMaximized ? "Exit maximize" : "Maximize"}
            onClick={() => setDocMaximized((v) => !v)}
            className="absolute right-14 top-4 rounded-full bg-muted/60 p-1.5 opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {docMaximized ? (
              <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
            <span className="sr-only">Toggle maximize</span>
          </button>
          <div className={`flex-1 min-h-0 ${docMaximized ? "p-0" : "px-6 pb-6"}`}>
            {docPreview?.url && (
              <iframe
                src={docPreview.url}
                title={docPreview?.name ?? "Document preview"}
                className={`w-full ${docMaximized ? "h-full min-h-0 rounded-md border border-border bg-muted/20" : "h-[70vh] min-h-[400px] rounded-md border border-border bg-muted/20"}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
