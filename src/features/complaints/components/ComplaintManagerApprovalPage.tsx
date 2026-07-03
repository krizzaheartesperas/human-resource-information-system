"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { useTheme } from "@/components/theme/ThemeProvider";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { employees, departments } from "@/lib/mock";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "INVESTIGATED"
  | "FURTHER_INVESTIGATION_REQUIRED"
  | "INVESTIGATION_COMPLETED"
  | "RESOLVED"
  | "WITHDRAWN"
  | "ESCALATED";

type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type StoredComplaint = {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: ComplaintPriority;
  departmentId: string;
  departmentName: string;
  submittedAt: string;
  dateOfIncident?: string;
  status: ComplaintStatus | string;
  isAnonymous?: boolean;
  createdByEmployeeId?: string;
  hrResponse?: string;
  investigationNotes?: string;
  hrRecommendation?: string;
  managerRequestReason?: string;
  witnessRecords?: Array<{ name?: string; statement?: string }>;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaintById(id: string): StoredComplaint | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredComplaint[];
    if (!Array.isArray(parsed)) return null;
    return parsed.find((c) => c.id === id) ?? null;
  } catch {
    return null;
  }
}

export default function ComplaintApprovalDetailsPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { theme, toggleTheme } = useTheme();
  const complaintsCardClass = [
    "rounded-[32px] border-none shadow-sm",
    theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]",
  ].join(" ");
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const complaint = params?.id ? loadComplaintById(params.id) : null;
  const autoOpenRequestDialog = searchParams.get("requestFurther") === "1";
  const [requestDialogOpen, setRequestDialogOpen] = useState(autoOpenRequestDialog);
  const [requestReason, setRequestReason] = useState("");
  const [confirmRequestOpen, setConfirmRequestOpen] = useState(false);
  const [requestHasError, setRequestHasError] = useState(false);

  const departmentName =
    complaint?.departmentName ??
    departments.find((d) => d.id === complaint?.departmentId)?.name ??
    "—";

  const reporterLabel = useMemo(() => {
    if (!complaint) return "";
    if (complaint.isAnonymous) {
      return "Anonymous";
    }
    if (complaint.createdByEmployeeId) {
      const emp = employees.find((e) => e.id === complaint.createdByEmployeeId);
      if (emp) {
        return `${emp.firstName} ${emp.lastName}`;
      }
    }
    return "Employee";
  }, [complaint]);

  const updateStatus = (nextStatus: ComplaintStatus, reason?: string) => {
    if (!complaint) return;
    const id = complaint.id;

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as StoredComplaint[];
          const updated = parsed.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: nextStatus,
                  managerRequestReason: reason ?? c.managerRequestReason,
                }
              : c
          );
          window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch {
        // ignore
      }
    }

    // Navigate back to approval tab so manager sees updated table
    router.push(`${paths.complaints}?panel=approval`);
  };

  const canAccessPage =
    user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN" || user.role === "HR_MANAGER";

  if (!canAccessPage) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaint Investigation
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              This page is restricted to HR managers and admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 -mt-2">
      {/* Topbar */}
      <div className="space-y-3 mt-[10px]">
        <div className="flex items-center gap-4">
          {/* Breadcrumb */}
          <div className="flex flex-1 items-center gap-1.5 text-base text-muted-foreground">
            <button
              type="button"
              onClick={() => router.push(`${paths.complaints}?panel=approval`)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="font-semibold">Complaints</span>
              <ChevronRight className="size-3" />
              <span>Complaint Approval</span>
            </button>
            <span className="opacity-70">&gt;</span>
            <span className="font-semibold text-foreground">
              Complaint {complaint?.id ?? ""}
            </span>
          </div>

          {/* Center search bar (placeholder) */}
          <div className="hidden">
            <div className="w-full max-w-lg">
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
                <Search className="size-5 opacity-70" />
                <input
                  type="text"
                  placeholder="Search complaints..."
                  className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:ring-transparent focus-visible:border-transparent topbar-search-input"
                />
              </div>
            </div>
          </div>

          {/* Right icons */}
          <div className="flex-1 flex justify-end items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
            </Button>
            <NotificationsBellMenu iconClassName="size-5" />
            <SettingsIconLink iconClassName="size-5" />
            <TopbarAccountMenu />
          </div>
        </div>
      </div>

      {!complaint ? (
        <Card className={complaintsCardClass}>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            This complaint could not be found in local history.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Complaint Information */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-4" />
                Complaint {complaint.id}
              </CardTitle>
              <CardDescription>
                Investigation details for{" "}
                {reporterLabel === "Anonymous"
                  ? "an anonymous reporter"
                  : reporterLabel}{" "}
                regarding {complaint.type.replace(/_/g, " ")}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Employee
                  </p>
                  <p className="text-sm text-foreground">{reporterLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Complaint Type
                  </p>
                  <p className="text-sm text-foreground">
                    {complaint.type.replace(/_/g, " ")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Department
                  </p>
                  <p className="text-sm text-foreground">{departmentName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Priority
                  </p>
                  <Badge
                    variant={
                      complaint.priority === "HIGH" || complaint.priority === "URGENT"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {complaint.priority}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Date Submitted
                  </p>
                  <p className="text-sm text-foreground">
                    {complaint.submittedAt
                      ? new Date(complaint.submittedAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Date of Incident
                  </p>
                  <p className="text-sm text-foreground">
                    {complaint.dateOfIncident ?? "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Complaint Description */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Complaint Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-foreground">
                {complaint.description}
              </p>
            </CardContent>
          </Card>

          {/* HR Officer Investigation Summary */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">HR Officer Investigation Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap text-foreground">
                {(
                  complaint?.hrResponse ??
                  complaint?.investigationNotes ??
                  "Investigation notes from HR Staff will appear here once they are recorded in the system."
                ) as string}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="size-3" />
                Latest notes provided by HR Staff handling this complaint.
              </p>
            </CardContent>
          </Card>

          {/* HR Officer Recommendation */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">HR Officer Recommendation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="whitespace-pre-wrap text-foreground">
                {(
                  complaint?.hrRecommendation ??
                  "The HR officer's recommendation will appear here after they record it in the investigation panel."
                ) as string}
              </p>
            </CardContent>
          </Card>

          {/* Witness Records */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Witness Records</CardTitle>
              <CardDescription>
                People interviewed or who provided statements related to this complaint.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(complaint?.witnessRecords ?? []).length === 0 ? (
                <p className="text-muted-foreground">
                  No witness records were provided by HR Staff for this investigation.
                </p>
              ) : (
                <div className="rounded-md border border-border bg-muted/30">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-48">Witness Name</TableHead>
                        <TableHead>Statement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(complaint?.witnessRecords ?? []).map(
                        (w, idx: number) => (
                          <TableRow key={`${w?.name ?? "witness"}-${idx}`}>
                            <TableCell className="align-top">
                              {w?.name ?? "Unnamed witness"}
                            </TableCell>
                            <TableCell className="align-top">
                              {w?.statement ?? "—"}
                            </TableCell>
                          </TableRow>
                        ),
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investigation Timeline */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Investigation Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="space-y-2">
                {["Submitted", "Under Review", "Investigating", "Investigation Completed"].map(
                  (step, index) => (
                    <li key={step} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-[#192853]" />
                      <span>
                        <span className="font-medium">{step}</span>
                        {index < 3 && (
                          <span className="ml-1 text-muted-foreground">
                            &rarr; completed
                          </span>
                        )}
                        {index === 3 && (
                          <span className="ml-1 text-muted-foreground">
                            &rarr; current stage
                          </span>
                        )}
                      </span>
                    </li>
                  )
                )}
              </ol>
            </CardContent>
          </Card>

          {/* HR Manager Decision Panel */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">HR Manager Decision</CardTitle>
              <CardDescription>
                Review the investigation details and choose how to proceed.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="default"
                className="rounded-full px-4"
                onClick={() => updateStatus("RESOLVED")}
              >
                Approve Resolution
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-4"
                onClick={() => {
                  setRequestReason("");
                  setRequestDialogOpen(true);
                }}
              >
                Request Further Investigation
              </Button>
              <Button
                variant="ghost"
                className="rounded-full px-4 text-red-700 hover:text-red-800"
                onClick={() => updateStatus("WITHDRAWN")}
              >
                Reject Resolution
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Request Additional Investigation dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Request Additional Investigation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please provide the reason for requesting further investigation. This will be visible
              to HR staff assigned to the case.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
              Reason for additional investigation
            </label>
            <textarea
              className={`mt-1 min-h-[120px] w-full rounded-md border px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 ${
                requestHasError
                  ? "border-red-500 bg-red-50 focus-visible:ring-red-500"
                  : "border-border bg-muted/40 focus-visible:ring-[#192853]"
              }`}
              placeholder="Additional witness statements are required to support the investigation findings."
              value={requestReason}
              onChange={(e) => {
                const value = e.target.value;
                setRequestReason(value);
                if (requestHasError && value.trim().length > 0) {
                  setRequestHasError(false);
                }
              }}
            />
            {requestHasError && (
              <p className="text-xs text-red-600">
                Please provide a brief explanation before sending this request.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setRequestDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => {
                const reason = requestReason.trim();
                if (!reason) {
                  setRequestHasError(true);
                  return;
                }

                setConfirmRequestOpen(true);
              }}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm send additional investigation request */}
      <Dialog
        open={confirmRequestOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmRequestOpen(false);
        }}
      >
        <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-card px-6 py-5 shadow-xl">
          <DialogHeader className="space-y-2 text-center">
            <div
              className={`mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full ${
                theme === "dark" ? "bg-[#FFE14E]/20 text-[#FFE14E]" : "bg-[#192853]/10 text-[#192853]"
              }`}
            >
              <CalendarDays className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold text-center">
              Send request for additional investigation?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              This will return the complaint to HR Staff with your reason for further investigation.
            </DialogDescription>
          </DialogHeader>
          <div className="my-3 h-px bg-border/60" />
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-3xl px-4 py-1.5 text-sm"
              onClick={() => setConfirmRequestOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-3xl px-5 py-1.5 text-sm shadow-sm"
              onClick={() => {
                const reason = requestReason.trim();
                if (!reason) {
                  // Safety check; main dialog already enforces this.
                  alert(
                    "Please provide a reason for requesting additional investigation before sending the request.",
                  );
                  setConfirmRequestOpen(false);
                  return;
                }
                updateStatus("FURTHER_INVESTIGATION_REQUIRED", reason);
                setConfirmRequestOpen(false);
                setRequestDialogOpen(false);
              }}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

