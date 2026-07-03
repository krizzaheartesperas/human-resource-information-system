"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AttendanceCorrectionType } from "@/features/attendance/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  correctionDate: string;
  setCorrectionDate: (v: string) => void;
  correctionType: AttendanceCorrectionType;
  setCorrectionType: (v: AttendanceCorrectionType) => void;
  correctionReason: string;
  setCorrectionReason: (v: string) => void;
  correctionProofUrl: string;
  setCorrectionProofUrl: (v: string) => void;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
};

export function AttendanceCorrectionDialog({
  open,
  onOpenChange,
  correctionDate,
  setCorrectionDate,
  correctionType,
  setCorrectionType,
  correctionReason,
  setCorrectionReason,
  correctionProofUrl,
  setCorrectionProofUrl,
  error,
  onSubmit,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit attendance correction</DialogTitle>
          <DialogDescription>
            Send a correction request to HR/your manager. This is a demo form; later it will be
            connected to the workflow engine.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="corr-date">Date</Label>
            <input
              id="corr-date"
              type="date"
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
              value={correctionDate}
              onChange={(e) => setCorrectionDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="corr-type">Issue type</Label>
            <select
              id="corr-type"
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
              value={correctionType}
              onChange={(e) => setCorrectionType(e.target.value as AttendanceCorrectionType)}
            >
              <option value="MISSING_CLOCK_IN">Missing clock in</option>
              <option value="MISSING_CLOCK_OUT">Missing clock out</option>
              <option value="WRONG_TIME">Wrong time</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="corr-reason">Reason</Label>
            <textarea
              id="corr-reason"
              rows={3}
              className="w-full rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm resize-y"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Briefly explain why this attendance record is incorrect."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="corr-proof">Proof (optional)</Label>
            <input
              id="corr-proof"
              type="url"
              className="flex h-9 w-full rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
              value={correctionProofUrl}
              onChange={(e) => setCorrectionProofUrl(e.target.value)}
              placeholder="Link to proof (screenshot in drive, etc.)"
            />
            <p className="text-xs text-muted-foreground">
              You can paste a link to a screenshot or document that supports this request.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Submit request</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
