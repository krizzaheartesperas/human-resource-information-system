import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  CreditCard,
  UserMinus,
  BookOpenText,
} from "lucide-react";
import type { Role } from "@/lib/mock";
import type { PortalPaths } from "@/core/routes/portal-routes";

export type SidebarNavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  roles?: Role[];
};

export type SidebarReportNavItem = {
  label: string;
  href: string;
  description: string;
};

export type SidebarNavModel = {
  mainNav: SidebarNavItem[];
  reportNav: SidebarReportNavItem[];
  deptManagerMyLeaveNav: { label: string; href: string; tab: string }[];
  deptManagerTeamLeaveNav: { label: string; href: string; tab: string }[];
  deptManagerWorkflowNav: { label: string; href: string; tab: string | null }[];
  deptManagerOrgNav: { label: string; href: string; tab: string | null }[];
  hrOrgNav: { label: string; href: string; tab: string | null }[];
  hrReportsNav: { label: string; href: string }[];
  workforceAnalyticsNav: { label: string; href: string }[];
  employeeLeaveNav: { label: string; href: string; tab: string }[];
  hrAdminLeaveNav: { label: string; href: string; tab: string }[];
  employeeMyLeaveNav: { label: string; href: string; tab: string }[];
  employeeWorkflowNav: { label: string; href: string; tab: null }[];
  employeeOrgNav: { label: string; href: string; tab: string | null }[];
  employeeComplaintsNav: { label: string; href: string; tab: string }[];
};

const L = (paths: PortalPaths, tab: string) => `${paths.leave}?tab=${tab}`;

export function buildSidebarNav(paths: PortalPaths): SidebarNavModel {
  const mainNav: SidebarNavItem[] = [
    { label: "Dashboard", href: paths.dashboard, icon: LayoutDashboard },
    {
      label: "Employees",
      href: paths.employees,
      icon: Users,
      roles: ["EMPLOYEE", "HR_ADMIN", "HR_STAFF", "MANAGER", "DEPARTMENT_MANAGER"],
    },
    {
      label: "Organization",
      href: paths.organization,
      icon: Building2,
      roles: [
        "EMPLOYEE",
        "HR_ADMIN",
        "HR_STAFF",
        "MANAGER",
        "DEPARTMENT_MANAGER",
        "EXECUTIVE",
        "BOARD",
      ],
    },
    {
      label: "Leave",
      href: paths.leave,
      icon: CalendarDays,
      roles: [
        "EMPLOYEE",
        "HR_ADMIN",
        "HR_MANAGER",
        "HR_STAFF",
        "DEPARTMENT_MANAGER",
        "AUDITOR",
        "EXECUTIVE",
        "BOARD",
      ],
    },
    {
      label: "Payroll",
      href: paths.payroll,
      icon: CreditCard,
      roles: [
        "HR_ADMIN",
        "HR_MANAGER",
        "HR_STAFF",
        "DEPARTMENT_MANAGER",
        "AUDITOR",
        "EXECUTIVE",
        "BOARD",
      ],
    },
    {
      label: "My Offboarding",
      href: paths.offboardingMy,
      icon: UserMinus,
      roles: [
        "EMPLOYEE",
        "HR_ADMIN",
        "HR_MANAGER",
        "HR_STAFF",
        "DEPARTMENT_MANAGER",
        "MANAGER",
        "AUDITOR",
        "EXECUTIVE",
        "BOARD",
        "SUPER_ADMIN",
      ],
    },
    {
      label: "Offboarding",
      href: paths.offboardingApprovals,
      icon: UserMinus,
      roles: [
        "HR_ADMIN",
        "HR_MANAGER",
        "HR_STAFF",
        "DEPARTMENT_MANAGER",
        "MANAGER",
        "AUDITOR",
        "EXECUTIVE",
      ],
    },
    {
      label: "Handbook",
      href: paths.handbook,
      icon: BookOpenText,
      roles: [
        "SUPER_ADMIN",
        "EMPLOYEE",
        "HR_ADMIN",
        "HR_MANAGER",
        "HR_STAFF",
        "DEPARTMENT_MANAGER",
        "MANAGER",
        "AUDITOR",
        "EXECUTIVE",
        "BOARD",
      ],
    },
  ];

  const reportNav: SidebarReportNavItem[] = [
    {
      label: "Attendance",
      href: paths.reportsAttendance,
      description:
        "Daily, weekly, or monthly attendance; clock-in/out, late arrivals, absences",
    },
    {
      label: "Leave",
      href: paths.leave,
      description:
        "Leave management: requests, workflow, balances, approve/reject",
    },
    {
      label: "Workflow Requests",
      href: paths.reportsWorkflow,
      description:
        "Status of requests (CREATED, PENDING, APPROVED, REJECTED) by department or employee",
    },
    {
      label: "Audit Reports",
      href: paths.audit,
      description:
        "User actions: logins, approvals, edits, deletions (Audit Logs)",
    },
  ];

  return {
    mainNav,
    reportNav,
    deptManagerMyLeaveNav: [
      { label: "Apply Leave", href: L(paths, "apply"), tab: "apply" },
      { label: "My Leave Request", href: L(paths, "my-report"), tab: "my-report" },
      { label: "Leave Balance", href: L(paths, "balances"), tab: "balances" },
    ],
    deptManagerTeamLeaveNav: [
      { label: "Pending Approvals", href: L(paths, "dm-pending"), tab: "dm-pending" },
      { label: "Approved Requests", href: L(paths, "dm-approved"), tab: "dm-approved" },
      { label: "Rejected Requests", href: L(paths, "dm-rejected"), tab: "dm-rejected" },
      { label: "Leave Calendar", href: L(paths, "calendar"), tab: "calendar" },
    ],
    deptManagerWorkflowNav: [
      { label: "Workflow requests", href: paths.requests, tab: null },
      { label: "Requests by Status", href: paths.reportsWorkflow, tab: null },
      { label: "To Approve", href: `${paths.requests}?tab=approve`, tab: "approve" },
    ],
    deptManagerOrgNav: [
      { label: "Company Structure", href: `${paths.organization}?tab=diagram`, tab: "diagram" },
      { label: "Departments", href: paths.departments, tab: null },
    ],
    hrOrgNav: [
      { label: "Company Structure", href: `${paths.organization}?tab=diagram`, tab: "diagram" },
      { label: "Departments", href: paths.departments, tab: null },
      {
        label: "Employment Types",
        href: `${paths.organization}?tab=employment-types`,
        tab: "employment-types",
      },
      { label: "Locations", href: `${paths.organization}?tab=locations`, tab: "locations" },
    ],
    hrReportsNav: [
      { label: "Employee List Report", href: `${paths.reportsAttendance}?report=employee-list` },
      { label: "New Hires Report", href: `${paths.reportsAttendance}?report=new-hires` },
      { label: "Employee Status Report", href: `${paths.reportsAttendance}?report=status` },
      { label: "Employee Leave Summary", href: `${paths.reportsAttendance}?report=leave-summary` },
      { label: "Department Leave Summary", href: `${paths.reportsAttendance}?report=dept-leave-summary` },
      { label: "Leave Balance Report", href: `${paths.reportsAttendance}?report=leave-balance` },
      { label: "Workflow Request Report", href: `${paths.reportsWorkflow}?report=workflow-requests` },
    ],
    workforceAnalyticsNav: [
      { label: "Employee Distribution by Department", href: `${paths.reportsWorkforce}?panel=dept-distribution` },
      { label: "Employee Distribution by Position", href: `${paths.reportsWorkforce}?panel=position-distribution` },
      { label: "Leave Usage Trends", href: `${paths.reportsWorkforce}?panel=leave-trends` },
      { label: "Monthly Leave Requests", href: `${paths.reportsWorkforce}?panel=monthly-leave-requests` },
      { label: "Workforce Growth Trend", href: `${paths.reportsWorkforce}?panel=workforce-growth` },
    ],
    employeeLeaveNav: [
      { label: "Apply Leave", href: L(paths, "apply"), tab: "apply" },
      { label: "My Leave Requests", href: L(paths, "my-report"), tab: "my-report" },
      { label: "Leave Balance", href: L(paths, "balances"), tab: "balances" },
      { label: "Company Leave Report", href: L(paths, "company-report"), tab: "company-report" },
      { label: "Employee Balances", href: L(paths, "employee-balances"), tab: "employee-balances" },
    ],
    hrAdminLeaveNav: [
      { label: "My Leave", href: L(paths, "my-report"), tab: "my-report" },
      { label: "Leave Management", href: L(paths, "admin-process"), tab: "admin-process" },
    ],
    employeeMyLeaveNav: [
      { label: "My Leave Requests", href: L(paths, "my-report"), tab: "my-report" },
      { label: "My Leave Balance", href: L(paths, "balances"), tab: "balances" },
      { label: "Leave types", href: L(paths, "reference"), tab: "reference" },
    ],
    employeeWorkflowNav: [{ label: "Workflow requests", href: paths.requests, tab: null }],
    employeeOrgNav: [
      { label: "Company Structure", href: `${paths.organization}?tab=diagram`, tab: "diagram" },
      { label: "Departments", href: paths.departments, tab: null },
    ],
    employeeComplaintsNav: [
      { label: "File Complaint", href: `${paths.complaints}?tab=file`, tab: "file" },
      { label: "My Complaints", href: `${paths.complaints}?tab=my`, tab: "my" },
      { label: "Complaint Status", href: `${paths.complaints}?tab=status`, tab: "status" },
    ],
  };
}
