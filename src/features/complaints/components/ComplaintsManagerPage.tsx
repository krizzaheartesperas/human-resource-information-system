"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  FileText,
} from "lucide-react";
import { employees } from "@/lib/mock";

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

type Complaint = {
  id: string;
  title: string;
  description?: string;
  employeeName?: string;
  typeLabel?: string;
  departmentName?: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  isAnonymous?: boolean;
  employeeId?: string;
  departmentId?: string;
  dateOfIncident?: string;
  createdAt: string;
  assignedHr?: string;
  managerRequestReason?: string;
};
type StoredComplaintRow = {
  id: string;
  title?: string;
  description?: string;
  employeeName?: string;
  type?: string;
  departmentName?: string;
  priority?: ComplaintPriority;
  status?: ComplaintStatus;
  isAnonymous?: boolean;
  createdByEmployeeId?: string;
  departmentId?: string;
  dateOfIncident?: string;
  submittedAt?: string;
  managerRequestReason?: string;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaintsForManager(): Complaint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredComplaintRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => ({
      id: c.id,
      title: c.title ?? "Untitled",
      description: c.description,
      // keep any stored name but mainly rely on employeeId for lookup
      employeeName: c.employeeName,
      typeLabel: c.type ?? "Complaint",
      departmentName: c.departmentName,
      priority: (c.priority ?? "MEDIUM") as ComplaintPriority,
      status: (c.status ?? "SUBMITTED") as ComplaintStatus,
      isAnonymous: !!c.isAnonymous,
      employeeId: c.createdByEmployeeId,
      departmentId: c.departmentId,
      dateOfIncident: c.dateOfIncident,
      createdAt: c.submittedAt ?? new Date().toISOString(),
      assignedHr: "HR Officer",
      managerRequestReason: c.managerRequestReason,
    }));
  } catch {
    return [];
  }
}

export default function ComplaintsManagerPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const complaintsCardClass = [
    "rounded-[32px] border-none shadow-sm",
    theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]",
  ].join(" ");
  const searchParams = useSearchParams();
  const confirmDialogClass = [
    "max-w-md rounded-3xl border px-6 py-5 shadow-xl",
    theme === "dark"
      ? "border-[#2e3d62] bg-[#1B223D] text-slate-50"
      : "border-border/60 bg-white text-[#192853]",
  ].join(" ");
  const confirmIconWrapClass = [
    "mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full",
    theme === "dark" ? "bg-[#FFE14E]/20 text-[#FFE14E]" : "bg-[#192853]/10 text-[#192853]",
  ].join(" ");
  const [complaints, setComplaints] = useState<Complaint[]>(() => loadComplaintsForManager());
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    complaintId: string;
    action: "approve" | "further" | "reject" | "close-case";
  } | null>(null);

  const requestedPanel = searchParams.get("panel");
  const panel =
    requestedPanel === "approval" || requestedPanel === "escalated" || requestedPanel === "overview"
      ? requestedPanel
      : "overview";
  const navigatePanel = (nextPanel: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("panel", nextPanel);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const selectedComplaint = useMemo(
    () => complaints.find((c) => c.id === selectedComplaintId) ?? null,
    [complaints, selectedComplaintId]
  );

  const totalComplaints = complaints.length;
  const pendingApproval = complaints.filter(
    (c) => c.status === "INVESTIGATION_COMPLETED",
  ).length;
  const underInvestigation = complaints.filter(
    (c) => c.status === "INVESTIGATING",
  ).length;
  const escalatedCount = complaints.filter((c) => c.status === "ESCALATED").length;
  const resolvedCount = complaints.filter((c) => c.status === "RESOLVED").length;

  const recentComplaints = useMemo(
    () =>
      [...complaints].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [complaints]
  );

  const approvalComplaints = complaints.filter(
    (c) => c.status === "INVESTIGATION_COMPLETED",
  );

  const escalatedComplaints = complaints.filter(
    (c) => c.status === "ESCALATED" || c.priority === "URGENT"
  );

  // Only HR roles can see this manager dashboard
  if (
    user.role !== "SUPER_ADMIN" &&
    user.role !== "HR_ADMIN" &&
    user.role !== "HR_MANAGER" &&
    user.role !== "DEPARTMENT_MANAGER"
  ) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          Complaints (HR)
        </h1>
        <Card className={complaintsCardClass}>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              This complaints dashboard is only available to HR managers and admins.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reporterLabel = (c: Complaint): string => {
    if (c.isAnonymous) {
      return "Anonymous";
    }

    // For HR roles (this page), we can show the reporter's full name.
    if (c.employeeId) {
      const emp = employees.find((e) => e.id === c.employeeId);
      if (emp) {
        return `${emp.firstName} ${emp.lastName}`;
      }
    }

    // Fallbacks
    if (c.employeeName) return c.employeeName;
    if (c.employeeId) return c.employeeId;
    return "Employee";
  };

  const updateComplaintStatus = (id: string, nextStatus: ComplaintStatus) => {
    setComplaints((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, status: nextStatus } : c
      );
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as StoredComplaintRow[];
            const next = parsed.map((c) =>
              c.id === id ? { ...c, status: nextStatus } : c
            );
            window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(next));
          }
        } catch {
          // ignore
        }
      }
      return updated;
    });
  };

  const handleConfirmManagerAction = () => {
    if (!pendingAction) return;
    const { complaintId, action } = pendingAction;

    if (action === "approve") {
      updateComplaintStatus(complaintId, "RESOLVED");
    } else if (action === "further") {
      updateComplaintStatus(complaintId, "FURTHER_INVESTIGATION_REQUIRED");
    } else if (action === "reject") {
      updateComplaintStatus(complaintId, "WITHDRAWN");
    } else if (action === "close-case") {
      // Close high-priority case (treat as resolved)
      updateComplaintStatus(complaintId, "RESOLVED");
    }

    setPendingAction(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search complaints..." />
        <EmployeeSectionHeader
          title="Complaints"
          tabs={[
            { id: "overview", label: "Complaints Overview" },
            { id: "approval", label: "Complaint Approval" },
            { id: "escalated", label: "High Priority Complaints" },
          ]}
          activeTab={panel}
          onTabChange={navigatePanel}
        />
      </div>

      {/* Details dialog (used by Overview + Approval actions) */}
      <Dialog open={detailsOpen && !!selectedComplaint} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-4xl rounded-2xl px-8 py-6">
          {selectedComplaint && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">
                  Complaint {selectedComplaint.id}
                </DialogTitle>
                <DialogDescription>
                  Reporter: {reporterLabel(selectedComplaint)} · Department:{" "}
                  {selectedComplaint.departmentName ?? "—"}.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 space-y-5 text-sm">
                {/* Form-style layout */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Complaint Title
                    </p>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {selectedComplaint.title}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Complaint Type
                    </p>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {selectedComplaint.typeLabel ?? "Complaint"}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Priority
                    </p>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {selectedComplaint.priority}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Date of Incident
                    </p>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                      {selectedComplaint.dateOfIncident ?? "—"}
                    </div>
                  </div>
                </div>

                {selectedComplaint.description && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">
                      Description
                    </p>
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground max-h-56 overflow-y-auto scrollbar-hide whitespace-pre-wrap">
                      {selectedComplaint.description}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Panel 1: Complaints Overview */}
      {panel === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardDescription>Total Complaints</CardDescription>
                <CardTitle className="text-2xl">{totalComplaints}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  All complaints submitted in the system.
                </p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardDescription>Pending Approval</CardDescription>
                <CardTitle className="text-2xl">{pendingApproval}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Awaiting HR manager decision.
                </p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardDescription>Under Investigation</CardDescription>
                <CardTitle className="text-2xl">{underInvestigation}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Currently handled by HR staff.
                </p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardDescription>High Priority Complaints</CardDescription>
                <CardTitle className="text-2xl">{escalatedCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Escalated or urgent cases needing attention.
                </p>
              </CardContent>
            </Card>
            <Card className={complaintsCardClass}>
              <CardHeader className="pb-2">
                <CardDescription>Resolved Complaints</CardDescription>
                <CardTitle className="text-2xl">{resolvedCount}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Successfully closed complaints.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                Recent complaints
              </CardTitle>
              <CardDescription>
                A quick view of the latest complaint activity. Use the Complaint Approval and
                Escalated tabs for deeper review.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentComplaints.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No complaints have been submitted yet.
                </p>
              ) : (
                <div className="rounded-md border border-border max-h-[60vh] overflow-y-auto scrollbar-hide">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Complaint ID</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assigned HR</TableHead>
                        <TableHead className="w-40 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentComplaints.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.id}</TableCell>
                          <TableCell>{reporterLabel(c)}</TableCell>
                          <TableCell>{c.typeLabel ?? "Complaint"}</TableCell>
                          <TableCell>{c.departmentName ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                c.priority === "HIGH" || c.priority === "URGENT"
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {c.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {c.status === "SUBMITTED" && c.managerRequestReason
                                ? "Further Investigation Required"
                                : c.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{c.assignedHr ?? "HR Officer"}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              onClick={() => {
                                setSelectedComplaintId(c.id);
                                setDetailsOpen(true);
                              }}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Panel 2: Complaint Approval */}
      {panel === "approval" && (
        <Card className={complaintsCardClass}>
          <CardHeader>
            <CardTitle>Complaint Approval</CardTitle>
            <CardDescription>
              Complaints where HR staff finished investigation and are awaiting your decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {approvalComplaints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There are no complaints pending HR manager approval at the moment.
              </p>
            ) : (
              <div className="rounded-md border border-border max-h-[70vh] overflow-y-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Complaint ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Complaint Type</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>HR Officer</TableHead>
                      <TableHead>Investigation Completed</TableHead>
                      <TableHead className="w-64 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalComplaints.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell>{reporterLabel(c)}</TableCell>
                        <TableCell>{c.typeLabel ?? "Complaint"}</TableCell>
                        <TableCell>{c.departmentName ?? "—"}</TableCell>
                        <TableCell>HR Officer</TableCell>
                        <TableCell className="text-sm text-foreground text-center">
                          Yes
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                            <Link href={paths.complaintManagerApproval(c.id)}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full px-3 py-1 text-xs"
                              >
                                Review Investigation
                              </Button>
                            </Link>
                            <Button
                              variant="default"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              onClick={() =>
                                setPendingAction({ complaintId: c.id, action: "approve" })
                              }
                            >
                              Approve Resolution
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              onClick={() =>
                                router.push(`${paths.complaintManagerApproval(c.id)}&requestFurther=1`)
                              }
                            >
                              Request Further Investigation
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              onClick={() =>
                                setPendingAction({ complaintId: c.id, action: "reject" })
                              }
                            >
                              Reject Resolution
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Manager Action dialog */}
      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
      >
        <DialogContent className={confirmDialogClass}>
          <DialogHeader className="space-y-2 text-center">
            <div className={confirmIconWrapClass}>
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold text-center">
              {pendingAction?.action === "approve" && "Approve this resolution?"}
              {pendingAction?.action === "reject" && "Reject this resolution?"}
              {pendingAction?.action === "close-case" && "Close this high-priority case?"}
            </DialogTitle>
            <DialogDescription
              className={`text-sm leading-relaxed ${
                theme === "dark" ? "text-slate-200" : "text-muted-foreground"
              }`}
            >
              {pendingAction?.action === "approve" &&
                "Approving the resolution will mark this complaint as resolved in the system."}
              {pendingAction?.action === "reject" &&
                "Rejecting the resolution will mark this complaint as withdrawn and close the current proposal."}
              {pendingAction?.action === "close-case" &&
                "Closing this case will treat the high-priority complaint as resolved and remove it from this list."}
            </DialogDescription>
          </DialogHeader>
          <div className="my-3 h-px bg-border/60" />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-3xl px-4 py-1.5 text-sm"
              onClick={() => setPendingAction(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-3xl px-5 py-1.5 text-sm shadow-sm"
              onClick={handleConfirmManagerAction}
            >
              {pendingAction?.action === "approve" && "Approve"}
              {pendingAction?.action === "further" && "Send Request"}
              {pendingAction?.action === "reject" && "Reject"}
              {pendingAction?.action === "close-case" && "Close Case"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Panel 3: High Priority Complaints */}
      {panel === "escalated" && (
        <Card className={complaintsCardClass}>
          <CardHeader>
            <CardTitle>High Priority Complaints</CardTitle>
            <CardDescription>
              High-risk or sensitive complaints that have been escalated to HR management.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {escalatedComplaints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There are no escalated complaints right now. Urgent complaints will appear here for
                additional review.
              </p>
            ) : (
              <div className="rounded-md border border-border max-h-[70vh] overflow-y-auto scrollbar-hide">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Complaint ID</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Escalated By</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-64 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {escalatedComplaints.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell>{reporterLabel(c)}</TableCell>
                        <TableCell>{c.typeLabel ?? "Complaint"}</TableCell>
                        <TableCell>{c.departmentName ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{c.priority}</Badge>
                        </TableCell>
                        <TableCell>HR Officer</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {c.status === "FURTHER_INVESTIGATION_REQUIRED"
                              ? "Further Investigation Required"
                              : c.status ?? "ESCALATED"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex flex-col items-end gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                            <Link href={paths.complaintManagerEscalated(c.id)}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full px-3 py-1 text-xs"
                              >
                                Review Case
                              </Button>
                            </Link>
                            <Link href={`${paths.complaintManagerEscalated(c.id)}&assign=1`}>
                              <Button
                                variant="default"
                                size="sm"
                                className="rounded-full px-3 py-1 text-xs"
                              >
                                Assign Investigation Team
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              onClick={() =>
                                setPendingAction({ complaintId: c.id, action: "close-case" })
                              }
                            >
                              Close Case
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
