"use client";

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
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import type { LeaveRequest, TimeOffType } from "@/lib/mock";

type PolicyViewId =
  | "maxLeaveCreditsPerYear"
  | "carryOverRules"
  | "noticePeriodDays"
  | "requiredAttachments"
  | "minimumServiceMonths"
  | null;

type HrPolicies = {
  maxLeaveCreditsPerYear: number;
  allowCarryOver: boolean;
  carryOverMaxDays: number;
  noticePeriodDays: number;
  requireAttachmentsFor: TimeOffType[];
  minimumServiceMonths: number;
};

type Props = {
  policyViewId: PolicyViewId;
  setPolicyViewId: (value: PolicyViewId) => void;
  hrPoliciesSaved: HrPolicies;
  hmApproveTarget: LeaveRequest | null;
  setHmApproveTarget: (value: LeaveRequest | null) => void;
  hmRejectTarget: LeaveRequest | null;
  setHmRejectTarget: (value: LeaveRequest | null) => void;
  hmReturnTarget: LeaveRequest | null;
  setHmReturnTarget: (value: LeaveRequest | null) => void;
  hmRemarks: string;
  setHmRemarks: (value: string) => void;
  hmRejectReason: string;
  setHmRejectReason: (value: string) => void;
  hmReturnReason: string;
  setHmReturnReason: (value: string) => void;
  hmException: boolean;
  setHmException: (value: boolean) => void;
  hmApproveRequest: (requestId: string, remarks?: string, asException?: boolean) => void;
  hmRejectRequest: (requestId: string, reason: string, remarks: string) => void;
  hmReturnReview: (requestId: string, reason: string) => void;
};

export function LeavePolicyAndHrManagerDialogs({
  policyViewId,
  setPolicyViewId,
  hrPoliciesSaved,
  hmApproveTarget,
  setHmApproveTarget,
  hmRejectTarget,
  setHmRejectTarget,
  hmReturnTarget,
  setHmReturnTarget,
  hmRemarks,
  setHmRemarks,
  hmRejectReason,
  setHmRejectReason,
  hmReturnReason,
  setHmReturnReason,
  hmException,
  setHmException,
  hmApproveRequest,
  hmRejectRequest,
  hmReturnReview,
}: Props) {
  return (
    <>
      <Dialog open={!!policyViewId} onOpenChange={(open) => { if (!open) setPolicyViewId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Policy details</DialogTitle>
            <DialogDescription>
              View the current policy configuration.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            {policyViewId === "maxLeaveCreditsPerYear" && (
              <div>
                <div className="font-medium">Maximum leave credits per year</div>
                <div className="text-muted-foreground mt-1">
                  Default maximum annual credits: <span className="font-medium">{hrPoliciesSaved.maxLeaveCreditsPerYear}</span> days.
                </div>
              </div>
            )}
            {policyViewId === "carryOverRules" && (
              <div>
                <div className="font-medium">Carry-over rules</div>
                <div className="text-muted-foreground mt-1">
                  Carry-over: <span className="font-medium">{hrPoliciesSaved.allowCarryOver ? "Enabled" : "Disabled"}</span>
                  {hrPoliciesSaved.allowCarryOver && (
                    <>
                      {" "}• Max carry-over: <span className="font-medium">{hrPoliciesSaved.carryOverMaxDays}</span> days
                    </>
                  )}
                </div>
              </div>
            )}
            {policyViewId === "noticePeriodDays" && (
              <div>
                <div className="font-medium">Notice period before applying</div>
                <div className="text-muted-foreground mt-1">
                  Employees must submit at least <span className="font-medium">{hrPoliciesSaved.noticePeriodDays}</span> day(s) before start date.
                </div>
              </div>
            )}
            {policyViewId === "requiredAttachments" && (
              <div>
                <div className="font-medium">Required attachments</div>
                <div className="text-muted-foreground mt-1">
                  Supporting documents are required for:
                </div>
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {hrPoliciesSaved.requireAttachmentsFor.map((t) => (
                    <li key={t}>{formatLeaveType(t)}</li>
                  ))}
                </ul>
              </div>
            )}
            {policyViewId === "minimumServiceMonths" && (
              <div>
                <div className="font-medium">Minimum service before eligibility</div>
                <div className="text-muted-foreground mt-1">
                  Minimum tenure required: <span className="font-medium">{hrPoliciesSaved.minimumServiceMonths}</span> month(s).
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" onClick={() => setPolicyViewId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hmApproveTarget} onOpenChange={(open) => { if (!open) { setHmApproveTarget(null); setHmRemarks(""); setHmException(false); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>HR Manager approval</DialogTitle>
            <DialogDescription>
              Approve/reject or return for review. You can approve as exception if needed.
            </DialogDescription>
          </DialogHeader>
          {hmApproveTarget && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Request</div>
                <div className="font-medium">{hmApproveTarget.employeeName}</div>
                <div className="text-xs text-muted-foreground">
                  {formatLeaveType(hmApproveTarget.type)} • {new Date(hmApproveTarget.startDate).toLocaleDateString()} – {new Date(hmApproveTarget.endDate).toLocaleDateString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  Reason: {hmApproveTarget.reason}
                </div>
              </div>
              <label className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">Approve as exception</span>
                <input type="checkbox" className="size-4" checked={hmException} onChange={(e) => setHmException(e.target.checked)} />
              </label>
              <div className="space-y-2">
                <Label htmlFor="hm-remarks">Remarks (optional)</Label>
                <Input id="hm-remarks" className="h-10" value={hmRemarks} onChange={(e) => setHmRemarks(e.target.value)} placeholder="Optional remarks / exception notes" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => { setHmApproveTarget(null); setHmRemarks(""); setHmException(false); }}>
              Cancel
            </Button>
            <Button type="button" onClick={() => { if (!hmApproveTarget) return; hmApproveRequest(hmApproveTarget.id, hmRemarks, hmException); setHmApproveTarget(null); setHmRemarks(""); setHmException(false); }}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hmRejectTarget} onOpenChange={(open) => { if (!open) { setHmRejectTarget(null); setHmRejectReason(""); setHmRemarks(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>Rejection reason and remarks are required.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="hm-reject-reason">Rejection reason</Label>
              <Input id="hm-reject-reason" className="h-10" value={hmRejectReason} onChange={(e) => setHmRejectReason(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hm-reject-remarks">Remarks</Label>
              <Input id="hm-reject-remarks" className="h-10" value={hmRemarks} onChange={(e) => setHmRemarks(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => { setHmRejectTarget(null); setHmRejectReason(""); setHmRemarks(""); }}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={!hmRejectTarget || !hmRejectReason.trim() || !hmRemarks.trim()} onClick={() => { if (!hmRejectTarget) return; hmRejectRequest(hmRejectTarget.id, hmRejectReason, hmRemarks); setHmRejectTarget(null); setHmRejectReason(""); setHmRemarks(""); }}>
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hmReturnTarget} onOpenChange={(open) => { if (!open) { setHmReturnTarget(null); setHmReturnReason(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return for review</DialogTitle>
            <DialogDescription>Send the request back for clarification (HR Admin).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="hm-return-reason">Reason</Label>
            <Input id="hm-return-reason" className="h-10" value={hmReturnReason} onChange={(e) => setHmReturnReason(e.target.value)} placeholder="Policy issue / clarification needed" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => { setHmReturnTarget(null); setHmReturnReason(""); }}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={!hmReturnTarget || !hmReturnReason.trim()} onClick={() => { if (!hmReturnTarget) return; hmReturnReview(hmReturnTarget.id, hmReturnReason); setHmReturnTarget(null); setHmReturnReason(""); }}>
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
