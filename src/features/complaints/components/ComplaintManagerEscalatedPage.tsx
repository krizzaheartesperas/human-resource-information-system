"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "ESCALATED"
  | "RESOLVED"
  | "WITHDRAWN";

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
  leadInvestigatorId?: string;
  supportingInvestigatorIds?: string[];
  investigationDueDate?: string;
  investigationNotes?: string;
  assignedHr?: string;
  managerRequestReason?: string;
  caseClosedDate?: string;
  resolutionStatus?: string;
  disciplinaryAction?: string;
  hrResponse?: string;
};

type DisciplinaryCase = {
  id: string;
  employeeId?: string;
  employeeName: string;
  complaintId: string;
  violation: string;
  createdAt: string;
  createdBy: string;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";
const DISCIPLINARY_STORAGE_KEY = "hris-disciplinary-cases";

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

function appendDisciplinaryCase(entry: DisciplinaryCase) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(DISCIPLINARY_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as DisciplinaryCase[]) : [];
    const list = Array.isArray(existing) ? existing : [];
    window.localStorage.setItem(
      DISCIPLINARY_STORAGE_KEY,
      JSON.stringify([...list, entry]),
    );
  } catch {
    // ignore storage errors
  }
}

export default function HighPriorityComplaintDetailsPage() {
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
  const [complaint, setComplaint] = useState<StoredComplaint | null>(() =>
    params?.id ? loadComplaintById(params.id) : null,
  );
  const [assignOpen, setAssignOpen] = useState(searchParams.get("assign") !== null);
  const [leadId, setLeadId] = useState<string>("");
  const [supportingIds, setSupportingIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [closeOpen, setCloseOpen] = useState(searchParams.get("close") !== null);
  const [resolutionStatus, setResolutionStatus] = useState<string>("Resolved");
  const [disciplinaryAction, setDisciplinaryAction] = useState<string>("");
  const [resolutionSummary, setResolutionSummary] = useState<string>("");
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestReason, setRequestReason] = useState<string>("");
  const [disciplinaryPromptOpen, setDisciplinaryPromptOpen] = useState(false);

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

  const hrInvestigators = useMemo(
    () =>
      employees.filter((e) =>
        ["HR_ADMIN", "HR_MANAGER", "HR_STAFF"].includes(e.role as string)
      ),
    []
  );

  const handleAssignTeam = () => {
    if (!complaint) return;
    if (!leadId) {
      alert("Please select a lead investigator before assigning a team.");
      return;
    }

    const id = complaint.id;
    const nextStatus: ComplaintStatus = "INVESTIGATING";

    const leadEmployee = hrInvestigators.find((e) => e.id === leadId);
    const leadName = leadEmployee
      ? `${leadEmployee.firstName} ${leadEmployee.lastName}`
      : complaint?.assignedHr ?? "HR Officer";

    // Update local storage
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
                  assignedHr: leadName,
                  leadInvestigatorId: leadId || c.leadInvestigatorId,
                  supportingInvestigatorIds:
                    supportingIds.length > 0
                      ? supportingIds
                      : c.supportingInvestigatorIds,
                  investigationDueDate: dueDate || c.investigationDueDate,
                  investigationNotes: notes || c.investigationNotes,
                }
              : c,
          );
          window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(updated));
        }
      } catch {
        // ignore
      }
    }

    setComplaint((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: nextStatus,
            leadInvestigatorId: leadId || prev.leadInvestigatorId,
            supportingInvestigatorIds:
              supportingIds.length > 0 ? supportingIds : prev.supportingInvestigatorIds,
            investigationDueDate: dueDate || prev.investigationDueDate,
            investigationNotes: notes || prev.investigationNotes,
          }
        : prev,
    );
    setAssignOpen(false);
    // Navigate back to escalated complaints list so manager sees updated status/team
    router.push(`${paths.complaints}?panel=escalated`);
  };

  const canAssignTeam = complaint?.status === "ESCALATED";
  const canCloseCase =
    complaint?.status === "INVESTIGATING" || complaint?.status === "ESCALATED";

  const handleCloseCase = (createDisciplinaryCase: boolean) => {
    if (!complaint) return;
    const id = complaint.id;
    const closedAt = new Date().toISOString();
    const nextStatus: ComplaintStatus = "RESOLVED";

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
                  investigationNotes: resolutionSummary || c.investigationNotes,
                  caseClosedDate: closedAt,
                  resolutionStatus,
                  disciplinaryAction,
                }
              : c,
          );
          window.localStorage.setItem(
            COMPLAINTS_STORAGE_KEY,
            JSON.stringify(updated),
          );
        }
      } catch {
        // simple popup error handler for save failures
        alert(
          "Something went wrong while saving this case. Please try again or contact your system administrator.",
        );
        return;
      }
    }

    // Optionally create a linked disciplinary case if the complaint was false/malicious
    if (
      createDisciplinaryCase &&
      resolutionStatus === "False Complaint Confirmed"
    ) {
      const reporterName = (() => {
        if (!complaint.createdByEmployeeId) return reporterLabel;
        const emp = employees.find((e) => e.id === complaint.createdByEmployeeId);
        return emp ? `${emp.firstName} ${emp.lastName}` : reporterLabel;
      })();

      appendDisciplinaryCase({
        id: `DISC-${Date.now()}`,
        employeeId: complaint.createdByEmployeeId,
        employeeName: reporterName,
        complaintId: complaint.id,
        violation: "False Complaint / Misconduct",
        createdAt: closedAt,
        createdBy: user.name,
      });
    }

    setComplaint((prev) =>
      prev && prev.id === id
        ? {
            ...prev,
            status: nextStatus,
            investigationNotes: resolutionSummary || prev.investigationNotes,
            caseClosedDate: closedAt,
          }
        : prev,
    );
    setCloseOpen(false);
  };

  const canAccessPage =
    user.role === "SUPER_ADMIN" || user.role === "HR_ADMIN" || user.role === "HR_MANAGER";

  if (!canAccessPage) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight text-foreground">
          High Priority Complaint
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
              onClick={() => router.push(`${paths.complaints}?panel=escalated`)}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="font-semibold">Complaints</span>
              <ChevronRight className="size-3" />
              <span>High Priority Complaints</span>
            </button>
            <span className="opacity-70">&gt;</span>
            <span className="font-semibold text-foreground">
              Complaint {complaint?.id ?? ""}
            </span>
          </div>

          {/* Center search bar (non-functional placeholder) */}
          <div className="hidden">
            <div className="w-full max-w-lg">
              <div className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-base text-muted-foreground transition-colors focus-within:border-[#192853] focus-within:ring-1 focus-within:ring-[#192853] hover:border-[#192853]">
                <Search className="size-5 opacity-70" />
                <input
                  type="text"
                  placeholder="Search escalated complaints..."
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
            This escalated complaint could not be found in local history.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Complaint information */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="size-4" />
                Complaint {complaint.id}
              </CardTitle>
              <CardDescription>
                High priority {complaint.type.replace(/_/g, " ")} case filed by {reporterLabel}.
                Priority: {complaint.priority}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    Department
                  </p>
                  <p className="text-sm text-foreground">{departmentName}</p>
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
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Reporter
                  </p>
                  <p className="text-sm text-foreground">{reporterLabel}</p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Incident Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {complaint.description}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Investigation status / timeline */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">Investigation Status</CardTitle>
              <CardDescription>
                Timeline of how this complaint progressed through the workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2 text-sm">
                {["Submitted", "Under Review", "Investigating", "Escalated"].map(
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

          {/* Evidence / notes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className={complaintsCardClass}>
              <CardHeader>
                <CardTitle className="text-base">Evidence / Attachments</CardTitle>
                <CardDescription>
                  Files collected during the investigation (placeholder listing).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-[#111827]">
                  <li>Screenshot_conversation.png</li>
                  <li>Meeting_recording.mp3</li>
                  <li>Incident_report.pdf</li>
                </ul>
              </CardContent>
            </Card>

            <Card className={complaintsCardClass}>
              <CardHeader>
                <CardTitle className="text-base">HR Officer Investigation Notes</CardTitle>
                <CardDescription>
                  Summary of findings from the HR Officer and HR Staff prior to this priority
                  review.
                </CardDescription>
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
          </div>

          {/* HR Manager Actions */}
          <Card className={complaintsCardClass}>
            <CardHeader>
              <CardTitle className="text-base">HR Manager Actions</CardTitle>
              <CardDescription>
                Decide how to move forward with this priority case.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="default"
                className="rounded-full px-4"
                onClick={() => setAssignOpen(true)}
                disabled={!canAssignTeam}
              >
                Assign Investigation Team
              </Button>
              <Button
                variant="outline"
                className="rounded-full px-4"
                onClick={() => {
                  setRequestReason("");
                  setRequestOpen(true);
                }}
              >
                Request Additional Investigation
              </Button>
              <Button
                variant="ghost"
                className="rounded-full px-4 text-red-700 hover:text-red-800"
                disabled={!canCloseCase}
                onClick={() => setCloseOpen(true)}
              >
                Close Case
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Assign investigation team modal */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Investigation Team</DialogTitle>
            <DialogDescription>
              Select HR investigators and set a due date for this escalated complaint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Lead Investigator</p>
              <select
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select HR Officer</option>
                {hrInvestigators.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Supporting Investigator(s)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {hrInvestigators.map((emp) => {
                  const value = emp.id;
                  const checked = supportingIds.includes(value);
                  return (
                    <label
                      key={emp.id}
                      className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3"
                        checked={checked}
                        onChange={() => {
                          setSupportingIds((prev) =>
                            prev.includes(value)
                              ? prev.filter((id) => id !== value)
                              : [...prev, value]
                          );
                        }}
                      />
                      <span className="truncate">
                        {emp.firstName} {emp.lastName}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Investigation Due Date
              </p>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Instructions for investigation team
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Provide any specific instructions, focus areas, or context for the team..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleAssignTeam}>
              Assign Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request additional investigation modal */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Request Additional Investigation
            </DialogTitle>
            <DialogDescription className="text-xs">
              Please provide the reason for requesting further investigation. This will be visible
              to HR staff handling the complaint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
              Reason for additional investigation
            </label>
            <textarea
              className="mt-1 min-h-[120px] w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-[#192853]"
              placeholder="Additional witness statements are required to support the investigation findings."
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setRequestOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => {
                if (!complaint) {
                  setRequestOpen(false);
                  return;
                }
                const id = complaint.id;
                const reason = requestReason.trim() || undefined;

                // Update storage: send back to HR staff (SUBMITTED) with managerRequestReason
                if (typeof window !== "undefined") {
                  try {
                    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
                    if (raw) {
                      const parsed = JSON.parse(raw) as StoredComplaint[];
                      const updated = parsed.map((c) =>
                        c.id === id
                          ? ({
                              ...c,
                              status: "SUBMITTED",
                              managerRequestReason: reason ?? c.managerRequestReason,
                            } as StoredComplaint)
                          : c
                      );
                      window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(updated));
                    }
                  } catch {
                    // ignore
                  }
                }

                setComplaint((prev) =>
                  prev && prev.id === id
                    ? ({
                        ...prev,
                        status: "SUBMITTED",
                        managerRequestReason: reason ?? prev.managerRequestReason,
                      } as StoredComplaint)
                    : prev,
                );

                setRequestOpen(false);
              }}
            >
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close case modal */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Close Case</DialogTitle>
            <DialogDescription>
              Confirm the final resolution and any disciplinary actions for this complaint.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Internal Resolution (HR only)
              </p>
              <select
                value={resolutionStatus}
                onChange={(e) => setResolutionStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="Policy Violation Confirmed">
                  Complaint Substantiated – Policy violation confirmed
                </option>
                <option value="No Evidence Found">
                  Complaint Unsubstantiated – Insufficient evidence
                </option>
                <option value="False Complaint Confirmed">
                  False Complaint Confirmed (malicious)
                </option>
                <option value="Resolved Through Mediation">
                  Resolved Through Mediation
                </option>
                <option value="Policy Guidance Provided">
                  Policy Guidance / Coaching Provided
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Resolution Summary</p>
              <textarea
                value={resolutionSummary}
                onChange={(e) => setResolutionSummary(e.target.value)}
                rows={4}
                placeholder="Summarize investigation findings and final decision..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Disciplinary Action (optional)
              </p>
              <select
                value={disciplinaryAction}
                onChange={(e) => setDisciplinaryAction(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select action</option>
                <option value="Verbal Warning">Verbal Warning</option>
                <option value="Written Warning">Written Warning</option>
                <option value="Suspension">Suspension</option>
                <option value="Termination">Termination</option>
                <option value="No Action Required">No Action Required</option>
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (resolutionStatus === "False Complaint Confirmed") {
                  setDisciplinaryPromptOpen(true);
                } else {
                  handleCloseCase(false);
                }
              }}
            >
              Close Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt to open a disciplinary case when complaint is malicious */}
      <Dialog
        open={disciplinaryPromptOpen}
        onOpenChange={setDisciplinaryPromptOpen}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Create Disciplinary Case?
            </DialogTitle>
            <DialogDescription className="text-xs">
              The investigation determined that this complaint was intentionally
              false. Would you like to open a disciplinary case for the reporting
              employee? This will be recorded separately from the complaint.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDisciplinaryPromptOpen(false);
                handleCloseCase(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setDisciplinaryPromptOpen(false);
                handleCloseCase(true);
              }}
            >
              Open Disciplinary Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

