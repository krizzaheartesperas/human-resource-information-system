"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ClipboardCheck,
  History,
  LayoutDashboard,
  MessageSquareQuote,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Employee, Role } from "@/lib/mock";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";
import { supabase } from "@/lib/supabase/client";
import { createItAccountActionRequest } from "@/features/it-account-actions/services/itAccountActions.service";
import {
  getPendingItAccountActionRequests,
  markItAccountActionRequestCompleted,
} from "@/features/it-account-actions/services/itAccountActions.service";
import type { ItAccountActionRequest } from "@/features/it-account-actions/types";
import { pushRoleNotification } from "@/features/notifications/services/notifications.service";
import { OffboardingRoleDashboard, type OffboardingRoleView } from "@/features/offboarding/components/OffboardingRoleDashboard";

type OffboardingView = "my" | "tasks" | "admin" | "approvals" | "audit" | "analytics" | "it";
type StatusTone = "pending" | "in-progress" | "completed" | "blocked";
type OffboardingStatus = StatusTone;
type ProcessTab =
  | "overview"
  | "profile"
  | "checklist"
  | "approvals"
  | "assets"
  | "exit-interview"
  | "activity-log";

const statusToneClass: Record<StatusTone, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  "in-progress": "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  blocked: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

const progressSteps = [
  "HR Initiation",
  "Manager Approval",
  "IT Clearance",
  "Finance Clearance",
  "Asset Return",
  "Exit Interview",
  "Final Approval",
  "Completed",
] as const;

const taskPanels = [
  {
    group: "HR Tasks",
    tasks: ["Exit interview scheduled", "Final documents prepared", "Clearance form generated"],
  },
  {
    group: "IT Tasks",
    tasks: ["Disable accounts", "Collect laptop/assets", "Revoke system access"],
  },
  {
    group: "Finance Tasks",
    tasks: ["Final salary computation", "Benefits clearance", "Loan deduction check"],
  },
  {
    group: "Admin Tasks",
    tasks: ["ID surrender", "Access card return"],
  },
];

const canAccess: Record<OffboardingView, string[]> = {
  my: ["EMPLOYEE"],
  tasks: ["HR_STAFF"],
  admin: ["HR_ADMIN"],
  approvals: ["DEPARTMENT_MANAGER", "MANAGER", "HR_MANAGER"],
  audit: ["AUDITOR"],
  analytics: ["EXECUTIVE"],
  it: ["SUPER_ADMIN"],
};

const processTabs: {
  id: ProcessTab;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "profile", label: "Employee Profile", icon: UserRound },
  { id: "checklist", label: "Task Checklist", icon: ClipboardCheck },
  { id: "approvals", label: "Approvals", icon: CheckCircle2 },
  { id: "assets", label: "Asset Clearance", icon: ShieldCheck },
  { id: "exit-interview", label: "Exit Interview", icon: MessageSquareQuote },
  { id: "activity-log", label: "Activity Log", icon: History },
];

type ChecklistTask = {
  id: string;
  group: string;
  label: string;
  assignedUser: string;
  dueDate: string;
  remarks: string;
  completed: boolean;
};

type AssetRow = {
  id: string;
  name: string;
  assigned: "Yes" | "No";
  condition: string;
  returned: boolean;
  verifiedBy: string;
};

const initialChecklistTasks: ChecklistTask[] = taskPanels.flatMap((panel) =>
  panel.tasks.map((task, index) => ({
    id: `${panel.group}-${index}`,
    group: panel.group,
    label: task,
    assignedUser: "",
    dueDate: "",
    remarks: "",
    completed: false,
  }))
);

const initialAssets: AssetRow[] = [
  {
    id: "asset-1",
    name: "Laptop",
    assigned: "Yes",
    condition: "Good",
    returned: true,
    verifiedBy: "IT Admin",
  },
  {
    id: "asset-2",
    name: "ID Card",
    assigned: "Yes",
    condition: "Good",
    returned: false,
    verifiedBy: "Admin Team",
  },
];

function statusBadge(label: string, tone: StatusTone) {
  return (
    <Badge className={`border-transparent ${statusToneClass[tone]}`}>
      {label}
    </Badge>
  );
}

const myPrimaryButtonClass =
  "rounded-xl bg-[#192853] text-white hover:bg-[#141c3d] dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90";

function MyStagePanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="border-t-[3px] border-t-[#FFE14E] border-b border-border bg-muted/25 px-5 py-4 sm:px-6">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

function StageShell({
  view,
  title,
  subtitle,
  children,
}: {
  view: OffboardingView;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  if (view === "my") {
    return (
      <MyStagePanel title={title} subtitle={subtitle}>
        {children}
      </MyStagePanel>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function OffboardingWorkspace({ view }: { view: OffboardingView }) {
  const { user } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const allowed = canAccess[view].includes(user.role);
  const [offboardingStatus, setOffboardingStatus] = useState<OffboardingStatus>("pending");
  const [progress, setProgress] = useState(10);
  const [checklistTasks, setChecklistTasks] = useState<ChecklistTask[]>(initialChecklistTasks);
  const [checklistNotice, setChecklistNotice] = useState("");
  const [approvalComment, setApprovalComment] = useState("");
  const [approvalHistory, setApprovalHistory] = useState<string[]>([
    "HR Manager approved initial clearance - 2026-04-12 11:30",
  ]);
  const [assets, setAssets] = useState<AssetRow[]>(initialAssets);
  const [interviewRating, setInterviewRating] = useState("");
  const [interviewReason, setInterviewReason] = useState("");
  const [interviewFeedback, setInterviewFeedback] = useState("");
  const [interviewConfidential, setInterviewConfidential] = useState(false);
  const [interviewSaved, setInterviewSaved] = useState(false);
  const [activityLogs, setActivityLogs] = useState<string[]>([
    "IT marked laptop returned",
    "HR approved exit interview",
    "Finance completed final pay computation",
  ]);

  const [itDialogOpen, setItDialogOpen] = useState(false);
  const [itEmployees, setItEmployees] = useState<Employee[]>([]);
  const [itEmployeesLoading, setItEmployeesLoading] = useState(false);
  const [itEmployeesError, setItEmployeesError] = useState("");
  const [itSearch, setItSearch] = useState("");
  const [itSelected, setItSelected] = useState<Employee | null>(null);
  const [itAction, setItAction] = useState<"DISABLE_ACCESS" | "DELETE_ACCOUNT">(
    "DISABLE_ACCESS"
  );
  const [itReason, setItReason] = useState("");
  const [itSubmitError, setItSubmitError] = useState("");

  const [itQueue, setItQueue] = useState<ItAccountActionRequest[]>([]);
  const [itQueueBusyId, setItQueueBusyId] = useState<string | null>(null);
  const [itQueueError, setItQueueError] = useState("");

  const pageTitle = useMemo(() => {
    switch (view) {
      case "my":
        return "Exit";
      case "tasks":
        return "Offboarding Tasks";
      case "admin":
        return "Offboarding Admin";
      case "approvals":
        return "Offboarding Approvals";
      case "audit":
        return "Offboarding Audit";
      case "analytics":
        return "Offboarding Analytics";
      case "it":
        return "Offboarding IT Clearance";
    }
  }, [view]);
  const tabFromQuery = searchParams.get("process") as ProcessTab | null;
  const currentProcess: ProcessTab = processTabs.some((p) => p.id === tabFromQuery)
    ? (tabFromQuery as ProcessTab)
    : "overview";
  const currentProcessLabel =
    processTabs.find((p) => p.id === currentProcess)?.label ?? "Overview";
  const basePath = `/offboarding/${view}`;
  const completedTaskCount = checklistTasks.filter((task) => task.completed).length;
  const overdueTaskCount = checklistTasks.filter(
    (task) => !task.completed && !!task.dueDate && new Date(task.dueDate) < new Date()
  ).length;

  const employeeStepper = (
    <div className="-mx-1 px-1">
      <div className="flex w-full items-start">
        {processTabs.map((tab, index) => {
          const href = `${basePath}?process=${tab.id}`;
          const stepNumber = String(index + 1).padStart(2, "0");
          const isActive = tab.id === currentProcess;
          const isCompleted = processTabs.findIndex((step) => step.id === currentProcess) > index;
          const isUpcoming = !isActive && !isCompleted;

          return (
            <div key={tab.id} className="flex min-w-0 flex-1 items-start">
              <Link
                href={href}
                className="group flex min-w-0 flex-1 flex-col items-center text-center"
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border text-xs font-semibold transition-colors sm:size-11 sm:text-sm",
                    isCompleted && "border-[#FFE14E] bg-[#FFE14E] text-[#111827]",
                    isActive &&
                      "border-[#FFE14E] bg-[#FFE14E]/25 text-[#111827] ring-2 ring-[#FFE14E]/40",
                    isUpcoming &&
                      "border-border bg-background text-muted-foreground group-hover:border-[#FFE14E] group-hover:text-[#111827]"
                  )}
                >
                  {isCompleted ? "✓" : stepNumber}
                </span>
                <p
                  className={cn(
                    "mt-2 line-clamp-2 px-1 text-[11px] font-medium leading-tight transition-colors sm:mt-3 sm:text-xs md:text-sm",
                    isCompleted && "text-[#111827]",
                    isActive && "text-[#111827]",
                    isUpcoming && "text-muted-foreground group-hover:text-foreground"
                  )}
                >
                  {tab.label}
                </p>
              </Link>
              {index < processTabs.length - 1 ? (
                <span
                  className={cn(
                    "mt-5 h-[2px] w-full max-w-16 rounded-full sm:max-w-20",
                    isCompleted ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const addActivity = (message: string) => {
    setActivityLogs((prev) => [message, ...prev].slice(0, 20));
  };

  const canRequestItAction =
    user.role === "HR_STAFF" || user.role === "HR_ADMIN" || user.role === "HR_MANAGER";

  const openItDialog = async () => {
    setItDialogOpen(true);
    setItSubmitError("");
    setItEmployeesError("");
    if (itEmployees.length > 0) return;

    setItEmployeesLoading(true);
    try {
      if (!isSupabaseAuthConfigured()) {
        setItEmployees([]);
        setItEmployeesError("Supabase is not configured in this environment.");
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session. Please sign in again.");
      const resp = await fetch("/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await resp.json().catch(() => null)) as unknown;
      const obj = (json && typeof json === "object" ? (json as Record<string, unknown>) : null);
      if (!resp.ok) throw new Error(String(obj?.error ?? "Failed to load employees."));
      const employees = (obj?.employees ?? []) as Employee[];
      setItEmployees(employees);
    } catch (e) {
      setItEmployeesError(e instanceof Error ? e.message : "Failed to load employees.");
    } finally {
      setItEmployeesLoading(false);
    }
  };

  const itFiltered = useMemo(() => {
    const q = itSearch.trim().toLowerCase();
    if (!q) return itEmployees.slice(0, 25);
    return itEmployees
      .filter((e) => {
        const hay = `${e.firstName} ${e.lastName} ${e.email} ${e.employeeNumber}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 25);
  }, [itEmployees, itSearch]);

  const submitItRequest = () => {
    setItSubmitError("");
    if (!itSelected) {
      setItSubmitError("Please select an employee.");
      return;
    }
    if (!itReason.trim()) {
      setItSubmitError("Please add a short reason (e.g., last day, exit type).");
      return;
    }
    const requestedByRole = user.role as Role;
    createItAccountActionRequest({
      employeeId: itSelected.id,
      employeeName: `${itSelected.firstName} ${itSelected.lastName}`.trim() || itSelected.email,
      employeeEmail: itSelected.email,
      employeeNumber: itSelected.employeeNumber,
      departmentId: itSelected.departmentId,
      action: itAction,
      reason: itReason.trim(),
      requestedByName: user.name,
      requestedByRole,
    });
    pushRoleNotification("SUPER_ADMIN", {
      title: "IT action required: Offboarding account",
      body: `HR requested ${itAction === "DELETE_ACCOUNT" ? "account deletion" : "access disable"} for ${itSelected.firstName} ${itSelected.lastName}.`,
      time: "Just now",
      unread: true,
    });
    addActivity(`IT account action requested (${itAction.replace(/_/g, " ").toLowerCase()})`);
    setItDialogOpen(false);
    setItSelected(null);
    setItSearch("");
    setItReason("");
    setItAction("DISABLE_ACCESS");
  };

  const fulfillItQueueRequest = async (req: ItAccountActionRequest) => {
    setItQueueError("");
    setItQueueBusyId(req.id);
    try {
      const authAction = req.action === "DELETE_ACCOUNT" ? "delete" : "disable";

      if (!isSupabaseAuthConfigured()) {
        const raw = localStorage.getItem("hris-user-mgmt-status") ?? "{}";
        const parsed = JSON.parse(raw) as Record<string, Employee["employmentStatus"]>;
        parsed[req.employeeId] = "OFFBOARDED";
        localStorage.setItem("hris-user-mgmt-status", JSON.stringify(parsed));
        markItAccountActionRequestCompleted(req.id);
        setItQueue(getPendingItAccountActionRequests());
        pushRoleNotification(req.requestedByRole, {
          title: "IT action completed",
          body: `IT completed ${req.action === "DELETE_ACCOUNT" ? "account deletion" : "access disable"} for ${req.employeeName}.`,
          time: "Just now",
          unread: true,
        });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session. Please sign in again.");

      const resp = await fetch(`/api/employees/${encodeURIComponent(req.employeeId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ employmentStatus: "OFFBOARDED", authAction }),
      });
      const json = (await resp.json().catch(() => null)) as unknown;
      const obj = (json && typeof json === "object" ? (json as Record<string, unknown>) : null);
      if (!resp.ok) throw new Error(String(obj?.error ?? "Failed to apply IT request."));

      markItAccountActionRequestCompleted(req.id);
      setItQueue(getPendingItAccountActionRequests());
      pushRoleNotification(req.requestedByRole, {
        title: "IT action completed",
        body: `IT completed ${req.action === "DELETE_ACCOUNT" ? "account deletion" : "access disable"} for ${req.employeeName}.`,
        time: "Just now",
        unread: true,
      });
    } catch (e) {
      setItQueueError(e instanceof Error ? e.message : "Failed to apply IT request.");
    } finally {
      setItQueueBusyId(null);
    }
  };

  useEffect(() => {
    if (view !== "it") return;
    setItQueue(getPendingItAccountActionRequests());
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith("hris-it-account-actions")) {
        setItQueue(getPendingItAccountActionRequests());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [view]);

  const goToProcess = (nextProcess: ProcessTab) => {
    router.push(`${basePath}?process=${nextProcess}`);
  };

  const handleStartOffboarding = () => {
    setOffboardingStatus("in-progress");
    setProgress((prev) => Math.max(prev, 20));
    addActivity("HR started offboarding process");
  };

  const handleCancelProcess = () => {
    setOffboardingStatus("blocked");
    addActivity("HR cancelled offboarding process");
  };

  const handleExportClearance = () => {
    const content = [
      "Employee,Department,Exit Type,Last Day,Status,Progress",
      `Isla Dela Cruz,Engineering,Resignation,2026-04-30,${offboardingStatus},${progress}%`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "offboarding-clearance.csv";
    link.click();
    URL.revokeObjectURL(url);
    addActivity("HR exported clearance report");
  };

  const getTaskTone = (task: ChecklistTask): StatusTone => {
    if (task.completed) return "completed";
    if (task.dueDate && new Date(task.dueDate) < new Date()) return "blocked";
    if (task.assignedUser || task.remarks || task.dueDate) return "in-progress";
    return "pending";
  };

  const handleTaskChange = (taskId: string, patch: Partial<ChecklistTask>) => {
    setChecklistTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
  };

  const handleSaveChecklist = () => {
    setChecklistNotice("Checklist updates saved.");
    setProgress((prev) => Math.max(prev, Math.min(70, 20 + completedTaskCount * 5)));
    addActivity("Checklist panel updated");
  };

  const handleApprovalAction = (action: "approved" | "revision" | "rejected") => {
    const note = approvalComment.trim() || "No comment";
    const entry =
      action === "approved"
        ? `Approved by ${user.name}: ${note}`
        : action === "revision"
          ? `Revision requested by ${user.name}: ${note}`
          : `Rejected by ${user.name}: ${note}`;
    setApprovalHistory((prev) => [entry, ...prev]);
    if (action === "approved") {
      setOffboardingStatus("in-progress");
      setProgress((prev) => Math.max(prev, 80));
    }
    if (action === "rejected") setOffboardingStatus("blocked");
    setApprovalComment("");
    addActivity(entry);
  };

  const handleToggleAssetReturn = (assetId: string) => {
    setAssets((prev) =>
      prev.map((asset) =>
        asset.id === assetId ? { ...asset, returned: !asset.returned } : asset
      )
    );
    addActivity("Asset clearance updated");
  };

  const handleSubmitInterview = () => {
    if (!interviewRating || !interviewReason || !interviewFeedback.trim()) {
      setInterviewSaved(false);
      return;
    }
    setInterviewSaved(true);
    setProgress((prev) => Math.max(prev, 90));
    addActivity(
      `Exit interview submitted${interviewConfidential ? " (confidential)" : ""}`
    );
  };

  if (!allowed) {
    return (
      <div className="space-y-4 -mt-2">
        <h1 className="mt-[10px] text-3xl font-semibold tracking-tight">{pageTitle}</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              You do not have permission to access this offboarding view.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "it") {
    return (
      <div className="min-w-0 w-full max-w-full space-y-6 text-foreground">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search offboarding..." />
            <EmployeeSectionHeader
              title="System Admin Offboarding"
              description="Coordinate access removal and account enforcement for governed offboarding requests."
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Disable Access</p>
              <p className="mt-2 text-2xl font-semibold">
                {itQueue.filter((request) => request.action === "DISABLE_ACCESS").length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Standard inactive enforcement requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Delete Account</p>
              <p className="mt-2 text-2xl font-semibold">
                {itQueue.filter((request) => request.action === "DELETE_ACCOUNT").length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Policy-driven permanent removal requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Pending Queue</p>
              <p className="mt-2 text-2xl font-semibold">{itQueue.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">Requests awaiting system action</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Access Removal Coordination Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">

            {itQueueError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {itQueueError}
              </div>
            )}

            {itQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending IT requests.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Removal Action</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Requested At</TableHead>
                    <TableHead className="text-right">Apply</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itQueue.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <div className="min-w-0">
                          <div className="truncate">{r.employeeName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.employeeEmail || "-"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.requestedByName} ({r.requestedByRole.replace(/_/g, " ")})
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {r.action === "DELETE_ACCOUNT" ? "Delete" : "Disable"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.reason}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(r.requestedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={r.action === "DELETE_ACCOUNT" ? "destructive" : "outline"}
                          onClick={() => void fulfillItQueueRequest(r)}
                          disabled={itQueueBusyId === r.id}
                        >
                          {itQueueBusyId === r.id ? "Working..." : "Apply"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </section>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Use “Disable” unless policy requires deletion.</p>
                <p>Deleting is permanent and can break historical references.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    );
  }

  if (
    view === "tasks" ||
    view === "admin" ||
    view === "approvals" ||
    view === "audit" ||
    view === "analytics"
  ) {
    return <OffboardingRoleDashboard view={view as OffboardingRoleView} currentUser={user} />;
  }

  const offboardingStages = (
    <>
      {currentProcess === "overview" && (
        <>
          {view === "my" ? (
            <StageShell
              view={view}
              title="Exit Summary"
            >
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <p>
                  <span className="text-muted-foreground">Employee:</span> Isla Dela Cruz
                </p>
                <p>
                  <span className="text-muted-foreground">Department:</span> Engineering
                </p>
                <p>
                  <span className="text-muted-foreground">Exit Type:</span> Resignation
                </p>
                <p>
                  <span className="text-muted-foreground">Last Day:</span> 2026-04-30
                </p>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {statusBadge(offboardingStatus.replace("-", " "), offboardingStatus)}
                <span className="text-sm text-muted-foreground">Overall progress: {progress}%</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => goToProcess("profile")}
                >
                  View Details
                </Button>
              </div>
            </StageShell>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card>
                  <CardContent className="py-5">
                    <p className="text-xs text-muted-foreground">Pending Offboarding</p>
                    <p className="text-2xl font-semibold">{offboardingStatus === "pending" ? 1 : 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-5">
                    <p className="text-xs text-muted-foreground">In Progress</p>
                    <p className="text-2xl font-semibold">{offboardingStatus === "in-progress" ? 1 : 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-5">
                    <p className="text-xs text-muted-foreground">Completed</p>
                    <p className="text-2xl font-semibold">{offboardingStatus === "completed" ? 1 : 0}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-5">
                    <p className="text-xs text-muted-foreground">Overdue Tasks</p>
                    <p className="text-2xl font-semibold text-rose-600">{overdueTaskCount}</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Offboarding Dashboard</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Type of Exit</TableHead>
                        <TableHead>Last Day</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Isla Dela Cruz</TableCell>
                        <TableCell>Engineering</TableCell>
                        <TableCell>Resignation</TableCell>
                        <TableCell>2026-04-30</TableCell>
                        <TableCell>{statusBadge(offboardingStatus.replace("-", " "), offboardingStatus)}</TableCell>
                        <TableCell>{progress}%</TableCell>
                        <TableCell className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => goToProcess("profile")}>
                            View Details
                          </Button>
                          {canRequestItAction && (
                            <Button variant="outline" size="sm" onClick={() => void openItDialog()}>
                              Request IT action
                            </Button>
                          )}
                          <Button size="sm" onClick={handleStartOffboarding}>
                            Start Offboarding
                          </Button>
                          <Button variant="outline" size="sm" onClick={handleExportClearance}>
                            Export Clearance
                          </Button>
                          <Button variant="destructive" size="sm" onClick={handleCancelProcess}>
                            Cancel Process
                          </Button>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {currentProcess === "profile" && (
        <StageShell
          view={view}
          title="Employee Offboarding Profile"
        >
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <p>
              <span className="text-muted-foreground">Employee:</span> Isla Dela Cruz (EMP-00124)
            </p>
            <p>
              <span className="text-muted-foreground">Position/Dept:</span> Junior Software Developer /
              Engineering
            </p>
            <p>
              <span className="text-muted-foreground">Last Working Date:</span> 2026-04-30
            </p>
            <p>
              <span className="text-muted-foreground">Reason:</span> Resignation
            </p>
          </div>
          <div
            className={cn(
              "mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-4",
              view === "my" && "pt-1"
            )}
          >
            {progressSteps.map((step, idx) => (
              <div
                key={step}
                className={cn(
                  "rounded-md border p-3",
                  view === "my" && "rounded-xl border-border bg-card shadow-sm"
                )}
              >
                <p className="text-sm font-medium">
                  {idx + 1}. {step}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Responsible: {idx < 2 ? "HR Team" : "Assigned Team Lead"}
                </p>
                <div className="mt-2">
                  {idx < 5
                    ? statusBadge("Completed", "completed")
                    : idx === 5
                      ? statusBadge("In Progress", "in-progress")
                      : statusBadge("Pending", "pending")}
                </div>
              </div>
            ))}
          </div>
        </StageShell>
      )}

      {currentProcess === "checklist" && (
        <StageShell
          view={view}
          title={view === "my" ? "Task Checklist" : "Task Checklist Panel"}
        >
          <div className="space-y-4">
            {taskPanels.map((panel) => (
              <div
                key={panel.group}
                className={cn(
                  "space-y-2 rounded-md border p-3",
                  view === "my" && "rounded-xl border-border bg-card shadow-sm"
                )}
              >
                <p className="text-sm font-semibold">{panel.group}</p>
                {checklistTasks
                  .filter((task) => task.group === panel.group)
                  .map((task) => (
                    <div key={task.id} className="grid items-center gap-2 md:grid-cols-6">
                      <Label className="flex items-center gap-2 md:col-span-2">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={task.completed}
                          onChange={(e) => handleTaskChange(task.id, { completed: e.target.checked })}
                        />
                        {task.label}
                      </Label>
                      <Input
                        className="h-8"
                        placeholder="Assigned user"
                        value={task.assignedUser}
                        onChange={(e) => handleTaskChange(task.id, { assignedUser: e.target.value })}
                      />
                      <Input
                        className="h-8"
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => handleTaskChange(task.id, { dueDate: e.target.value })}
                      />
                      <Input
                        className="h-8"
                        placeholder="Remarks"
                        value={task.remarks}
                        onChange={(e) => handleTaskChange(task.id, { remarks: e.target.value })}
                      />
                      <div className="flex items-center gap-2">
                        {statusBadge(getTaskTone(task).replace("-", " "), getTaskTone(task))}
                      </div>
                    </div>
                  ))}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveChecklist}
                className={cn(view === "my" && myPrimaryButtonClass)}
              >
                Save Checklist Updates
              </Button>
              <p className="text-xs text-muted-foreground">
                Completed: {completedTaskCount}/{checklistTasks.length}
              </p>
              {checklistNotice ? <p className="text-xs text-emerald-600">{checklistNotice}</p> : null}
            </div>
          </div>
        </StageShell>
      )}

      {currentProcess === "approvals" && (
        <StageShell
          view={view}
          title={view === "my" ? "Approvals" : "Approval Panel"}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => handleApprovalAction("approved")}
                className={cn(view === "my" && myPrimaryButtonClass)}
              >
                Approve Offboarding
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(view === "my" && "rounded-xl")}
                onClick={() => handleApprovalAction("revision")}
              >
                Request Revision
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => handleApprovalAction("rejected")}>
                Reject Process
              </Button>
            </div>
            <Label htmlFor="approval-comment">Comment</Label>
            <Input
              id="approval-comment"
              placeholder="Add manager or HR comment"
              value={approvalComment}
              onChange={(e) => setApprovalComment(e.target.value)}
              className={cn(view === "my" && "rounded-xl")}
            />
            <div
              className={cn(
                "rounded-md border p-3 text-sm",
                view === "my" && "rounded-xl border-border bg-muted/20"
              )}
            >
              <p className="mb-2 font-medium">Approval History</p>
              <div className="space-y-2">
                {approvalHistory.map((entry) => (
                  <p key={entry} className="text-muted-foreground">
                    {entry}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </StageShell>
      )}

      {currentProcess === "assets" && (
        <StageShell
          view={view}
          title="Asset & Clearance"
        >
          <Table>
            <TableHeader
              className={
                view === "my"
                  ? "[&_tr]:border-[#111827]/10 [&_th]:border-[#111827]/10 [&_th]:bg-[#FFE14E] [&_th]:font-semibold [&_th]:text-[#111827]"
                  : undefined
              }
            >
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Assigned To Employee</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Returned?</TableHead>
                <TableHead>Verified By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell>{asset.name}</TableCell>
                  <TableCell>{asset.assigned}</TableCell>
                  <TableCell>{asset.condition}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {statusBadge(asset.returned ? "Returned" : "Pending", asset.returned ? "completed" : "pending")}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn(view === "my" && "rounded-xl")}
                        onClick={() => handleToggleAssetReturn(asset.id)}
                      >
                        {asset.returned ? "Mark Pending" : "Mark Returned"}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{asset.verifiedBy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </StageShell>
      )}

      {currentProcess === "exit-interview" && (
        <StageShell
          view={view}
          title={view === "my" ? "Exit Interview" : "Exit Interview Module"}
        >
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Label>Overall Experience (1-5)</Label>
                <Input
                  placeholder="4"
                  value={interviewRating}
                  onChange={(e) => setInterviewRating(e.target.value)}
                  className={cn(view === "my" && "rounded-xl")}
                />
              </div>
              <div>
                <Label>Reason for Leaving</Label>
                <Input
                  placeholder="Career growth"
                  value={interviewReason}
                  onChange={(e) => setInterviewReason(e.target.value)}
                  className={cn(view === "my" && "rounded-xl")}
                />
              </div>
            </div>
            <div>
              <Label>Feedback</Label>
              <textarea
                className={cn(
                  "mt-1 min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm",
                  view === "my" && "rounded-xl"
                )}
                placeholder="Share your feedback..."
                value={interviewFeedback}
                onChange={(e) => setInterviewFeedback(e.target.value)}
              />
            </div>
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="size-4"
                checked={interviewConfidential}
                onChange={(e) => setInterviewConfidential(e.target.checked)}
              />
              Mark as confidential
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitInterview}
                className={cn(view === "my" && myPrimaryButtonClass)}
              >
                Submit Exit Interview
              </Button>
              {interviewSaved ? (
                <span className="text-xs text-emerald-600">Exit interview saved.</span>
              ) : null}
            </div>
          </div>
        </StageShell>
      )}

      {currentProcess === "activity-log" && (
        <StageShell
          view={view}
          title={view === "my" ? "Activity Log" : "Audit / Activity Log"}
        >
          <div className="space-y-2 text-sm">
            {activityLogs.map((log) => (
              <div
                key={log}
                className={cn(
                  "rounded-md border p-3",
                  view === "my" && "rounded-xl border-border bg-muted/15"
                )}
              >
                {log}
              </div>
            ))}
          </div>
        </StageShell>
      )}
    </>
  );

  return (
    <div className={cn(view === "my" ? "flex flex-col gap-6 pb-8" : "space-y-6 -mt-2")}>
      {view === "my" ? (
        <>
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader title="Exit" />
          </div>
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <div className="border-b border-border pb-3">{employeeStepper}</div>
            {offboardingStages}
          </div>
        </>
      ) : (
        <>
          {user.role === "HR_STAFF" ? (
            <div className="flex flex-col gap-6">
              <EmployeeModuleTopbar searchPlaceholder="Search" />
              <EmployeeSectionHeader
                title="Offboarding"
                tabs={processTabs.map((t) => ({ id: t.id, label: t.label }))}
                activeTab={currentProcess}
                onTabChange={(id) => {
                  const href = `${basePath}?process=${id}`;
                  window.location.href = href;
                }}
              />
            </div>
          ) : (
            <div className="space-y-3 mt-[10px]">
              <DashboardSectionTopBar
                breadcrumb={
                  <>
                    <span className="font-semibold">Offboarding</span>
                    <span className="opacity-70">&gt;</span>
                    <span className="font-semibold text-foreground">{currentProcessLabel}</span>
                  </>
                }
              />
              <div className="border-b border-border/70 pb-3">
                <div className="-mx-1 px-1">
                  <div className="flex gap-1 overflow-x-auto py-1 sm:gap-4 lg:gap-6">
                    {processTabs.map((tab) => {
                      const href = `${basePath}?process=${tab.id}`;
                      const active = tab.id === currentProcess;
                      const Icon = tab.icon;
                      return (
                        <Link
                          key={tab.id}
                          href={href}
                          className={cn(
                            "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base",
                            active
                              ? "text-primary font-medium"
                              : "text-muted-foreground hover:text-primary"
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          {tab.label}
                          <span
                            className={cn(
                              "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200",
                              active ? "scale-x-100" : "scale-x-0"
                            )}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {offboardingStages}

          <Dialog open={itDialogOpen} onOpenChange={setItDialogOpen}>
            <DialogContent className="sm:max-w-[720px]">
              <DialogHeader>
                <DialogTitle>Request IT account action</DialogTitle>
                <DialogDescription>
                  Notifies the System Admin to disable or delete the employee’s HRIS account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                {itEmployeesError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                    {itEmployeesError}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="it-search">Employee</Label>
                    <Input
                      id="it-search"
                      value={itSearch}
                      onChange={(e) => setItSearch(e.target.value)}
                      placeholder="Search name, email, employee #"
                    />
                    <div className="max-h-56 overflow-auto rounded-md border border-border bg-background">
                      {itEmployeesLoading ? (
                        <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                      ) : itFiltered.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">No matches.</div>
                      ) : (
                        <div className="divide-y divide-border">
                          {itFiltered.map((e) => {
                            const selected = itSelected?.id === e.id;
                            const name = `${e.firstName} ${e.lastName}`.trim() || e.email;
                            return (
                              <button
                                key={e.id}
                                type="button"
                                onClick={() => setItSelected(e)}
                                className={cn(
                                  "w-full text-left px-3 py-2 transition-colors hover:bg-accent/60",
                                  selected && "bg-accent/70"
                                )}
                              >
                                <div className="text-sm font-medium text-foreground">{name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {e.email || "—"} • {e.employeeNumber || "—"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="it-action">Action</Label>
                      <select
                        id="it-action"
                        value={itAction}
                        onChange={(e) =>
                          setItAction(e.target.value as "DISABLE_ACCESS" | "DELETE_ACCOUNT")
                        }
                        className={cn(
                          "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        )}
                      >
                        <option value="DISABLE_ACCESS">Disable access (recommended)</option>
                        <option value="DELETE_ACCOUNT">Delete account (permanent)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="it-reason">Reason</Label>
                      <Input
                        id="it-reason"
                        value={itReason}
                        onChange={(e) => setItReason(e.target.value)}
                        placeholder="e.g., Resignation, last day 2026-04-30"
                      />
                    </div>

                    {itSubmitError && (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                        {itSubmitError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setItDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submitItRequest} disabled={itEmployeesLoading}>
                  Send request
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
