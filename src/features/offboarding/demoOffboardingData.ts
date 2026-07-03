import type { OffboardingStep } from "@/components/offboarding/ProgressTracker";
import type { OffboardingTask } from "@/components/offboarding/MyTasks";
import type { DepartmentProgressItem } from "@/components/offboarding/DepartmentProgress";
import type { EmployeeAsset } from "@/components/offboarding/AssetReturn";
import type { ApprovalItem } from "@/components/offboarding/ApprovalStatus";
import type { ActivityLogItem } from "@/components/offboarding/ActivityLog";

export const DEMO_OFFBOARDING_EMPLOYEE_INFO = {
  exitType: "Voluntary Resignation",
  lastDay: "April 30, 2026",
  status: "In Progress" as const,
  progress: 10,
};

export const DEMO_OFFBOARDING_URGENT_TASKS = [
  "Action Required: Please return your company laptop before April 28, 2026.",
];

export const DEMO_OFFBOARDING_HR_ALERTS = [
  "Overdue: Clearance form is not generated yet for Isla Dela Cruz (last day April 30, 2026).",
];

export const DEMO_OFFBOARDING_ADMIN_ALERTS = [
  "2 cases are blocked due to pending IT clearance. Review and escalate if needed.",
];

export const DEMO_OFFBOARDING_STEPS: OffboardingStep[] = [
  { id: "1", title: "HR Initiation", responsible: "HR Staff", status: "Completed" },
  { id: "2", title: "Manager Approval", responsible: "Department Manager", status: "Completed" },
  { id: "3", title: "IT Clearance", responsible: "IT Team", status: "Completed" },
  { id: "4", title: "Finance Clearance", responsible: "Finance Team", status: "Completed" },
  { id: "5", title: "Asset Return", responsible: "Employee + IT", status: "Completed" },
  { id: "6", title: "Exit Interview", responsible: "HR Staff", status: "In Progress" },
  { id: "7", title: "Final Approval", responsible: "HR Manager", status: "Pending" },
  { id: "8", title: "Completed", responsible: "System", status: "Pending" },
];

export const DEMO_OFFBOARDING_EMPLOYEE_TASKS: OffboardingTask[] = [
  { id: "task-1", title: "Return Laptop", dueDate: "Apr 28, 2026", status: "In Progress", completed: false },
  { id: "task-2", title: "Submit Exit Interview", dueDate: "Apr 29, 2026", status: "Pending", completed: false },
  { id: "task-3", title: "Return ID Card", dueDate: "Apr 30, 2026", status: "Pending", completed: false },
];

export const DEMO_OFFBOARDING_HR_TASKS: OffboardingTask[] = [
  { id: "hr-1", title: "Generate clearance form", dueDate: "Apr 22, 2026", status: "In Progress", completed: false },
  { id: "hr-2", title: "Schedule exit interview", dueDate: "Apr 23, 2026", status: "Pending", completed: false },
  { id: "hr-3", title: "Prepare final documents", dueDate: "Apr 29, 2026", status: "Pending", completed: false },
];

export const DEMO_OFFBOARDING_DEPT_SUMMARY: DepartmentProgressItem[] = [
  { department: "HR", completed: 1, total: 3 },
  { department: "IT", completed: 0, total: 3 },
  { department: "Finance", completed: 0, total: 3 },
  { department: "Admin", completed: 0, total: 2 },
];

export const DEMO_OFFBOARDING_ASSETS: EmployeeAsset[] = [
  { id: "asset-1", name: "Laptop", status: "Pending" },
  { id: "asset-2", name: "ID Card", status: "Pending" },
];

export const DEMO_OFFBOARDING_APPROVALS: ApprovalItem[] = [
  { role: "HR Manager", status: "Approved" },
  { role: "Department Manager", status: "Approved" },
  { role: "Final Approval", status: "Pending" },
];

export const DEMO_OFFBOARDING_ACTIVITY: ActivityLogItem[] = [
  { id: "log-1", message: "You marked laptop as returned", timestamp: "Apr 24, 2026 • 10:15 AM" },
  { id: "log-2", message: "HR scheduled exit interview", timestamp: "Apr 23, 2026 • 2:30 PM" },
  { id: "log-3", message: "Finance started final pay computation", timestamp: "Apr 22, 2026 • 9:45 AM" },
  { id: "log-4", message: "IT initiated account deactivation checklist", timestamp: "Apr 21, 2026 • 4:10 PM" },
  { id: "log-5", message: "Manager approved resignation workflow", timestamp: "Apr 20, 2026 • 11:05 AM" },
];
