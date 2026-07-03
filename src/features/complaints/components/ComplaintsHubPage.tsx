"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { departments, type Department } from "@/lib/mock";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { CheckCircle2, FileText, ListTodo, ShieldCheck } from "lucide-react";

type ComplaintType =
  | "WORKPLACE_HARASSMENT"
  | "WORKPLACE_CONFLICT"
  | "POLICY_VIOLATION"
  | "MANAGEMENT_CONCERN"
  | "DISCRIMINATION"
  | "PAYROLL_CONCERN"
  | "OTHER";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "FURTHER_INVESTIGATION_REQUIRED"
  | "INVESTIGATION_COMPLETED"
  | "RESOLVED"
  | "WITHDRAWN";

type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type Complaint = {
  id: string;
  title: string;
  type: ComplaintType;
  description: string;
  dateOfIncident: string;
  priority: ComplaintPriority;
  isAnonymous: boolean;
  departmentId: string;
  departmentName: string;
  personInvolved?: string;
  location?: string;
  attachmentName?: string;
  submittedAt: string;
  status: ComplaintStatus;
  createdByEmployeeId: string;
  // Optional fields set later by HR workflows
  resolutionStatus?: string;
  disciplinaryAction?: string;
};

const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaints(): Complaint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Complaint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveComplaints(list: Complaint[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

const COMPLAINT_TYPE_OPTIONS: { value: ComplaintType; label: string }[] = [
  { value: "WORKPLACE_HARASSMENT", label: "Workplace Harassment" },
  { value: "WORKPLACE_CONFLICT", label: "Workplace Conflict" },
  { value: "POLICY_VIOLATION", label: "Policy Violation" },
  { value: "MANAGEMENT_CONCERN", label: "Management Concern" },
  { value: "DISCRIMINATION", label: "Discrimination" },
  { value: "PAYROLL_CONCERN", label: "Payroll Concern" },
  { value: "OTHER", label: "Other" },
];

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}

function getEmployeeResolutionMessage(c: {
  status: ComplaintStatus;
  disciplinaryAction?: string;
  resolutionStatus?: string;
}): string {
  // For in‑progress cases, just show whatever status text exists.
  if (c.status !== "RESOLVED") {
    return c.resolutionStatus || "—";
  }

  const action = (c.disciplinaryAction || "").toLowerCase();
  const res = (c.resolutionStatus || "").toLowerCase();

  if (
    ["termination", "suspension", "verbal warning", "written warning"].some(
      (keyword) => action.includes(keyword),
    )
  ) {
    return "Complaint Substantiated – Appropriate action taken";
  }

  if (res.includes("no evidence") || res.includes("unsubstantiated")) {
    if (res.includes("false")) {
      return "Complaint Unsubstantiated – False report confirmed.";
    }
    return "Complaint Unsubstantiated – Insufficient evidence found";
  }

  if (res.includes("mediation")) {
    return "Case Resolved Through Mediation";
  }

  if (res.includes("policy") || res.includes("guidance")) {
    return "Policy Guidance Provided";
  }

  // Fallback: show stored text or a generic substantiated message.
  return (
    c.resolutionStatus || "Complaint Substantiated – Appropriate action taken"
  );
}

export default function ComplaintsPage() {
  const { user: currentUser } = useCurrentUser();
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [complaints, setComplaints] = useState<Complaint[]>(() => loadComplaints());
  const [complaintsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ComplaintType>("WORKPLACE_HARASSMENT");
  const [description, setDescription] = useState("");
  const [dateOfIncident, setDateOfIncident] = useState("");
  const [priority, setPriority] = useState<ComplaintPriority>("MEDIUM");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [personInvolved, setPersonInvolved] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [location, setLocation] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const [confirmRead, setConfirmRead] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const tabParam = searchParams.get("tab");
  const tab: "file" | "my" | "status" =
    tabParam === "my" || tabParam === "status" || tabParam === "file"
      ? tabParam
      : "file";

  const navigateTab = (next: "file" | "my" | "status") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    if (complaintsLoading) return;
    saveComplaints(complaints);
  }, [complaints, complaintsLoading]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !description.trim() || !departmentId || !dateOfIncident || !priority) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!confirmRead) {
      setError("Please confirm that the information provided is true and accurate.");
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = () => {
    const now = new Date();
    const nextNumber = complaints.length + 1;
    const id = `CMP-${String(nextNumber).padStart(3, "0")}`;
    const dept: Department | undefined = departments.find((d) => d.id === departmentId);
    const complaint: Complaint = {
      id,
      title: title.trim(),
      type,
      description: description.trim(),
      dateOfIncident,
      priority,
      isAnonymous,
      departmentId,
      departmentName: dept?.name ?? "Unknown",
      personInvolved: personInvolved.trim() || undefined,
      location: location.trim() || undefined,
      attachmentName: attachmentName || undefined,
      submittedAt: now.toISOString(),
      status: "UNDER_REVIEW",
      createdByEmployeeId: currentUser.employeeId,
    };
    setComplaints((prev) => [complaint, ...prev]);
    setTitle("");
    setDescription("");
    setDateOfIncident("");
    setPriority("MEDIUM");
    setDepartmentId("");
    setPersonInvolved("");
    setIsAnonymous(false);
    setLocation("");
    setAttachmentName("");
    setConfirmRead(false);
    setShowConfirmDialog(false);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
    navigateTab("my");
  };

  const myComplaints = useMemo(
    () =>
      complaints
        .filter((c) => c.createdByEmployeeId === currentUser.employeeId)
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        ),
    [complaints, currentUser.employeeId]
  );

  const handleWithdraw = (id: string) => {
    setComplaints((prev) =>
      prev.map((c) =>
        c.id === id && c.status === "UNDER_REVIEW"
          ? { ...c, status: "WITHDRAWN" }
          : c
      )
    );
  };

  const [selectedStatusId, setSelectedStatusId] = useState<string | null>(null);

  const orderedComplaints = useMemo(
    () =>
      [...complaints].sort(
        (a, b) =>
          new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      ),
    [complaints]
  );

  const activeStatusComplaint =
    orderedComplaints.find((c) => c.id === selectedStatusId) ??
    orderedComplaints[0] ??
    null;

  const headerByTab = {
    file: {
      title: "File Complaint",
    },
    my: {
      title: "My Complaints",
    },
    status: {
      title: "Complaint Status",
    },
  };

  const { title: headerTitle } = headerByTab[tab];

  const useWorkplaceHeader = currentUser.role === "DEPARTMENT_MANAGER";

  return (
    <div className={useWorkplaceHeader ? "min-w-0 w-full max-w-full flex flex-col gap-4" : "min-w-0 w-full max-w-full space-y-5"}>
      <div className={useWorkplaceHeader ? "contents" : "min-w-0 space-y-3"}>
        {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" || currentUser.role === "DEPARTMENT_MANAGER" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title={currentUser.role === "DEPARTMENT_MANAGER" ? "Complaints" : "Issues & Feedback"}
              tabs={[
                { id: "file", label: "File Complaint" },
                { id: "my", label: "My Complaints" },
                { id: "status", label: "Complaint Status" },
              ]}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id as typeof tab)}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">Complaints</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">{headerTitle}</span>
                </>
              }
              searchPlaceholder="Search complaints..."
            />

            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                <button
                  type="button"
                  onClick={() => navigateTab("file")}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                    tab === "file"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <FileText className="size-4 shrink-0" />
                  <span>File Complaint</span>
                  <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                      tab === "file" ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTab("my")}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                    tab === "my"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <ListTodo className="size-4 shrink-0" />
                  <span>My Complaints</span>
                  <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                      tab === "my" ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => navigateTab("status")}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                    tab === "status"
                      ? "text-primary font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span>Complaint Status</span>
                  <span
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                      tab === "status" ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => navigateTab(v as typeof tab)} className="min-w-0 w-full">
            <TabsContent value="file" className="mt-0 min-w-0">
          <div className="flex w-full min-w-0 justify-center px-0">
            <div
              className={`w-full min-w-0 max-w-4xl rounded-2xl border border-border/60 px-3 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.18)] sm:px-8 sm:py-7 ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <div className="flex min-w-0 flex-col gap-6">
                <div className="text-center space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-blue-400">
                    Workplace Concerns
                  </p>
                  <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
                    File a Complaint
                  </h2>
                </div>

                <form onSubmit={handleSubmit} className="min-w-0 space-y-8">
                  <div className="grid min-w-0 gap-6 md:grid-cols-2 md:gap-8">
                    {/* Left column – basic complaint info */}
                    <div className="min-w-0 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="complaint-title">
                          Complaint Title <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="complaint-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Harassment in the workplace"
                      />
                    </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="complaint-date">
                          Date of Incident <span className="text-destructive">*</span>
                      </Label>
                      <Input
                          id="complaint-date"
                          type="date"
                          value={dateOfIncident}
                          onChange={(e) => setDateOfIncident(e.target.value)}
                        />
                  </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="complaint-type">
                          Complaint Type <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="complaint-type"
                        value={type}
                        onChange={(e) =>
                          setType(e.target.value as ComplaintType)
                        }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {COMPLAINT_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="complaint-person">
                          Person Involved{" "}
                          <span className="text-xs text-muted-foreground">
                            (optional)
                          </span>
                        </Label>
                        <Input
                          id="complaint-person"
                          value={personInvolved}
                          onChange={(e) => setPersonInvolved(e.target.value)}
                          placeholder="Name of person involved (if any)"
                        />
                      </div>
                    </div>

                    {/* Right column – department & attachment */}
                    <div className="min-w-0 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="complaint-dept">
                          Department Involved <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="complaint-dept"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                  </div>

                      <div className="space-y-1.5">
                    <Label htmlFor="complaint-attachment">
                      Attachment{" "}
                          <span className="text-xs text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="complaint-attachment"
                      type="file"
                      accept=".pdf,application/pdf"
                      ref={attachmentInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                          setAttachmentName("");
                          return;
                        }
                        const isPdf =
                          file.type === "application/pdf" ||
                          file.name.toLowerCase().endsWith(".pdf");
                        if (!isPdf) {
                          setAttachmentName("");
                          setError("Only PDF documents are allowed for attachments.");
                          if (attachmentInputRef.current) attachmentInputRef.current.value = "";
                          return;
                        }
                        setError("");
                        setAttachmentName(file.name);
                      }}
                    />
                    {attachmentName && (
                      <p className="text-xs text-muted-foreground">
                        Selected file: {attachmentName}
                      </p>
                    )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="complaint-priority">
                          Priority Level <span className="text-destructive">*</span>
                        </Label>
                        <select
                          id="complaint-priority"
                          value={priority}
                          onChange={(e) =>
                            setPriority(e.target.value as ComplaintPriority)
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="URGENT">Urgent</option>
                        </select>
                      </div>

                      <label className="flex items-start gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border border-input"
                          checked={isAnonymous}
                          onChange={(e) => setIsAnonymous(e.target.checked)}
                        />
                        <span>Submit this complaint anonymously</span>
                      </label>
                    </div>
                  </div>

                  <div className="min-w-0 space-y-4">
                    <div className="min-w-0 space-y-1.5">
                      <Label htmlFor="complaint-location">
                        Location{" "}
                        <span className="text-xs text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="complaint-location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Floor 3, Meeting Room A, or online"
                      />
                    </div>

                    <div className="min-w-0 space-y-2">
                      <Label htmlFor="complaint-description">
                        Description <span className="text-destructive">*</span>
                      </Label>
                      <textarea
                        id="complaint-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="min-w-0 w-full max-w-full resize-y rounded-xl border border-input bg-background px-4 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Provide details of the incident, dates, people involved, and any context HR should know."
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-sm text-destructive">{error}</p>
                  )}

                  <div className="space-y-4 pt-1">
                    <label className="flex items-start gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border border-input"
                        checked={confirmRead}
                        onChange={(e) => setConfirmRead(e.target.checked)}
                      />
                      <span>
                        <span className="block">
                          I confirm that the information provided is true and accurate.
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          I understand that false accusations may lead to disciplinary action.
                        </span>
                      </span>
                    </label>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">
                        Fields marked with <span className="text-destructive">*</span> are required.
                      </p>
                      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setTitle("");
                        setDescription("");
                            setDateOfIncident("");
                            setPriority("MEDIUM");
                        setDepartmentId("");
                        setPersonInvolved("");
                            setIsAnonymous(false);
                            setLocation("");
                        setAttachmentName("");
                            setConfirmRead(false);
                        setError("");
                        if (attachmentInputRef.current) {
                          attachmentInputRef.current.value = "";
                        }
                      }}
                    >
                          Clear
                    </Button>
                        <Button type="submit" className="px-8 rounded-full">
                      Submit Complaint
                    </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <Dialog
            open={showConfirmDialog}
            onOpenChange={(open) => {
              if (!open) setShowConfirmDialog(false);
            }}
          >
            <DialogContent className="max-w-md rounded-3xl border border-border/60 bg-card px-6 py-5 shadow-xl">
              <DialogHeader className="space-y-3 text-center">
                <div
                  className={`mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full ${
                    theme === "dark" ? "bg-[#FFE14E]/20 text-[#FFE14E]" : "bg-[#192853]/10 text-[#192853]"
                  }`}
                >
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <DialogTitle className="text-lg font-semibold text-center">
                  Confirm Complaint Submission
                </DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">
                  Are you sure you want to submit this complaint? Please ensure that the information
                  provided is accurate.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="text-sm text-muted-foreground">
                  Submitting false or misleading complaints may lead to disciplinary action in line
                  with company policy.
                </p>
              </div>
              <div className="my-3 h-px bg-border/60" />
              <DialogFooter className="flex gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-3xl px-4 py-1.5 text-sm"
                  onClick={() => setShowConfirmDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="rounded-3xl px-5 py-1.5 text-sm shadow-sm"
                  onClick={handleConfirmSubmit}
                >
                  Submit Complaint
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
            </TabsContent>

            <TabsContent value="my" className="mt-0 min-w-0">
              <ComplaintsTable
                loading={complaintsLoading}
                rows={myComplaints}
                onWithdraw={handleWithdraw}
                onView={(complaint) => {
                  router.push(`/complaints/${complaint.id}`);
                }}
              />
            </TabsContent>

        <TabsContent value="status" className="mt-0 min-w-0 space-y-4">
          {complaintsLoading ? (
            <div className="min-w-0 w-full overflow-x-auto rounded-md border border-border">
              <Table scrollable={false} className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[110px]">Complaint ID</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeletonRows columns={7} prefix="complaints-status-sk" />
                </TableBody>
              </Table>
            </div>
          ) : orderedComplaints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No complaints have been filed yet.
            </p>
          ) : (
            <>
              {/* Complaint selector */}
              <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground">
                    Complaint Status
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Track the progress, updates, and attachments for your submitted complaints.
                  </p>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                  <Label htmlFor="status-complaint-select" className="shrink-0 text-sm text-muted-foreground">
                    Complaint:
                  </Label>
                  <select
                    id="status-complaint-select"
                    value={activeStatusComplaint?.id ?? ""}
                    onChange={(e) => setSelectedStatusId(e.target.value || null)}
                    className="complaint-status-select flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm sm:max-w-md sm:w-auto"
                  >
                    {orderedComplaints.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.id} — {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {activeStatusComplaint && (
                <div className="space-y-6">
                  {/* Complaint Summary */}
                  <div
                    className={`rounded-xl border border-border/70 px-4 py-4 sm:px-6 sm:py-5 shadow-sm ${
                      theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Complaint Summary
                        </p>
                        <h3 className="text-xl font-semibold tracking-tight text-foreground">
                          {activeStatusComplaint.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Complaint ID:{" "}
                          <span className="font-medium text-foreground">
                            {activeStatusComplaint.id}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            activeStatusComplaint.status === "RESOLVED"
                              ? "success"
                              : activeStatusComplaint.status === "UNDER_REVIEW"
                              ? "outline"
                              : activeStatusComplaint.status === "WITHDRAWN"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {activeStatusComplaint.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm sm:text-base">
                      <div>
                        <p className="text-muted-foreground">Department Involved</p>
                        <p className="font-medium text-foreground">
                          {activeStatusComplaint.departmentName}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Complaint Type</p>
                        <p className="font-medium text-foreground">
                          {COMPLAINT_TYPE_OPTIONS.find(
                            (t) => t.value === activeStatusComplaint.type
                          )?.label ?? activeStatusComplaint.type.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Priority Level</p>
                        <p className="font-medium text-foreground">
                          {activeStatusComplaint.priority
                            ? activeStatusComplaint.priority.charAt(0) +
                              activeStatusComplaint.priority.slice(1).toLowerCase()
                            : "Not set"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date of Incident</p>
                        <p className="font-medium text-foreground">
                          {activeStatusComplaint.dateOfIncident
                            ? new Date(activeStatusComplaint.dateOfIncident).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Date Submitted</p>
                        <p className="font-medium text-foreground">
                          {new Date(
                            activeStatusComplaint.submittedAt
                          ).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current Status</p>
                        <p className="font-medium text-foreground">
                          {activeStatusComplaint.status.replace(/_/g, " ")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Complaint Progress Timeline */}
                  <div
                    className={`rounded-xl border border-border/70 px-4 py-4 sm:px-6 sm:py-5 shadow-sm ${
                      theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                    }`}
                  >
                    <div className="mb-4">
                      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Complaint Progress Timeline
                      </p>
                      <p className="text-base text-muted-foreground mt-1">
                        Follow the progress of your complaint from submission to resolution.
                      </p>
                    </div>
                    <div className="space-y-4">
                      {[
                        {
                          key: "SUBMITTED",
                          title: "Submitted",
                          description: "Complaint successfully submitted.",
                        },
                        {
                          key: "UNDER_REVIEW",
                          title: "Under Review",
                          description:
                            "HR is reviewing the complaint and checking initial details.",
                        },
                        {
                          key: "INVESTIGATING",
                          title: "Investigation",
                          description:
                            "HR is currently investigating the incident and may contact you for more information.",
                        },
                        {
                          key: "RESOLVED",
                          title: "Resolved",
                          description: "Issue has been resolved and recorded.",
                        },
                      ].map((step, index, arr) => {
                        const isCompleted =
                          step.key === "SUBMITTED" ||
                          (step.key === "UNDER_REVIEW" &&
                            (activeStatusComplaint.status === "UNDER_REVIEW" ||
                              activeStatusComplaint.status === "RESOLVED")) ||
                          (step.key === "INVESTIGATING" &&
                            activeStatusComplaint.status === "RESOLVED") ||
                          (step.key === "RESOLVED" &&
                            activeStatusComplaint.status === "RESOLVED");
                        const isCurrent =
                          !isCompleted &&
                          (index === 0 ||
                            arr[index - 1].key === "UNDER_REVIEW" ||
                            arr[index - 1].key === "SUBMITTED");
                        return (
                          <div key={step.key} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={[
                                  "mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px]",
                                  isCompleted
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : isCurrent
                                    ? "border-primary text-primary"
                                    : "border-border text-muted-foreground",
                                ].join(" ")}
                              >
                                {index + 1}
                              </div>
                              {index < arr.length - 1 && (
                                <div className="flex-1 w-px bg-border mt-1" />
                              )}
                            </div>
                            <div className="space-y-1 pb-4">
                              <p className="text-base font-semibold text-foreground">
                                {step.title}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* HR Updates / Messages + Attachments + Actions */}
                  <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
                    {/* HR updates */}
                    <div
                      className={`rounded-xl border border-border/70 px-4 py-4 sm:px-6 sm:py-5 shadow-sm space-y-4 ${
                        theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          HR Updates / Messages
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          HR may send clarifications or status updates about your complaint.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-lg border border-border/70 bg-background px-3 py-3 space-y-1.5">
                          <p className="text-sm font-medium text-muted-foreground">
                            HR Officer Comment
                          </p>
                          <p className="text-sm text-muted-foreground">
                            We have received your complaint and are currently reviewing the
                            details. We may contact you for additional information if necessary.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          No further updates yet.
                        </p>
                      </div>
                    </div>

                    {/* Attachments + actions */}
                    <div className="space-y-4">
                      <div
                        className={`rounded-xl border border-border/70 px-4 py-4 sm:px-5 sm:py-4 shadow-sm ${
                          theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                        }`}
                      >
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Attachments
                        </p>
                        {activeStatusComplaint.attachmentName ? (
                          <ul className="mt-3 space-y-1.5 text-xs text-foreground">
                            <li className="flex items-center gap-2">
                              <span className="text-lg leading-none">📎</span>
                              <span className="truncate">
                                {activeStatusComplaint.attachmentName}
                              </span>
                            </li>
                          </ul>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            No attachments were included with this complaint.
                          </p>
                        )}
                      </div>

                      <div
                        className={`rounded-xl border border-border/70 px-4 py-4 sm:px-5 sm:py-4 shadow-sm space-y-2 ${
                          theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                        }`}
                      >
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Actions
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              router.push(`/complaints/${activeStatusComplaint.id}`)
                            }
                          >
                            View Full Details
                          </Button>
                          <Button size="sm" variant="outline">
                            Add Additional Evidence
                          </Button>
                          <Button size="sm" variant="outline">
                            Add Comment
                          </Button>
                          {activeStatusComplaint.status === "UNDER_REVIEW" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleWithdraw(activeStatusComplaint.id)}
                            >
                              Withdraw Complaint
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
            </TabsContent>
      </Tabs>
    </div>
  );
}

function ComplaintsTable({
  loading,
  rows,
  onWithdraw,
  onView,
}: {
  loading?: boolean;
  rows: Complaint[];
  onWithdraw: (id: string) => void;
  onView?: (complaint: Complaint) => void;
}) {
  if (loading) {
    return (
      <div className="min-w-0 w-full overflow-x-auto rounded-md border border-border">
        <Table scrollable={false} className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[110px]">Complaint ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Resolution</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeletonRows columns={7} prefix="complaints-my-sk" />
          </TableBody>
        </Table>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No complaints found.
      </p>
    );
  }

  return (
    <div className="min-w-0 w-full overflow-x-auto rounded-md border border-border">
      <Table scrollable={false} className="min-w-[720px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[110px]">Complaint ID</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Date Submitted</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Resolution</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c) => (
          <TableRow key={c.id}>
            <TableCell className="font-medium">{c.id}</TableCell>
            <TableCell>{c.title}</TableCell>
            <TableCell>
              {COMPLAINT_TYPE_OPTIONS.find((t) => t.value === c.type)?.label ??
                c.type}
            </TableCell>
            <TableCell>{formatDateLabel(c.submittedAt)}</TableCell>
            <TableCell>
              <Badge variant="secondary">
                {c.status === "FURTHER_INVESTIGATION_REQUIRED"
                  ? "Further Investigation Required"
                  : c.status
                      .replace("_", " ")
                      .toLowerCase()
                      .replace(/\b\w/g, (ch) => ch.toUpperCase())}
              </Badge>
            </TableCell>
            <TableCell>{getEmployeeResolutionMessage(c)}</TableCell>
            <TableCell className="text-right space-x-1">
              {/* View is always shown, including when status is Resolved or Closed */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() =>
                  onView
                    ? onView(c)
                    : alert(
                        `${c.title}\n\n${
                          c.description || "No description provided."
                        }`,
                      )
                }
              >
                View
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={c.status !== "UNDER_REVIEW"}
                onClick={() => onWithdraw(c.id)}
              >
                Withdraw
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}
