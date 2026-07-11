"use client";

import { useEffect, useMemo, useState } from "react";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { AlertBanner } from "@/components/offboarding/AlertBanner";
import { ApprovalStatus } from "@/components/offboarding/ApprovalStatus";
import { DepartmentProgress } from "@/components/offboarding/DepartmentProgress";
import { ProgressTracker } from "@/components/offboarding/ProgressTracker";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderClock,
  Landmark,
  UserMinus,
} from "lucide-react";
import type { Employee, Role } from "@/lib/mock";
import { getDepartmentById } from "@/lib/mock";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";
import { supabase } from "@/lib/supabase/client";
import { createItAccountActionRequest } from "@/features/it-account-actions/services/itAccountActions.service";
import { pushRoleNotification } from "@/features/notifications/services/notifications.service";
import {
  addOffboardingAudit,
  advanceOffboardingCase,
  blockOffboardingCase,
  createOffboardingCase,
  getOffboardingAudit,
  getOffboardingCases,
  updateOffboardingCase,
  type OffboardingAuditEntry,
  type OffboardingCase,
  type OffboardingCaseStatus,
} from "@/features/offboarding/services/offboardingCases.service";
import {
  DEMO_OFFBOARDING_APPROVALS,
  DEMO_OFFBOARDING_ADMIN_ALERTS,
  DEMO_OFFBOARDING_DEPT_SUMMARY,
  DEMO_OFFBOARDING_HR_ALERTS,
} from "@/features/offboarding/demoOffboardingData";

export type OffboardingRoleView = "tasks" | "admin" | "approvals" | "audit" | "analytics";

type HrStaffTab = "overview" | "cases" | "clearance" | "assets" | "payroll";
type HrAdminTab =
  | "overview"
  | "cases"
  | "clearance"
  | "approvals"
  | "assets"
  | "payroll"
  | "audit"
  | "reports"
  | "settings";
type ClearanceStatus = "Pending" | "In Progress" | "Completed" | "Blocked" | "Overdue";
type PayrollStatus = "Pending Clearance" | "On Hold" | "Ready for Payroll";

const HR_STAFF_OFFBOARDING_TABS: Array<{ id: HrStaffTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "cases", label: "Offboarding Cases" },
  { id: "clearance", label: "Clearance Tracking" },
  { id: "assets", label: "Assets & Access" },
  { id: "payroll", label: "Payroll Readiness" },
];

const OFFBOARDING_DARK_CARD_TW =
  "dark:border-white/10 dark:bg-[#161b30] dark:text-slate-50 dark:shadow-sm";

type PendingActionRow = {
  caseId: string;
  employeeName: string;
  departmentName: string;
  exitType: string;
  effectiveDate: string;
  status: string;
  action: string;
};

type AdminSettings = {
  checklistTemplate: string;
  approvalFlow: string;
  defaultHrOwner: string;
  escalationRule: string;
};

const ADMIN_SETTINGS_KEY = "hris.offboarding.adminSettings.v1";

type ClearanceRow = {
  id: string;
  caseId: string;
  department: "HR Staff" | "Department Manager" | "System Admin" | "HR Admin";
  taskName: string;
  employeeName: string;
  owner: string;
  dueDate: string;
  status: ClearanceStatus;
  remarks: string;
};

type AssetReturnRow = {
  id: string;
  caseId: string;
  employeeName: string;
  asset: string;
  assigned: string;
  returnStatus: string;
  verifiedBy: string;
  dateReturned: string;
};

type AccessRemovalRow = {
  id: string;
  caseId: string;
  employeeName: string;
  account: string;
  responsibleTeam: string;
  status: string;
  dateDisabled: string;
};

type PayrollReadinessRow = {
  caseId: string;
  employeeName: string;
  effectiveDate: string;
  clearanceStatus: string;
  assetReturnStatus: string;
  holdReason: string;
  finalPayStatus: PayrollStatus;
  financeRemarks: string;
};

type PayrollWorkflowRecord = {
  hrRemarks: string;
  financeReviewFlagged: boolean;
  financeReviewReason: string;
  financeReviewFlaggedAt: string;
  lastFollowUpAt: string;
};

type PayrollWorkflowMap = Record<string, PayrollWorkflowRecord>;

const PAYROLL_WORKFLOW_KEY = "hris.offboarding.payrollWorkflow.v1";

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function daysUntil(date: string) {
  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function readPayrollWorkflowRaw(): PayrollWorkflowMap {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PAYROLL_WORKFLOW_KEY) ?? "{}") as PayrollWorkflowMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePayrollWorkflowRaw(records: PayrollWorkflowMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAYROLL_WORKFLOW_KEY, JSON.stringify(records));
}

function readAdminSettingsRaw(): AdminSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ADMIN_SETTINGS_KEY) ?? "null") as AdminSettings | null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeAdminSettingsRaw(settings: AdminSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(settings));
}

function getLifecycleLabel(input: Pick<OffboardingCase, "status" | "currentStep" | "lastDay">) {
  if (input.status === "Completed") return "Completed";
  if (input.status === "Blocked") return "Blocked";
  if (input.currentStep <= 2 && daysUntil(input.lastDay) > 0) return "Scheduled";
  if (input.currentStep <= 2) return "Pending Clearance";
  if (input.currentStep >= 7) return "Final Review";
  return "In Progress";
}

function getPayrollReadinessLabel(input: Pick<OffboardingCase, "status" | "currentStep">): PayrollStatus {
  if (input.status === "Blocked") return "On Hold";
  if (input.status === "Completed" || input.currentStep >= 7) return "Ready for Payroll";
  return "Pending Clearance";
}

function getEmploymentLabel(input: Pick<OffboardingCase, "status" | "lastDay">) {
  if (input.status === "Completed" && daysUntil(input.lastDay) <= 0) return "Inactive";
  return "Active";
}

function getCurrentStage(caseItem: OffboardingCase) {
  if (caseItem.status === "Blocked") return "Clearance Blocked";
  switch (caseItem.currentStep) {
    case 1:
    case 2:
      return "Manager Review";
    case 3:
    case 4:
      return "Clearance";
    case 5:
      return "Asset Return";
    case 6:
      return "Final Review";
    case 7:
      return "Payroll Ready Check";
    default:
      return "Completed";
  }
}

function statusBadgeTone(status: OffboardingCaseStatus | ClearanceStatus | PayrollStatus | string) {
  if (status === "Completed" || status === "Ready for Payroll") {
    return "bg-emerald-500/15 text-emerald-800 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/30";
  }
  if (status === "In Progress") {
    return "bg-blue-500/15 text-blue-800 ring-blue-500/25 dark:text-blue-200 dark:ring-blue-400/30";
  }
  if (status === "Blocked" || status === "On Hold") {
    return "bg-rose-500/15 text-rose-800 ring-rose-500/25 dark:text-rose-200 dark:ring-rose-400/30";
  }
  if (status === "Overdue") {
    return "bg-orange-500/15 text-orange-800 ring-orange-500/25 dark:text-orange-200 dark:ring-orange-400/30";
  }
  return "bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-100 dark:ring-amber-400/35";
}

function renderBadge(label: string, tone?: string) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone ?? statusBadgeTone(label)
      )}
    >
      {label}
    </span>
  );
}

function buildCaseAlerts(cases: OffboardingCase[]) {
  const pendingActions: PendingActionRow[] = [];
  const stalledCases: PendingActionRow[] = [];

  for (const row of cases) {
    const dayDelta = daysUntil(row.lastDay);
    const base = {
      caseId: row.id,
      employeeName: row.employeeName,
      departmentName: row.departmentName,
      exitType: row.exitType,
      effectiveDate: row.lastDay,
      status: getLifecycleLabel(row),
    };

    if (row.currentStep <= 2) {
      pendingActions.push({ ...base, action: "Pending manager confirmation" });
    }
    if (row.currentStep === 3) {
      pendingActions.push({ ...base, action: "HR Staff coordination in progress" });
    }
    if (row.currentStep === 4 || row.currentStep === 5) {
      pendingActions.push({ ...base, action: "Missing asset return confirmation" });
    }
    if (row.currentStep < 7) {
      pendingActions.push({ ...base, action: "Payroll not yet ready" });
    }
    if (row.status === "Blocked") {
      stalledCases.push({ ...base, action: "Waiting for HR Admin or HR Manager review" });
    } else if (row.currentStep === 3) {
      stalledCases.push({ ...base, action: "Waiting for System Admin clearance" });
    } else if (row.currentStep === 5) {
      stalledCases.push({ ...base, action: "Waiting for Department Manager handover sign-off" });
    } else if (dayDelta < 0 && row.status !== "Completed") {
      stalledCases.push({ ...base, action: "Effective date passed with open tasks" });
    }
  }

  return { pendingActions, stalledCases };
}

function buildClearanceRows(cases: OffboardingCase[]): ClearanceRow[] {
  return cases.flatMap((caseItem) => {
    const separation = daysUntil(caseItem.lastDay);
    const hrStatus: ClearanceStatus =
      caseItem.status === "Completed" ? "Completed" : caseItem.currentStep >= 3 ? "Completed" : "In Progress";
    const managerStatus: ClearanceStatus =
      caseItem.status === "Blocked"
        ? "Blocked"
        : caseItem.currentStep <= 2
          ? separation < 0
            ? "Overdue"
            : "Pending"
          : "Completed";
    const itStatus: ClearanceStatus =
      caseItem.status === "Completed"
        ? "Completed"
        : caseItem.currentStep >= 4
          ? "In Progress"
          : caseItem.currentStep <= 2
            ? "Pending"
            : separation < 2
              ? "Overdue"
              : "Pending";
    const financeStatus: ClearanceStatus =
      caseItem.status === "Blocked"
        ? "Blocked"
        : caseItem.currentStep >= 6
          ? "In Progress"
          : caseItem.currentStep >= 7
            ? "Completed"
            : separation <= 3
              ? "Pending"
              : "Pending";
    const adminStatus: ClearanceStatus =
      caseItem.status === "Completed" ? "Completed" : caseItem.currentStep >= 5 ? "In Progress" : "Pending";

    return [
      {
        id: `${caseItem.id}-hr`,
        caseId: caseItem.id,
        department: "HR Staff",
        taskName: "Finalize separation checklist",
        employeeName: caseItem.employeeName,
        owner: "Kath Domingo",
        dueDate: caseItem.lastDay,
        status: hrStatus,
        remarks: hrStatus === "Completed" ? "HR initiation complete" : "Main case coordination in progress",
      },
      {
        id: `${caseItem.id}-manager`,
        caseId: caseItem.id,
        department: "Department Manager",
        taskName: "Confirm handover and sign-off",
        employeeName: caseItem.employeeName,
        owner: `${caseItem.departmentName} Manager`,
        dueDate: caseItem.lastDay,
        status: managerStatus,
        remarks: managerStatus === "Pending" ? "Pending manager confirmation" : "Manager checkpoint tracked",
      },
      {
        id: `${caseItem.id}-it`,
        caseId: caseItem.id,
        department: "System Admin",
        taskName: "Disable system access and deactivate accounts",
        employeeName: caseItem.employeeName,
        owner: "System Admin",
        dueDate: caseItem.lastDay,
        status: itStatus,
        remarks: itStatus === "Overdue" ? "Effective date near, access still open" : "Coordinate account disablement",
      },
      {
        id: `${caseItem.id}-hr-admin-docs`,
        caseId: caseItem.id,
        department: "HR Admin",
        taskName: "Complete HR documentation and payroll endorsement",
        employeeName: caseItem.employeeName,
        owner: "HR Admin",
        dueDate: caseItem.lastDay,
        status: financeStatus,
        remarks: financeStatus === "Blocked" ? "Waiting on blocked case resolution" : "Documentation and payroll inputs required",
      },
      {
        id: `${caseItem.id}-hr-admin-clearance`,
        caseId: caseItem.id,
        department: "HR Admin",
        taskName: "Collect ID, access card, and site property",
        employeeName: caseItem.employeeName,
        owner: "HR Admin",
        dueDate: caseItem.lastDay,
        status: adminStatus,
        remarks: adminStatus === "Pending" ? "Return items not yet coordinated" : "Physical asset return in progress",
      },
    ];
  });
}

function buildAssetRows(cases: OffboardingCase[]) {
  const assets: AssetReturnRow[] = [];
  const access: AccessRemovalRow[] = [];

  for (const caseItem of cases) {
    const returned = caseItem.currentStep >= 6 || caseItem.status === "Completed";
    const disabled = caseItem.currentStep >= 5 || caseItem.status === "Completed";

    for (const asset of ["Laptop", "ID Card", "Access Card", "Company Phone"]) {
      assets.push({
        id: `${caseItem.id}-${asset}`,
        caseId: caseItem.id,
        employeeName: caseItem.employeeName,
        asset,
        assigned: "Yes",
        returnStatus: returned ? "Returned" : asset === "Company Phone" ? "Pending Verification" : "Pending Return",
        verifiedBy: returned ? "Admin Team" : asset === "Laptop" ? "IT Operations" : "Missing verifier",
        dateReturned: returned ? caseItem.lastDay : "-",
      });
    }

    for (const account of ["HRIS account", "Email account", "Payroll access", "Shared drive access"]) {
      access.push({
        id: `${caseItem.id}-${account}`,
        caseId: caseItem.id,
        employeeName: caseItem.employeeName,
        account,
        responsibleTeam: account === "Payroll access" ? "Finance" : "IT",
        status: disabled ? "Disabled" : daysUntil(caseItem.lastDay) <= 0 ? "Still Active" : "Pending Disablement",
        dateDisabled: disabled ? caseItem.lastDay : "-",
      });
    }
  }

  return { assets, access };
}

function buildPayrollRows(cases: OffboardingCase[], payrollWorkflow: PayrollWorkflowMap): PayrollReadinessRow[] {
  return cases.map((caseItem) => {
    const workflow = payrollWorkflow[caseItem.id];
    const clearanceStatus =
      caseItem.status === "Completed" ? "Completed" : caseItem.currentStep >= 6 ? "Completed" : "Pending Clearance";
    const assetReturnStatus =
      caseItem.status === "Completed" ? "Completed" : caseItem.currentStep >= 5 ? "In Progress" : "Pending Return";
    const finalPayStatus = getPayrollReadinessLabel(caseItem);

    let holdReason = "-";
    if (finalPayStatus === "Pending Clearance") {
      holdReason =
        caseItem.currentStep <= 2
          ? "Pending manager sign-off"
          : caseItem.currentStep <= 5
            ? "Incomplete clearance"
            : "Missing asset return";
    }
    if (finalPayStatus === "On Hold") {
      holdReason = "Pending finance validation";
    }
    if (workflow?.financeReviewFlagged && workflow.financeReviewReason.trim()) {
      holdReason = workflow.financeReviewReason.trim();
    }

    return {
      caseId: caseItem.id,
      employeeName: caseItem.employeeName,
      effectiveDate: caseItem.lastDay,
      clearanceStatus,
      assetReturnStatus,
      holdReason,
      finalPayStatus,
      financeRemarks: workflow?.hrRemarks?.trim()
        ? workflow.hrRemarks.trim()
        : finalPayStatus === "Ready for Payroll"
          ? "Ready to endorse for final pay computation"
          : workflow?.financeReviewFlagged
            ? "Flagged for HR Admin payroll review."
            : "Finance is waiting for all upstream offboarding controls.",
    };
  });
}

function viewMeta(view: OffboardingRoleView, currentUser: { role: Role; jobTitle?: string }) {
  switch (view) {
    case "tasks":
      return {
        title: "Offboarding",
        description: "HR Staff operations dashboard for case handling, clearance coordination, assets and access tracking, and payroll readiness.",
      };
    case "admin":
      return {
        title: "Offboarding",
        description: "Oversee lifecycle status, future-dated separations, cross-team clearance, and payroll readiness governance.",
      };
    case "approvals":
      return {
        title: "Offboarding Approvals",
        description:
          currentUser.role === "HR_MANAGER"
            ? "Review and govern separation requests before they move deeper into controlled offboarding."
            : "Review team separation requests with accountable, auditable approval controls.",
      };
    case "audit":
      return {
        title: "Offboarding Audit",
        description: "Read-only audit trail for separation actions, approvals, access coordination, and accountability.",
      };
    case "analytics":
      return {
        title: "Offboarding Analytics",
        description: "Executive-level visibility into offboarding volume, blockers, future-dated exits, and completion readiness.",
      };
  }
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  caption: string;
}) {
  return (
    <Card className={cn("overflow-hidden rounded-[22px] border-[#cfe0ff] bg-white shadow-[0_8px_18px_rgba(30,64,175,0.06)]", OFFBOARDING_DARK_CARD_TW)}>
      <CardContent className="px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFD84D] text-[#1f3566] shadow-[0_5px_12px_rgba(255,216,77,0.34)]">
            <Icon className="h-4 w-4 shrink-0" />
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-semibold leading-5 text-[#1d3563] dark:text-slate-100">{label}</p>
          </div>
        </div>

        <div className="my-2 border-t-2 border-dashed border-[#c9d7ef] dark:border-white/10" />

        <div className="space-y-1 text-center">
          <div>
            <p className="text-[32px] font-bold leading-none text-[#1d3563] dark:text-slate-50">{value}</p>
            <p className="mt-1.5 text-[10px] font-medium leading-5 text-[#50658f] dark:text-slate-400">{caption}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OpsStatCard({
  icon: Icon,
  title,
  value,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: number;
  caption: string;
}) {
  return (
    <Card className={cn("rounded-[22px] border-[#cfe0ff] bg-white shadow-[0_8px_18px_rgba(30,64,175,0.06)]", OFFBOARDING_DARK_CARD_TW)}>
      <CardContent className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFD84D] text-[#1f3566] shadow-[0_5px_12px_rgba(255,216,77,0.34)]">
            <Icon className="h-4 w-4 shrink-0" />
          </div>
          <p className="text-[15px] font-semibold text-[#1d3563] dark:text-slate-100">{title}</p>
        </div>
        <div className="my-3 border-t-2 border-dashed border-[#c9d7ef] dark:border-white/10" />
        <div className="text-center">
          <p className="text-[34px] font-bold leading-none text-[#1d3563] dark:text-slate-50">{value}</p>
          <p className="mt-2 text-[11px] font-medium leading-5 text-[#50658f] dark:text-slate-400">{caption}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function OffboardingRoleDashboard({
  view,
  currentUser,
}: {
  view: OffboardingRoleView;
  currentUser: { role: Role; name: string; departmentId: string; jobTitle?: string };
}) {
  const { title, description } = useMemo(() => viewMeta(view, currentUser), [currentUser, view]);
  const [showAlert, setShowAlert] = useState(true);
  const [cases, setCases] = useState<OffboardingCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [auditRows, setAuditRows] = useState<OffboardingAuditEntry[]>([]);
  const [hrTab, setHrTab] = useState<HrStaffTab>("overview");
  const [actionNotice, setActionNotice] = useState("");
  const [adminTab, setAdminTab] = useState<HrAdminTab>("overview");
  const [caseSearch, setCaseSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [exitTypeFilter, setExitTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [clearanceDepartmentFilter, setClearanceDepartmentFilter] = useState("all");
  const [clearanceStatusFilter, setClearanceStatusFilter] = useState("all");
  const [selectedPayrollCaseId, setSelectedPayrollCaseId] = useState("");
  const [payrollWorkflow, setPayrollWorkflow] = useState<PayrollWorkflowMap>({});
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewCaseDialogOpen, setViewCaseDialogOpen] = useState(false);
  const [payrollReadinessDialogOpen, setPayrollReadinessDialogOpen] = useState(false);
  const [payrollRemarksDialogOpen, setPayrollRemarksDialogOpen] = useState(false);
  const [financeReviewDialogOpen, setFinanceReviewDialogOpen] = useState(false);
  const [missingRequirementsDialogOpen, setMissingRequirementsDialogOpen] = useState(false);
  const [editExitType, setEditExitType] = useState("Resignation");
  const [editLastDay, setEditLastDay] = useState("");
  const [editStatus, setEditStatus] = useState<OffboardingCaseStatus>("Pending");
  const [editError, setEditError] = useState("");
  const [payrollRemarksDraft, setPayrollRemarksDraft] = useState("");
  const [financeReviewReason, setFinanceReviewReason] = useState("");
  const [missingRequirementsNote, setMissingRequirementsNote] = useState("");
  const [auditActorFilter, setAuditActorFilter] = useState("all");
  const [auditCaseFilter, setAuditCaseFilter] = useState("all");
  const [auditDateFilter, setAuditDateFilter] = useState("");
  const [approvalCommentOpen, setApprovalCommentOpen] = useState(false);
  const [approvalCommentMode, setApprovalCommentMode] = useState<"revision" | "approve" | "reject">("revision");
  const [approvalCommentDraft, setApprovalCommentDraft] = useState("");
  const [approvalTargetCaseId, setApprovalTargetCaseId] = useState("");
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    checklistTemplate: "Standard Corporate",
    approvalFlow: "Manager -> HR Manager",
    defaultHrOwner: "Kath Domingo",
    escalationRule: "Escalate after 2 overdue days",
  });

  const canRequestItAction =
    currentUser.role === "HR_STAFF" ||
    currentUser.role === "HR_ADMIN" ||
    currentUser.role === "HR_MANAGER";

  const canInitiateOffboarding =
    currentUser.role === "HR_STAFF" ||
    currentUser.role === "HR_ADMIN" ||
    currentUser.role === "HR_MANAGER";

  useEffect(() => {
    setCases(getOffboardingCases());
    setAuditRows(getOffboardingAudit());
    setPayrollWorkflow(readPayrollWorkflowRaw());
    const storedAdminSettings = readAdminSettingsRaw();
    if (storedAdminSettings) setAdminSettings(storedAdminSettings);
  }, []);

  useEffect(() => {
    writePayrollWorkflowRaw(payrollWorkflow);
  }, [payrollWorkflow]);

  useEffect(() => {
    writeAdminSettingsRaw(adminSettings);
  }, [adminSettings]);

  useEffect(() => {
    if (!selectedCaseId && cases.length > 0) {
      setSelectedCaseId(cases[0].id);
    }
  }, [cases, selectedCaseId]);

  useEffect(() => {
    if (!selectedPayrollCaseId && cases.length > 0) {
      setSelectedPayrollCaseId(cases[0].id);
    }
  }, [cases, selectedPayrollCaseId]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  const selectedCase = useMemo(
    () => cases.find((row) => row.id === selectedCaseId) ?? cases[0] ?? null,
    [cases, selectedCaseId]
  );

  useEffect(() => {
    if (!editDialogOpen) {
      setEditError("");
      return;
    }
    if (!selectedCase) return;
    setEditExitType(selectedCase.exitType);
    setEditLastDay(selectedCase.lastDay);
    setEditStatus(selectedCase.status);
    setEditError("");
  }, [editDialogOpen, selectedCase]);

  const progressSteps = useMemo(() => {
    if (!selectedCase) return [];
    const base = [
      "HR Initiation",
      "Manager Review",
      "Clearance",
      "Asset Return",
      "Final Review",
      "Completed",
    ];
    return base.map((label, index): OffboardingStep => {
      const stepNumber = index + 1;
      const mappedCurrent = Math.min(6, Math.max(1, selectedCase.currentStep - 1));
      return {
        id: `${selectedCase.id}-${label}`,
        title: label,
        responsible: "HR",
        status:
          selectedCase.status === "Completed" || stepNumber < mappedCurrent
            ? "Completed"
            : stepNumber === mappedCurrent
              ? "In Progress"
              : selectedCase.status === "Blocked" && stepNumber >= mappedCurrent
                ? "Blocked"
                : "Pending",
      };
    });
  }, [selectedCase]);

  const summary = useMemo(() => {
    const pendingClearance = cases.filter((row) => getPayrollReadinessLabel(row) === "Pending Clearance").length;
    const readyForPayroll = cases.filter((row) => getPayrollReadinessLabel(row) === "Ready for Payroll").length;
    const overdueTasks = cases.filter((row) => daysUntil(row.lastDay) < 0 && row.status !== "Completed").length;
    const effectiveThisWeek = cases.filter((row) => {
      const diff = daysUntil(row.lastDay);
      return diff >= 0 && diff <= 7;
    }).length;
    const upcomingSeparations = cases.filter((row) => {
      const diff = daysUntil(row.lastDay);
      return diff >= 0 && diff <= 14;
    }).length;

    return {
      total: cases.length,
      inProgress: cases.filter((row) => row.status === "In Progress").length,
      pendingClearance,
      readyForPayroll,
      overdueTasks,
      effectiveThisWeek,
      upcomingSeparations,
      blocked: cases.filter((row) => row.status === "Blocked").length,
      completed: cases.filter((row) => row.status === "Completed").length,
      pending: cases.filter((row) => row.status === "Pending").length,
    };
  }, [cases]);

  const { pendingActions, stalledCases } = useMemo(() => buildCaseAlerts(cases), [cases]);
  const clearanceRows = useMemo(() => buildClearanceRows(cases), [cases]);
  const { assets: assetRows, access: accessRows } = useMemo(() => buildAssetRows(cases), [cases]);
  const payrollRows = useMemo(() => buildPayrollRows(cases, payrollWorkflow), [cases, payrollWorkflow]);
  const selectedPayrollRow = useMemo(
    () => payrollRows.find((row) => row.caseId === selectedPayrollCaseId) ?? payrollRows[0] ?? null,
    [payrollRows, selectedPayrollCaseId]
  );

  const upcomingSeparations = useMemo(
    () =>
      [...cases]
        .filter((row) => {
          const diff = daysUntil(row.lastDay);
          return diff >= 0 && diff <= 14;
        })
        .sort((a, b) => new Date(a.lastDay).getTime() - new Date(b.lastDay).getTime()),
    [cases]
  );

  const caseFilters = useMemo(() => {
    const departments = Array.from(new Set(cases.map((row) => row.departmentName))).sort();
    const exitTypes = Array.from(new Set(cases.map((row) => row.exitType))).sort();
    return { departments, exitTypes };
  }, [cases]);

  const filteredCases = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    return cases.filter((row) => {
      const matchesSearch =
        !q ||
        [row.employeeName, row.employeeNumber ?? "", row.departmentName, row.exitType]
          .join(" ")
          .toLowerCase()
          .includes(q);
      const matchesDepartment = departmentFilter === "all" || row.departmentName === departmentFilter;
      const matchesExitType = exitTypeFilter === "all" || row.exitType === exitTypeFilter;
      const matchesStatus = statusFilter === "all" || getLifecycleLabel(row) === statusFilter;
      const matchesOverdue = !overdueOnly || (daysUntil(row.lastDay) < 0 && row.status !== "Completed");
      return matchesSearch && matchesDepartment && matchesExitType && matchesStatus && matchesOverdue;
    });
  }, [caseSearch, cases, departmentFilter, exitTypeFilter, overdueOnly, statusFilter]);

  const filteredClearanceRows = useMemo(() => {
    return clearanceRows.filter((row) => {
      const matchesDepartment =
        clearanceDepartmentFilter === "all" || row.department === clearanceDepartmentFilter;
      const matchesStatus = clearanceStatusFilter === "all" || row.status === clearanceStatusFilter;
      return matchesDepartment && matchesStatus;
    });
  }, [clearanceDepartmentFilter, clearanceRows, clearanceStatusFilter]);

  const adminEscalationRows = useMemo(
    () =>
      [...stalledCases, ...pendingActions.filter((row) => row.action.includes("Pending") || row.action.includes("Payroll"))].slice(0, 8),
    [pendingActions, stalledCases]
  );

  const auditActorOptions = useMemo(
    () => Array.from(new Set(auditRows.map((row) => row.actor))).sort(),
    [auditRows]
  );

  const filteredAuditRows = useMemo(() => {
    return auditRows.filter((row) => {
      const matchesActor = auditActorFilter === "all" || row.actor === auditActorFilter;
      const matchesCase = auditCaseFilter === "all" || row.caseId === auditCaseFilter;
      const matchesDate = !auditDateFilter || row.when.startsWith(auditDateFilter);
      return matchesActor && matchesCase && matchesDate;
    });
  }, [auditActorFilter, auditCaseFilter, auditDateFilter, auditRows]);

  const reportMetrics = useMemo(() => {
    const byDepartment = Array.from(
      cases.reduce((acc, row) => {
        acc.set(row.departmentName, (acc.get(row.departmentName) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())
    );
    const resignationCount = cases.filter((row) => row.exitType === "Resignation").length;
    const terminationCount = cases.filter((row) => row.exitType === "Termination").length;
    const averageCompletion =
      cases.length === 0 ? 0 : Math.round(cases.reduce((sum, row) => sum + row.progress, 0) / cases.length);
    const overdueRate = cases.length === 0 ? 0 : Math.round((summary.overdueTasks / cases.length) * 100);
    const payrollDelayCount = payrollRows.filter((row) => row.finalPayStatus !== "Ready for Payroll").length;
    const assetReturnRate = assetRows.length === 0
      ? 0
      : Math.round((assetRows.filter((row) => row.returnStatus === "Returned").length / assetRows.length) * 100);
    return {
      byDepartment,
      resignationCount,
      terminationCount,
      averageCompletion,
      overdueRate,
      payrollDelayCount,
      assetReturnRate,
    };
  }, [assetRows, cases, payrollRows, summary.overdueTasks]);

  const approvalQueue = useMemo(() => {
    const base = cases.filter((row) => row.currentStep === 2 && row.status !== "Completed");
    return currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "MANAGER"
      ? base.filter((row) => row.departmentId === currentUser.departmentId)
      : base;
  }, [cases, currentUser.departmentId, currentUser.role]);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeesError, setEmployeesError] = useState("");

  const [itDialogOpen, setItDialogOpen] = useState(false);
  const [itSearch, setItSearch] = useState("");
  const [itSelected, setItSelected] = useState<Employee | null>(null);
  const [itAction, setItAction] = useState<"DISABLE_ACCESS" | "DELETE_ACCOUNT">("DISABLE_ACCESS");
  const [itReason, setItReason] = useState("");
  const [itSubmitError, setItSubmitError] = useState("");

  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [startSearch, setStartSearch] = useState("");
  const [startSelected, setStartSelected] = useState<Employee | null>(null);
  const [startExitType, setStartExitType] = useState("Resignation");
  const [startLastDay, setStartLastDay] = useState("");
  const [startError, setStartError] = useState("");

  const ensureEmployeesLoaded = async () => {
    setEmployeesError("");
    if (employees.length > 0) return;

    setEmployeesLoading(true);
    try {
      if (!isSupabaseAuthConfigured()) {
        setEmployees([]);
        setEmployeesError("Supabase is not configured in this environment.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("No active session. Please sign in again.");

      const response = await fetch("/api/employees", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await response.json().catch(() => null)) as unknown;
      const payload =
        json && typeof json === "object" ? (json as Record<string, unknown>) : null;
      if (!response.ok) {
        throw new Error(String(payload?.error ?? "Failed to load employees."));
      }
      setEmployees((payload?.employees ?? []) as Employee[]);
    } catch (error) {
      setEmployeesError(error instanceof Error ? error.message : "Failed to load employees.");
    } finally {
      setEmployeesLoading(false);
    }
  };

  const openItDialog = async () => {
    setItDialogOpen(true);
    setItSubmitError("");
    await ensureEmployeesLoaded();
  };

  const openStartDialog = async () => {
    setStartDialogOpen(true);
    setStartError("");
    await ensureEmployeesLoaded();
  };

  useEffect(() => {
    if (!itDialogOpen) {
      setItSearch("");
      setItSelected(null);
      setItReason("");
      setItAction("DISABLE_ACCESS");
      setItSubmitError("");
    }
  }, [itDialogOpen]);

  useEffect(() => {
    if (!startDialogOpen) {
      setStartSearch("");
      setStartSelected(null);
      setStartExitType("Resignation");
      setStartLastDay("");
      setStartError("");
    }
  }, [startDialogOpen]);

  const itFiltered = useMemo(() => {
    const q = itSearch.trim().toLowerCase();
    if (!q) return employees.slice(0, 25);
    return employees
      .filter((row) => {
        const haystack = `${row.firstName} ${row.lastName} ${row.email} ${row.employeeNumber}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 25);
  }, [employees, itSearch]);

  const startFiltered = useMemo(() => {
    const q = startSearch.trim().toLowerCase();
    if (!q) return employees.slice(0, 25);
    return employees
      .filter((row) => {
        const haystack = `${row.firstName} ${row.lastName} ${row.email} ${row.employeeNumber}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 25);
  }, [employees, startSearch]);

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

    createItAccountActionRequest({
      employeeId: itSelected.id,
      employeeName: `${itSelected.firstName} ${itSelected.lastName}`.trim() || itSelected.email,
      employeeEmail: itSelected.email,
      employeeNumber: itSelected.employeeNumber,
      departmentId: itSelected.departmentId,
      action: itAction,
      reason: itReason.trim(),
      requestedByName: currentUser.name,
      requestedByRole: currentUser.role,
    });

    pushRoleNotification("SUPER_ADMIN", {
      title: "IT action required: Offboarding account",
      body: `HR requested ${itAction === "DELETE_ACCOUNT" ? "account deletion" : "access disable"} for ${itSelected.firstName} ${itSelected.lastName}.`,
      time: "Just now",
      unread: true,
    });

    setActionNotice("IT action request sent.");
    setItDialogOpen(false);
  };

  const submitStartOffboarding = () => {
    setStartError("");
    if (!startSelected) {
      setStartError("Please select an employee.");
      return;
    }
    if (!startLastDay) {
      setStartError("Please select the employee's last day.");
      return;
    }

    const departmentName = getDepartmentById(startSelected.departmentId)?.name ?? "Unknown";
    const created = createOffboardingCase({
      employeeId: startSelected.id,
      employeeName: `${startSelected.firstName} ${startSelected.lastName}`.trim() || startSelected.email,
      employeeEmail: startSelected.email,
      employeeNumber: startSelected.employeeNumber,
      departmentId: startSelected.departmentId,
      departmentName,
      exitType: startExitType,
      lastDay: startLastDay,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
    });

    setCases((prev) => [created, ...prev]);
    setSelectedCaseId(created.id);
    setAuditRows(getOffboardingAudit());
    setHrTab("cases");

    pushRoleNotification("DEPARTMENT_MANAGER", {
      title: "Offboarding approval needed",
      body: `Please review manager approval for ${created.employeeName} (${created.departmentName}).`,
      time: "Just now",
      unread: true,
    });
    pushRoleNotification("HR_MANAGER", {
      title: "Offboarding initiated",
      body: `HR started offboarding for ${created.employeeName}. Awaiting manager approval.`,
      time: "Just now",
      unread: true,
    });

    setActionNotice("Offboarding case created.");
    setStartDialogOpen(false);
  };

  const handleFollowUp = (caseItem: OffboardingCase) => {
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Sent follow-up for pending offboarding tasks",
      target: caseItem.employeeName,
      caseId: caseItem.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Follow-up sent for ${caseItem.employeeName}.`);
  };

  const handleMarkReadyForReview = (caseItem: OffboardingCase) => {
    const nextStep = Math.max(caseItem.currentStep, 7);
    const updated = advanceOffboardingCase({
      caseId: caseItem.id,
      nextStep,
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Marked case ready for final review",
    });
    if (!updated) return;
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setAuditRows(getOffboardingAudit());
    setActionNotice(`${updated.employeeName} marked ready for review.`);
  };

  const handleSelectCase = (caseId: string, nextTab?: HrStaffTab) => {
    setSelectedCaseId(caseId);
    if (nextTab) setHrTab(nextTab);
  };

  const handleViewCase = (caseItem: OffboardingCase) => {
    setSelectedCaseId(caseItem.id);
    setViewCaseDialogOpen(true);
  };

  const handleOpenEditCase = (caseItem: OffboardingCase) => {
    setSelectedCaseId(caseItem.id);
    setHrTab("cases");
    setEditDialogOpen(true);
  };

  const handleSaveCaseEdit = () => {
    if (!selectedCase) return;
    if (!editLastDay) {
      setEditError("Please select the effective separation date.");
      return;
    }
    const updated = updateOffboardingCase(selectedCase.id, {
      exitType: editExitType,
      lastDay: editLastDay,
      status: editStatus,
    });
    if (!updated) {
      setEditError("Failed to update the case.");
      return;
    }
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Edited offboarding case details",
      target: updated.employeeName,
      caseId: updated.id,
    });
    setAuditRows(getOffboardingAudit());
    setEditDialogOpen(false);
    setActionNotice(`Updated ${updated.employeeName}'s offboarding case.`);
  };

  const handleStartChecklist = (caseItem: OffboardingCase) => {
    setSelectedCaseId(caseItem.id);
    setClearanceDepartmentFilter("all");
    setClearanceStatusFilter("all");
    setHrTab("clearance");
    setActionNotice(`Checklist opened for ${caseItem.employeeName}.`);
  };

  const handleViewAllCases = () => {
    setOverdueOnly(false);
    setStatusFilter("all");
    setHrTab("cases");
  };

  const handleViewOverdueItems = () => {
    const overdueTask = clearanceRows.find((row) => row.status === "Overdue" || row.status === "Blocked");
    setHrTab("clearance");
    setClearanceStatusFilter(overdueTask?.status === "Blocked" ? "Blocked" : "Overdue");
    if (!overdueTask) {
      setActionNotice("No overdue clearance items found.");
      return;
    }
    setSelectedCaseId(overdueTask.caseId);
    setActionNotice(`Showing urgent clearance items for ${overdueTask.employeeName}.`);
  };

  const handleCreateChecklist = () => {
    const target = selectedCase ?? cases[0];
    if (!target) return;
    setSelectedCaseId(target.id);
    setHrTab("clearance");
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Created offboarding checklist",
      target: target.employeeName,
      caseId: target.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Checklist created for ${target.employeeName}.`);
  };

  const handleUpdateDueDate = () => {
    const overdue = clearanceRows.find((row) => row.status === "Overdue");
    setHrTab("clearance");
    setClearanceStatusFilter("Overdue");
    if (!overdue) {
      setActionNotice("No overdue tasks to review.");
      return;
    }
    setSelectedCaseId(overdue.caseId);
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Reviewed overdue due date",
      target: overdue.employeeName,
      caseId: overdue.caseId,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Due date review opened for ${overdue.employeeName}.`);
  };

  const handleAddRemarks = () => {
    const target = selectedCase ?? cases[0];
    if (!target) return;
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Added HR coordination remarks",
      target: target.employeeName,
      caseId: target.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Remarks logged for ${target.employeeName}.`);
  };

  const upsertPayrollWorkflow = (caseId: string, patch: Partial<PayrollWorkflowRecord>) => {
    setPayrollWorkflow((prev) => {
      const existing = prev[caseId] ?? {
        hrRemarks: "",
        financeReviewFlagged: false,
        financeReviewReason: "",
        financeReviewFlaggedAt: "",
        lastFollowUpAt: "",
      };
      return {
        ...prev,
        [caseId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const getMissingPayrollRequirements = (caseItem: OffboardingCase | null) => {
    if (!caseItem) return [];
    const items: string[] = [];
    if (caseItem.currentStep <= 2) items.push("Department Manager approval is still pending.");
    if (caseItem.currentStep < 6) items.push("HR Admin clearance and payroll endorsement checks are incomplete.");
    if (caseItem.currentStep < 5) items.push("System Admin access deactivation is not yet complete.");
    if (caseItem.currentStep < 6) items.push("Asset return confirmation has not been fully completed.");
    if (caseItem.status === "Blocked") items.push("Case is blocked and needs HR Manager review.");
    return Array.from(new Set(items));
  };

  const handleFollowUpPendingClearance = () => {
    const pendingTask = clearanceRows.find((row) => ["Pending", "In Progress", "Overdue"].includes(row.status));
    if (!pendingTask) {
      setActionNotice("No pending clearance tasks require follow-up.");
      return;
    }
    const target = cases.find((row) => row.id === pendingTask.caseId);
    if (!target) return;
    setSelectedCaseId(target.id);
    setHrTab("clearance");
    handleFollowUp(target);
  };

  const handleReviewRoleResponsibilities = () => {
    const target = clearanceRows.find((row) => row.status === "Pending" || row.status === "Overdue") ?? clearanceRows[0];
    setHrTab("clearance");
    if (!target) {
      setActionNotice("No clearance responsibilities to review.");
      return;
    }
    setSelectedCaseId(target.caseId);
    setClearanceDepartmentFilter(target.department);
    setActionNotice(`Showing role responsibilities for ${target.employeeName}.`);
  };

  const handleMonitorAssets = () => {
    const target = accessRows.find((row) => row.status !== "Disabled") ?? accessRows[0];
    if (!target) return;
    setSelectedCaseId(target.caseId);
    setHrTab("assets");
    setActionNotice(`Monitoring asset/access coordination for ${target.employeeName}.`);
  };

  const handleFollowUpResponsibleTeam = () => {
    const target = accessRows.find((row) => row.status === "Pending Disablement" || row.status === "Still Active");
    if (!target) {
      setActionNotice("No pending access removals require follow-up.");
      return;
    }
    setSelectedCaseId(target.caseId);
    setHrTab("assets");
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `Followed up ${target.responsibleTeam} for access removal`,
      target: target.employeeName,
      caseId: target.caseId,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Follow-up sent to ${target.responsibleTeam} for ${target.employeeName}.`);
  };

  const handleMarkCoordinationStatus = () => {
    const target = selectedCase ?? cases[0];
    if (!target) return;
    setHrTab("assets");
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Updated asset and access coordination status",
      target: target.employeeName,
      caseId: target.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Coordination status updated for ${target.employeeName}.`);
  };

  const handleViewReadiness = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    setSelectedPayrollCaseId(target.caseId);
    setHrTab("payroll");
    setPayrollReadinessDialogOpen(true);
  };

  const handleOpenPayrollRemarks = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    setSelectedPayrollCaseId(target.caseId);
    setHrTab("payroll");
    setPayrollRemarksDraft(target.financeRemarks === "Ready to endorse for final pay computation" || target.financeRemarks === "Finance is waiting for all upstream offboarding controls." || target.financeRemarks === "Flagged for HR Admin payroll review."
      ? (payrollWorkflow[target.caseId]?.hrRemarks ?? "")
      : target.financeRemarks);
    setPayrollRemarksDialogOpen(true);
  };

  const handleSavePayrollRemarks = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    upsertPayrollWorkflow(target.caseId, { hrRemarks: payrollRemarksDraft.trim() });
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Updated payroll readiness remarks",
      target: target.employeeName,
      caseId: target.caseId,
    });
    setAuditRows(getOffboardingAudit());
    setPayrollRemarksDialogOpen(false);
    setActionNotice(`Payroll remarks updated for ${target.employeeName}.`);
  };

  const handleSubmitFinanceReviewFlag = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    const reason = financeReviewReason.trim() || "Flagged for HR Admin payroll review.";
    upsertPayrollWorkflow(target.caseId, {
      financeReviewFlagged: true,
      financeReviewReason: reason,
      financeReviewFlaggedAt: new Date().toISOString(),
    });
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `Flagged case for finance review: ${reason}`,
      target: target.employeeName,
      caseId: target.caseId,
    });
    setAuditRows(getOffboardingAudit());
    setFinanceReviewDialogOpen(false);
    setActionNotice(`Finance review flagged for ${target.employeeName}.`);
  };

  const handleSendMissingRequirementsFollowUp = () => {
    const target = selectedPayrollRow ?? payrollRows.find((row) => row.finalPayStatus === "Pending Clearance") ?? payrollRows[0];
    if (!target) return;
    const caseItem = cases.find((row) => row.id === target.caseId) ?? null;
    const defaultNote = getMissingPayrollRequirements(caseItem).join(" ");
    const note = missingRequirementsNote.trim() || defaultNote || "Follow-up sent for payroll readiness blockers.";
    upsertPayrollWorkflow(target.caseId, {
      lastFollowUpAt: new Date().toISOString(),
    });
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `Followed up on payroll blockers: ${note}`,
      target: target.employeeName,
      caseId: target.caseId,
    });
    setAuditRows(getOffboardingAudit());
    setMissingRequirementsDialogOpen(false);
    setActionNotice(`Follow-up sent for missing payroll requirements of ${target.employeeName}.`);
  };

  const handleFinanceReviewFlag = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    setSelectedPayrollCaseId(target.caseId);
    setHrTab("payroll");
    setFinanceReviewReason(target.holdReason === "-" ? "" : target.holdReason);
    setFinanceReviewDialogOpen(true);
  };

  const handleFollowUpMissingRequirements = () => {
    const target = selectedPayrollRow ?? payrollRows.find((row) => row.finalPayStatus === "Pending Clearance") ?? payrollRows[0];
    if (!target) {
      setActionNotice("No payroll blockers require follow-up.");
      return;
    }
    setSelectedPayrollCaseId(target.caseId);
    setHrTab("payroll");
    setMissingRequirementsNote("");
    setMissingRequirementsDialogOpen(true);
  };

  const handleApprove = (caseId: string) => {
    const updated = advanceOffboardingCase({
      caseId,
      nextStep: 3,
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Approved manager clearance",
    });
    if (!updated) return;
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setAuditRows(getOffboardingAudit());
  };

  const handleReject = (caseId: string) => {
    const updated = blockOffboardingCase({
      caseId,
      actor: currentUser.name,
      actorRole: currentUser.role,
      reason: "Manager rejected offboarding request",
    });
    if (!updated) return;
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    setAuditRows(getOffboardingAudit());
  };

  const handleAdminReassignHrStaff = (caseItem: OffboardingCase) => {
    setSelectedCaseId(caseItem.id);
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Reassigned HR Staff owner to Kath Domingo",
      target: caseItem.employeeName,
      caseId: caseItem.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`HR Staff reassigned for ${caseItem.employeeName}.`);
  };

  const handleAdminOverrideStatus = (caseItem: OffboardingCase) => {
    const nextStatus: OffboardingCaseStatus =
      caseItem.status === "Blocked" ? "In Progress" : caseItem.status === "Completed" ? "In Progress" : "Blocked";
    const updated = updateOffboardingCase(caseItem.id, { status: nextStatus });
    if (!updated) return;
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `HR Admin overrode case status to ${nextStatus}`,
      target: updated.employeeName,
      caseId: updated.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`${updated.employeeName} status overridden to ${nextStatus}.`);
  };

  const handleAdminRestartOrCancel = (caseItem: OffboardingCase) => {
    const updated = updateOffboardingCase(caseItem.id, {
      status: caseItem.status === "Completed" ? "In Progress" : "Completed",
      currentStep: caseItem.status === "Completed" ? Math.max(2, caseItem.currentStep - 1) : 8,
      progress: caseItem.status === "Completed" ? Math.min(90, Math.max(15, caseItem.progress - 20)) : 100,
    });
    if (!updated) return;
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: caseItem.status === "Completed" ? "Restarted offboarding case" : "Cancelled offboarding case",
      target: updated.employeeName,
      caseId: updated.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`${updated.employeeName} ${caseItem.status === "Completed" ? "restarted" : "cancelled"} successfully.`);
  };

  const handleAdminApproveEscalation = (caseItem: OffboardingCase) => {
    setSelectedCaseId(caseItem.id);
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Approved escalation and intervention path",
      target: caseItem.employeeName,
      caseId: caseItem.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Escalation approved for ${caseItem.employeeName}.`);
  };

  const handleAdminOverrideChecklistTask = (row: ClearanceRow) => {
    const caseItem = cases.find((item) => item.id === row.caseId);
    if (!caseItem) return;
    const stepMap: Record<ClearanceRow["department"], number> = {
      "HR Staff": 3,
      "Department Manager": 3,
      "System Admin": 5,
      "HR Admin": 6,
    };
    const updated = advanceOffboardingCase({
      caseId: row.caseId,
      nextStep: Math.max(caseItem.currentStep, stepMap[row.department]),
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `HR Admin overrode checklist task completion: ${row.taskName}`,
    });
    if (!updated) return;
    setCases((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setAuditRows(getOffboardingAudit());
    setActionNotice(`${row.taskName} marked complete for ${updated.employeeName}.`);
  };

  const handleAdminOpenApprovalComment = (caseId: string, mode: "revision" | "approve" | "reject") => {
    setApprovalTargetCaseId(caseId);
    setApprovalCommentMode(mode);
    setApprovalCommentDraft("");
    setApprovalCommentOpen(true);
  };

  const handleAdminSubmitApprovalComment = () => {
    const target = cases.find((row) => row.id === approvalTargetCaseId);
    if (!target) return;
    if (approvalCommentMode === "reject") {
      const updated = blockOffboardingCase({
        caseId: target.id,
        actor: currentUser.name,
        actorRole: currentUser.role,
        reason: approvalCommentDraft.trim() || "Rejected by HR Admin",
      });
      if (updated) {
        setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      }
    }
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action:
        approvalCommentMode === "revision"
          ? `Requested approval revision: ${approvalCommentDraft.trim() || "Needs revision"}`
          : approvalCommentMode === "approve"
            ? `Approved with comment: ${approvalCommentDraft.trim() || "Approved"}`
            : `Rejected with comment: ${approvalCommentDraft.trim() || "Rejected"}`,
      target: target.employeeName,
      caseId: target.id,
    });
    setAuditRows(getOffboardingAudit());
    setApprovalCommentOpen(false);
    setActionNotice(`Approval comment saved for ${target.employeeName}.`);
  };

  const handleAdminFollowUpAssetRow = (employeeName: string, caseId: string, subject: string) => {
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `Followed up on ${subject}`,
      target: employeeName,
      caseId,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Follow-up sent for ${employeeName}.`);
  };

  const handleAdminFlagAssetIncomplete = (employeeName: string, caseId: string, subject: string) => {
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `Flagged incomplete ${subject}`,
      target: employeeName,
      caseId,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`${subject} flagged for ${employeeName}.`);
  };

  const handleAdminOverrideVerification = (employeeName: string, caseId: string, subject: string) => {
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: `Overrode verification for ${subject}`,
      target: employeeName,
      caseId,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Verification overridden for ${employeeName}.`);
  };

  const handleAdminReleasePayrollHold = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    const caseItem = cases.find((row) => row.id === target.caseId);
    if (!caseItem) return;
    const updated = updateOffboardingCase(target.caseId, { status: "In Progress", currentStep: Math.max(caseItem.currentStep, 7), progress: Math.max(caseItem.progress, 86) });
    if (!updated) return;
    upsertPayrollWorkflow(target.caseId, { financeReviewFlagged: false, financeReviewReason: "" });
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Released payroll hold for finance review",
      target: updated.employeeName,
      caseId: updated.id,
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`Payroll hold released for ${updated.employeeName}.`);
  };

  const handleAdminSendToFinance = () => {
    const target = selectedPayrollRow ?? payrollRows[0];
    if (!target) return;
    const caseItem = cases.find((row) => row.id === target.caseId);
    if (!caseItem) return;
    const updated = advanceOffboardingCase({
      caseId: target.caseId,
      nextStep: Math.max(caseItem.currentStep, 7),
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Sent case to finance for final pay processing",
    });
    if (!updated) return;
    setCases((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    upsertPayrollWorkflow(target.caseId, { financeReviewFlagged: false, financeReviewReason: "" });
    setAuditRows(getOffboardingAudit());
    setActionNotice(`${updated.employeeName} sent to Finance.`);
  };

  const handleAdminSaveSettings = () => {
    addOffboardingAudit({
      actor: currentUser.name,
      actorRole: currentUser.role,
      action: "Updated offboarding admin settings",
      target: "Offboarding Configuration",
    });
    setAuditRows(getOffboardingAudit());
    setActionNotice("Offboarding settings saved.");
  };

  const showUrgentBanner = view === "tasks" || view === "admin";
  const alertMessage =
    view === "tasks"
      ? pendingActions[0]
        ? `${pendingActions[0].employeeName}: ${pendingActions[0].action}`
        : DEMO_OFFBOARDING_HR_ALERTS[0]
      : DEMO_OFFBOARDING_ADMIN_ALERTS[0];

  const actions =
    view === "tasks" ? (
      <div className="flex flex-wrap items-center gap-2">
        {canInitiateOffboarding ? (
          <Button onClick={() => void openStartDialog()}>
            <UserMinus className="mr-2 size-4" />
            Initiate Offboarding
          </Button>
        ) : null}
        <Button variant="outline" onClick={handleViewAllCases}>
          View All Cases
        </Button>
        <Button variant="outline" onClick={handleViewOverdueItems}>
          View Overdue Items
        </Button>
      </div>
    ) : null;

  return (
    <div
      className={cn(
        "min-w-0 w-full max-w-full text-foreground",
        currentUser.role === "HR_ADMIN" ||
          currentUser.role === "HR_MANAGER" ||
          currentUser.role === "DEPARTMENT_MANAGER" ||
          currentUser.role === "AUDITOR" ||
          currentUser.role === "EXECUTIVE"
          ? "flex flex-col gap-4"
          : "space-y-6"
      )}
    >
      <div className={currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? "contents" : "min-w-0 space-y-3"}>
        <div className="flex flex-col gap-6">
          <EmployeeModuleTopbar
            searchPlaceholder={
              view === "tasks"
                ? "Search offboarding cases, clearance tasks, assets, or payroll readiness..."
                : view === "audit"
                  ? "Search audit trail..."
                  : view === "analytics"
                    ? "Search reports..."
                    : "Search offboarding..."
            }
          />
          <EmployeeSectionHeader
            title={title}
            description={description}
            actions={actions}
            tabs={view === "tasks" ? HR_STAFF_OFFBOARDING_TABS : undefined}
            activeTab={view === "tasks" ? hrTab : undefined}
            onTabChange={view === "tasks" ? (id) => setHrTab(id as HrStaffTab) : undefined}
          />
        </div>
      </div>

      {showUrgentBanner && showAlert && alertMessage ? (
        <AlertBanner message={alertMessage} onDismiss={() => setShowAlert(false)} />
      ) : null}

      {actionNotice ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
          {actionNotice}
        </div>
      ) : null}

      {view === "tasks" && (
        <>
          <Tabs value={hrTab} onValueChange={(value) => setHrTab(value as HrStaffTab)} className="space-y-5">
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-3 lg:grid-cols-3">
                <OpsStatCard icon={ClipboardList} title="In Progress" value={summary.inProgress} caption="Active coordination in motion" />
                <OpsStatCard icon={AlertTriangle} title="Pending Clearance" value={summary.pendingClearance} caption="Cases still missing required steps" />
                <OpsStatCard icon={Landmark} title="Ready for Payroll" value={summary.readyForPayroll} caption="Eligible for final pay handling" />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle>Upcoming Separations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Exit Type</TableHead>
                          <TableHead>Effective Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pending Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingSeparations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-sm text-muted-foreground">
                              No upcoming separations in the next 14 days.
                            </TableCell>
                          </TableRow>
                        ) : (
                          upcomingSeparations.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">{row.employeeName}</TableCell>
                              <TableCell>{row.departmentName}</TableCell>
                              <TableCell>{row.exitType}</TableCell>
                              <TableCell>{formatLongDate(row.lastDay)}</TableCell>
                              <TableCell>{renderBadge(getLifecycleLabel(row))}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {pendingActions.find((item) => item.caseId === row.id)?.action ?? "Checklist on track"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card className={cn("border-[#d7e1f1] bg-white shadow-[0_10px_24px_rgba(30,64,175,0.06)]", OFFBOARDING_DARK_CARD_TW)}>
                  <CardHeader className="pb-3">
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm leading-6 text-[#5d7298] dark:text-slate-400">
                      Start a case, jump to operational queues, or trigger cross-team follow-up from one place.
                    </p>

                    <button
                      type="button"
                      onClick={() => void openStartDialog()}
                      className="group flex w-full items-center justify-between rounded-2xl bg-[#223563] px-4 py-3.5 text-left text-white shadow-[0_10px_24px_rgba(34,53,99,0.22)] transition hover:bg-[#1d2d55]"
                    >
                      <div>
                        <p className="text-sm font-semibold">Initiate Offboarding</p>
                        <p className="mt-1 text-xs text-white/75">Create a new offboarding case and route it for approval.</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-white/80 transition group-hover:translate-x-0.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleViewAllCases}
                      className="group flex w-full items-center justify-between rounded-2xl border border-[#d7e1f1] bg-[#f8fbff] px-4 py-3 text-left shadow-[0_6px_16px_rgba(30,64,175,0.06)] transition hover:border-[#bdd0ef] hover:bg-white dark:border-white/10 dark:bg-[#161b30] dark:hover:bg-[#202842]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#1f3566] dark:text-slate-100">View All Cases</p>
                        <p className="mt-1 text-xs text-[#5d7298] dark:text-slate-400">Open the full case queue with filters and case actions.</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[#5d7298] transition group-hover:translate-x-0.5 dark:text-slate-400" />
                    </button>

                    <button
                      type="button"
                      onClick={handleViewOverdueItems}
                      className="group flex w-full items-center justify-between rounded-2xl border border-[#d7e1f1] bg-[#f8fbff] px-4 py-3 text-left shadow-[0_6px_16px_rgba(30,64,175,0.06)] transition hover:border-[#bdd0ef] hover:bg-white dark:border-white/10 dark:bg-[#161b30] dark:hover:bg-[#202842]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#1f3566] dark:text-slate-100">View Overdue Items</p>
                        <p className="mt-1 text-xs text-[#5d7298] dark:text-slate-400">Jump directly to urgent clearance blockers and late tasks.</p>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-[#5d7298] transition group-hover:translate-x-0.5 dark:text-slate-400" />
                    </button>

                    {canRequestItAction ? (
                      <button
                        type="button"
                        onClick={() => void openItDialog()}
                        className="group flex w-full items-center justify-between rounded-2xl border border-[#d7e1f1] bg-[#f8fbff] px-4 py-3 text-left shadow-[0_6px_16px_rgba(30,64,175,0.06)] transition hover:border-[#bdd0ef] hover:bg-white dark:border-white/10 dark:bg-[#161b30] dark:hover:bg-[#202842]"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#1f3566] dark:text-slate-100">Request IT Action</p>
                          <p className="mt-1 text-xs text-[#5d7298] dark:text-slate-400">Coordinate access disablement or account removal with IT.</p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-[#5d7298] transition group-hover:translate-x-0.5 dark:text-slate-400" />
                      </button>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Action Needed</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingActions.slice(0, 6).map((row, index) => (
                          <TableRow key={`${row.caseId}-${index}`}>
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.departmentName}</TableCell>
                            <TableCell>{renderBadge(row.status)}</TableCell>
                            <TableCell>
                              <button
                                type="button"
                                className="text-left text-sm text-primary hover:underline"
                                onClick={() => handleSelectCase(row.caseId, "cases")}
                              >
                                {row.action}
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Blocked / Stalled Cases</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Effective Date</TableHead>
                          <TableHead>Blocker</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stalledCases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-sm text-muted-foreground">
                              No stalled cases right now.
                            </TableCell>
                          </TableRow>
                        ) : (
                          stalledCases.slice(0, 6).map((row, index) => (
                            <TableRow key={`${row.caseId}-${index}`}>
                              <TableCell className="font-medium">{row.employeeName}</TableCell>
                              <TableCell>{row.departmentName}</TableCell>
                              <TableCell>{formatLongDate(row.effectiveDate)}</TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  className="text-left text-sm text-primary hover:underline"
                                  onClick={() => handleSelectCase(row.caseId, "clearance")}
                                >
                                  {row.action}
                                </button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="cases" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Offboarding Cases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <Input
                      value={caseSearch}
                      onChange={(event) => setCaseSearch(event.target.value)}
                      placeholder="Search employee"
                    />
                    <select
                      value={departmentFilter}
                      onChange={(event) => setDepartmentFilter(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All departments</option>
                      {caseFilters.departments.map((row) => (
                        <option key={row} value={row}>
                          {row}
                        </option>
                      ))}
                    </select>
                    <select
                      value={exitTypeFilter}
                      onChange={(event) => setExitTypeFilter(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All exit types</option>
                      {caseFilters.exitTypes.map((row) => (
                        <option key={row} value={row}>
                          {row}
                        </option>
                      ))}
                    </select>
                    <select
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All statuses</option>
                      <option value="Scheduled">Scheduled</option>
                      <option value="Pending Clearance">Pending Clearance</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Final Review">Final Review</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Completed">Completed</option>
                    </select>
                    <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
                      <input
                        type="checkbox"
                        checked={overdueOnly}
                        onChange={(event) => setOverdueOnly(event.target.checked)}
                      />
                      Overdue only
                    </label>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Exit Type</TableHead>
                        <TableHead>Effective Separation Date</TableHead>
                        <TableHead>Employment Status</TableHead>
                        <TableHead>Offboarding Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead>Assigned HR Owner</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={11} className="text-sm text-muted-foreground">
                            No offboarding cases match the current filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCases.map((row) => (
                          <TableRow
                            key={row.id}
                            className={cn("cursor-pointer", selectedCaseId === row.id && "bg-accent/40")}
                            onClick={() => setSelectedCaseId(row.id)}
                          >
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.employeeNumber ?? "-"}</TableCell>
                            <TableCell>{row.departmentName}</TableCell>
                            <TableCell>{row.departmentName} Specialist</TableCell>
                            <TableCell>{row.exitType}</TableCell>
                            <TableCell>{formatLongDate(row.lastDay)}</TableCell>
                            <TableCell>{renderBadge(getEmploymentLabel(row))}</TableCell>
                            <TableCell>{renderBadge(getLifecycleLabel(row), statusBadgeTone(row.status))}</TableCell>
                            <TableCell>{row.progress}%</TableCell>
                            <TableCell>HR Staff</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                                <Button size="sm" variant="outline" onClick={() => handleViewCase(row)}>
                                  View Case
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleOpenEditCase(row)}>
                                  Edit Case
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleStartChecklist(row)}>
                                  Start Checklist
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleFollowUp(row)}>
                                  Send Follow-up
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleMarkReadyForReview(row)}>
                                  Mark Ready for Review
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

            </TabsContent>

            <TabsContent value="clearance" className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <OpsStatCard icon={ClipboardList} title="Total Tasks" value={clearanceRows.length} caption="Department-owned checklist items" />
                <OpsStatCard icon={CheckCircle2} title="Completed" value={clearanceRows.filter((row) => row.status === "Completed").length} caption="Finished clearance steps" />
                <OpsStatCard icon={CalendarClock} title="Pending" value={clearanceRows.filter((row) => row.status === "Pending" || row.status === "In Progress").length} caption="Tasks still open for action" />
                <OpsStatCard icon={AlertTriangle} title="Overdue / Blocked" value={clearanceRows.filter((row) => row.status === "Overdue" || row.status === "Blocked").length} caption="Needs immediate HR follow-up" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Checklist by Department</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={clearanceDepartmentFilter}
                      onChange={(event) => setClearanceDepartmentFilter(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All departments</option>
                      <option value="HR">HR</option>
                      <option value="IT">IT</option>
                      <option value="Finance">Finance</option>
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                    </select>
                    <select
                      value={clearanceStatusFilter}
                      onChange={(event) => setClearanceStatusFilter(event.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Blocked">Blocked</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  <Button variant="outline" onClick={handleCreateChecklist}>
                    Create Checklist
                  </Button>
                  <Button variant="outline" onClick={handleReviewRoleResponsibilities}>
                    View Role Responsibilities
                  </Button>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>Task Name</TableHead>
                        <TableHead>Employee / Case</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClearanceRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.department}</TableCell>
                          <TableCell>{row.taskName}</TableCell>
                          <TableCell>
                            <button
                              type="button"
                              className="text-left text-primary hover:underline"
                              onClick={() => handleSelectCase(row.caseId, "cases")}
                            >
                              {row.employeeName}
                            </button>
                          </TableCell>
                          <TableCell>
                            {row.owner}
                          </TableCell>
                          <TableCell>{formatLongDate(row.dueDate)}</TableCell>
                          <TableCell>{renderBadge(row.status)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.remarks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Important Indicators</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">HR Staff is the primary case coordinator</div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Due today</div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Overdue</div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Waiting on another department</div>
                  </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle>HR Staff Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <Button variant="outline" onClick={handleUpdateDueDate}>
                      Update Due Date
                    </Button>
                    <Button variant="outline" onClick={handleAddRemarks}>
                      Add Remarks
                    </Button>
                    <Button variant="outline" onClick={handleFollowUpPendingClearance}>
                      Follow Up Pending Tasks
                    </Button>
                    <Button variant="outline" onClick={handleReviewRoleResponsibilities}>
                      Review Role Responsibilities
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="assets" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Asset Return</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Asset</TableHead>
                          <TableHead>Assigned</TableHead>
                          <TableHead>Return Status</TableHead>
                          <TableHead>Verified By</TableHead>
                          <TableHead>Date Returned</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assetRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.asset}</TableCell>
                            <TableCell>{row.assigned}</TableCell>
                            <TableCell>{renderBadge(row.returnStatus, statusBadgeTone(row.returnStatus === "Returned" ? "Completed" : "Pending"))}</TableCell>
                            <TableCell>{row.verifiedBy}</TableCell>
                            <TableCell>{row.dateReturned === "-" ? "-" : formatLongDate(row.dateReturned)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Access Removal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Account / System</TableHead>
                          <TableHead>Responsible Team</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date Disabled</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accessRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.account}</TableCell>
                            <TableCell>{row.responsibleTeam}</TableCell>
                            <TableCell>{renderBadge(row.status, statusBadgeTone(row.status === "Disabled" ? "Completed" : row.status === "Still Active" ? "Overdue" : "Pending"))}</TableCell>
                            <TableCell>{row.dateDisabled === "-" ? "-" : formatLongDate(row.dateDisabled)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Important Alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Effective date reached but access still active</div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Asset not yet returned</div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Missing verifier</div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">Account removal still pending</div>
                  </CardContent>
                </Card>

                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle>HR Staff Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    <Button variant="outline" onClick={handleMonitorAssets}>
                      Monitor Status
                    </Button>
                    <Button variant="outline" onClick={handleFollowUpResponsibleTeam}>
                      Follow Up Responsible Team
                    </Button>
                    <Button variant="outline" onClick={handleMarkCoordinationStatus}>
                      Mark Coordination Status
                    </Button>
                    <Button variant="outline" onClick={handleAddRemarks}>
                      Add Notes / Reminders
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="payroll" className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <OpsStatCard icon={Landmark} title="Ready for Payroll" value={payrollRows.filter((row) => row.finalPayStatus === "Ready for Payroll").length} caption="Ready for finance handoff" />
                <OpsStatCard icon={AlertTriangle} title="On Hold" value={payrollRows.filter((row) => row.finalPayStatus === "On Hold").length} caption="Blocked from final pay processing" />
                <OpsStatCard icon={ClipboardList} title="Pending Clearance" value={payrollRows.filter((row) => row.finalPayStatus === "Pending Clearance").length} caption="Still waiting on requirements" />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Payroll Readiness</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[72px]">Select</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Clearance Status</TableHead>
                        <TableHead>Asset Return Status</TableHead>
                        <TableHead>Hold Reason</TableHead>
                        <TableHead>Final Pay Status</TableHead>
                        <TableHead>Finance Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollRows.map((row) => (
                        <TableRow
                          key={row.caseId}
                          className={cn("cursor-pointer", selectedPayrollCaseId === row.caseId && "bg-accent/40")}
                          onClick={() => setSelectedPayrollCaseId(row.caseId)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedPayrollCaseId === row.caseId}
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                              onChange={() => setSelectedPayrollCaseId(row.caseId)}
                              className="h-4 w-4 rounded border-input"
                              aria-label={`Select ${row.employeeName}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <button
                              type="button"
                              className="text-left text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleSelectCase(row.caseId, "cases");
                              }}
                            >
                              {row.employeeName}
                            </button>
                          </TableCell>
                          <TableCell>{formatLongDate(row.effectiveDate)}</TableCell>
                          <TableCell>{renderBadge(row.clearanceStatus, statusBadgeTone(row.clearanceStatus === "Completed" ? "Completed" : "Pending"))}</TableCell>
                          <TableCell>{renderBadge(row.assetReturnStatus, statusBadgeTone(row.assetReturnStatus === "Completed" ? "Completed" : "In Progress"))}</TableCell>
                          <TableCell>{row.holdReason}</TableCell>
                          <TableCell>{renderBadge(row.finalPayStatus)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.financeRemarks}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>HR Staff Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-[#d7e1f1] bg-[#f8fbff] px-4 py-3 text-sm text-[#38507b]">
                    Selected employee: <span className="font-medium text-[#1f3566]">{selectedPayrollRow?.employeeName ?? "None selected"}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button variant="outline" onClick={handleViewReadiness}>
                    View Readiness
                  </Button>
                  <Button variant="outline" onClick={handleOpenPayrollRemarks}>
                    Add / Update HR Remarks
                  </Button>
                  <Button variant="outline" onClick={handleFinanceReviewFlag}>
                    Flag for Finance Review
                  </Button>
                  <Button variant="outline" onClick={handleFollowUpMissingRequirements}>
                    Follow Up Missing Requirements
                  </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}

      {view === "admin" && (
        <Tabs value={adminTab} onValueChange={(value) => setAdminTab(value as HrAdminTab)} className="space-y-5">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-[#d7e1f1] bg-transparent p-0">
            {[
              ["overview", "Overview"],
              ["cases", "Offboarding Cases"],
              ["clearance", "Clearance Tracking"],
              ["approvals", "Approvals"],
              ["assets", "Assets & Access"],
              ["payroll", "Payroll Readiness"],
              ["audit", "Audit Trail"],
              ["reports", "Reports"],
              ["settings", "Settings"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="rounded-none border-b-2 border-transparent px-3 py-3 text-[15px] font-medium text-[#4d648f] data-[state=active]:border-[#1f3566] data-[state=active]:bg-transparent data-[state=active]:text-[#1f3566] data-[state=active]:shadow-none after:hidden"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <OpsStatCard icon={FolderClock} title="Total Cases" value={cases.length} caption="All offboarding records" />
              <OpsStatCard icon={ClipboardList} title="In Progress" value={summary.inProgress} caption="Live cases under coordination" />
              <OpsStatCard icon={CheckCircle2} title="Pending Approvals" value={approvalQueue.length} caption="Awaiting HR Admin action" />
              <OpsStatCard icon={AlertTriangle} title="Pending Clearance" value={summary.pendingClearance} caption="Checklist items still open" />
              <OpsStatCard icon={Landmark} title="Ready for Payroll" value={summary.readyForPayroll} caption="Eligible for finance endorsement" />
              <OpsStatCard icon={CalendarClock} title="Overdue Tasks" value={summary.overdueTasks} caption="Needs immediate intervention" />
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle>Critical Alerts</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Alert</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminEscalationRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">No critical alerts.</TableCell>
                        </TableRow>
                      ) : (
                        adminEscalationRows.map((row, index) => (
                          <TableRow key={`${row.caseId}-${row.action}-${index}`}>
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.departmentName}</TableCell>
                            <TableCell>{renderBadge(row.status)}</TableCell>
                            <TableCell>{row.action}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Button variant="outline" onClick={() => setStartDialogOpen(true)}>Initiate Offboarding</Button>
                  <Button variant="outline" onClick={() => setAdminTab("cases")}>View All Cases</Button>
                  <Button variant="outline" onClick={() => setAdminTab("clearance")}>Resolve Blocked Cases</Button>
                  <Button variant="outline" onClick={() => setAdminTab("payroll")}>Oversee Payroll Readiness</Button>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Separations</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Effective Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingSeparations.slice(0, 6).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                          <TableCell>{row.departmentName}</TableCell>
                          <TableCell>{formatLongDate(row.lastDay)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Escalation Panel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {adminEscalationRows.slice(0, 4).map((row) => (
                    <div key={`${row.caseId}-${row.action}`} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{row.employeeName}</p>
                          <p className="text-sm text-muted-foreground">{row.action}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleAdminApproveEscalation(cases.find((item) => item.id === row.caseId) ?? cases[0])}>
                          Intervene
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cases" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Offboarding Cases</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Input value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} placeholder="Search employee" />
                  <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="all">All departments</option>
                    {caseFilters.departments.map((row) => <option key={row} value={row}>{row}</option>)}
                  </select>
                  <select value={exitTypeFilter} onChange={(event) => setExitTypeFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="all">All exit types</option>
                    {caseFilters.exitTypes.map((row) => <option key={row} value={row}>{row}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="all">All statuses</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Pending Clearance">Pending Clearance</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Final Review">Final Review</option>
                    <option value="Blocked">Blocked</option>
                    <option value="Completed">Completed</option>
                  </select>
                  <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
                    <input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />
                    Overdue / Blocked
                  </label>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Exit Type</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Employment</TableHead>
                      <TableHead>Offboarding</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Assigned HR Staff</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCases.map((row) => (
                      <TableRow key={row.id} className={cn("cursor-pointer", selectedCaseId === row.id && "bg-accent/40")} onClick={() => setSelectedCaseId(row.id)}>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>{row.departmentName}</TableCell>
                        <TableCell>{row.departmentName} Specialist</TableCell>
                        <TableCell>{row.exitType}</TableCell>
                        <TableCell>{formatLongDate(row.lastDay)}</TableCell>
                        <TableCell>{renderBadge(getEmploymentLabel(row))}</TableCell>
                        <TableCell>{renderBadge(getLifecycleLabel(row), statusBadgeTone(row.status))}</TableCell>
                        <TableCell>{row.progress}%</TableCell>
                        <TableCell>Kath Domingo</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                            <Button size="sm" variant="outline" onClick={() => handleViewCase(row)}>View Case</Button>
                            <Button size="sm" variant="outline" onClick={() => handleOpenEditCase(row)}>Edit Case</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminReassignHrStaff(row)}>Reassign HR Staff</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminOverrideStatus(row)}>Override Status</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminRestartOrCancel(row)}>{row.status === "Completed" ? "Restart" : "Cancel"}</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminApproveEscalation(row)}>Approve Escalation</Button>
                            <Button size="sm" variant="outline" onClick={() => handleFollowUp(row)}>Send Reminder</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clearance" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              <OpsStatCard icon={ClipboardList} title="Total Tasks" value={clearanceRows.length} caption="Tracked checklist items" />
              <OpsStatCard icon={CheckCircle2} title="Completed" value={clearanceRows.filter((row) => row.status === "Completed").length} caption="Resolved checklist tasks" />
              <OpsStatCard icon={CalendarClock} title="Pending" value={clearanceRows.filter((row) => row.status === "Pending" || row.status === "In Progress").length} caption="Awaiting action" />
              <OpsStatCard icon={AlertTriangle} title="Overdue / Blocked" value={clearanceRows.filter((row) => row.status === "Overdue" || row.status === "Blocked").length} caption="Needs escalation" />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Checklist Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClearanceRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.taskName}</TableCell>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>{row.owner}</TableCell>
                        <TableCell>{row.department}</TableCell>
                        <TableCell>{formatLongDate(row.dueDate)}</TableCell>
                        <TableCell>{renderBadge(row.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.remarks}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleReviewRoleResponsibilities()}>Assign / Reassign</Button>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateDueDate()}>Edit Due Date</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminOverrideChecklistTask(row)}>Mark Complete</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAddRemarks()}>Add Remarks</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminApproveEscalation(cases.find((item) => item.id === row.caseId) ?? cases[0])}>Escalate</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approvals" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Approval Queue</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Request Type</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Submitted Date</TableHead>
                      <TableHead>Requested By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalQueue.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>Offboarding Request</TableCell>
                        <TableCell>{renderBadge(getCurrentStage(row))}</TableCell>
                        <TableCell>{formatLongDate(row.lastDay)}</TableCell>
                        <TableCell>Kath Domingo</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => handleApprove(row.id)}>Approve</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminOpenApprovalComment(row.id, "revision")}>Request Revision</Button>
                            <Button size="sm" variant="outline" onClick={() => handleAdminOpenApprovalComment(row.id, "approve")}>Add Comment</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleAdminOpenApprovalComment(row.id, "reject")}>Reject</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Approval History</CardTitle></CardHeader>
              <CardContent>
                <ApprovalStatus items={DEMO_OFFBOARDING_APPROVALS} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assets" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Asset Return</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Asset</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verified By</TableHead>
                        <TableHead>Date Returned</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assetRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                          <TableCell>{row.asset}</TableCell>
                          <TableCell>{renderBadge(row.returnStatus, statusBadgeTone(row.returnStatus === "Returned" ? "Completed" : "Pending"))}</TableCell>
                          <TableCell>{row.verifiedBy}</TableCell>
                          <TableCell>{row.dateReturned === "-" ? "-" : formatLongDate(row.dateReturned)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleAdminFollowUpAssetRow(row.employeeName, row.caseId, row.asset)}>Follow Up</Button>
                              <Button size="sm" variant="outline" onClick={() => handleAdminFlagAssetIncomplete(row.employeeName, row.caseId, row.asset)}>Flag Incomplete</Button>
                              <Button size="sm" variant="outline" onClick={() => handleAdminOverrideVerification(row.employeeName, row.caseId, row.asset)}>Override</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Access Removal</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>System Name</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Responsible Team</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Disabled Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accessRows.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.account}</TableCell>
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                          <TableCell>{row.responsibleTeam}</TableCell>
                          <TableCell>{renderBadge(row.status, statusBadgeTone(row.status === "Disabled" ? "Completed" : row.status === "Still Active" ? "Overdue" : "Pending"))}</TableCell>
                          <TableCell>{row.dateDisabled === "-" ? "-" : formatLongDate(row.dateDisabled)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleAdminFollowUpAssetRow(row.employeeName, row.caseId, row.account)}>Follow Up</Button>
                              <Button size="sm" variant="outline" onClick={() => handleAdminFlagAssetIncomplete(row.employeeName, row.caseId, row.account)}>Flag Incomplete</Button>
                              <Button size="sm" variant="outline" onClick={() => handleAdminOverrideVerification(row.employeeName, row.caseId, row.account)}>Override</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle>HR Admin Actions</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Button variant="outline" onClick={handleMonitorAssets}>Follow Up</Button>
                <Button variant="outline" onClick={handleFollowUpResponsibleTeam}>Flag Incomplete</Button>
                <Button variant="outline" onClick={handleMarkCoordinationStatus}>Override Verification</Button>
                <Button variant="outline" onClick={() => setItDialogOpen(true)}>Request IT Action</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <OpsStatCard icon={Landmark} title="Ready for Payroll" value={payrollRows.filter((row) => row.finalPayStatus === "Ready for Payroll").length} caption="Ready for finance handoff" />
              <OpsStatCard icon={AlertTriangle} title="On Hold" value={payrollRows.filter((row) => row.finalPayStatus === "On Hold").length} caption="Blocked from final pay processing" />
              <OpsStatCard icon={ClipboardList} title="Pending Clearance" value={payrollRows.filter((row) => row.finalPayStatus === "Pending Clearance").length} caption="Still waiting on requirements" />
            </div>
            <Card>
              <CardHeader><CardTitle>Payroll Readiness</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Select</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Effective Date</TableHead>
                      <TableHead>Clearance Status</TableHead>
                      <TableHead>Asset Status</TableHead>
                      <TableHead>Hold Reason</TableHead>
                      <TableHead>Final Pay Status</TableHead>
                      <TableHead>Finance Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrollRows.map((row) => (
                      <TableRow key={row.caseId} className={cn("cursor-pointer", selectedPayrollCaseId === row.caseId && "bg-accent/40")} onClick={() => setSelectedPayrollCaseId(row.caseId)}>
                        <TableCell><input type="checkbox" checked={selectedPayrollCaseId === row.caseId} onClick={(event) => event.stopPropagation()} onChange={() => setSelectedPayrollCaseId(row.caseId)} className="h-4 w-4 rounded border-input" /></TableCell>
                        <TableCell className="font-medium">{row.employeeName}</TableCell>
                        <TableCell>{formatLongDate(row.effectiveDate)}</TableCell>
                        <TableCell>{renderBadge(row.clearanceStatus, statusBadgeTone(row.clearanceStatus === "Completed" ? "Completed" : "Pending"))}</TableCell>
                        <TableCell>{renderBadge(row.assetReturnStatus, statusBadgeTone(row.assetReturnStatus === "Completed" ? "Completed" : "In Progress"))}</TableCell>
                        <TableCell>{row.holdReason}</TableCell>
                        <TableCell>{renderBadge(row.finalPayStatus)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.financeRemarks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>HR Admin Actions</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-[#d7e1f1] bg-[#f8fbff] px-4 py-3 text-sm text-[#38507b]">
                  Selected employee: <span className="font-medium text-[#1f3566]">{selectedPayrollRow?.employeeName ?? "None selected"}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button variant="outline" onClick={handleOpenPayrollRemarks}>Update HR Remarks</Button>
                  <Button variant="outline" onClick={handleFinanceReviewFlag}>Flag Issues</Button>
                  <Button variant="outline" onClick={handleAdminReleasePayrollHold}>Release / Review Hold</Button>
                  <Button variant="outline" onClick={handleAdminSendToFinance}>Send to Finance</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Audit Trail</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <select value={auditActorFilter} onChange={(event) => setAuditActorFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="all">All actors</option>
                    {auditActorOptions.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
                  </select>
                  <select value={auditCaseFilter} onChange={(event) => setAuditCaseFilter(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                    <option value="all">All cases</option>
                    {cases.map((row) => <option key={row.id} value={row.id}>{row.employeeName}</option>)}
                  </select>
                  <Input type="date" value={auditDateFilter} onChange={(event) => setAuditDateFilter(event.target.value)} />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Old Value</TableHead>
                      <TableHead>New Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAuditRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="tabular-nums text-muted-foreground">{row.when}</TableCell>
                        <TableCell>{row.actor}</TableCell>
                        <TableCell className="font-medium">{row.action}</TableCell>
                        <TableCell>{row.target}</TableCell>
                        <TableCell className="text-muted-foreground">-</TableCell>
                        <TableCell className="text-muted-foreground">Captured in action log</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <SummaryCard icon={FolderClock} label="Avg Completion" value={`${reportMetrics.averageCompletion}%`} caption="Average case progress" />
              <SummaryCard icon={AlertTriangle} label="Overdue Rate" value={`${reportMetrics.overdueRate}%`} caption="Cases past due" />
              <SummaryCard icon={Landmark} label="Payroll Delays" value={reportMetrics.payrollDelayCount} caption="Not payroll-ready" />
              <SummaryCard icon={ClipboardList} label="Asset Return Rate" value={`${reportMetrics.assetReturnRate}%`} caption="Returned assets ratio" />
              <SummaryCard icon={UserMinus} label="Resignations" value={reportMetrics.resignationCount} caption="Voluntary exits" />
              <SummaryCard icon={AlertTriangle} label="Terminations" value={reportMetrics.terminationCount} caption="Involuntary exits" />
            </div>
            <Card>
              <CardHeader><CardTitle>Offboarding by Department</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {reportMetrics.byDepartment.map(([department, count]) => (
                  <div key={department} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">{department}</p>
                    <p className="mt-2 text-2xl font-semibold">{count}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Trend Notes</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Track resignation versus termination trends for BRD reporting.</div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Review departments with repeated overdue tasks and payroll blockers.</div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Use audit and approval history to monitor bottlenecks over time.</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Workflow Settings</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-checklist-template">Checklist Template</Label>
                  <select id="admin-checklist-template" value={adminSettings.checklistTemplate} onChange={(event) => setAdminSettings((prev) => ({ ...prev, checklistTemplate: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option>Standard Corporate</option>
                    <option>Engineering Exit</option>
                    <option>Leadership Exit</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-approval-flow">Approval Flow</Label>
                  <select id="admin-approval-flow" value={adminSettings.approvalFlow} onChange={(event) => setAdminSettings((prev) => ({ ...prev, approvalFlow: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option>Manager -&gt; HR Manager</option>
                    <option>Manager -&gt; HR Admin -&gt; HR Manager</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-default-owner">Default HR Owner</Label>
                  <Input id="admin-default-owner" value={adminSettings.defaultHrOwner} onChange={(event) => setAdminSettings((prev) => ({ ...prev, defaultHrOwner: event.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-escalation-rule">Escalation Rule</Label>
                  <select id="admin-escalation-rule" value={adminSettings.escalationRule} onChange={(event) => setAdminSettings((prev) => ({ ...prev, escalationRule: event.target.value }))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option>Escalate after 2 overdue days</option>
                    <option>Escalate immediately on blocked status</option>
                    <option>Escalate after effective date passes</option>
                  </select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Settings Summary</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Checklist Templates: {adminSettings.checklistTemplate}</div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Approval Flow: {adminSettings.approvalFlow}</div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Default Owner: {adminSettings.defaultHrOwner}</div>
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm">Escalation: {adminSettings.escalationRule}</div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button onClick={handleAdminSaveSettings}>Save Settings</Button>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {view === "approvals" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Pending Approvals</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Current Stage</TableHead>
                      <TableHead>Effective Separation Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvalQueue.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground">
                          No pending approvals.
                        </TableCell>
                      </TableRow>
                    ) : (
                      approvalQueue.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.employeeName}</TableCell>
                          <TableCell>{row.departmentName}</TableCell>
                          <TableCell>{renderBadge(getCurrentStage(row))}</TableCell>
                          <TableCell>{formatLongDate(row.lastDay)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" onClick={() => handleApprove(row.id)}>
                                Approve
                              </Button>
                              <Button size="sm" variant="outline">
                                Revise
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReject(row.id)}>
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            {selectedCase ? <ProgressTracker steps={progressSteps} /> : null}
            <ApprovalStatus items={DEMO_OFFBOARDING_APPROVALS} />
          </aside>
        </div>
      )}

      {view === "audit" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Audit Trail</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="tabular-nums text-muted-foreground">{row.when}</TableCell>
                        <TableCell>{row.actor}</TableCell>
                        <TableCell className="font-medium">{row.action}</TableCell>
                        <TableCell>{row.target}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Audit Filters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Suggested filters: date range, actor, action type.</p>
                <p>Records remain available for compliance review.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      {view === "analytics" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="space-y-6 lg:col-span-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard icon={FolderClock} label="Tracked Cases" value={cases.length} caption="All visible offboarding cases" />
              <SummaryCard icon={CalendarClock} label="Awaiting Approval" value={approvalQueue.length} caption="Manager sign-off still pending" />
              <SummaryCard icon={AlertTriangle} label="Blocked Cases" value={summary.blocked} caption="Requires executive attention" />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Progress by Department</CardTitle>
              </CardHeader>
              <CardContent>
                <DepartmentProgress items={DEMO_OFFBOARDING_DEPT_SUMMARY} />
              </CardContent>
            </Card>
          </section>

          <aside className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Executive Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>Focus on future-dated volume, blocked cases, and payroll delays.</p>
                <p>Historical records remain available for authorized review.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}

      <Dialog open={viewCaseDialogOpen} onOpenChange={setViewCaseDialogOpen}>
        <DialogContent className="sm:max-w-[980px]">
          <DialogHeader>
            <DialogTitle>Case Detail</DialogTitle>
            <DialogDescription>
              Review the selected offboarding case without leaving the case list.
            </DialogDescription>
          </DialogHeader>

          {selectedCase ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2 space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Employee Info</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Name</span>
                        <span className="text-left font-medium text-foreground">{selectedCase.employeeName}</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Position</span>
                        <span className="text-left text-foreground">{selectedCase.departmentName} Specialist</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Department</span>
                        <span className="text-left text-foreground">{selectedCase.departmentName}</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Manager</span>
                        <span className="text-left text-foreground">Department Manager</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Last Working Day</span>
                        <span className="text-left text-foreground">{formatLongDate(selectedCase.lastDay)}</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Exit Type</span>
                        <span className="text-left text-foreground">{selectedCase.exitType}</span>
                      </div>
                      <div className="grid grid-cols-[160px_minmax(0,1fr)] gap-4">
                        <span className="text-muted-foreground">Reason</span>
                        <span className="text-left text-foreground">{selectedCase.exitType} processing</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status Summary</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Employment Status</span>
                        <span>{renderBadge(getEmploymentLabel(selectedCase))}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Offboarding Status</span>
                        <span>{renderBadge(getLifecycleLabel(selectedCase), statusBadgeTone(selectedCase.status))}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Effective Date</span>
                        <span>{formatLongDate(selectedCase.lastDay)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Overall Progress</span>
                        <span>{selectedCase.progress}%</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Current Stage</span>
                        <span>{getCurrentStage(selectedCase)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    "HR Initiation",
                    "Manager Review",
                    "Clearance",
                    "Asset Return",
                    "Final Review",
                    "Completed",
                  ].map((label, index) => {
                    const mappedCurrent = Math.min(6, Math.max(1, selectedCase.currentStep - 1));
                    const state =
                      selectedCase.status === "Completed" || index + 1 < mappedCurrent
                        ? "Completed"
                        : index + 1 === mappedCurrent
                          ? selectedCase.status === "Blocked"
                            ? "Blocked"
                            : "In Progress"
                          : "Pending";
                    return (
                      <div key={label} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                        <p className="text-sm font-medium">{label}</p>
                        <div className="mt-2">{renderBadge(state)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Button className="w-full justify-start" variant="outline" onClick={() => handleFollowUp(selectedCase)}>
                  Send Follow-up
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => { setViewCaseDialogOpen(false); setHrTab("assets"); }}>
                  Monitor Assets &amp; Access
                </Button>
                <Button className="w-full justify-start" variant="outline" onClick={() => { setViewCaseDialogOpen(false); setHrTab("payroll"); }}>
                  Check Payroll Readiness
                </Button>
                <Button className="w-full justify-start" onClick={() => { setViewCaseDialogOpen(false); setEditDialogOpen(true); }}>
                  Edit Case
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={payrollReadinessDialogOpen} onOpenChange={setPayrollReadinessDialogOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Payroll Readiness Detail</DialogTitle>
            <DialogDescription>
              Review final pay readiness, blockers, and HR remarks for {selectedPayrollRow?.employeeName ?? "the selected case"}.
            </DialogDescription>
          </DialogHeader>

          {selectedPayrollRow ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Employee</p>
                  <p className="mt-2 text-sm font-medium">{selectedPayrollRow.employeeName}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Effective Date</p>
                  <p className="mt-2 text-sm font-medium">{formatLongDate(selectedPayrollRow.effectiveDate)}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clearance</p>
                  <div className="mt-2">{renderBadge(selectedPayrollRow.clearanceStatus, statusBadgeTone(selectedPayrollRow.clearanceStatus === "Completed" ? "Completed" : "Pending"))}</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
                  <div className="mt-2">{renderBadge(selectedPayrollRow.assetReturnStatus, statusBadgeTone(selectedPayrollRow.assetReturnStatus === "Completed" ? "Completed" : "In Progress"))}</div>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Final Pay</p>
                  <div className="mt-2">{renderBadge(selectedPayrollRow.finalPayStatus)}</div>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hold Reason</p>
                <p className="mt-2 text-sm">{selectedPayrollRow.holdReason}</p>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">HR Remarks</p>
                <p className="mt-2 text-sm">{selectedPayrollRow.financeRemarks}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={payrollRemarksDialogOpen} onOpenChange={setPayrollRemarksDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Update Payroll Remarks</DialogTitle>
            <DialogDescription>
              Save HR notes for payroll processing readiness on {selectedPayrollRow?.employeeName ?? "the selected case"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              Final pay status: {selectedPayrollRow ? selectedPayrollRow.finalPayStatus : "-"}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payroll-remarks">Remarks</Label>
              <textarea
                id="payroll-remarks"
                value={payrollRemarksDraft}
                onChange={(event) => setPayrollRemarksDraft(event.target.value)}
                placeholder="Add payroll notes, endorsements, or pending clarifications."
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayrollRemarksDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePayrollRemarks}>Save Remarks</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={financeReviewDialogOpen} onOpenChange={setFinanceReviewDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Flag for Finance Review</DialogTitle>
            <DialogDescription>
              Mark this case for HR Admin payroll review and record the reason for escalation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              Target case: {selectedPayrollRow?.employeeName ?? "No case selected"}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="finance-review-reason">Review Reason</Label>
              <textarea
                id="finance-review-reason"
                value={financeReviewReason}
                onChange={(event) => setFinanceReviewReason(event.target.value)}
                placeholder="Explain why payroll review is needed."
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFinanceReviewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFinanceReviewFlag}>Flag Case</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={missingRequirementsDialogOpen} onOpenChange={setMissingRequirementsDialogOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Follow Up Missing Requirements</DialogTitle>
            <DialogDescription>
              Review payroll blockers and log the follow-up sent for {selectedPayrollRow?.employeeName ?? "the selected case"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Outstanding Items</p>
              <div className="mt-3 space-y-2 text-sm">
                {getMissingPayrollRequirements(cases.find((row) => row.id === selectedPayrollCaseId) ?? selectedCase).length === 0 ? (
                  <p>No missing requirements detected. This case is ready for payroll review.</p>
                ) : (
                  getMissingPayrollRequirements(cases.find((row) => row.id === selectedPayrollCaseId) ?? selectedCase).map((item) => (
                    <div key={item} className="rounded-md border border-border/60 bg-background px-3 py-2">
                      {item}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="missing-requirements-note">Follow-up Note</Label>
              <textarea
                id="missing-requirements-note"
                value={missingRequirementsNote}
                onChange={(event) => setMissingRequirementsNote(event.target.value)}
                placeholder="Add the note or message you sent to the responsible role."
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingRequirementsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendMissingRequirementsFollowUp}>Log Follow-up</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalCommentOpen} onOpenChange={setApprovalCommentOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>
              {approvalCommentMode === "revision"
                ? "Request Revision"
                : approvalCommentMode === "approve"
                  ? "Approval Comment"
                  : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              Add the HR Admin note for this approval action.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
              Target case: {cases.find((row) => row.id === approvalTargetCaseId)?.employeeName ?? "No case selected"}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approval-comment">Comment</Label>
              <textarea
                id="approval-comment"
                value={approvalCommentDraft}
                onChange={(event) => setApprovalCommentDraft(event.target.value)}
                placeholder="Add rationale or revision notes."
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setApprovalCommentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdminSubmitApprovalComment}>Save Comment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit Offboarding Case</DialogTitle>
            <DialogDescription>
              Update the selected case details for HR Staff coordination.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                {selectedCase?.employeeName ?? "No case selected"}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-exit-type">Exit Type</Label>
              <select
                id="edit-exit-type"
                value={editExitType}
                onChange={(event) => setEditExitType(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="Resignation">Resignation</option>
                <option value="Termination">Termination</option>
                <option value="End of Contract">End of Contract</option>
                <option value="Retirement">Retirement</option>
                <option value="Redundancy">Redundancy</option>
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-last-day">Effective Separation Date</Label>
                <Input
                  id="edit-last-day"
                  type="date"
                  value={editLastDay}
                  onChange={(event) => setEditLastDay(event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Offboarding Status</Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as OffboardingCaseStatus)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
            </div>

            {editError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {editError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCaseEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itDialogOpen} onOpenChange={setItDialogOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Request IT Account Action</DialogTitle>
            <DialogDescription>
              Notifies the System Admin to disable or delete the employee&apos;s HRIS account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {employeesError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {employeesError}
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="it-search">Employee</Label>
                <Input
                  id="it-search"
                  value={itSearch}
                  onChange={(event) => setItSearch(event.target.value)}
                  placeholder="Search name, email, employee #"
                />
                <div className="max-h-56 overflow-auto rounded-md border border-border bg-background">
                  {employeesLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading...</div>
                  ) : itFiltered.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No matches.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {itFiltered.map((row) => {
                        const selected = itSelected?.id === row.id;
                        const name = `${row.firstName} ${row.lastName}`.trim() || row.email;
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => setItSelected(row)}
                            className={cn(
                              "w-full px-3 py-2 text-left transition-colors hover:bg-accent/60",
                              selected && "bg-accent/70"
                            )}
                          >
                            <div className="text-sm font-medium text-foreground">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.email || "-"} - {row.employeeNumber || "-"}
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
                    onChange={(event) => setItAction(event.target.value as "DISABLE_ACCESS" | "DELETE_ACCOUNT")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="DISABLE_ACCESS">Disable access</option>
                    <option value="DELETE_ACCOUNT">Delete account</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="it-reason">Reason</Label>
                  <Input
                    id="it-reason"
                    value={itReason}
                    onChange={(event) => setItReason(event.target.value)}
                    placeholder="e.g., Resignation, last day 2026-04-30"
                  />
                </div>

                {itSubmitError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {itSubmitError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setItDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitItRequest} disabled={employeesLoading}>
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Initiate Offboarding</DialogTitle>
            <DialogDescription>
              Create a new offboarding case. This routes to manager approval, then clearance and payroll readiness tracking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {employeesError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {employeesError}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start-search">Employee</Label>
                <Input
                  id="start-search"
                  value={startSearch}
                  onChange={(event) => setStartSearch(event.target.value)}
                  placeholder="Search name, email, employee #"
                />
                <div className="max-h-56 overflow-auto rounded-md border border-border bg-background">
                  {employeesLoading ? (
                    <div className="p-3 text-sm text-muted-foreground">Loading...</div>
                  ) : startFiltered.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground">No matches.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {startFiltered.map((row) => {
                        const selected = startSelected?.id === row.id;
                        const name = `${row.firstName} ${row.lastName}`.trim() || row.email;
                        return (
                          <button
                            key={row.id}
                            type="button"
                            onClick={() => setStartSelected(row)}
                            className={cn(
                              "w-full px-3 py-2 text-left transition-colors hover:bg-accent/60",
                              selected && "bg-accent/70"
                            )}
                          >
                            <div className="text-sm font-medium text-foreground">{name}</div>
                            <div className="text-xs text-muted-foreground">
                              {row.email || "-"} - {row.employeeNumber || "-"}
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
                  <Label htmlFor="start-exit">Exit Type</Label>
                  <select
                    id="start-exit"
                    value={startExitType}
                    onChange={(event) => setStartExitType(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="Resignation">Resignation</option>
                    <option value="Termination">Termination</option>
                    <option value="End of Contract">End of Contract</option>
                    <option value="Retirement">Retirement</option>
                    <option value="Redundancy">Redundancy</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="start-lastday">Last Day</Label>
                  <Input
                    id="start-lastday"
                    type="date"
                    value={startLastDay}
                    onChange={(event) => setStartLastDay(event.target.value)}
                  />
                </div>

                {startError ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                    {startError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStartDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitStartOffboarding} disabled={employeesLoading}>
              Create Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
