"use client";

import type { RefObject } from "react";
import { ClipboardList, ExternalLink, FileText, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leaveTypeMetadata, type LeaveRequest, type Role, type TimeOffType } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type LeaveTypeOption = {
  value: TimeOffType;
  label: string;
};

type BalanceRow = {
  type: TimeOffType;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  balanceDays: number;
};

type Props = {
  currentUserRole: Role;
  requestLeaveOpen: boolean;
  leaveSubmitConfirmOpen: boolean;
  pendingLeaveRequest: LeaveRequest | null;
  setRequestLeaveOpen: (open: boolean) => void;
  setLeaveSubmitConfirmOpen: (open: boolean) => void;
  setPendingLeaveRequest: (value: LeaveRequest | null) => void;
  /** Clears staged file when the submit-confirm dialog is dismissed without completing. */
  onLeaveSubmitConfirmDismiss?: () => void;
  handleSubmitLeaveRequest: (e: React.FormEvent<HTMLFormElement>) => void;
  confirmSubmitLeaveRequest: () => void | Promise<void>;
  leaveSubmitInProgress: boolean;
  /** When set, shows "Save as draft" for in-progress forms (e.g. main leave workspace). */
  onSaveLeaveDraft?: () => void | Promise<void>;
  leaveDraftSaveInProgress?: boolean;
  leaveTypeOptions: LeaveTypeOption[];
  newLeaveType: TimeOffType;
  setNewLeaveType: (value: TimeOffType) => void;
  newLeaveStart: string;
  setNewLeaveStart: (value: string) => void;
  newLeaveEnd: string;
  setNewLeaveEnd: (value: string) => void;
  newLeaveReason: string;
  setNewLeaveReason: (value: string) => void;
  newLeaveError: string;
  supportingDocument: File | null;
  setSupportingDocument: (file: File | null) => void;
  supportDocInputRef: RefObject<HTMLInputElement | null>;
  myBalanceRows: BalanceRow[];
};

export function LeaveRequestDialogs({
  currentUserRole,
  requestLeaveOpen,
  leaveSubmitConfirmOpen,
  pendingLeaveRequest,
  setRequestLeaveOpen,
  setLeaveSubmitConfirmOpen,
  setPendingLeaveRequest,
  onLeaveSubmitConfirmDismiss,
  handleSubmitLeaveRequest,
  confirmSubmitLeaveRequest,
  leaveSubmitInProgress,
  onSaveLeaveDraft,
  leaveDraftSaveInProgress = false,
  leaveTypeOptions,
  newLeaveType,
  setNewLeaveType,
  newLeaveStart,
  setNewLeaveStart,
  newLeaveEnd,
  setNewLeaveEnd,
  newLeaveReason,
  setNewLeaveReason,
  newLeaveError,
  supportingDocument,
  setSupportingDocument,
  supportDocInputRef,
  myBalanceRows,
}: Props) {
  const flowByRole: Record<Role, string> = {
    EMPLOYEE: "Department Manager -> HR Staff -> Final approval",
    AUDITOR: "HR Staff -> Final approval",
    DEPARTMENT_MANAGER: "HR Staff -> HR Manager -> Final approval",
    MANAGER: "HR Staff -> HR Manager -> Final approval",
    HR_STAFF: "HR Manager -> Final approval",
    HR_ADMIN: "HR Manager -> Executive (optional) -> Final approval",
    HR_MANAGER: "Executive -> Final approval",
    EXECUTIVE: "Optional / auto approval (finalized on confirm)",
    SUPER_ADMIN: "HR Staff -> Final approval",
    BOARD: "HR Staff -> Final approval",
  };

  const activeFlow = flowByRole[currentUserRole] ?? flowByRole.EMPLOYEE;

  return (
    <>
      <Dialog
        open={requestLeaveOpen}
        onOpenChange={(open) => {
          if (!open && leaveSubmitConfirmOpen) return;
          setRequestLeaveOpen(open);
          if (!open) {
            setLeaveSubmitConfirmOpen(false);
            setPendingLeaveRequest(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request. It will follow the standard approval flow below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitLeaveRequest} className="space-y-5">
            <div className="rounded-md border border-dashed border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="font-medium text-foreground text-sm flex items-center gap-2">
                <ClipboardList className="size-4 text-muted-foreground" />
                This request will be reviewed by:
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="font-medium">{activeFlow}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-leave-type">Leave type</Label>
              <select
                id="new-leave-type"
                value={newLeaveType}
                onChange={(e) => setNewLeaveType(e.target.value as TimeOffType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {leaveTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <ClipboardList className="size-4 text-muted-foreground" />
                  Leave policy for {leaveTypeMetadata[newLeaveType].label}
                </div>
                <dl className="grid gap-1.5 text-sm">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">Paid or Unpaid:</dt>
                    <dd className="font-medium">{leaveTypeMetadata[newLeaveType].paid ? "Paid" : "Unpaid"}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">Salary status:</dt>
                    <dd>{leaveTypeMetadata[newLeaveType].salaryStatus}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="text-muted-foreground">Notes:</dt>
                    <dd>{leaveTypeMetadata[newLeaveType].notes}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-leave-start">Start date</Label>
                <Input id="new-leave-start" type="date" className="h-10" value={newLeaveStart} onChange={(e) => setNewLeaveStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-leave-end">End date</Label>
                <Input id="new-leave-end" type="date" className="h-10" value={newLeaveEnd} onChange={(e) => setNewLeaveEnd(e.target.value)} />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              {(() => {
                const b = myBalanceRows.find((r) => r.type === newLeaveType);
                const total = b?.totalDays ?? 0;
                const used = b?.usedDays ?? 0;
                const pending = b?.pendingDays ?? 0;
                const balance = b?.balanceDays ?? Math.max(0, total - used - pending);
                if (!total && !used && !pending && !balance) {
                  return "No configured balance for this leave type yet.";
                }
                return `For ${formatLeaveType(newLeaveType)} you have ${balance} day(s) remaining (Used ${used}, Pending ${pending}, Total ${total}).`;
              })()}
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-leave-reason">Reason</Label>
              <Input
                id="new-leave-reason"
                value={newLeaveReason}
                onChange={(e) => setNewLeaveReason(e.target.value)}
                placeholder="e.g. Family trip, medical appointment"
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground font-normal">
                <Upload className="size-4" />
                Upload supporting document (optional)
              </Label>
              <div className="space-y-2">
                <div className="flex h-10 items-center rounded-md border border-input bg-background overflow-hidden">
                  <input
                    ref={supportDocInputRef}
                    id="supporting-doc"
                    type="file"
                    accept=".pdf,application/pdf"
                    className="sr-only"
                    onChange={(e) => setSupportingDocument(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" size="sm" className="h-full rounded-r-none border-0 border-r border-input bg-muted/50 px-4 font-medium shrink-0" onClick={() => supportDocInputRef.current?.click()}>
                    Choose file
                  </Button>
                  <span className="flex-1 min-w-0 px-3 py-2 text-sm text-muted-foreground truncate">
                    {supportingDocument?.name ?? "No file chosen"}
                  </span>
                </div>
                {supportingDocument && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground truncate flex-1" title={supportingDocument.name}>
                        {supportingDocument.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(supportingDocument.size / 1024).toFixed(1)} KB)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setSupportingDocument(null);
                          if (supportDocInputRef.current) supportDocInputRef.current.value = "";
                        }}
                        aria-label="Remove file"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto gap-2"
                      onClick={() => {
                        const url = URL.createObjectURL(supportingDocument);
                        window.open(url, "_blank", "noopener,noreferrer");
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                      }}
                    >
                      <ExternalLink className="size-4" />
                      Open to review
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {newLeaveError && <p className="text-sm text-destructive">{newLeaveError}</p>}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setRequestLeaveOpen(false)}>
                Cancel
              </Button>
              {onSaveLeaveDraft ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onSaveLeaveDraft()}
                  disabled={leaveDraftSaveInProgress || leaveSubmitInProgress}
                >
                  {leaveDraftSaveInProgress ? "Saving…" : "Save as draft"}
                </Button>
              ) : null}
              <Button type="submit" disabled={leaveSubmitInProgress || leaveDraftSaveInProgress}>
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={leaveSubmitConfirmOpen}
        onOpenChange={(open) => {
          setLeaveSubmitConfirmOpen(open);
          if (!open) {
            setPendingLeaveRequest(null);
            onLeaveSubmitConfirmDismiss?.();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mx-auto rounded-full bg-muted/60 p-2 ring-1 ring-border">
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <DialogTitle className="text-base text-center">Confirm Leave Request Submission</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to submit this Leave Request? Please ensure that the information
              provided is accurate.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Submitting false or misleading leave requests may lead to disciplinary action in line with company policy.
          </div>
          {newLeaveError ? (
            <p className="text-sm text-destructive pt-2" role="alert">
              {newLeaveError}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setLeaveSubmitConfirmOpen(false);
                setPendingLeaveRequest(null);
                onLeaveSubmitConfirmDismiss?.();
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmSubmitLeaveRequest} disabled={!pendingLeaveRequest || leaveSubmitInProgress}>
              Submit Leave Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
