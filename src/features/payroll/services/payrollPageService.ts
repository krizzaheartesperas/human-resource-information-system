import type { LucideIcon } from "lucide-react";
import {
  FileText,
  History,
  LayoutDashboard,
  Plug,
  ScrollText,
  Settings,
  Upload,
} from "lucide-react";
import type { ExportStep } from "@/features/payroll/components/PayrollExportWizard";
import type { PayrollExportRun } from "@/features/payroll/services/payrollExportRuns";
import type { Role } from "@/lib/mock";

export type MainTab =
  | "overview"
  | "payslips"
  | "export"
  | "history"
  | "activity"
  | "config"
  | "integration";

export const MAIN_TABS: { id: MainTab; label: string; icon: LucideIcon; roles?: Role[] }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  {
    id: "payslips",
    label: "Payslips",
    icon: FileText,
    roles: ["EMPLOYEE", "HR_ADMIN", "HR_STAFF", "HR_MANAGER", "DEPARTMENT_MANAGER", "SUPER_ADMIN"],
  },
  {
    id: "export",
    label: "Payroll Export",
    icon: Upload,
    roles: ["HR_ADMIN", "HR_STAFF", "HR_MANAGER", "SUPER_ADMIN", "DEPARTMENT_MANAGER"],
  },
  { id: "history", label: "Payroll History", icon: History },
  {
    id: "activity",
    label: "Payroll Activity Logs",
    icon: ScrollText,
    roles: ["EMPLOYEE", "HR_ADMIN", "HR_STAFF", "HR_MANAGER", "SUPER_ADMIN", "DEPARTMENT_MANAGER"],
  },
  {
    id: "config",
    label: "Configuration",
    icon: Settings,
    roles: ["HR_ADMIN", "HR_MANAGER", "SUPER_ADMIN"],
  },
  {
    id: "integration",
    label: "Integration Settings",
    icon: Plug,
    roles: ["SUPER_ADMIN"],
  },
];

const EXPORT_STEPS: ExportStep[] = ["prepare", "validate", "preview", "generate", "results"];
const SEEDED_ROLES: Role[] = ["HR_STAFF", "HR_ADMIN", "HR_MANAGER", "DEPARTMENT_MANAGER", "SUPER_ADMIN"];

export function canSeeTab(tab: MainTab, role: Role): boolean {
  const def = MAIN_TABS.find((t) => t.id === tab);
  if (!def?.roles?.length) return true;
  return def.roles.includes(role);
}

export function parseMainTab(raw: string | null): MainTab {
  const v = raw as MainTab;
  if (
    v === "overview" ||
    v === "payslips" ||
    v === "export" ||
    v === "history" ||
    v === "activity" ||
    v === "config" ||
    v === "integration"
  )
    return v;
  return "overview";
}

export function parseExportStep(raw: string | null): ExportStep {
  const v = raw as ExportStep;
  if (EXPORT_STEPS.includes(v)) return v;
  return "prepare";
}

export function roleMockRuns(role: Role, generatedBy: string, generatedById: string): PayrollExportRun[] {
  const now = Date.now();
  type Approval = NonNullable<PayrollExportRun["approvalStatus"]>;
  return [
    {
      id: "RUN-ROLE-001",
      periodLabel: "March 2026 · 1st half (1-15)",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-15",
      generatedBy,
      generatedById,
      mappingVersion: role === "HR_ADMIN" ? "MAP-v2.0" : "MAP-v1.1",
      status: "SUCCESS",
      format: "Excel",
      template: role === "HR_ADMIN" ? "Compliance Payroll Export" : "Default PH Payroll",
      employeeCount: role === "HR_MANAGER" ? 48 : role === "DEPARTMENT_MANAGER" ? 7 : 42,
      approvalStatus: (
        role === "HR_MANAGER" ? "Approved" : role === "DEPARTMENT_MANAGER" ? "Exported" : "Pending Approval"
      ) as Approval,
      approvedBy: role === "HR_MANAGER" ? generatedBy : "HR Manager",
      approvedById: role === "HR_MANAGER" ? generatedById : "emp-hrm-1",
      approvedAt: new Date(now - 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      errors: [],
    },
    {
      id: "RUN-ROLE-002",
      periodLabel: "February 2026 · 2nd half (16-28)",
      periodStart: "2026-02-16",
      periodEnd: "2026-02-28",
      generatedBy,
      generatedById,
      mappingVersion: "MAP-v1.0",
      status: role === "HR_STAFF" ? "PARTIAL" : "SUCCESS",
      format: "CSV",
      template: "Default PH Payroll",
      employeeCount: role === "DEPARTMENT_MANAGER" ? 6 : 40,
      approvalStatus: (role === "HR_MANAGER" ? "Exported" : "Pending Approval") as Approval,
      exportedAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      errors: role === "HR_STAFF" ? ["2 records with pending overtime approval"] : [],
    },
  ];
}

export function canUseMockRuns(role: Role) {
  return SEEDED_ROLES.includes(role);
}
