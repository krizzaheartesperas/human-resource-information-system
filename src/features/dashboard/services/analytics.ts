/**
 * Dashboard chart metrics (mock-backed). Replace with API/Supabase when wired.
 */

import {
  employees,
  departments,
  leaveRequests,
  workflowRequests,
} from "@/lib/mock";
import { loadRequestsFromStorage } from "@/features/workflow/services/workflowRequests";

export function getHeadcountByDepartment() {
  const allEmployees = [...employees];
  return departments.map((dept) => ({
    name: dept.code,
    fullName: dept.name,
    count: allEmployees.filter((e) => e.departmentId === dept.id).length,
  }));
}

export function getWorkflowRequestsByStatus() {
  const requests = loadRequestsFromStorage();
  const use = requests.length > 0 ? requests : workflowRequests;
  const byStatus: Record<string, number> = {};
  for (const r of use) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  }
  return Object.entries(byStatus).map(([name, value]) => ({ name, value }));
}

export function getLeaveRequestsByType() {
  const byType: Record<string, number> = {};
  for (const r of leaveRequests) {
    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }
  return Object.entries(byType).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));
}

export function getEmploymentTypeDistribution() {
  const byType: Record<string, number> = {};
  for (const e of employees) {
    const t = e.employmentType ?? "FULL_TIME";
    byType[t] = (byType[t] ?? 0) + 1;
  }
  return Object.entries(byType).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));
}

export function getLeaveRequestsTrend() {
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const now = new Date();
  const data = months.map((label, i) => {
    const monthOffset = 5 - i;
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const count = leaveRequests.filter((r) => {
      const created = r.createdAt.slice(0, 7);
      return created === monthKey;
    }).length;
    return { month: label, requests: count };
  });
  const total = data.reduce((s, d) => s + d.requests, 0);
  if (total === 0) {
    return months.map((label, i) => ({ month: label, requests: [4, 6, 3, 7, 5, 8][i] ?? 0 }));
  }
  return data;
}

export function getPayrollSummary() {
  const activeCount = employees.filter((e) => e.employmentStatus === "ACTIVE").length;
  const totalPayroll = activeCount * 45000;
  const requests = loadRequestsFromStorage();
  const use = requests.length > 0 ? requests : workflowRequests;
  const pendingAdjustments = use.filter(
    (r) => r.type === "SALARY_CHANGE" && (r.status === "PENDING" || r.status === "CREATED"),
  ).length;
  return {
    totalPayroll,
    employeesPaid: activeCount,
    pendingAdjustments,
  };
}

export function getWorkflowRequestsTrend() {
  const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
  const now = new Date();
  const requests = loadRequestsFromStorage();
  const use = requests.length > 0 ? requests : workflowRequests;
  const data = months.map((label, i) => {
    const monthOffset = 5 - i;
    const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const count = use.filter((r) => {
      const created = r.createdAt.slice(0, 7);
      return created === monthKey;
    }).length;
    return { month: label, requests: count };
  });
  const total = data.reduce((s, d) => s + d.requests, 0);
  if (total === 0) {
    return months.map((label, i) => ({ month: label, requests: [2, 4, 1, 3, 5, 6][i] ?? 0 }));
  }
  return data;
}
