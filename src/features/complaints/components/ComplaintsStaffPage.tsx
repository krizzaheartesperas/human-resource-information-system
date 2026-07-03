"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { useTheme } from "@/components/theme/ThemeProvider";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { cn } from "@/lib/utils";
import { employees } from "@/lib/mock";
import {
  ListTodo,
  ShieldCheck,
  ClipboardList,
  Pencil,
  Trash2,
} from "lucide-react";

type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "INVESTIGATING"
  | "INVESTIGATED"
  | "FURTHER_INVESTIGATION_REQUIRED"
  | "INVESTIGATION_COMPLETED"
  | "RESOLVED"
  | "WITHDRAWN"
  | "ESCALATED"
  | "REJECTED";

type Complaint = {
  id: string;
  title?: string;
  employeeName?: string;
  typeLabel?: string;
  departmentName?: string;
  priority: ComplaintStatus | string;
  status: ComplaintStatus;
  assignedHr?: string;
  createdAt?: string;
  hrResponse?: string;
  investigationNotes?: string;
  hrRecommendation?: string;
  managerRequestReason?: string;
  witnessRecords?: { name: string; statement: string }[];
  supportingInvestigators?: string[];
  managerInvestigationInstructions?: string;
};
type StoredComplaintRow = {
  id: string;
  title?: string;
  employeeName?: string;
  type?: string;
  departmentName?: string;
  priority?: string;
  status?: ComplaintStatus;
  assignedHr?: string;
  submittedAt?: string;
  createdAt?: string;
  hrResponse?: string;
  investigationNotes?: string;
  hrRecommendation?: string;
  managerRequestReason?: string;
  witnessRecords?: { name: string; statement: string }[];
  supportingInvestigatorIds?: string[];
};

type StaffComplaintsPanel = "dashboard" | "all" | "investigation" | "assigned";

const PANEL_PARAM = "panel";
const COMPLAINTS_STORAGE_KEY = "hris-complaints";

function loadComplaintsForStaff(): Complaint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredComplaintRow[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((c) => {
      const supportingIds = c.supportingInvestigatorIds ?? [];
      const supportingInvestigators = supportingIds
        .map((id) => {
          const emp = employees.find((e) => e.id === id);
          if (emp) return `${emp.firstName} ${emp.lastName}`;
          return id;
        })
        .filter(Boolean);

      return {
        id: c.id,
        title: c.title,
        employeeName: c.employeeName,
        typeLabel: c.type ?? "Complaint",
        departmentName: c.departmentName,
        priority: (c.priority ?? "MEDIUM") as string,
        status: (c.status ?? "SUBMITTED") as ComplaintStatus,
        assignedHr: c.assignedHr ?? "HR Officer",
        createdAt: c.submittedAt ?? c.createdAt,
        hrResponse: c.hrResponse,
        investigationNotes: c.investigationNotes,
        hrRecommendation: c.hrRecommendation,
        managerRequestReason: c.managerRequestReason,
        witnessRecords: c.witnessRecords ?? [],
        supportingInvestigators,
        managerInvestigationInstructions: c.investigationNotes,
      };
    });
  } catch {
    return [];
  }
}

export default function HRStaffComplaintsPage() {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const { theme } = useTheme();
  const complaintsCardClass = cn(
    "rounded-[32px] border-none shadow-sm",
    theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
  );
  const escalateButtonClass = cn(
    "rounded-full px-3 py-1 text-xs",
    theme === "dark"
      ? "border-amber-300 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 hover:text-amber-100"
      : "text-amber-700 border-amber-300 hover:bg-amber-50"
  );
  const searchParams = useSearchParams();
  const router = useRouter();

  const [complaints, setComplaints] = useState<Complaint[]>(() => loadComplaintsForStaff());
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [notesComplaintId, setNotesComplaintId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");
  const [newWitnessName, setNewWitnessName] = useState("");
  const [newWitnessStatement, setNewWitnessStatement] = useState("");
  const [editingWitnessIndex, setEditingWitnessIndex] = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [submitInvestigationOpen, setSubmitInvestigationOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "urgent" | "high_urgent">("all");

  const reloadComplaints = () => {
    setComplaints(loadComplaintsForStaff());
  };

  const panel: StaffComplaintsPanel = useMemo(() => {
    const value = searchParams.get(PANEL_PARAM);
    if (value === "all" || value === "investigation" || value === "assigned") return value;
    return "dashboard";
  }, [searchParams]);

  const selectedComplaint = useMemo(
    () => complaints.find((c) => c.id === selectedComplaintId) ?? null,
    [complaints, selectedComplaintId]
  );

  const updateComplaint = (id: string, updater: (prev: Complaint) => Complaint) => {
    setComplaints((prev) => {
      const updated = prev.map((c) => (c.id === id ? updater(c) : c));
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(COMPLAINTS_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as StoredComplaintRow[];
            const next = parsed.map((c) => {
              if (c.id !== id) return c;
              const updatedComplaint = updated.find((item) => item.id === id);
              return updatedComplaint ? { ...c, ...updatedComplaint } : c;
            });
            window.localStorage.setItem(COMPLAINTS_STORAGE_KEY, JSON.stringify(next));
          }
        } catch {
          // ignore storage errors
        }
      }
      return updated;
    });
  };

  const navigatePanel = (next: StaffComplaintsPanel) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(PANEL_PARAM, next);
    router.push(`${paths.complaints}?${params.toString()}`);
  };

  const totalComplaints = complaints.length;
  const underReview = complaints.filter((c) => c.status === "UNDER_REVIEW").length;
  const investigating = complaints.filter((c) => c.status === "SUBMITTED").length;
  const escalated = complaints.filter((c) => c.status === "ESCALATED").length;
  const resolved = complaints.filter((c) => c.status === "RESOLVED").length;

  const furtherInvestigationComplaints = complaints.filter(
    (c) => c.status === "FURTHER_INVESTIGATION_REQUIRED"
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search complaints..." />
        <EmployeeSectionHeader
          title="Complaints"
          tabs={[
            { id: "dashboard", label: "Complaints" },
            { id: "all", label: "All Complaints" },
            { id: "assigned", label: "Assigned Complaints" },
            { id: "investigation", label: "Investigation Panel" },
          ]}
          activeTab={panel}
          onTabChange={(id) => navigatePanel(id as StaffComplaintsPanel)}
        />
      </div>

      {/* Manager requests banner for HR Staff */}
      {furtherInvestigationComplaints.length > 0 && !bannerDismissed && (
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="py-3 text-sm flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-amber-900">
                HR Manager has requested additional investigation for{" "}
                {furtherInvestigationComplaints.length === 1
                  ? `Complaint ${furtherInvestigationComplaints[0].id}.`
                  : `${furtherInvestigationComplaints.length} complaints.`}
              </p>
              {furtherInvestigationComplaints[0]?.managerRequestReason && (
                <p className="mt-1 text-xs text-amber-900/90">
                  Manager note: {furtherInvestigationComplaints[0].managerRequestReason}
                </p>
              )}
            </div>
            <button
              type="button"
              className="mt-2 inline-flex items-center rounded-full border border-amber-300 px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 sm:mt-0"
              onClick={() => setBannerDismissed(true)}
            >
              Dismiss
            </button>
          </CardContent>
        </Card>
      )}

      {/* Content area */}
      {panel === "dashboard" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className={complaintsCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Complaints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{totalComplaints}</p>
              <p className="text-xs text-muted-foreground">All complaints submitted.</p>
            </CardContent>
          </Card>

          <Card className={complaintsCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Under Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{underReview}</p>
              <p className="text-xs text-muted-foreground">
                Complaints currently being reviewed.
              </p>
            </CardContent>
          </Card>

          <Card className={complaintsCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Investigating</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{investigating}</p>
              <p className="text-xs text-muted-foreground">
                Complaints under investigation by HR staff.
              </p>
            </CardContent>
          </Card>

          <Card className={complaintsCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">High Priority Complaints</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{escalated}</p>
              <p className="text-xs text-muted-foreground">
                Escalated or urgent cases handled with priority.
              </p>
            </CardContent>
          </Card>

          <Card className={complaintsCardClass}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-2xl font-semibold">{resolved}</p>
              <p className="text-xs text-muted-foreground">Completed complaints.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {panel === "all" && (
        <Card className={complaintsCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ListTodo className="size-4" />
              <span>All Complaints</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {complaints.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No complaints have been submitted yet.
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
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-64">Manager Note</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead className="w-72 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complaints.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-xs">{c.id}</TableCell>
                        <TableCell>{c.employeeName ?? "Anonymous / Hidden"}</TableCell>
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
                            {c.status === "FURTHER_INVESTIGATION_REQUIRED"
                              ? "Further Investigation Required"
                              : c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top">
                          {c.managerRequestReason
                            ? c.managerRequestReason
                            : c.status === "FURTHER_INVESTIGATION_REQUIRED"
                            ? "No manager note provided."
                            : "—"}
                        </TableCell>
                        <TableCell>{c.assignedHr ?? "HR Officer"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              type="button"
                              onClick={() => {
                              setSelectedComplaintId(c.id);
                              navigatePanel("investigation");
                            }}
                            >
                              View Details
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              type="button"
                              onClick={() => {
                                updateComplaint(c.id, (prev) => ({
                                  ...prev,
                                  status: "INVESTIGATING",
                                  assignedHr:
                                    !prev.assignedHr || prev.assignedHr === "HR Officer"
                                      ? user.name
                                      : prev.assignedHr,
                                }));
                                setSelectedComplaintId(c.id);
                                navigatePanel("investigation");
                              }}
                            >
                              Start Investigation
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-full px-3 py-1 text-xs"
                              type="button"
                              onClick={() =>
                                updateComplaint(c.id, (prev) => ({
                                  ...prev,
                                  assignedHr: user.name,
                                }))
                              }
                            >
                              Assign to Me
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className={escalateButtonClass}
                              type="button"
                              onClick={() =>
                                updateComplaint(c.id, (prev) => ({
                                  ...prev,
                                  status: "ESCALATED",
                                }))
                              }
                            >
                              Escalate
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

      {panel === "investigation" && (
        <Card className={complaintsCardClass}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" />
              <span>Investigation Panel</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            {!selectedComplaint ? (
              <p className="text-muted-foreground">
                Select a complaint from the <span className="font-medium">All Complaints</span> tab
                and click <span className="font-medium">View Details</span> to see its full report
                here.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  This is where HR staff record investigation progress for the selected complaint.
                </p>

                {/* Investigation Team summary (if assigned) */}
                {selectedComplaint.supportingInvestigators &&
                  selectedComplaint.supportingInvestigators.length > 0 && (
                    <div>
                      <p className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-[11px] font-semibold text-amber-900">
                          Investigation Team
                        </span>
                      </p>
                      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm shadow-sm">
                        <p className="text-xs text-amber-900 mb-1">
                          This complaint has been escalated with an assigned investigation team.
                        </p>
                        <p className="text-sm text-amber-900">
                          <span className="font-semibold">Lead investigator:</span>{" "}
                          <span className="font-medium">
                            {selectedComplaint.assignedHr ?? "HR Officer"}
                          </span>
                        </p>
                        <p className="text-sm text-amber-900 mt-1">
                          <span className="font-semibold">Supporting investigators:</span>{" "}
                          {selectedComplaint.supportingInvestigators.join(", ")}
                        </p>
                      </div>
                    </div>
                  )}

                {/* Section 1 — Complaint Information */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 1 — Complaint Information
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Complaint ID
                      </p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-mono">
                        {selectedComplaint.id}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Submitted By
                      </p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        {selectedComplaint.employeeName ?? "Anonymous / Hidden"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">Department</p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        {selectedComplaint.departmentName ?? "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Complaint Type
                      </p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        {selectedComplaint.typeLabel ?? "Complaint"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">Priority</p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        {selectedComplaint.priority}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Date Submitted
                      </p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        {selectedComplaint.createdAt
                          ? new Date(selectedComplaint.createdAt).toLocaleDateString("en-US", {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">Status</p>
                      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        {selectedComplaint.status}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section 2 — Complaint Description */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 2 — Complaint Description
                  </p>
                  <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-sm text-foreground min-h-[80px] whitespace-pre-wrap">
                    {selectedComplaint.title || selectedComplaint.typeLabel
                      ? `${selectedComplaint.title ?? selectedComplaint.typeLabel}`
                      : "The employee reported an issue. Description details will appear here once captured from the complaint form."}
                  </div>
                </div>

                {/* Section 3 — Attachments */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 3 — Attachments
                  </p>
                  <ul className="space-y-1.5 text-sm">
                    <li className="flex items-center gap-2">
                      <span>📎</span>
                      <span className="text-foreground">Screenshot_conversation.png</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>📎</span>
                      <span className="text-foreground">Evidence_document.pdf</span>
                    </li>
                  </ul>
                  <p className="mt-1 text-sm text-muted-foreground">
                    (In a full implementation, this list will reflect the actual files uploaded with
                    the complaint.)
                  </p>
                </div>

                {/* Section 4 — Investigation Notes */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 4 — Investigation Notes
                  </p>
                  <div className="space-y-1">
                    {selectedComplaint.managerInvestigationInstructions && (
                      <p className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                        <span className="font-medium text-amber-900">Manager instructions: </span>
                        <span className="text-amber-900">
                          {selectedComplaint.managerInvestigationInstructions}
                        </span>
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Use this area to capture interview summaries and investigation progress.
                    </p>
                    <textarea
                      className="mt-1 min-h-[110px] w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-[#192853]"
                      placeholder="Enter investigation notes here..."
                      defaultValue={selectedComplaint.hrResponse ?? ""}
                      onBlur={(e) =>
                        updateComplaint(selectedComplaint.id, (prev) => ({
                          ...prev,
                          hrResponse: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* HR Officer Recommendation (for Manager) */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    HR Officer Recommendation
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Provide a concise recommendation for the HR Manager (e.g. mediation, warning,
                      policy training). This will be visible on the manager&apos;s Complaint
                      Approval view.
                    </p>
                    <textarea
                      className="mt-1 min-h-[80px] w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-[#192853]"
                      placeholder="Write the investigation findings and recommended action."
                      defaultValue={selectedComplaint.hrRecommendation ?? ""}
                      onBlur={(e) =>
                        updateComplaint(selectedComplaint.id, (prev) => ({
                          ...prev,
                          // store alongside existing fields
                          hrRecommendation: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {/* Section 5 — Update Complaint Status */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 5 — Update Complaint Status
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,260px)_1fr] items-center">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={selectedComplaint.status}
                      onChange={(e) =>
                        updateComplaint(selectedComplaint.id, (prev) => ({
                          ...prev,
                          status: e.target.value as ComplaintStatus,
                        }))
                      }
                    >
                      <option value="SUBMITTED">Submitted</option>
                      <option value="UNDER_REVIEW">Under Review</option>
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="INVESTIGATED">Investigated</option>
                      <option value="ESCALATED">Escalated</option>
                    </select>
                    <p className="text-sm text-muted-foreground">
                      Use this dropdown while the case is still being handled by HR Staff.
                    </p>
                  </div>
                </div>

                {/* Section 6 — Evidence Upload */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 6 — Evidence Upload
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Upload interview notes
                      </p>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="block w-full cursor-pointer rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5 text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-[#192853] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white hover:border-[#192853]"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Upload additional evidence
                      </p>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="block w-full cursor-pointer rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5 text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-[#192853] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white hover:border-[#192853]"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-[#192853] dark:text-[#FFE14E]">
                        Upload witness statements
                      </p>
                      <input
                        type="file"
                        accept=".pdf,application/pdf"
                        className="block w-full cursor-pointer rounded-md border border-dashed border-border bg-muted/40 px-2 py-1.5 text-[11px] file:mr-2 file:rounded-md file:border-0 file:bg-[#192853] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white hover:border-[#192853]"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 7 — Witness Records */}
                <div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#192853] dark:text-[#FFE14E]">
                    Section 7 — Witness Records (optional)
                  </p>
                  <div className="rounded-md border border-border bg-muted/30">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-40">Witness Name</TableHead>
                          <TableHead>Statement</TableHead>
                          <TableHead className="w-32 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(selectedComplaint.witnessRecords ?? []).length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-sm text-muted-foreground">
                              No witnesses have been recorded yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          (selectedComplaint.witnessRecords ?? []).map((w, idx) => (
                            <TableRow key={`${w.name}-${idx}`}>
                              <TableCell>{w.name}</TableCell>
                              <TableCell>{w.statement}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2 pr-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 rounded-full border-slate-500 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                                    onClick={() => {
                                      setNewWitnessName(w.name);
                                      setNewWitnessStatement(w.statement);
                                      setEditingWitnessIndex(idx);
                                    }}
                                  >
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 rounded-full border-slate-500 bg-slate-900 text-red-300 hover:bg-slate-800 hover:text-red-200"
                                    onClick={() => {
                                      updateComplaint(selectedComplaint.id, (prev) => ({
                                        ...prev,
                                        witnessRecords: (prev.witnessRecords ?? []).filter(
                                          (_, i) => i !== idx,
                                        ),
                                      }));
                                      setEditingWitnessIndex((current) =>
                                        current === idx ? null : current,
                                      );
                                    }}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Add witnesses to record who was interviewed or provided statements related to
                    this complaint.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_2fr_auto] items-center">
                    <input
                      type="text"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      placeholder="Witness name"
                      value={newWitnessName}
                      onChange={(e) => setNewWitnessName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                      placeholder="Brief statement"
                      value={newWitnessStatement}
                      onChange={(e) => setNewWitnessStatement(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full px-4 text-xs"
                      onClick={() => {
                        const name = newWitnessName.trim();
                        const statement = newWitnessStatement.trim();
                        if (!name || !statement) {
                          alert("Please enter both a witness name and a statement.");
                          return;
                        }

                        updateComplaint(selectedComplaint.id, (prev) => {
                          const existing = prev.witnessRecords ?? [];

                          if (
                            editingWitnessIndex !== null &&
                            editingWitnessIndex >= 0 &&
                            editingWitnessIndex < existing.length
                          ) {
                            const next = [...existing];
                            next[editingWitnessIndex] = { name, statement };
                            return {
                              ...prev,
                              witnessRecords: next,
                            };
                          }

                          const duplicateIndex = existing.findIndex(
                            (w) =>
                              w.name.toLowerCase() === name.toLowerCase() &&
                              w.statement.trim() === statement,
                          );

                          // If an identical record already exists, just keep the list as-is
                          // so we don't create visual duplicates, but also don't block the user.
                          if (duplicateIndex !== -1) {
                            return prev;
                          }

                          return {
                            ...prev,
                            witnessRecords: [...existing, { name, statement }],
                          };
                        });

                        setNewWitnessName("");
                        setNewWitnessStatement("");
                        setEditingWitnessIndex(null);
                      }}
                    >
                      {editingWitnessIndex !== null ? "Save Witness" : "Add Witness"}
                    </Button>
                  </div>
                </div>

                {/* Submit Investigation — send to HR Manager for approval */}
                <div className="flex items-center justify-between rounded-md border border-dashed border-border bg-muted/40 px-3 py-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground">
                      Submit Investigation
                    </p>
                    <p className="text-sm text-muted-foreground max-w-xl">
                      When you have finished collecting evidence and recording your notes, submit
                      this investigation so the HR Manager can review and make a final decision.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full px-4 text-xs"
                    onClick={() => setSubmitInvestigationOpen(true)}
                  >
                    Submit Investigation
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirm Submit Investigation dialog */}
      {selectedComplaint && (
        <Dialog
          open={submitInvestigationOpen}
          onOpenChange={(open) => setSubmitInvestigationOpen(open)}
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
                Confirm Investigation Submission
              </DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                Are you sure you want to submit this investigation to the HR Manager for approval?
                Please ensure your notes, witnesses, and recommendation accurately reflect the
                findings.
              </DialogDescription>
            </DialogHeader>
            <div className="my-3 h-px bg-border/60" />
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-3xl px-4 py-1.5 text-sm"
                onClick={() => setSubmitInvestigationOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-3xl px-5 py-1.5 text-sm shadow-sm"
                onClick={() => {
                  if (!selectedComplaint) return;

                  // Basic validation before handing over to HR Manager
                  if (
                    selectedComplaint.status !== "INVESTIGATED" &&
                    selectedComplaint.status !== "ESCALATED"
                  ) {
                    alert(
                      "Please set the complaint status to Investigated or Escalated before submitting the investigation.",
                    );
                    return;
                  }

                  const notes = selectedComplaint.hrResponse ?? selectedComplaint.investigationNotes;
                  if (!notes || String(notes).trim().length === 0) {
                    alert(
                      "Please add investigation notes before submitting the investigation for manager approval.",
                    );
                    return;
                  }

                  updateComplaint(selectedComplaint.id, (prev) => ({
                    ...prev,
                    status: "INVESTIGATION_COMPLETED",
                  }));
                  setSubmitInvestigationOpen(false);
                  setSelectedComplaintId(null);
                  navigatePanel("assigned");
                  alert(
                    "Investigation submitted. The case is now waiting for HR Manager approval.",
                  );
                }}
              >
                Submit Investigation
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {panel === "assigned" && (
        <Card className={complaintsCardClass}>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4" />
              <span>Assigned Complaints</span>
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Priority:</span>
                <select
                  className="h-8 rounded-full border border-input bg-background px-3 text-xs"
                  value={priorityFilter}
                  onChange={(e) =>
                    setPriorityFilter(e.target.value as "all" | "urgent" | "high_urgent")
                  }
                >
                  <option value="all">All</option>
                  <option value="urgent">Urgent only</option>
                  <option value="high_urgent">High + Urgent</option>
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full px-3 py-1 text-xs"
                onClick={reloadComplaints}
              >
                Refresh list
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This section displays complaints that are{" "}
              <span className="font-medium text-foreground">assigned to you</span> for investigation.
              You can review case details, add investigation notes, update status, or escalate the
              complaint if necessary.
            </p>

            {complaints.filter((c) => c.assignedHr === user.name).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                You currently have no complaints assigned to you.
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
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-64">Manager Note</TableHead>
                      <TableHead>Date Assigned</TableHead>
                      <TableHead className="w-[320px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complaints
                      .filter((c) => c.assignedHr === user.name)
                      .filter((c) => {
                        const p = String(c.priority).toUpperCase();
                        if (priorityFilter === "urgent") return p === "URGENT";
                        if (priorityFilter === "high_urgent")
                          return p === "URGENT" || p === "HIGH";
                        return true;
                      })
                      .sort((a, b) => {
                        const order: Record<string, number> = {
                          URGENT: 0,
                          HIGH: 1,
                          MEDIUM: 2,
                          LOW: 3,
                        };
                        const aPriority = order[String(a.priority).toUpperCase()] ?? 99;
                        const bPriority = order[String(b.priority).toUpperCase()] ?? 99;
                        if (aPriority !== bPriority) return aPriority - bPriority;

                        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return bDate - aDate;
                      })
                      .map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-xs">{c.id}</TableCell>
                          <TableCell>{c.employeeName ?? "Anonymous / Hidden"}</TableCell>
                          <TableCell>{c.typeLabel ?? "Complaint"}</TableCell>
                          <TableCell>{c.departmentName ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                c.priority === "HIGH" || c.priority === "URGENT"
                                  ? "destructive"
                                  : c.priority === "MEDIUM"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {c.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {c.status === "FURTHER_INVESTIGATION_REQUIRED"
                                ? "Further Investigation Required"
                                : c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground align-top">
                            {c.managerRequestReason
                              ? c.managerRequestReason
                              : c.status === "FURTHER_INVESTIGATION_REQUIRED"
                              ? "No manager note provided."
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full px-3 py-1 text-xs"
                                type="button"
                                onClick={() => {
                                  setSelectedComplaintId(c.id);
                                  navigatePanel("investigation");
                                }}
                              >
                                View Details
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full px-3 py-1 text-xs"
                                type="button"
                                onClick={() => {
                                  setNotesComplaintId(c.id);
                                  setNotesDraft(c.hrResponse ?? "");
                                }}
                              >
                                Add Notes
                              </Button>
                              <select
                                className="h-8 rounded-full border border-input bg-background px-2 text-xs"
                                value={c.status}
                                onChange={(e) =>
                                  updateComplaint(c.id, (prev) => ({
                                    ...prev,
                                    status: e.target.value as ComplaintStatus,
                                  }))
                                }
                              >
                                <option value="SUBMITTED">Submitted</option>
                                <option value="UNDER_REVIEW">Under Review</option>
                                <option value="INVESTIGATING">Investigating</option>
                                <option value="ESCALATED">Escalated to HR Manager</option>
                              </select>
                              <Button
                                variant="outline"
                                size="sm"
                                className={escalateButtonClass}
                                type="button"
                                onClick={() =>
                                  updateComplaint(c.id, (prev) => ({
                                    ...prev,
                                    status: "ESCALATED",
                                  }))
                                }
                              >
                                Escalate
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

      {/* Add Investigation Notes dialog */}
      {notesComplaintId && (
        <Dialog
          open={!!notesComplaintId}
          onOpenChange={(open) => {
            if (!open) {
              setNotesComplaintId(null);
            }
          }}
        >
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Investigation Notes
              </DialogTitle>
              <DialogDescription className="text-xs">
                Record your investigation findings for this complaint. These notes may be visible to
                HR Managers and used in the final resolution.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <textarea
                className="mt-1 min-h-[140px] w-full rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-[#192853]"
                placeholder="Enter investigation notes here..."
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                className="rounded-full"
                onClick={() => setNotesComplaintId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => {
                  updateComplaint(notesComplaintId, (prev) => ({
                    ...prev,
                    hrResponse: notesDraft,
                  }));
                  setNotesComplaintId(null);
                }}
              >
                Save Notes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
