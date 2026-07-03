"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileCheck,
  FileDown,
  FileText,
  HelpCircle,
  Info,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plus,
  Search,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { cn } from "@/lib/utils";
import { ExitRequestForm, type ExitRequestFormValues } from "./ExitRequestForm";
import {
  acknowledgeEmployeeOffboardingDocument,
  addEmployeeHandoverItem,
  buildDocumentText,
  cancelEmployeeOffboardingRequest,
  createEmployeeOffboardingRequest,
  cycleEmployeeHandoverStatus,
  getFinalPayReadiness,
  getChecklistProgress,
  getOffboardingCurrentStatus,
  loadEmployeeOffboardingState,
  logEmployeeOffboardingActivity,
  saveEmployeeOffboardingState,
  toggleEmployeeChecklistTask,
  updateEmployeeOffboardingRequest,
  type EmployeeOffboardingChecklistTask,
  type EmployeeOffboardingDocument,
  type EmployeeOffboardingState,
} from "@/features/offboarding/services/employeeOffboarding.service";

type TabType =
  | "Overview"
  | "Exit Request"
  | "Clearance & Checklist"
  | "Handover"
  | "Documents & Policy"
  | "FAQs"
  | "History";

const TABS: TabType[] = [
  "Overview",
  "Exit Request",
  "Clearance & Checklist",
  "Handover",
  "Documents & Policy",
  "FAQs",
  "History",
];

const TAB_QUERY_MAP: Record<TabType, string> = {
  Overview: "overview",
  "Exit Request": "exit-request",
  "Clearance & Checklist": "clearance-checklist",
  Handover: "handover",
  "Documents & Policy": "documents-policy",
  FAQs: "faqs",
  History: "history",
};

const QUERY_TO_TAB = Object.fromEntries(
  Object.entries(TAB_QUERY_MAP).map(([key, value]) => [value, key as TabType])
) as Record<string, TabType>;

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Draft: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  "In Review": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "Awaiting Final Approval": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  "Ready for Payroll": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Pending Clearance": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  "On Hold": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  Inactive: "bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  "Waiting Review": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  Acknowledged: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

const POLICY_LINKS = [
  { label: "Resignation Policy", fileName: "resignation-policy.txt" },
  { label: "Handover Guidelines", fileName: "handover-guidelines.txt" },
  { label: "Clearance Policy", fileName: "clearance-policy.txt" },
  { label: "Exit FAQs", fileName: "exit-faqs.txt" },
];

const FAQ_ITEMS = [
  { q: "How do I submit my resignation?", a: "Use the Exit Request Form to file your resignation or other exit type and provide the required transition details." },
  { q: "What is the standard notice period?", a: "The default notice period is 30 calendar days unless another arrangement is approved." },
  { q: "Where can I track my offboarding progress?", a: "Track it in this module through the Overview, Clearance & Checklist, Handover, and History tabs." },
  { q: "Who reviews my exit request?", a: "The reporting manager reviews first, then HR continues the offboarding workflow." },
  { q: "When is my final pay processed?", a: "Final pay readiness is shown in this module as a read-only Finance status. Incomplete employee tasks, acknowledgements, or department clearance can delay readiness." },
  { q: "Can I still edit my request after review starts?", a: "You can only edit or cancel your request while it is still in an employee-editable stage. Once governance steps are underway, those actions are locked." },
  { q: "What happens if my checklist is incomplete?", a: "Unfinished employee or department clearance items can delay final pay readiness, final documents, and completion of the offboarding case." },
];

const EMPTY_CHECKLIST: EmployeeOffboardingChecklistTask[] = [];
const EMPTY_DOCUMENTS: EmployeeOffboardingDocument[] = [];
const EMPTY_HANDOVER = [] as const;
const EMPTY_ACTIVITIES = [] as const;

function statusBadge(status: string) {
  return (
    <Badge className={cn("rounded-lg border-none px-2.5 py-0.5 text-xs font-semibold shadow-none", STATUS_STYLE[status] ?? STATUS_STYLE.Pending)}>
      {status}
    </Badge>
  );
}

function formatLongDate(date?: string) {
  if (!date) return "Not set";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function normalizeQueryTab(value: string | null): TabType {
  if (!value) return "Overview";
  return QUERY_TO_TAB[value] ?? "Overview";
}

function downloadTextFile(fileName: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function emptyState(message: string) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export default function OffboardingPageClient() {
  const { user: currentUser } = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showExitRequestForm, setShowExitRequestForm] = useState(false);
  const [isEditingRequest, setIsEditingRequest] = useState(false);
  const [state, setState] = useState<EmployeeOffboardingState | null>(() =>
    currentUser.employeeId ? loadEmployeeOffboardingState(currentUser.employeeId) : null
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [handoverDialogOpen, setHandoverDialogOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [handoverDraft, setHandoverDraft] = useState({
    task: "",
    assignedTo: "",
    dueDate: "",
    notes: "",
  });

  useEffect(() => {
    if (!currentUser.employeeId || !state) return;
    saveEmployeeOffboardingState(currentUser.employeeId, state);
  }, [currentUser.employeeId, state]);

  useEffect(() => {
    if (!flashMessage) return;
    const timer = window.setTimeout(() => setFlashMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [flashMessage]);

  const activeTab = normalizeQueryTab(searchParams.get("tab"));
  const searchText = searchParams.get("q") ?? "";
  const query = searchText.trim().toLowerCase();
  const request = state?.request ?? null;
  const checklist = state?.checklist ?? EMPTY_CHECKLIST;
  const documents = state?.documents ?? EMPTY_DOCUMENTS;
  const handoverItems = state?.handoverItems ?? EMPTY_HANDOVER;
  const activities = state?.activities ?? EMPTY_ACTIVITIES;
  const checklistProgress = getChecklistProgress(checklist);
  const overallStatus = state ? getOffboardingCurrentStatus(state) : "Draft";
  const finalPayReadiness = state ? getFinalPayReadiness(state) : "Pending Clearance";
  const effectiveSeparationDate = request?.lastWorkingDay || request?.preferredExitDate || "";
  const effectiveDate = effectiveSeparationDate ? new Date(effectiveSeparationDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isFutureDated = Boolean(effectiveDate && !Number.isNaN(effectiveDate.getTime()) && effectiveDate > today);
  const employmentStatus = !request ? "Active" : effectiveDate && !Number.isNaN(effectiveDate.getTime()) && effectiveDate <= today ? "Inactive" : "Active";
  const employeeTasks = checklist.filter((task) => task.ownerType === "employee");
  const departmentTasks = checklist.filter((task) => task.ownerType === "department");
  const myPendingTasks = employeeTasks.filter((task) => !task.completed);
  const waitingOnAnotherTeam = departmentTasks.filter((task) => !task.completed);
  const filteredDocuments = documents.filter((doc) =>
    query ? `${doc.title} ${doc.status}`.toLowerCase().includes(query) : true
  );
  const acknowledgementProgress = {
    total: documents.filter((doc) => doc.required).length,
    completed: documents.filter((doc) => doc.required && doc.status === "Acknowledged").length,
  };
  const currentStage =
    !request
      ? "No request started"
      : overallStatus === "Scheduled"
        ? "Request submitted and queued for offboarding setup"
        : overallStatus === "In Progress"
          ? "Employee actions and department clearance are underway"
          : overallStatus === "Awaiting Final Approval"
            ? "Your actions are complete and the case is waiting on final team review"
            : overallStatus === "Completed"
              ? "Clearance completed"
              : overallStatus === "Inactive"
                ? "Separation date reached and inactive enforcement applies"
                : "Offboarding case has been cancelled";
  const nextStep =
    !request
      ? "Submit your exit request."
      : myPendingTasks.length > 0
        ? `Complete ${myPendingTasks[0].label}.`
        : waitingOnAnotherTeam.length > 0
          ? `Waiting for ${waitingOnAnotherTeam[0].owner} to complete ${waitingOnAnotherTeam[0].label}.`
          : "Monitor final clearance and payroll readiness.";
  const canEditRequest = Boolean(request && (overallStatus === "Scheduled" || overallStatus === "In Progress") && employmentStatus !== "Inactive" && request.status !== "Cancelled");
  const canCancelRequest = Boolean(request && overallStatus === "Scheduled" && employmentStatus !== "Inactive" && request.status !== "Cancelled");
  const futureDatedMessage =
    request && isFutureDated
      ? `Your offboarding process has started in preparation for your effective separation date on ${formatLongDate(effectiveSeparationDate)}.`
      : null;

  const filteredChecklist = checklist.filter((task) =>
    query ? `${task.category} ${task.label} ${task.status} ${task.owner}`.toLowerCase().includes(query) : true
  );

  const groupedChecklist = filteredChecklist.reduce<Record<string, EmployeeOffboardingChecklistTask[]>>((acc, task) => {
    acc[task.category] = [...(acc[task.category] ?? []), task];
    return acc;
  }, {});

  const filteredHandover = handoverItems.filter((item) =>
    query ? `${item.task} ${item.assignedTo} ${item.notes} ${item.status}`.toLowerCase().includes(query) : true
  );

  const filteredPolicies = POLICY_LINKS.filter((item) => (query ? item.label.toLowerCase().includes(query) : true));

  const filteredFaqs = FAQ_ITEMS.filter((item) => (query ? `${item.q} ${item.a}`.toLowerCase().includes(query) : true));

  const filteredActivities = activities.filter((item) =>
    query ? `${item.activity} ${item.actor} ${item.happenedAt}`.toLowerCase().includes(query) : true
  );

  const syncRouteState = (nextTab: TabType, nextQuery: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", TAB_QUERY_MAP[nextTab]);
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    else params.delete("q");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleTabChange = (tab: TabType) => {
    syncRouteState(tab, searchText);
  };

  const handleSearchChange = (value: string) => {
    syncRouteState(activeTab, value);
  };

  const mutateState = (updater: (current: EmployeeOffboardingState) => EmployeeOffboardingState, message?: string) => {
    setState((current) => {
      if (!current) return current;
      return updater(current);
    });
    if (message) setFlashMessage(message);
  };

  const handleSubmitRequest = (values: ExitRequestFormValues) => {
    if (!state) return;
    const next = isEditingRequest
      ? updateEmployeeOffboardingRequest(state, values)
      : createEmployeeOffboardingRequest(state, values);
    setState(next);
    setShowExitRequestForm(false);
    setIsEditingRequest(false);
    syncRouteState("Exit Request", searchText);
    setFlashMessage(isEditingRequest ? "Exit request updated." : "Exit request submitted.");
  };

  const handleCancelRequest = () => {
    if (!request) return;
    mutateState((current) => cancelEmployeeOffboardingRequest(current), "Exit request cancelled.");
  };

  const handleToggleChecklist = (taskId: string) => {
    const task = checklist.find((item) => item.id === taskId);
    if (!task || task.ownerType !== "employee") return;
    mutateState((current) => toggleEmployeeChecklistTask(current, taskId), "Checklist updated.");
  };

  const handleAddHandover = () => {
    if (!handoverDraft.task.trim() || !handoverDraft.assignedTo.trim() || !handoverDraft.dueDate) return;
    mutateState(
      (current) =>
        addEmployeeHandoverItem(current, {
          task: handoverDraft.task.trim(),
          assignedTo: handoverDraft.assignedTo.trim(),
          dueDate: handoverDraft.dueDate,
          notes: handoverDraft.notes.trim(),
          status: "Pending",
        }),
      "Handover item added."
    );
    setHandoverDraft({ task: "", assignedTo: "", dueDate: "", notes: "" });
    setHandoverDialogOpen(false);
  };

  const handleCycleHandoverStatus = (itemId: string) => {
    mutateState((current) => cycleEmployeeHandoverStatus(current, itemId), "Handover status updated.");
  };

  const handleOpenPolicies = () => {
    handleTabChange("Documents & Policy");
  };

  const handleDocumentDownload = (name: string, activityType: "document" | "policy" = "document") => {
    if (!state) return;
    downloadTextFile(
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`,
      buildDocumentText(name, state)
    );
    mutateState(
      (current) => logEmployeeOffboardingActivity(current, `Downloaded ${name}`, activityType),
      `${name} downloaded.`
    );
  };

  const handleOpenSupportChat = (participantName: string) => {
    window.dispatchEvent(
      new CustomEvent("employee-chat:open", {
        detail: { participantName },
      })
    );
  };

  const handleAcknowledgeDocument = (documentId: string) => {
    const target = documents.find((item) => item.id === documentId);
    if (!target || target.status === "Acknowledged") return;
    mutateState((current) => acknowledgeEmployeeOffboardingDocument(current, documentId), `${target.title} acknowledged.`);
  };

  const overviewPolicyLinks = (
    <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader>
            <CardTitle className="text-xl font-medium">Policy Links</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {filteredPolicies.map((link) => (
          <button
            key={link.label}
            type="button"
            onClick={() => {
              handleOpenPolicies();
              mutateState(
                (current) => logEmployeeOffboardingActivity(current, `Viewed policy link: ${link.label}`, "policy"),
                "Policy link opened."
              );
            }}
            className="group flex w-full items-center justify-between rounded-2xl bg-slate-50 p-4 text-left transition-all hover:bg-[#FFE14E]/10 dark:bg-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm group-hover:text-[#1B2447] dark:bg-white/10 dark:text-slate-300">
                <FileText className="size-4" />
              </div>
              <span className="text-sm font-normal group-hover:text-[#1B2447] dark:group-hover:text-[#FFE14E]">{link.label}</span>
            </div>
            <ChevronRight className="size-4 opacity-30 group-hover:opacity-100" />
          </button>
        ))}
        {filteredPolicies.length === 0 ? emptyState("No policy links match the current search.") : null}
      </CardContent>
    </Card>
  );

  const overviewContent = (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="relative overflow-hidden rounded-3xl border-none bg-[#1B2447] text-white shadow-xl lg:col-span-2">
          <div className="absolute -right-12 -top-12 size-48 rounded-full bg-[#FFE14E]/10 blur-3xl" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-medium text-white">Offboarding Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm font-medium leading-relaxed text-slate-300">
              Track your separation lifecycle, employee actions, and read-only department progress in one governed workspace.
            </p>
            {futureDatedMessage ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                {futureDatedMessage}
              </div>
            ) : null}
            <Separator className="bg-white/10" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Employee Name</span>
                <span className="font-normal text-base">{currentUser.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Employee ID</span>
                <span className="font-normal text-base">{currentUser.employeeId || "Not set"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Position / Department</span>
                <span className="font-normal text-base">{`${currentUser.jobTitle || request?.position || "Position"} / ${currentUser.department || request?.department || "Department"}`}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Exit Type</span>
                <span className="font-normal text-base">{request?.requestType ?? "Not started"}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Effective Separation Date</span>
                <span className="font-normal">{formatLongDate(effectiveSeparationDate)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Employment Status</span>
                {statusBadge(employmentStatus)}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Offboarding Status</span>
                {statusBadge(overallStatus)}
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-slate-400 font-medium uppercase tracking-widest">Overall Progress</span>
                <span className="font-medium text-[#FFE14E] text-base">{checklistProgress.percent}%</span>
              </div>
            </div>
            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Current Stage</span>
                <span className="text-[10px] font-medium text-[#FFE14E]">{currentStage}</span>
              </div>
              <Progress value={checklistProgress.percent} className="h-1.5 bg-white/10" indicatorClassName="bg-[#FFE14E]" />
              <p className="mt-3 text-xs text-slate-300">Next step: {nextStep}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-medium">
              <Wallet className="size-5 text-amber-500" />
              Final Pay Readiness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Finance Status</p>
                <p className="mt-1 text-lg font-medium">{finalPayReadiness}</p>
              </div>
              {statusBadge(finalPayReadiness)}
            </div>
            <p className="text-sm text-muted-foreground">
              Final pay readiness is determined by Finance based on completed employee actions, required acknowledgements, and department clearance status.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {overviewPolicyLinks}

        <Card className="rounded-3xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-xl font-medium">Exit Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative space-y-5 before:absolute before:left-[11px] before:top-1.5 before:h-[calc(100%-12px)] before:w-[2px] before:bg-slate-100 dark:before:bg-white/10">
              {[
                { label: "Submit exit request", done: Boolean(request) },
                { label: "Manager review", done: request?.managerApproval === "Approved", current: Boolean(request) && request?.managerApproval === "Pending" },
                { label: "HR review", done: request?.hrApproval === "Approved", current: overallStatus === "In Progress" || overallStatus === "Awaiting Final Approval" },
                { label: "Clearance & handover", done: checklistProgress.percent >= 60, current: checklistProgress.percent > 0 && checklistProgress.percent < 100 },
                { label: "Final documents", done: checklistProgress.percent === 100 },
              ].map((step) => (
                <div key={step.label} className="relative flex items-center pl-8">
                  <div
                    className={cn(
                      "absolute left-0 z-10 flex size-6 items-center justify-center rounded-full border-4 border-card transition-all dark:border-[#161b30]",
                      step.done
                        ? "bg-emerald-500"
                        : step.current
                          ? "bg-[#FFE14E] shadow-lg shadow-amber-500/20"
                          : "bg-slate-200 dark:bg-white/20"
                    )}
                  >
                    {step.done ? <CheckCircle2 className="size-3 text-white" /> : null}
                    {!step.done && step.current ? <div className="size-2 rounded-full bg-[#1B2447] animate-pulse" /> : null}
                  </div>
                  <span className={cn("text-xs font-medium", step.done ? "text-emerald-600 dark:text-emerald-400" : step.current ? "text-[#1B2447] dark:text-[#FFE14E]" : "text-muted-foreground")}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Info className="size-5 text-amber-500" />
              Important Reminders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {[
                "Keep your manager updated on the transition plan and current deliverables.",
                "Complete your own tasks and acknowledgements to avoid delays in final pay readiness.",
                "Use the Handover tab to track knowledge transfer and open responsibilities.",
                "Department-owned tasks are visible here for transparency but cannot be completed by employees.",
              ].map((text) => (
                <li key={text} className="flex gap-3 text-sm leading-relaxed">
                  <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FFE14E]" />
                  <span className="text-muted-foreground dark:text-slate-300">{text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <User className="size-5 text-blue-500" />
              Support Contact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
              {[
                { label: "HR Support", contact: "hr.helpdesk@company.com", participantName: "HR Support", icon: <ShieldCheck className="size-4" /> },
                { label: "Reporting Manager", contact: request?.reportingManager ?? "Michael Scott", participantName: request?.reportingManager ?? "Michael Scott", icon: <User className="size-4" /> },
                { label: "System Admin", contact: "it.support@company.com", participantName: "System Admin", icon: <LayoutDashboard className="size-4" /> },
              ].map((item) => (
                <div key={item.label} className="flex min-w-0 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm dark:bg-white/10 dark:text-slate-300">
                    {item.icon}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 text-sm">
                    <span className="whitespace-nowrap font-normal text-muted-foreground">{item.label}</span>
                    <span className="whitespace-nowrap font-normal text-foreground">{item.contact}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 rounded-lg hover:bg-[#FFE14E]/20"
                    onClick={() => handleOpenSupportChat(item.participantName)}
                  >
                    <MessageSquare className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const exitRequestContent = (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Exit Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            {request ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {[
                  { label: "Request ID", value: request.id },
                  { label: "Request Type", value: request.requestType },
                  { label: "Reason for Exit", value: request.reasonForExit || "Not specified" },
                  { label: "Preferred Exit Date", value: formatLongDate(request.preferredExitDate) },
                  { label: "Effective Separation Date", value: formatLongDate(effectiveSeparationDate) },
                  { label: "Notice Period", value: request.noticePeriod },
                  { label: "Submitted On", value: request.submissionDate },
                  { label: "Last Working Day", value: formatLongDate(request.lastWorkingDay) },
                  { label: "Personal Email", value: request.personalEmail || "Not provided" },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-normal">{item.value}</span>
                  </div>
                ))}
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Current Status</span>
                  <div className="flex">{statusBadge(overallStatus)}</div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Current Stage</span>
                  <span className="text-sm font-normal">{currentStage}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Approval Status</span>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider dark:bg-white/10">
                      <span className={cn("size-1.5 rounded-full", request.managerApproval === "Approved" ? "bg-emerald-500" : "bg-amber-500")} />
                      Manager: {request.managerApproval}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider dark:bg-white/10">
                      <span className={cn("size-1.5 rounded-full", request.hrApproval === "Approved" ? "bg-emerald-500" : request.hrApproval === "Rejected" ? "bg-rose-500" : "bg-slate-300")} />
                      HR: {request.hrApproval}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              emptyState("No exit request has been submitted yet. Use the Exit Request Form button to start.")
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Request Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm italic leading-relaxed text-muted-foreground dark:border-white/20">
              {request?.detailedExplanation || "Detailed request notes will appear here after submission."}
            </div>
            {request ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Current Stage</p>
                  <p className="mt-2 text-sm font-normal">{currentStage}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Next Step</p>
                  <p className="mt-2 text-sm font-normal">{nextStep}</p>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="rounded-2xl border-border/50 bg-amber-50/30 shadow-sm dark:border-amber-500/20 dark:bg-amber-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium text-amber-800 dark:text-amber-400">
              <Clock className="size-5" />
              Next Action
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed text-amber-700/80 dark:text-amber-400/80">
              {request
                ? `Current stage: ${currentStage}. Keep your employee tasks current and monitor read-only department approval updates here.`
                : "No request is active yet. Start by filing the Exit Request Form."}
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-400">
                <CheckCircle2 className="size-3.5" />
                {request ? nextStep : "Submit exit request"}
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <CheckCircle2 className="size-3.5" />
                Approval states are view-only for employees
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <CheckCircle2 className="size-3.5" />
                Edit and cancel actions lock after governed stages begin
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Button
            className="h-11 w-full justify-between rounded-xl border border-border bg-white text-foreground shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            onClick={() => setPreviewOpen(true)}
            disabled={!request}
          >
            View Full Request
            <ExternalLink className="size-4 opacity-50" />
          </Button>
          <Button
            className="h-11 w-full justify-between rounded-xl border border-border bg-white text-foreground shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            onClick={() => handleDocumentDownload("Exit Request Copy")}
            disabled={!request}
          >
            Download Copy
            <Download className="size-4 opacity-50" />
          </Button>
          <Button
            className="h-11 w-full justify-between rounded-xl border border-border bg-white text-foreground shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            onClick={() => {
              setIsEditingRequest(true);
              setShowExitRequestForm(true);
            }}
            disabled={!canEditRequest}
          >
            Edit Request
            <ArrowRight className="size-4 opacity-50" />
          </Button>
          <Button
            variant="ghost"
            className="h-11 w-full rounded-xl text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/10"
            onClick={handleCancelRequest}
            disabled={!canCancelRequest}
          >
            Cancel Request
          </Button>
        </div>
      </div>
    </div>
  );

  const checklistContent = (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-medium">Checklist by Category</CardTitle>
            <Badge variant="outline" className="rounded-full border-[#FFE14E]/30 bg-[#FFE14E]/10 px-3 py-1 font-bold text-[#FFE14E]">
              {checklistProgress.completed} / {checklistProgress.total} Tasks
            </Badge>
          </CardHeader>
          <CardContent className="space-y-8">
            {Object.entries(groupedChecklist).map(([category, tasks]) => (
              <div key={category} className="space-y-4">
                <div className="flex items-center gap-2 border-l-4 border-[#FFE14E] pl-3">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400">
                    {category.includes("HR") ? <User className="size-4" /> : category.includes("Manager") ? <ShieldCheck className="size-4" /> : category.includes("IT") ? <LayoutDashboard className="size-4" /> : category.includes("Asset") ? <Package className="size-4" /> : <ExternalLink className="size-4" />}
                  </div>
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{category}</h3>
                </div>
                <div className="grid gap-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center justify-between rounded-xl border p-4 text-left transition-all",
                        task.ownerType === "employee"
                          ? "border-transparent bg-slate-50/50 hover:border-border dark:bg-white/5 dark:hover:bg-white/10"
                          : "border-border/60 bg-slate-50/80 dark:border-white/10 dark:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded border-2 bg-white dark:bg-slate-800",
                            task.completed
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : task.ownerType === "employee"
                                ? "border-slate-300 dark:border-white/20"
                                : "border-slate-200 bg-slate-100 text-slate-400 dark:border-white/10 dark:bg-slate-900/70"
                          )}
                        >
                          {task.completed ? <CheckCircle2 className="size-3" /> : null}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{task.label}</span>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                              Owner: {task.owner}
                            </span>
                            <span className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                              Due: {formatLongDate(task.dueDate)}
                            </span>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                                task.ownerType === "employee"
                                  ? "bg-[#FFE14E]/15 text-[#1B2447] dark:text-[#FFE14E]"
                                  : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                              )}
                            >
                              {task.ownerType === "employee" ? "My Action" : task.status === "Waiting Review" ? "Waiting on Another Team" : "Department Action"}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {task.ownerType === "employee" ? (
                          <Button
                            size="sm"
                            variant={task.completed ? "outline" : "default"}
                            className={cn(
                              "h-9 rounded-lg",
                              !task.completed && "bg-[#FFE14E] text-[#1B2447] hover:bg-[#F7D93C]"
                            )}
                            onClick={() => handleToggleChecklist(task.id)}
                          >
                            {task.completed ? "Re-open" : "Mark Complete"}
                          </Button>
                        ) : (
                          <span className="text-xs font-semibold text-muted-foreground">Read only</span>
                        )}
                        {statusBadge(task.completed ? "Completed" : task.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(groupedChecklist).length === 0 ? emptyState("No checklist items match the current search.") : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <div className="h-2 bg-slate-100 dark:bg-white/10">
            <div className="h-full bg-[#FFE14E]" style={{ width: `${checklistProgress.percent}%` }} />
          </div>
          <CardHeader>
            <CardTitle className="text-center text-lg font-medium">Clearance Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="flex flex-col items-center justify-center gap-1">
              <span className="text-4xl font-medium text-foreground">{checklistProgress.percent}%</span>
              <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Overall Completion</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <span className="text-xl font-medium">{checklistProgress.total}</span>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">Total Tasks</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <span className="text-xl font-medium text-blue-600 dark:text-blue-400">{checklistProgress.completed}</span>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">Completed</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <span className="text-xl font-medium text-amber-600 dark:text-amber-400">{checklistProgress.pending}</span>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">Pending</span>
              </div>
              <div className="flex flex-col items-center rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <span className="text-xl font-medium text-[#1B2447] dark:text-[#FFE14E]">{myPendingTasks.length}</span>
                <span className="text-[10px] font-medium uppercase text-muted-foreground">My Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myPendingTasks
                .slice(0, 4)
                .map((task) => (
                  <div key={task.id} className="flex items-center gap-3 text-sm">
                    <Clock className="size-4 shrink-0 text-amber-500" />
                    <span className="font-medium text-muted-foreground">{task.label}</span>
                  </div>
                ))}
              {myPendingTasks.length === 0 ? emptyState("No employee actions are pending right now.") : null}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Waiting on Another Team</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {waitingOnAnotherTeam.slice(0, 4).map((task) => (
                <div key={task.id} className="flex items-start gap-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-medium text-muted-foreground">{task.label}</p>
                    <p className="text-xs text-muted-foreground">{task.status === "Waiting Review" ? `Waiting for ${task.owner} to review this step.` : `${task.owner} owns this step.`}</p>
                  </div>
                </div>
              ))}
              {waitingOnAnotherTeam.length === 0 ? emptyState("No department-owned tasks are pending right now.") : null}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2 rounded-2xl border border-[#FFE14E]/20 bg-[#FFE14E]/10 p-5">
          <h4 className="flex items-center gap-2 text-sm font-medium text-[#1B2447]">
            <Info className="size-4" />
            Note
          </h4>
          <p className="text-xs font-medium leading-relaxed text-[#1B2447]/80">
            Incomplete clearance may delay final pay readiness and final document release.
          </p>
        </div>
      </div>
    </div>
  );

  const handoverContent = (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-2">
              <CardTitle className="text-lg font-medium">Handover Items</CardTitle>
              <p className="text-sm text-muted-foreground">Update the status from each row action so your manager can review progress clearly.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 rounded-lg bg-[#FFE14E] text-xs font-bold text-[#1B2447] hover:bg-[#F7D93C]"
                onClick={() => setHandoverDialogOpen(true)}
              >
                <Plus className="mr-1 size-3.5" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-white/5">
                <TableRow className="border-none">
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider">Task / Project</TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider">Assigned To</TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider">Due Date</TableHead>
                  <TableHead className="text-[10px] font-medium uppercase tracking-wider text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHandover.map((item) => (
                  <TableRow
                    key={item.id}
                    className="border-border/50 hover:bg-slate-50/50 dark:hover:bg-white/5"
                  >
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-normal">{item.task}</span>
                        <span className="text-[10px] text-muted-foreground">{item.notes || "No extra notes"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{item.assignedTo}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatLongDate(item.dueDate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-3">
                        {statusBadge(item.status)}
                        <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => handleCycleHandoverStatus(item.id)}>
                          {item.status === "Pending" ? "Start" : item.status === "In Progress" ? "Complete" : "Reset"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredHandover.length === 0 ? <div className="p-6">{emptyState("No handover items match the current search.")}</div> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Handover Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {request ? (
              [
                { title: "Active Projects", content: request.activeProjects || "No projects listed." },
                { title: "Pending Deliverables", content: request.pendingDeliverables || "No pending deliverables listed." },
                { title: "Suggested Handover Person", content: request.suggestedHandoverPerson || "Not assigned yet." },
                { title: "Handover Notes", content: request.handoverNotes || "No handover notes recorded." },
              ].map((note) => (
                <div key={note.title} className="space-y-1.5">
                  <h4 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{note.title}</h4>
                  <div className="rounded-xl border border-border/50 bg-slate-50 p-4 text-sm dark:bg-white/5">
                    {note.content}
                  </div>
                </div>
              ))
            ) : (
              emptyState("Submit an exit request first so handover notes and responsibilities can be tracked here.")
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Status Legend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Pending", note: "Work has not started yet." },
              { label: "In Progress", note: "Transition work is actively being completed." },
              { label: "Completed", note: "The handover item is ready for manager review." },
            ].map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                <div>
                  {statusBadge(item.label)}
                  <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Guidelines</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {[
                "Document current responsibilities, pending deadlines, and key dependencies.",
                "Assign a clear owner for each transition item and expected due date.",
                "Share working files, links, credentials handoff process, and escalation contacts.",
                "Update item status regularly so manager and HR can review progress.",
              ].map((text) => (
                <li key={text} className="flex gap-3 text-sm leading-relaxed">
                  <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#FFE14E]" />
                  <span className="font-medium text-muted-foreground dark:text-slate-300">{text}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Manager Confirmation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Handover progress is visible to your manager for review.</p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Handover Tracker Active</span>
                <CheckCircle2 className="size-4 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-950/20">
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {filteredHandover.some((item) => item.status !== "Completed") ? "Awaiting Item Completion" : "Ready for Manager Review"}
                </span>
                <Clock className="size-4 text-amber-500" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-slate-50 p-3 dark:bg-white/5">
                <span className="text-xs font-medium text-muted-foreground">Completed Items</span>
                <span className="text-xs font-medium">{handoverItems.filter((item) => item.status === "Completed").length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const documentsContent = (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="space-y-6 md:col-span-2">
        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Documents & Acknowledgement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredDocuments.map((document) => (
              <div key={document.id} className="rounded-2xl border border-border/60 p-4 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-normal">{document.title}</span>
                      {document.required ? (
                        <Badge className="border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300">Required</Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(document.status)}
                      <span className="text-xs text-muted-foreground">
                        {document.acknowledgedAt ? `Acknowledged on ${document.acknowledgedAt}` : "Awaiting your acknowledgement"}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-lg bg-[#FFE14E] text-[#1B2447] hover:bg-[#F7D93C]"
                    onClick={() => handleAcknowledgeDocument(document.id)}
                    disabled={document.status === "Acknowledged"}
                  >
                    {document.status === "Acknowledged" ? "Acknowledged" : "Acknowledge"}
                  </Button>
                </div>
              </div>
            ))}
            {filteredDocuments.length === 0 ? emptyState("No acknowledgement items match the current search.") : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Policy Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {[
              {
                title: "Resignation Policy",
                points: [
                  "Employees must file their resignation or exit request through the HRIS workflow.",
                  "Standard notice period is 30 calendar days unless a different arrangement is approved.",
                  "Responsibilities remain active until formal transition or release is confirmed.",
                ],
              },
              {
                title: "Handover Guidelines",
                points: [
                  "Document active work, deadlines, and unresolved dependencies.",
                  "Transfer essential files, references, and context to the assigned successor or team.",
                  "Keep your manager informed of blockers that could delay transition.",
                ],
              },
              {
                title: "Clearance Policy",
                points: [
                  "Offboarding requires completion of HR, manager, IT, finance, and asset clearances.",
                  "Outstanding obligations may delay final pay or document release.",
                  "Final completion is recorded only after the full clearance checklist is completed.",
                ],
              },
            ].map((policy) => (
              <div key={policy.title} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-1 rounded-full bg-[#FFE14E]" />
                  <h3 className="text-base font-bold">{policy.title}</h3>
                </div>
                <div className="grid gap-3 pl-3">
                  {policy.points.map((point, index) => (
                    <div key={point} className="flex gap-3 text-sm leading-relaxed">
                      <span className="mt-1.5 text-xs font-bold text-[#FFE14E]">{index + 1}.</span>
                      <p className="font-medium text-muted-foreground">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Downloads</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              "Exit Request Copy",
              "Clearance Summary",
              "Handover Summary",
              "Exit Interview Notes",
              "Final Clearance Snapshot",
            ]
              .filter((doc) => (query ? doc.toLowerCase().includes(query) : true))
              .map((doc) => (
                <Button
                  key={doc}
                  variant="ghost"
                  className="h-12 w-full justify-between rounded-xl border border-transparent hover:border-border hover:bg-slate-50 dark:hover:bg-white/5"
                  onClick={() => handleDocumentDownload(doc)}
                >
                  <div className="flex items-center gap-3">
                    <FileDown className="size-4 text-blue-500" />
                    <span className="text-sm font-normal">{doc}</span>
                  </div>
                  <Download className="size-4 opacity-30" />
                </Button>
              ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <FileCheck className="size-5 text-emerald-500" />
              Compliance Tracking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Required Acknowledgements</p>
              <p className="mt-2 text-2xl font-medium">{acknowledgementProgress.completed} / {acknowledgementProgress.total}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              You can acknowledge required documents here, but system metadata and admin verification remain read only.
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filteredPolicies.map((link) => (
              <Button
                key={link.label}
                variant="ghost"
                className="h-10 w-full justify-between rounded-xl hover:bg-[#FFE14E]/10 group"
                onClick={() => handleDocumentDownload(link.label, "policy")}
              >
                <span className="text-sm font-medium text-muted-foreground group-hover:text-[#1B2447] dark:group-hover:text-[#FFE14E]">{link.label}</span>
                <ExternalLink className="size-3.5 opacity-30 group-hover:opacity-100" />
              </Button>
            ))}
            {filteredPolicies.length === 0 ? emptyState("No quick links match the current search.") : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const faqContent = (
    <Card className="mx-auto max-w-4xl rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
      <CardHeader className="border-b border-border/50 pb-8 text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-[#FFE14E]/10 text-[#FFE14E]">
          <HelpCircle className="size-6" />
        </div>
        <CardTitle className="text-2xl font-bold">Frequently Asked Questions</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Find answers to common questions about the offboarding process.</p>
      </CardHeader>
      <CardContent className="space-y-6 pt-8">
        {filteredFaqs.map((item) => (
          <div key={item.q} className="group rounded-2xl border border-border/50 p-5 transition-all hover:border-[#FFE14E]/50 hover:bg-slate-50 dark:hover:bg-white/5">
            <h4 className="mb-2 flex items-start gap-3 text-base font-medium">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-medium dark:bg-white/10">Q</span>
              {item.q}
            </h4>
            <div className="flex items-start gap-3 pl-9">
              <p className="text-sm font-medium leading-relaxed text-muted-foreground">{item.a}</p>
            </div>
          </div>
        ))}
        {filteredFaqs.length === 0 ? emptyState("No FAQ entries match the current search.") : null}
      </CardContent>
    </Card>
  );

  const historyContent = (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-medium">Exit Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-white/5">
              <TableRow className="border-none">
                <TableHead className="text-[10px] font-medium uppercase tracking-wider">Type</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider">Date Submitted</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider">Preferred Exit Date</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider">Last Working Day</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-[10px] font-medium uppercase tracking-wider text-right">Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {request ? (
                <TableRow className="border-border/50 hover:bg-slate-50/50 dark:hover:bg-white/5">
                  <TableCell className="py-4 text-sm font-normal">{request.requestType}</TableCell>
                  <TableCell className="text-sm font-medium">{request.submissionDate}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatLongDate(request.preferredExitDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatLongDate(request.lastWorkingDay)}</TableCell>
                  <TableCell>{statusBadge(request.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="link" className="h-auto p-0 text-xs font-bold text-[#FFE14E] hover:no-underline" onClick={() => setPreviewOpen(true)}>
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {!request ? <div className="p-6">{emptyState("No exit records yet.")}</div> : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative space-y-8 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-[2px] before:bg-slate-100 dark:before:bg-white/10">
            {filteredActivities.map((log) => (
              <div key={log.id} className="relative flex items-center pl-7">
                <div className="absolute left-0 z-10 flex size-4 items-center justify-center rounded-full border border-border bg-white shadow-sm dark:bg-slate-800">
                  <div className="size-1.5 rounded-full bg-[#FFE14E]" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-normal">{log.activity}</span>
                  <span className="text-xs font-medium text-muted-foreground">Actor: {log.actor}</span>
                  <span className="text-xs text-muted-foreground">{log.happenedAt}</span>
                </div>
              </div>
            ))}
            {filteredActivities.length === 0 ? emptyState("No activity entries match the current search.") : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/50 shadow-sm dark:bg-[#161b30]">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Audit Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Action</p>
            <p className="mt-2 text-sm text-muted-foreground">Each record captures what happened in the offboarding workflow.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Actor</p>
            <p className="mt-2 text-sm text-muted-foreground">Entries identify whether the action came from you, HR, Finance, or the system.</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Timestamp</p>
            <p className="mt-2 text-sm text-muted-foreground">Time-stamped records support traceability and preserve historical visibility.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "Overview":
        return overviewContent;
      case "Exit Request":
        return exitRequestContent;
      case "Clearance & Checklist":
        return checklistContent;
      case "Handover":
        return handoverContent;
      case "Documents & Policy":
        return documentsContent;
      case "FAQs":
        return faqContent;
      case "History":
        return historyContent;
      default:
        return null;
    }
  };

  if (!state) {
    return <div className="py-8 text-sm text-muted-foreground">Loading offboarding workspace...</div>;
  }

  if (showExitRequestForm) {
    return (
      <ExitRequestForm
        user={currentUser}
        initialValues={isEditingRequest ? request ?? undefined : undefined}
        onClose={() => {
          setShowExitRequestForm(false);
          setIsEditingRequest(false);
        }}
        onSubmitSuccess={handleSubmitRequest}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12 animate-in fade-in duration-500">
      <div className="space-y-6">
        <EmployeeModuleTopbar
          searchPlaceholder="Search offboarding status, tasks, documents, or history..."
          searchInputProps={{ value: searchText, onChange: (event) => handleSearchChange(event.target.value) }}
          rightExtras={
            searchText ? (
              <Button variant="ghost" className="h-9 rounded-lg px-3 text-xs font-semibold" onClick={() => handleSearchChange("")}>
                Clear Search
              </Button>
            ) : null
          }
        />
        <EmployeeSectionHeader
          title="Exit & Offboarding"
          description="Track your separation lifecycle, complete employee actions, and monitor read-only department progress."
          tabs={TABS.map((tab) => ({ id: tab, label: tab }))}
          activeTab={activeTab}
          onTabChange={(id) => handleTabChange(id as TabType)}
          actions={
            <Button
              onClick={() => {
                if (request) {
                  handleTabChange("Exit Request");
                  setPreviewOpen(true);
                  return;
                }
                setShowExitRequestForm(true);
              }}
              className="h-11 rounded-lg bg-[#FFE14E] px-6 text-sm font-bold text-[#1B2447] shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] hover:bg-[#F7D93C] active:scale-[0.98]"
            >
              {request ? "View Exit Request" : "Exit Request Form"}
            </Button>
          }
        />
      </div>

      {flashMessage ? (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CheckCircle2 className="size-4" />
          {flashMessage}
        </div>
      ) : null}

      {query ? (
        <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <Search className="size-4" />
          Filtering this module for: <span className="font-semibold text-foreground">{searchText}</span>
        </div>
      ) : null}

      <div className="min-h-[500px]">{renderContent()}</div>

      <Separator className="mt-8 opacity-50" />

      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-emerald-500" />
          System Online
        </div>
        <div>
          Employee: <span className="text-foreground">{currentUser.name}</span>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Exit Request Preview</DialogTitle>
            <DialogDescription>Review the currently saved request details.</DialogDescription>
          </DialogHeader>
          {request ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                ["Request ID", request.id],
                ["Status", request.status],
                ["Type", request.requestType],
                ["Preferred Exit Date", formatLongDate(request.preferredExitDate)],
                ["Last Working Day", formatLongDate(request.lastWorkingDay)],
                ["Department", request.department],
                ["Position", request.position],
                ["Reporting Manager", request.reportingManager],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
                  <div className="mt-1 text-sm font-semibold">{value}</div>
                </div>
              ))}
              <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4 dark:bg-white/5">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Detailed Explanation</div>
                <div className="mt-2 text-sm leading-relaxed">{request.detailedExplanation}</div>
              </div>
            </div>
          ) : (
            emptyState("No request available to preview.")
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={handoverDialogOpen} onOpenChange={setHandoverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Handover Item</DialogTitle>
            <DialogDescription>Create a new handover task for your transition plan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Task / Project</label>
              <Input value={handoverDraft.task} onChange={(event) => setHandoverDraft((current) => ({ ...current, task: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Assigned To</label>
              <Input value={handoverDraft.assignedTo} onChange={(event) => setHandoverDraft((current) => ({ ...current, assignedTo: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due Date</label>
              <Input type="date" value={handoverDraft.dueDate} onChange={(event) => setHandoverDraft((current) => ({ ...current, dueDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={handoverDraft.notes}
                onChange={(event) => setHandoverDraft((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-4 py-3 text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoverDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddHandover}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
