import { useMemo } from "react";
import { leaveTypeMetadata, type LeaveRequest, type LeaveStatus, type TimeOffType } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type BalanceRow = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  type: TimeOffType;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  balanceDays: number;
};

type EmployeeBalances = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  rows: BalanceRow[];
};

type Args = {
  balances: BalanceRow[];
  requests: LeaveRequest[];
  currentUser: { employeeId: string; employeeNumber: string; name: string; role: string };
  hrMaxLeaveCreditsPerYear: number;
  deptManagerEmployeeIds: string[];
  isCurrentUsersLeave: (r: LeaveRequest) => boolean;
  statusFilter: LeaveStatus | "ALL";
  mySearchTerm: string;
  staffAllStatusFilter: LeaveStatus | "ALL";
  tab: string;
};

export function useLeaveReports(args: Args) {
  const {
    balances,
    requests,
    currentUser,
    hrMaxLeaveCreditsPerYear,
    deptManagerEmployeeIds,
    isCurrentUsersLeave,
    statusFilter,
    mySearchTerm,
    staffAllStatusFilter,
    tab,
  } = args;

  const myBalanceRows = useMemo(() => {
    const currentEmployeeNumber = (currentUser.employeeNumber ?? "").trim().toUpperCase();
    const rows = balances.filter((b) => {
      if (b.employeeId === currentUser.employeeId) return true;
      const balanceEmployeeNumber = (b.employeeNumber ?? "").trim().toUpperCase();
      return Boolean(currentEmployeeNumber && balanceEmployeeNumber === currentEmployeeNumber);
    });
    const existingByType = new Map(rows.map((r) => [r.type, r]));
    const defaultTotal = (type: TimeOffType) => (type === "UNPAID_LEAVE" ? 0 : hrMaxLeaveCreditsPerYear);

    return (Object.keys(leaveTypeMetadata) as TimeOffType[]).map((type) => {
      const existing = existingByType.get(type);
      const totalDays = existing?.totalDays ?? defaultTotal(type);
      const usedDays = existing?.usedDays ?? 0;
      const pendingDays = existing?.pendingDays ?? 0;
      const balanceDays = existing?.balanceDays ?? Math.max(0, totalDays - usedDays - pendingDays);
      return {
        employeeId: currentUser.employeeId,
        employeeName: currentUser.name,
        employeeNumber: currentUser.employeeNumber,
        type,
        totalDays,
        usedDays,
        pendingDays,
        balanceDays,
      };
    });
  }, [balances, currentUser.employeeId, currentUser.employeeNumber, currentUser.name, hrMaxLeaveCreditsPerYear]);

  const companyBalanceByEmployee = useMemo(() => {
    const map = new Map<string, EmployeeBalances>();
    for (const b of balances) {
      if (!map.has(b.employeeId)) {
        map.set(b.employeeId, {
          employeeId: b.employeeId,
          employeeName: b.employeeName,
          employeeNumber: b.employeeNumber,
          rows: [],
        });
      }
      map.get(b.employeeId)!.rows.push(b);
    }
    return Array.from(map.values());
  }, [balances]);

  const myLeaveReportRequests = useMemo(
    () => requests.filter((r) => isCurrentUsersLeave(r)),
    [requests, isCurrentUsersLeave],
  );

  const companyLeaveReportRequests = useMemo(() => {
    if (currentUser.role === "DEPARTMENT_MANAGER") {
      return requests.filter((r) => deptManagerEmployeeIds.includes(r.employeeId));
    }
    return requests;
  }, [requests, currentUser.role, deptManagerEmployeeIds]);

  const myLeaveReportFiltered = useMemo(() => {
    const base =
      statusFilter === "ALL"
        ? myLeaveReportRequests
        : myLeaveReportRequests.filter((r) => r.status === statusFilter);
    const term = mySearchTerm.trim().toLowerCase();
    if (!term) return base;
    return base.filter((r) => {
      const typeLabel = formatLeaveType(r.type).toLowerCase();
      const reason = r.reason.toLowerCase();
      const status = r.status.replace(/_/g, " ").toLowerCase();
      return (
        typeLabel.includes(term) ||
        reason.includes(term) ||
        status.includes(term) ||
        r.supportingDocName?.toLowerCase().includes(term) ||
        r.employeeNumber.toLowerCase().includes(term)
      );
    });
  }, [myLeaveReportRequests, statusFilter, mySearchTerm]);

  const companyLeaveReportFiltered = useMemo(() => {
    if (statusFilter === "ALL") return companyLeaveReportRequests;
    return companyLeaveReportRequests.filter((r) => r.status === statusFilter);
  }, [companyLeaveReportRequests, statusFilter]);

  const staffAllLeaveRequestsFiltered = useMemo(() => {
    if (staffAllStatusFilter === "ALL") return companyLeaveReportRequests;
    return companyLeaveReportRequests.filter((r) => r.status === staffAllStatusFilter);
  }, [companyLeaveReportRequests, staffAllStatusFilter]);

  const reportRequests = useMemo(
    () => (tab === "my-report" ? myLeaveReportRequests : companyLeaveReportRequests),
    [tab, myLeaveReportRequests, companyLeaveReportRequests],
  );

  return {
    myBalanceRows,
    companyBalanceByEmployee,
    myLeaveReportRequests,
    companyLeaveReportRequests,
    myLeaveReportFiltered,
    companyLeaveReportFiltered,
    staffAllLeaveRequestsFiltered,
    reportRequests,
  };
}
