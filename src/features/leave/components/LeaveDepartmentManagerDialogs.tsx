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
import { departments, getEmployeeById, type LeaveRequest } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type Props = {
  dmApproveTarget: LeaveRequest | null;
  setDmApproveTarget: (value: LeaveRequest | null) => void;
  dmRejectTarget: LeaveRequest | null;
  setDmRejectTarget: (value: LeaveRequest | null) => void;
  dmRemarks: string;
  setDmRemarks: (value: string) => void;
  dmRejectReason: string;
  setDmRejectReason: (value: string) => void;
  calculateInclusiveDays: (start: string, end: string) => number;
  requests: LeaveRequest[];
  deptManagerEmployeeIds: string[];
  dmApproveRequest: (requestId: string, remarks?: string) => void;
  dmRejectRequest: (requestId: string, reason: string, remarks: string) => void;
};

export function LeaveDepartmentManagerDialogs({
  dmApproveTarget,
  setDmApproveTarget,
  dmRejectTarget,
  setDmRejectTarget,
  dmRemarks,
  setDmRemarks,
  dmRejectReason,
  setDmRejectReason,
  calculateInclusiveDays,
  requests,
  deptManagerEmployeeIds,
  dmApproveRequest,
  dmRejectRequest,
}: Props) {
  return (
    <>
      <Dialog open={!!dmApproveTarget} onOpenChange={(open) => { if (!open) { setDmApproveTarget(null); setDmRemarks(""); } }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Approve leave request</DialogTitle>
            <DialogDescription>
              Review team impact and add remarks (optional) before approving.
            </DialogDescription>
          </DialogHeader>
          {dmApproveTarget && (
            <div className="space-y-4">
              {(() => {
                const emp = getEmployeeById(dmApproveTarget.employeeId);
                const deptName =
                  departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                const days = calculateInclusiveDays(dmApproveTarget.startDate, dmApproveTarget.endDate);
                const teamConflicts = requests.filter((r) => {
                  if (r.id === dmApproveTarget.id) return false;
                  if (!deptManagerEmployeeIds.includes(r.employeeId)) return false;
                  if (r.status === "REJECTED" || r.status === "CANCELLED") return false;
                  return r.startDate <= dmApproveTarget.endDate && r.endDate >= dmApproveTarget.startDate;
                });
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Employee</div>
                      <div className="font-medium">{dmApproveTarget.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{deptName} • {emp?.jobTitle ?? "—"}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Leave details</div>
                      <div className="font-medium">{formatLeaveType(dmApproveTarget.type)}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(dmApproveTarget.startDate).toLocaleDateString()} – {new Date(dmApproveTarget.endDate).toLocaleDateString()} • {days} day(s)
                      </div>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
                      <div className="text-xs text-muted-foreground">Team impact preview</div>
                      <div className="text-sm">
                        <span className="font-medium">{teamConflicts.length}</span> team member(s) have overlapping leave dates.
                      </div>
                      {teamConflicts.length > 0 && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-1">
                          {teamConflicts.slice(0, 4).map((r) => (
                            <div key={r.id} className="flex items-center justify-between gap-2">
                              <span className="truncate">{r.employeeName}</span>
                              <span className="shrink-0">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</span>
                            </div>
                          ))}
                          {teamConflicts.length > 4 && (
                            <div>+{teamConflicts.length - 4} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label htmlFor="dm-approve-remarks">Remarks (optional)</Label>
                <Input
                  id="dm-approve-remarks"
                  value={dmRemarks}
                  onChange={(e) => setDmRemarks(e.target.value)}
                  placeholder="Optional remarks for HR Admin / employee"
                  className="h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => { setDmApproveTarget(null); setDmRemarks(""); }}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!dmApproveTarget) return;
                dmApproveRequest(dmApproveTarget.id, dmRemarks);
                setDmApproveTarget(null);
                setDmRemarks("");
              }}
            >
              Approve request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!dmRejectTarget} onOpenChange={(open) => { if (!open) { setDmRejectTarget(null); setDmRejectReason(""); setDmRemarks(""); } }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>
              Rejection reason and remarks are required. The request will be returned to the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="dm-reject-reason">Rejection reason</Label>
              <Input
                id="dm-reject-reason"
                value={dmRejectReason}
                onChange={(e) => setDmRejectReason(e.target.value)}
                placeholder="e.g. Schedule conflict / insufficient coverage"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dm-reject-remarks">Remarks</Label>
              <Input
                id="dm-reject-remarks"
                value={dmRemarks}
                onChange={(e) => setDmRemarks(e.target.value)}
                placeholder="Add details for the employee"
                className="h-10"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => { setDmRejectTarget(null); setDmRejectReason(""); setDmRemarks(""); }}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!dmRejectTarget || !dmRejectReason.trim() || !dmRemarks.trim()}
              onClick={() => {
                if (!dmRejectTarget) return;
                dmRejectRequest(dmRejectTarget.id, dmRejectReason, dmRemarks);
                setDmRejectTarget(null);
                setDmRejectReason("");
                setDmRemarks("");
              }}
            >
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
