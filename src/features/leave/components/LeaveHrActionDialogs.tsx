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
import { departments, getEmployeeById, type LeaveRequest, type TimeOffType } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type BalanceRow = {
  employeeId: string;
  type: TimeOffType;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  balanceDays: number;
};

type Props = {
  hrFinalizeTarget: LeaveRequest | null;
  setHrFinalizeTarget: (value: LeaveRequest | null) => void;
  hrReturnTarget: LeaveRequest | null;
  setHrReturnTarget: (value: LeaveRequest | null) => void;
  hrReturnReason: string;
  setHrReturnReason: (value: string) => void;
  hrReturnTo: "HR_STAFF" | "DEPARTMENT_MANAGER";
  setHrReturnTo: (value: "HR_STAFF" | "DEPARTMENT_MANAGER") => void;
  calculateInclusiveDays: (start: string, end: string) => number;
  balances: BalanceRow[];
  hrFinalizeRequest: (requestId: string) => void;
  hrReturnForReview: (
    requestId: string,
    toRole: "HR_STAFF" | "DEPARTMENT_MANAGER",
    reason: string
  ) => void;
};

export function LeaveHrActionDialogs({
  hrFinalizeTarget,
  setHrFinalizeTarget,
  hrReturnTarget,
  setHrReturnTarget,
  hrReturnReason,
  setHrReturnReason,
  hrReturnTo,
  setHrReturnTo,
  calculateInclusiveDays,
  balances,
  hrFinalizeRequest,
  hrReturnForReview,
}: Props) {
  return (
    <>
      <Dialog open={!!hrFinalizeTarget} onOpenChange={(open) => { if (!open) setHrFinalizeTarget(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalize &amp; record</DialogTitle>
            <DialogDescription>
              This will mark the request as Final Approved and update leave balances.
            </DialogDescription>
          </DialogHeader>
          {hrFinalizeTarget && (
            <div className="space-y-4">
              {(() => {
                const emp = getEmployeeById(hrFinalizeTarget.employeeId);
                const deptName =
                  departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                const days = calculateInclusiveDays(hrFinalizeTarget.startDate, hrFinalizeTarget.endDate);
                const bal = balances.find((b) => b.employeeId === hrFinalizeTarget.employeeId && b.type === hrFinalizeTarget.type);
                const total = bal?.totalDays ?? 0;
                const used = bal?.usedDays ?? 0;
                const pending = bal?.pendingDays ?? 0;
                const remaining = bal?.balanceDays ?? Math.max(0, total - used - pending);
                const wasReserved = days > 0 && (Boolean(hrFinalizeTarget.balanceReserved) || pending >= days);
                const remainingAfter = wasReserved ? remaining : Math.max(0, remaining - days);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Employee</div>
                      <div className="font-medium">{hrFinalizeTarget.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{deptName} • {emp?.jobTitle ?? "—"}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Leave details</div>
                      <div className="font-medium">{formatLeaveType(hrFinalizeTarget.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(hrFinalizeTarget.startDate).toLocaleDateString()} – {new Date(hrFinalizeTarget.endDate).toLocaleDateString()} • {days} day(s)
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
                      <div className="text-xs text-muted-foreground">System update preview</div>
                      <div className="mt-1 grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Available now</div>
                          <div className="font-medium">{remaining}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">
                            {wasReserved ? "Pending to used" : "Deducted"}
                          </div>
                          <div className="font-medium">{wasReserved ? days : `-${days}`}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Remaining after</div>
                          <div className="font-medium">{remainingAfter}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => setHrFinalizeTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!hrFinalizeTarget) return;
                hrFinalizeRequest(hrFinalizeTarget.id);
                setHrFinalizeTarget(null);
              }}
            >
              Finalize &amp; Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hrReturnTarget} onOpenChange={(open) => { if (!open) { setHrReturnTarget(null); setHrReturnReason(""); setHrReturnTo("HR_STAFF"); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Return for review</DialogTitle>
            <DialogDescription>
              Use this when there is a policy/compliance issue. The request will be marked Returned for Review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="hr-return-to">Returned to</Label>
              <select
                id="hr-return-to"
                value={hrReturnTo}
                onChange={(e) => setHrReturnTo(e.target.value as "HR_STAFF" | "DEPARTMENT_MANAGER")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="HR_STAFF">HR Staff</option>
                <option value="DEPARTMENT_MANAGER">Department Manager</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr-return-reason">Reason</Label>
              <Input
                id="hr-return-reason"
                value={hrReturnReason}
                onChange={(e) => setHrReturnReason(e.target.value)}
                placeholder="e.g. Wrong leave category / missing compliance"
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => { setHrReturnTarget(null); setHrReturnReason(""); setHrReturnTo("HR_STAFF"); }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!hrReturnTarget || !hrReturnReason.trim()}
              onClick={() => {
                if (!hrReturnTarget) return;
                hrReturnForReview(hrReturnTarget.id, hrReturnTo, hrReturnReason);
                setHrReturnTarget(null);
                setHrReturnReason("");
                setHrReturnTo("HR_STAFF");
              }}
            >
              Return for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
