"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { supabase } from "@/lib/supabase/client";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { appendAuditLog, type AuditLogEntry } from "@/features/leave/services/leaveAuditService";
import { generateLeaveRequestId, randomUUID } from "@/lib/utils";
import {
  leaveRequests,
  leaveBalances,
  getEmployeeById,
  getEmployeeIdsUnderDepartmentManager,
  departments,
  employees,
  type LeaveRequest,
  type LeaveStatus,
  type TimeOffType,
} from "@/lib/mock";
import {
  adjustLeaveBalanceInSupabase,
  fetchLeaveBalancesFromSupabase,
  isSupabaseLeaveConfigured,
  pushLeaveRequestsToSupabase,
  seedMissingLeaveBalancesToSupabase,
  upsertLeaveBalanceToSupabase,
} from "@/features/leave/services/leaveSupabaseService";
import type { ExecutiveReportKey } from "@/features/leave/constants/executiveReports";
import type { AuditorReportKey } from "@/features/leave/types/auditorReports";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";
import {
  calculateInclusiveDays,
  toLocalISODate,
  getMonthWindow,
  inWindow,
  overlapDays,
} from "@/features/leave/utils/leaveDates";
import { escapeHtml, downloadCsv } from "@/features/leave/utils/csv";
import { useLeaveReports } from "@/features/leave/hooks/useLeaveReports";
import { useLeaveRouting } from "@/features/leave/hooks/useLeaveRouting";
import { useLeaveData } from "@/features/leave/hooks/useLeaveData";

export type LeavePageViewModel = ReturnType<typeof useLeavePage>;

const departmentManagerApprovedStatuses = new Set<LeaveStatus>([
  "PENDING_FINALIZATION",
  "PENDING_RECORDING",
  "APPROVED",
  "FINAL_APPROVED",
  "APPLIED",
]);

function isDepartmentManagerApprovedStatus(status: LeaveStatus): boolean {
  return departmentManagerApprovedStatuses.has(status);
}

type LeaveBalanceViewRow = typeof leaveBalances[number];

const pendingBalanceStatuses = new Set<LeaveStatus>([
  "APPROVED",
  "PENDING_RECORDING",
  "PENDING_FINALIZATION",
  "PENDING_HR_ADMIN_PROCESSING",
  "PENDING_HR_ADMIN_PROCESSING_HR_MANAGER",
  "PENDING_HR_ADMIN_PROCESSING_EXECUTIVE",
  "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN",
  "PENDING_HR_STAFF_PROCESSING",
  "PENDING_HR_STAFF_PROCESSING_AUDITOR",
  "PENDING_HR_MANAGER_APPROVAL",
  "PENDING_EXECUTIVE_APPROVAL",
  "PENDING_EXECUTIVE_BOARD_APPROVAL",
  "PENDING_APPROVAL",
]);

function shouldReservePendingBalance(status: LeaveStatus): boolean {
  return pendingBalanceStatuses.has(status);
}

function reconcilePendingLeaveBalances(
  requestsToReconcile: LeaveRequest[],
  balancesToReconcile: LeaveBalanceViewRow[]
) {
  const pendingByEmployeeAndType = new Map<string, number>();

  for (const request of requestsToReconcile) {
    if (!shouldReservePendingBalance(request.status)) continue;
    const days = calculateInclusiveDays(request.startDate, request.endDate);
    if (days <= 0) continue;
    const key = `${request.employeeId}:${request.type}`;
    pendingByEmployeeAndType.set(key, (pendingByEmployeeAndType.get(key) ?? 0) + days);
  }

  const changedBalances: LeaveBalanceViewRow[] = [];
  const balances = balancesToReconcile.map((balance) => {
    const key = `${balance.employeeId}:${balance.type}`;
    const pendingDays = pendingByEmployeeAndType.get(key) ?? 0;
    if ((balance.pendingDays ?? 0) === pendingDays) return balance;

    const totalDays = balance.totalDays ?? 0;
    const usedDays = balance.usedDays ?? 0;
    const next = {
      ...balance,
      pendingDays,
      balanceDays: Math.max(0, totalDays - usedDays - pendingDays),
    };
    changedBalances.push(next);
    return next;
  });

  const changedRequests: LeaveRequest[] = [];
  const requests = requestsToReconcile.map((request) => {
    if (!shouldReservePendingBalance(request.status) || request.balanceReserved) return request;
    const next = { ...request, balanceReserved: true };
    changedRequests.push(next);
    return next;
  });

  return { balances, requests, changedBalances, changedRequests };
}

function mergeLeaveBalanceRow(
  rows: LeaveBalanceViewRow[],
  row: LeaveBalanceViewRow
): LeaveBalanceViewRow[] {
  const next = [...rows];
  const idx = next.findIndex((b) => b.employeeId === row.employeeId && b.type === row.type);
  if (idx >= 0) {
    next[idx] = row;
  } else {
    next.push(row);
  }
  return next;
}

export function useLeavePage() {
  const [statusFilter, _setStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [requests, setRequests] = useState<LeaveRequest[]>(leaveRequests);
  const [balances, setBalances] = useState(leaveBalances);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [requestLeaveOpen, setRequestLeaveOpen] = useState(false);
  const [detailRequest, _setDetailRequest] = useState<LeaveRequest | null>(null);
  const [newLeaveType, _setNewLeaveType] = useState<TimeOffType>("VACATION_LEAVE");
  const [newLeaveStart, setNewLeaveStart] = useState("");
  const [newLeaveEnd, setNewLeaveEnd] = useState("");
  const [newLeaveReason, setNewLeaveReason] = useState("");
  const [newLeaveError, setNewLeaveError] = useState("");
  const [leaveSubmitConfirmOpen, setLeaveSubmitConfirmOpen] = useState(false);
  const [pendingLeaveRequest, setPendingLeaveRequest] = useState<LeaveRequest | null>(null);
  const [mySearchTerm, _setMySearchTerm] = useState("");
  /** HR Staff "All Requests" tab only — avoids hiding rows when `statusFilter` was changed on My Leave. */
  const [staffAllStatusFilter, _setStaffAllStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [selectedExecutiveReport, _setSelectedExecutiveReport] = useState<ExecutiveReportKey | "">("");
  const [dmApproveTarget, _setDmApproveTarget] = useState<LeaveRequest | null>(null);
  const [dmRejectTarget, _setDmRejectTarget] = useState<LeaveRequest | null>(null);
  const [dmRemarks, _setDmRemarks] = useState("");
  const [dmRejectReason, _setDmRejectReason] = useState("");
  const [hrFinalizeTarget, _setHrFinalizeTarget] = useState<LeaveRequest | null>(null);
  const [hrReturnTarget, _setHrReturnTarget] = useState<LeaveRequest | null>(null);
  const [hrReturnTo, _setHrReturnTo] = useState<"HR_STAFF" | "DEPARTMENT_MANAGER">("HR_STAFF");
  const [hrReturnReason, _setHrReturnReason] = useState("");
  const [hrPoliciesDraft, _setHrPoliciesDraft] = useState({
    maxLeaveCreditsPerYear: 15,
    allowCarryOver: true,
    carryOverMaxDays: 5,
    noticePeriodDays: 3,
    requireAttachmentsFor: ["SICK_LEAVE", "EMERGENCY_LEAVE"] as TimeOffType[],
    minimumServiceMonths: 3,
  });
  const [hrPoliciesSaved, _setHrPoliciesSaved] = useState({
    maxLeaveCreditsPerYear: 15,
    allowCarryOver: true,
    carryOverMaxDays: 5,
    noticePeriodDays: 3,
    requireAttachmentsFor: ["SICK_LEAVE", "EMERGENCY_LEAVE"] as TimeOffType[],
    minimumServiceMonths: 3,
  });
  const [hrPoliciesEditing, _setHrPoliciesEditing] = useState(false);
  const [policyViewId, _setPolicyViewId] = useState<
    | "maxLeaveCreditsPerYear"
    | "carryOverRules"
    | "noticePeriodDays"
    | "requiredAttachments"
    | "minimumServiceMonths"
    | null
  >(null);
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [hmApproveTarget, _setHmApproveTarget] = useState<LeaveRequest | null>(null);
  const [hmRejectTarget, _setHmRejectTarget] = useState<LeaveRequest | null>(null);
  const [hmRemarks, _setHmRemarks] = useState("");
  const [hmRejectReason, _setHmRejectReason] = useState("");
  const [hmReturnTarget, _setHmReturnTarget] = useState<LeaveRequest | null>(null);
  const [hmReturnReason, _setHmReturnReason] = useState("");
  const [hmException, _setHmException] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [balanceAdjustments, setBalanceAdjustments] = useState<
    Array<{
      id: string;
      employeeId: string;
      employeeName: string;
      leaveType: TimeOffType;
      previousBalance: number;
      newBalance: number;
      reason: string;
      adjustedBy: string;
      adjustedByRole: string;
      dateAdjusted: string;
    }>
  >([]);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  /** When true, leave requests are loaded (or seeded) to Supabase and edits sync there instead of only localStorage. */
  const [supabaseLeaveReady, setSupabaseLeaveReady] = useState(false);
  const [supabaseBalancesReady, setSupabaseBalancesReady] = useState(false);
  const requestsRef = useRef(requests);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);
  const [docPreview, setDocPreview] = useState<{ url: string; name: string } | null>(null);
  const [docMaximized, setDocMaximized] = useState(false);
  // Auditor "Audit Reports" print: render report into this container, then call `window.print()`
  // (no new tab/pop-up).
  const [auditorPrintHtml, setAuditorPrintHtml] = useState<string>("");
  const supportDocInputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: currentUser, isHydrated: currentUserHydrated } = useCurrentUser();
  const portal = useMemo(
    () => getPortalPaths(currentUser.role),
    [currentUser.role]
  );
  const dmPendingScrollRef = useRef<HTMLDivElement>(null);
  const dmPendingScrollbarRef = useRef<HTMLDivElement>(null);
  const dmPendingSyncingRef = useRef<"content" | "bar" | null>(null);

  const leaveDataLoading =
    !currentUserHydrated ||
    !hasLoadedStorage ||
    (isSupabaseLeaveConfigured() && (!supabaseLeaveReady || !supabaseBalancesReady));

  const canManageCompanyLeaveBalances = useMemo(() => {
    const values = [
      currentUser.role,
      currentUser.selectedSystemRoleCode,
      currentUser.selectedSystemRoleName,
      currentUser.jobTitle,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase().replace(/_/g, " "));

    return values.some((value) =>
      [
        "hr staff",
        "hr admin",
        "hr manager",
        "department manager",
        "engineering manager",
        "super admin",
        "system admin",
        "audit officer",
        "auditor",
        "executive",
      ].includes(value)
    );
  }, [
    currentUser.role,
    currentUser.selectedSystemRoleCode,
    currentUser.selectedSystemRoleName,
    currentUser.jobTitle,
  ]);


  const { tab, setTab } = useLeaveRouting({
    searchParams,
    currentUserRole: currentUser.role,
    onReplace: router.replace,
  });

  const openDocPreview = useCallback(async (dataUrl: string, name: string) => {
    const source = dataUrl.trim();
    if (!source) {
      setDocPreview(null);
      setDocMaximized(false);
      return;
    }

    // For already-viewable URLs (blob/data/http/https), use directly to avoid fetch/CORS failures.
    if (
      source.startsWith("blob:") ||
      source.startsWith("data:") ||
      source.startsWith("http://") ||
      source.startsWith("https://")
    ) {
      setDocPreview({ url: source, name });
      setDocMaximized(false);
      return;
    }

    try {
      const res = await fetch(source);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDocPreview({ url, name });
      setDocMaximized(false);
    } catch {
      setDocPreview(null);
      setDocMaximized(false);
    }
  }, []);

  const closeDocPreview = useCallback(() => {
    setDocMaximized(false);
    setDocPreview((prev) => {
      if (prev?.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const refreshLeaveBalancesFromSupabase = useCallback(async () => {
    if (!isSupabaseLeaveConfigured()) return;
    const { data, error } = await fetchLeaveBalancesFromSupabase();
    if (error) {
      console.warn("[leave] Supabase leave_balances refresh failed:", error.message);
      return;
    }
    setBalances(data);
  }, []);

  const syncLeaveBalanceDeltaToSupabase = (
    balance: LeaveBalanceViewRow,
    pendingDelta: number,
    usedDelta: number
  ) => {
    if (!isSupabaseLeaveConfigured()) return;
    void adjustLeaveBalanceInSupabase({
      employeeId: balance.employeeId,
      employeeNumber: balance.employeeNumber,
      leaveType: balance.type,
      totalDays: balance.totalDays,
      pendingDelta,
      usedDelta,
    }).then(async ({ data, error }) => {
      if (!error && data) {
        setBalances((prev) => mergeLeaveBalanceRow(prev, data));
        return;
      }

      console.warn(
        "[leave] Supabase leave_balances delta sync failed; falling back to row upsert:",
        error?.message ?? "No balance returned"
      );
      const fallback = await upsertLeaveBalanceToSupabase(balance);
      if (fallback.error) {
        console.warn("[leave] Supabase leave_balances sync:", fallback.error.message);
        return;
      }
      await refreshLeaveBalancesFromSupabase();
    });
  };

  const adjustLeaveBalance = (
    employeeId: string,
    employeeName: string,
    leaveType: TimeOffType,
    pendingDelta: number,
    usedDelta: number,
    reason: string
  ) => {
    const now = new Date().toISOString();
    setBalances((prev) => {
      const next = [...prev];
      const idx = next.findIndex((b) => b.employeeId === employeeId && b.type === leaveType);
      if (idx < 0) {
        // Ensure balances stay functional even if a leave type row is missing in the mock dataset.
        // For now we default total credits to the current policy max (0 for UNPAID).
        if (pendingDelta <= 0 && usedDelta <= 0) return prev;

        const emp = getEmployeeById(employeeId);
        const employeeNumber = emp?.employeeNumber ?? "";
        const total = leaveType === "UNPAID_LEAVE" ? 0 : hrPoliciesSaved.maxLeaveCreditsPerYear;
        const used = Math.max(0, usedDelta);
        const pending = Math.max(0, pendingDelta);
        const balance = Math.max(0, total - used - pending);

        next.push({
          employeeId,
          employeeName,
          employeeNumber,
          type: leaveType,
          totalDays: total,
          usedDays: used,
          pendingDays: pending,
          balanceDays: balance,
        });
        syncLeaveBalanceDeltaToSupabase(next[next.length - 1]!, pendingDelta, usedDelta);

        setBalanceAdjustments((prevAdj) => [
          {
            id: randomUUID(),
            employeeId,
            employeeName,
            leaveType,
            previousBalance: 0,
            newBalance: balance,
            reason,
            adjustedBy: currentUser.name,
            adjustedByRole: currentUser.role,
            dateAdjusted: now,
          },
          ...prevAdj,
        ]);

        return next;
      }

      const row = next[idx]!;
      const total = row.totalDays ?? 0;
      const prevBalance = row.balanceDays ?? Math.max(0, total - (row.usedDays ?? 0) - (row.pendingDays ?? 0));

      const used = Math.max(0, (row.usedDays ?? 0) + usedDelta);
      const pending = Math.max(0, (row.pendingDays ?? 0) + pendingDelta);
      const balance = Math.max(0, total - used - pending);

      next[idx] = { ...row, usedDays: used, pendingDays: pending, balanceDays: balance };
      syncLeaveBalanceDeltaToSupabase(next[idx]!, pendingDelta, usedDelta);

      setBalanceAdjustments((prevAdj) => [
        {
          id: randomUUID(),
          employeeId,
          employeeName,
          leaveType,
          previousBalance: prevBalance,
          newBalance: balance,
          reason,
          adjustedBy: currentUser.name,
          adjustedByRole: currentUser.role,
          dateAdjusted: now,
        },
        ...prevAdj,
      ]);

      return next;
    });
  };

  const reservePendingBalanceForRequest = (request: LeaveRequest, reason: string) => {
    if (request.balanceReserved) return false;
    const days = calculateInclusiveDays(request.startDate, request.endDate);
    if (days <= 0) return false;
    adjustLeaveBalance(request.employeeId, request.employeeName, request.type, days, 0, reason);
    return true;
  };

  const releasePendingBalanceForRequest = (request: LeaveRequest, reason: string) => {
    if (!request.balanceReserved) return false;
    const days = calculateInclusiveDays(request.startDate, request.endDate);
    if (days <= 0) return false;
    adjustLeaveBalance(request.employeeId, request.employeeName, request.type, -days, 0, reason);
    return true;
  };

  const requestHasReservedPendingBalance = (request: LeaveRequest) => {
    if (request.balanceReserved) return true;
    const days = calculateInclusiveDays(request.startDate, request.endDate);
    if (days <= 0 || !shouldReservePendingBalance(request.status)) return false;
    const balance = balances.find(
      (b) => b.employeeId === request.employeeId && b.type === request.type
    );
    return (balance?.pendingDays ?? 0) >= days;
  };

  useLeaveData({
    hasLoadedStorage,
    setHasLoadedStorage,
    requests,
    setRequests,
    requestsRef,
    supabaseLeaveReady,
    setSupabaseLeaveReady,
    requestLeaveOpen,
    setSupportingDocument,
    supportDocInputRef,
    setAuditLogs,
  });

  useEffect(() => {
    if (!currentUserHydrated || !hasLoadedStorage || !supabaseLeaveReady || !isSupabaseLeaveConfigured()) {
      return;
    }

    let cancelled = false;

    (async () => {
      const { data: balanceRows, error: balanceError } = await fetchLeaveBalancesFromSupabase();
      if (cancelled) return;
      if (balanceError) {
        console.warn("[leave] Supabase leave_balances load failed - using default balances:", balanceError.message);
        setSupabaseBalancesReady(true);
        return;
      }

      const { error: seedBalanceError } = await seedMissingLeaveBalancesToSupabase({
        defaultTotalDays: hrPoliciesSaved.maxLeaveCreditsPerYear,
        employeeId: canManageCompanyLeaveBalances ? undefined : currentUser.employeeId,
      });
      if (cancelled) return;

      let rowsToUse = balanceRows;
      if (seedBalanceError) {
        console.warn("[leave] Supabase leave_balances seed failed:", seedBalanceError.message);
      } else {
        const { data: refreshedBalanceRows, error: refreshBalanceError } =
          await fetchLeaveBalancesFromSupabase();
        if (cancelled) return;
        if (refreshBalanceError) {
          console.warn("[leave] Supabase leave_balances refresh failed:", refreshBalanceError.message);
        } else {
          rowsToUse = refreshedBalanceRows;
        }
      }

      const reconciled = reconcilePendingLeaveBalances(requestsRef.current, rowsToUse);
      setBalances(reconciled.balances);
      if (reconciled.changedRequests.length > 0) {
        setRequests(reconciled.requests);
        void pushLeaveRequestsToSupabase(reconciled.changedRequests).then(({ error }) => {
          if (error) console.warn("[leave] Supabase balance reservation metadata sync failed:", error.message);
        });
      }
      for (const changedBalance of reconciled.changedBalances) {
        void upsertLeaveBalanceToSupabase(changedBalance).then(({ error }) => {
          if (error) console.warn("[leave] Supabase pending balance reconciliation failed:", error.message);
        });
      }
      setSupabaseBalancesReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    canManageCompanyLeaveBalances,
    currentUser.employeeId,
    currentUserHydrated,
    hasLoadedStorage,
    hrPoliciesSaved.maxLeaveCreditsPerYear,
    setRequests,
    supabaseLeaveReady,
  ]);

  useEffect(() => {
    if (!currentUserHydrated || !hasLoadedStorage || !supabaseLeaveReady || !isSupabaseLeaveConfigured()) {
      return;
    }

    let cancelled = false;
    const refreshIfActive = () => {
      if (!cancelled) void refreshLeaveBalancesFromSupabase();
    };

    const channel = supabase
      .channel(`leave-balances-${currentUser.employeeId || "current"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_balances" },
        refreshIfActive
      )
      .subscribe();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshIfActive();
    };

    window.addEventListener("focus", refreshIfActive);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(refreshIfActive, 10000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshIfActive);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
      void supabase.removeChannel(channel);
    };
  }, [
    currentUser.employeeId,
    currentUserHydrated,
    hasLoadedStorage,
    refreshLeaveBalancesFromSupabase,
    supabaseLeaveReady,
  ]);

  const normalizeEmployeeKey = useCallback(
    (value?: string) => (value ?? "").trim().toUpperCase(),
    [],
  );
  const isCurrentUsersLeave = useCallback(
    (r: LeaveRequest) => {
      if (r.employeeId === currentUser.employeeId) return true;
      const reqNo = normalizeEmployeeKey(r.employeeNumber);
      const curNo = normalizeEmployeeKey(currentUser.employeeNumber);
      return Boolean(reqNo && curNo && reqNo === curNo);
    },
    [currentUser.employeeId, currentUser.employeeNumber, normalizeEmployeeKey],
  );

  // Department Manager: employees in departments they manage (department.managerId === currentUser)
  const deptManagerEmployeeIds = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return getEmployeeIdsUnderDepartmentManager(currentUser.employeeId);
  }, [currentUser.role, currentUser.employeeId]);

  // Pending approval requests that the Dept Manager can approve (their department only)
  const pendingApprovalForDeptManager = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests.filter(
      (r) =>
        r.status === "PENDING_APPROVAL" &&
        deptManagerEmployeeIds.includes(r.employeeId) &&
        !isCurrentUsersLeave(r)
    );
  }, [requests, currentUser.role, deptManagerEmployeeIds, isCurrentUsersLeave]);

  const dmApprovedRequests = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests
      .filter((r) => deptManagerEmployeeIds.includes(r.employeeId))
      .filter((r) => isDepartmentManagerApprovedStatus(r.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, deptManagerEmployeeIds]);

  const dmRejectedRequests = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests
      .filter((r) => deptManagerEmployeeIds.includes(r.employeeId))
      .filter((r) => r.status === "REJECTED")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, deptManagerEmployeeIds]);

  const hrFinalizationQueue = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return [];
    return requests
      .filter((r) => r.status === "PENDING_FINALIZATION" || r.status === "PENDING_RECORDING")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role]);

  const hmHighLevelApprovals = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    const allowedSubmitterRoles = new Set(["DEPARTMENT_MANAGER", "HR_STAFF", "HR_ADMIN"]);
    return requests
      .filter((r) => r.status === "PENDING_HR_MANAGER_APPROVAL")
      .filter((r) => allowedSubmitterRoles.has(getEmployeeById(r.employeeId)?.role ?? "EMPLOYEE"))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role]);

  const hmEscalatedRequests = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    return requests
      .filter((r) => r.status === "RETURNED_FOR_REVIEW")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role]);

  const hmOverridesQueue = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    return requests
      .filter((r) => r.status === "REJECTED")
      .filter((r) => (r.remarks ?? "").toLowerCase().includes("override"))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role]);

  const hmDepartmentOverview = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    return departments.map((d) => {
      const deptRequests = requests.filter((r) => {
        const emp = getEmployeeById(r.employeeId);
        return emp?.departmentId === d.id;
      });
      const approved = deptRequests.filter((r) => r.status === "FINAL_APPROVED" || r.status === "PENDING_FINALIZATION" || r.status === "APPROVED").length;
      const rejected = deptRequests.filter((r) => r.status === "REJECTED").length;
      const pending = deptRequests.filter((r) => r.status === "PENDING_HR_MANAGER_APPROVAL" || r.status === "PENDING_APPROVAL" || r.status === "PENDING_HR_STAFF_PROCESSING").length;
      const todayKey = toLocalISODate(new Date());
      const onLeaveToday = deptRequests.filter((r) => {
        if (r.status === "REJECTED" || r.status === "CANCELLED") return false;
        return todayKey >= r.startDate && todayKey <= r.endDate;
      }).length;
      return {
        deptId: d.id,
        deptName: d.name,
        total: deptRequests.length,
        approved,
        rejected,
        pending,
        onLeaveToday,
      };
    });
  }, [requests, currentUser.role]);

  const hrFinalRecords = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return [];
    return requests
      .filter((r) => r.status === "FINAL_APPROVED")
      .sort((a, b) => new Date((b.approvedAt ?? b.createdAt)).getTime() - new Date((a.approvedAt ?? a.createdAt)).getTime());
  }, [requests, currentUser.role]);

  const hrFinalizedThisMonthCount = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return 0;
    const now = new Date();
    return hrFinalRecords.filter((r) => {
      const d = new Date(r.approvedAt ?? r.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [currentUser.role, hrFinalRecords]);

  const employeesOnLeaveTodayCount = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return 0;
    const todayKey = toLocalISODate(new Date());
    return requests.filter((r) => {
      if (r.status === "REJECTED" || r.status === "CANCELLED") return false;
      return todayKey >= r.startDate && todayKey <= r.endDate;
    }).length;
  }, [requests, currentUser.role]);

  // HR Admin: HR Staff leave requests awaiting processing
  const pendingHrAdminProcessing = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return [];
    return requests.filter((r) => r.status === "PENDING_HR_ADMIN_PROCESSING");
  }, [requests, currentUser.role]);

  // HR Manager: processed requests awaiting approve/reject
  const pendingHrManagerApproval = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    return requests.filter((r) => r.status === "PENDING_HR_MANAGER_APPROVAL");
  }, [requests, currentUser.role]);

  // HR Staff: forwarded requests (dept manager queue or HR Manager queue, then outcomes)
  const forwardedForHrStaff = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    const forwardedStatuses: LeaveStatus[] = [
      "PENDING_APPROVAL", // employee requests → validated by HR → awaiting Department Manager
      "PENDING_HR_MANAGER_APPROVAL", // e.g. auditor or DM-submitted → awaiting HR Manager
      "APPROVED",
      "REJECTED",
    ];
    const set = new Set(forwardedStatuses);
    return requests
      .filter((r) => set.has(r.status))
      .map((r) => {
        const employee = getEmployeeById(r.employeeId);
        const dept = departments.find((d) => d.id === employee?.departmentId);
        const manager =
          dept && dept.managerId ? getEmployeeById(dept.managerId) : undefined;
        const forwardedToName =
          r.status === "PENDING_HR_MANAGER_APPROVAL"
            ? "HR Manager"
            : manager
              ? manager.firstName + " " + manager.lastName
              : "Department Manager";
        return {
          request: r,
          forwardedToName,
        };
      });
  }, [requests, currentUser.role]);

  const headerByTab: Record<string, string> = {
    "apply": "Apply Leave",
    "my-report": "My Leave Request",
    "balances": "My Leave Balance",
    "exec-summary": "Executive Summary",
    "exec-trends": "Department Trends",
    "exec-availability": "Workforce Availability",
    "exec-reports": "Leave Reports",
    "company-report": "Company Report",
    "employee-balances": "Employee Balances",
    "dm-pending": "Pending Approvals",
    "dm-approved": "Approved Requests",
    "dm-rejected": "Rejected Requests",
    "calendar": "Leave Calendar",
    "staff-all": "All Requests",
    "staff-pending": "Pending Validation",
    "staff-approved": "Approved Requests",
    "staff-forwarded": "Forwarded Requests",
    "hr-final": "Final Approvals",
    "hr-records": "Leave Records",
    "hr-balances": "Leave Balances",
    "hr-types": "Leave Types",
    "hr-policies": "Policies",
    "hm-high": "High-Level Approvals",
    "hm-escalated": "Escalated Requests",
    "hm-all": "All Leave Requests",
    "hm-overview": "Department Leave Overview",
    "hm-overrides": "Override Requests",
    "audit-records": "Leave Records",
    "audit-trail": "Approval Trail",
    "audit-adjustments": "Balance Adjustments",
    "audit-compliance": "Policy Compliance",
    "audit-reports": "Audit Reports",
    "manager-approvals": "Team Leave Request",
    "manager-process-hr-admin": "Team Leave Processing",
    "reference": "Leave Types Reference",
  };

  const headerTitle = headerByTab[tab] ?? "My Leave";
  const breadcrumbRoot =
    tab === "my-report" || tab === "balances" || tab === "reference" || tab === "apply"
      ? "My Leave"
      : currentUser.role === "AUDITOR"
      ? "Leave Audit"
      : "Leave Management";
  const navigateTab = (next: string) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`/leave?${params.toString()}`);
  };

  // HR Manager: HR Admin leave requests awaiting processing (send to Executive)
  const pendingHrManagerProcessingHrAdmin = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    return requests.filter((r) => r.status === "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN");
  }, [requests, currentUser.role]);

  // HR Staff: Dept Manager leave requests awaiting processing
  const pendingHrStaffProcessing = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    return requests.filter((r) => r.status === "PENDING_HR_STAFF_PROCESSING");
  }, [requests, currentUser.role]);

  // HR Staff: Auditor leave requests awaiting processing (send to HR Manager)
  const pendingHrStaffProcessingAuditor = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    return requests.filter((r) => r.status === "PENDING_HR_STAFF_PROCESSING_AUDITOR");
  }, [requests, currentUser.role]);

  const staffPendingValidationList = useMemo(
    () => [...pendingHrStaffProcessing, ...pendingHrStaffProcessingAuditor],
    [pendingHrStaffProcessing, pendingHrStaffProcessingAuditor]
  );

  const staffApprovedRequests = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    const approvedStatuses = new Set<LeaveStatus>(["FINAL_APPROVED", "APPROVED", "APPLIED"]);
    return requests
      .filter((r) => approvedStatuses.has(r.status))
      .sort((a, b) => new Date((b.approvedAt ?? b.createdAt)).getTime() - new Date((a.approvedAt ?? a.createdAt)).getTime());
  }, [requests, currentUser.role]);

  // HR Admin: HR Manager leave requests awaiting processing (send to Executive)
  const pendingHrAdminProcessingHrManager = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return [];
    return requests.filter((r) => r.status === "PENDING_HR_ADMIN_PROCESSING_HR_MANAGER");
  }, [requests, currentUser.role]);

  // HR Admin: approved leave awaiting recording (includes auto-approved Executive and Dept Manager-approved employees)
  const pendingApprovedLeaveToRecord = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return [];
    return requests.filter((r) => r.status === "APPROVED");
  }, [requests, currentUser.role]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Selection behavior is now explicit via user actions
  // (avoids setState-in-effect lint violations in React 19 rules).

  const toggleAllFor = (
    list: LeaveRequest[],
    selectableStatuses: LeaveStatus[],
    checked: boolean
  ) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    const allowed = new Set(selectableStatuses);
    setSelectedIds(list.filter((r) => allowed.has(r.status)).map((r) => r.id));
  };

  const bulkUpdateStatusFrom = (fromStatus: LeaveStatus, nextStatus: LeaveStatus) => {
    if (selectedIds.length === 0) return;
    const now = new Date().toISOString();
    const verb =
      nextStatus === "APPROVED"
        ? "approved"
        : nextStatus === "REJECTED"
          ? "rejected"
          : nextStatus === "APPLIED"
            ? "recorded"
            : nextStatus === "PENDING_HR_MANAGER_APPROVAL"
              ? "processed"
              : "updated";
    const balanceReservedById = new Map<string, boolean>();
    requests
      .filter((r) => selectedIds.includes(r.id) && r.status === fromStatus)
      .forEach((r) => {
        if (nextStatus === "REJECTED") {
          releasePendingBalanceForRequest(r, "Rejected leave request (released pending days)");
          balanceReservedById.set(r.id, false);
          return;
        }
        if (nextStatus === "APPROVED") {
          const reserved = reservePendingBalanceForRequest(
            r,
            "Approved leave request reserved pending days"
          );
          balanceReservedById.set(r.id, r.balanceReserved || reserved);
          return;
        }
        if (nextStatus === "APPLIED") {
          const days = calculateInclusiveDays(r.startDate, r.endDate);
          if (days > 0) {
            const wasReserved = requestHasReservedPendingBalance(r);
            adjustLeaveBalance(
              r.employeeId,
              r.employeeName,
              r.type,
              wasReserved ? -days : 0,
              days,
              "Recorded leave deduction"
            );
          }
          balanceReservedById.set(r.id, false);
        }
      });
    setRequests((prev) => {
      const updated = prev.map((r) =>
        selectedIds.includes(r.id) && r.status === fromStatus
          ? {
              ...r,
              status: nextStatus,
              balanceReserved: balanceReservedById.has(r.id)
                ? balanceReservedById.get(r.id)
                : r.balanceReserved,
              approvedAt:
                nextStatus === "APPROVED" || nextStatus === "REJECTED"
                  ? now
                  : r.approvedAt,
              approvedBy:
                nextStatus === "APPROVED" || nextStatus === "REJECTED"
                  ? currentUser.employeeId
                  : r.approvedBy,
            }
          : r
      );

      prev.forEach((r) => {
        if (!selectedIds.includes(r.id) || r.status !== fromStatus) return;
        appendAuditLog({
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: "LEAVE_STATUS_CHANGED",
          entityType: "LEAVE_REQUEST",
          entityId: r.id,
          summary: `${currentUser.name} ${verb} leave request ${r.id} for ${r.employeeName}.`,
          before: { status: r.status },
          after: { status: nextStatus },
        });
      });

      return updated;
    });
    setSelectedIds([]);
  };

  // HR Staff routing: employee requests go to Dept Manager approval; Dept Manager requests go to HR Manager approval;
  // Auditor submissions go to HR Manager after HR Staff validation.
  const bulkRouteHrStaffProcessing = () => {
    if (selectedIds.length === 0) return;

    setRequests((prev) => {
      const resolveNext = (r: LeaveRequest): LeaveStatus | null => {
        if (!selectedIds.includes(r.id)) return null;
        if (r.status === "PENDING_HR_STAFF_PROCESSING_AUDITOR") {
          return "PENDING_HR_MANAGER_APPROVAL";
        }
        if (r.status === "PENDING_HR_STAFF_PROCESSING") {
          const submitterRole = getEmployeeById(r.employeeId)?.role ?? "EMPLOYEE";
          return submitterRole === "DEPARTMENT_MANAGER"
            ? "PENDING_HR_MANAGER_APPROVAL"
            : "PENDING_APPROVAL";
        }
        return null;
      };

      const updated = prev.map((r) => {
        const nextStatus = resolveNext(r);
        return nextStatus ? { ...r, status: nextStatus } : r;
      });

      prev.forEach((r) => {
        const nextStatus = resolveNext(r);
        if (!nextStatus) return;
        appendAuditLog({
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
          action: "LEAVE_STATUS_CHANGED",
          entityType: "LEAVE_REQUEST",
          entityId: r.id,
          summary: `${currentUser.name} processed leave request ${r.id} for ${r.employeeName}.`,
          before: { status: r.status },
          after: { status: nextStatus },
        });
      });

      return updated;
    });

    setSelectedIds([]);
  };

  const cancelRequest = (id: string) => {
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    const isOwner = isCurrentUsersLeave(r);
    const canAdminCancel = currentUser.role === "HR_ADMIN" || currentUser.role === "SUPER_ADMIN";
    if (!isOwner && !canAdminCancel) return;
    if (
      r.status === "REJECTED" ||
      r.status === "APPLIED" ||
      r.status === "CANCELLED" ||
      r.status === "APPROVED" ||
      r.status === "FINAL_APPROVED"
    ) {
      return;
    }

    releasePendingBalanceForRequest(r, "Cancelled pending leave request (released pending days)");
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id ? { ...x, status: "CANCELLED" as LeaveStatus, balanceReserved: false } : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} cancelled leave request ${id}.`,
      before: { status: r.status },
      after: { status: "CANCELLED" },
    });
  };

  const dmApproveRequest = (id: string, remarks?: string) => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return;
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    if (r.status !== "PENDING_APPROVAL") return;
    const now = new Date().toISOString();
    const reserved = reservePendingBalanceForRequest(
      r,
      "Department Manager approval reserved pending days"
    );
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "PENDING_FINALIZATION", approvedAt: now, approvedBy: currentUser.employeeId, remarks: remarks?.trim() || undefined, balanceReserved: x.balanceReserved || reserved }
          : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} approved leave request ${id} for ${r.employeeName}.`,
      before: { status: r.status },
      after: { status: "PENDING_FINALIZATION" },
    });
  };

  const dmRejectRequest = (id: string, reason: string, remarks: string) => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return;
    const r = requests.find((x) => x.id === id);
    if (!r) return;
    if (r.status !== "PENDING_APPROVAL") return;
    const now = new Date().toISOString();
    releasePendingBalanceForRequest(r, "Rejected leave request (released pending days)");
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "REJECTED", approvedAt: now, approvedBy: currentUser.employeeId, rejectionReason: reason.trim(), remarks: remarks.trim(), balanceReserved: false }
          : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} rejected leave request ${id} for ${r.employeeName}.`,
      before: { status: r.status },
      after: { status: "REJECTED" },
    });
  };

  const hrFinalizeRequest = (id: string) => {
    if (currentUser.role !== "HR_ADMIN") return;
    const r = requests.find((x) => x.id === id);
    if (!r || (r.status !== "PENDING_FINALIZATION" && r.status !== "PENDING_RECORDING")) return;
    const now = new Date().toISOString();
    const days = calculateInclusiveDays(r.startDate, r.endDate);
    if (days > 0) {
      const wasReserved = requestHasReservedPendingBalance(r);
      adjustLeaveBalance(
        r.employeeId,
        r.employeeName,
        r.type,
        wasReserved ? -days : 0,
        days,
        "Finalized leave deduction"
      );
    }

    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "FINAL_APPROVED", approvedAt: now, approvedBy: currentUser.employeeId, balanceReserved: false }
          : x
      )
    );

    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} finalized leave request ${id} for ${r.employeeName}.`,
      before: { status: r.status },
      after: { status: "FINAL_APPROVED" },
    });
  };

  const hrReturnForReview = (
    id: string,
    returnedTo: "HR_STAFF" | "DEPARTMENT_MANAGER",
    reason: string
  ) => {
    if (currentUser.role !== "HR_ADMIN") return;
    const r = requests.find((x) => x.id === id);
    if (!r || r.status !== "PENDING_FINALIZATION") return;
    const now = new Date().toISOString();
    releasePendingBalanceForRequest(r, "Returned for review (released pending days)");
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "RETURNED_FOR_REVIEW", approvedAt: now, approvedBy: currentUser.employeeId, returnedTo, remarks: reason.trim(), balanceReserved: false }
          : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} returned leave request ${id} for review.`,
      before: { status: r.status },
      after: { status: "RETURNED_FOR_REVIEW", returnedTo },
    });
  };

  const hmApproveRequest = (id: string, remarks?: string, asException?: boolean) => {
    if (currentUser.role !== "HR_MANAGER") return;
    const r = requests.find((x) => x.id === id);
    if (!r || r.status !== "PENDING_HR_MANAGER_APPROVAL") return;
    const now = new Date().toISOString();
    const note = [remarks?.trim(), asException ? "Approved as exception" : undefined].filter(Boolean).join(" • ");
    const reserved = reservePendingBalanceForRequest(
      r,
      "HR Manager approval reserved pending days"
    );
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "PENDING_FINALIZATION", approvedAt: now, approvedBy: currentUser.employeeId, remarks: note || undefined, balanceReserved: x.balanceReserved || reserved }
          : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} approved leave request ${id} for ${r.employeeName}.`,
      before: { status: r.status },
      after: { status: "PENDING_FINALIZATION" },
    });
  };

  const hmRejectRequest = (id: string, reason: string, remarks: string) => {
    if (currentUser.role !== "HR_MANAGER") return;
    const r = requests.find((x) => x.id === id);
    if (!r || r.status !== "PENDING_HR_MANAGER_APPROVAL") return;
    const now = new Date().toISOString();
    releasePendingBalanceForRequest(r, "Rejected leave request (released pending days)");
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "REJECTED", approvedAt: now, approvedBy: currentUser.employeeId, rejectionReason: reason.trim(), remarks: remarks.trim(), balanceReserved: false }
          : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} rejected leave request ${id} for ${r.employeeName}.`,
      before: { status: r.status },
      after: { status: "REJECTED" },
    });
  };

  const hmReturnReview = (id: string, reason: string) => {
    if (currentUser.role !== "HR_MANAGER") return;
    const r = requests.find((x) => x.id === id);
    if (!r || r.status !== "PENDING_HR_MANAGER_APPROVAL") return;
    const now = new Date().toISOString();
    releasePendingBalanceForRequest(r, "Returned for review (released pending days)");
    setRequests((prev) =>
      prev.map((x) =>
        x.id === id
          ? { ...x, status: "RETURNED_FOR_REVIEW", approvedAt: now, approvedBy: currentUser.employeeId, remarks: reason.trim(), returnedTo: "HR_ADMIN", balanceReserved: false }
          : x
      )
    );
    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_STATUS_CHANGED",
      entityType: "LEAVE_REQUEST",
      entityId: id,
      summary: `${currentUser.name} returned leave request ${id} for review.`,
      before: { status: r.status },
      after: { status: "RETURNED_FOR_REVIEW" },
    });
  };

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewLeaveError("");
    if (leaveSubmitConfirmOpen) return;
    const start = newLeaveStart.trim();
    const end = newLeaveEnd.trim();
    const reason = newLeaveReason.trim();
    if (!start || !end) {
      setNewLeaveError("Please select start and end dates.");
      return;
    }
    if (new Date(end) < new Date(start)) {
      setNewLeaveError("End date must be on or after start date.");
      return;
    }
    if (!reason) {
      setNewLeaveError("Please enter a reason.");
      return;
    }
    const balanceRow = myBalanceRows.find((b) => b.type === newLeaveType);
    const total = balanceRow?.totalDays ?? 0;
    const used = balanceRow?.usedDays ?? 0;
    const pending = balanceRow?.pendingDays ?? 0;
    const remaining = balanceRow?.balanceDays ?? Math.max(0, total - used - pending);
    const requestedDays = calculateInclusiveDays(start, end);
    if (remaining > 0 && requestedDays > remaining) {
      setNewLeaveError(
        `You are requesting ${requestedDays} day(s) of ${formatLeaveType(
          newLeaveType
        )}, but only ${remaining} day(s) remain.`
      );
      return;
    }
    const hasOverlap = requests.some((r) => {
      if (!isCurrentUsersLeave(r)) return false;
      if (r.status === "CANCELLED" || r.status === "REJECTED") return false;
      const existingStart = new Date(r.startDate);
      const existingEnd = new Date(r.endDate);
      const newStart = new Date(start);
      const newEnd = new Date(end);
      if (
        Number.isNaN(existingStart.getTime()) ||
        Number.isNaN(existingEnd.getTime()) ||
        Number.isNaN(newStart.getTime()) ||
        Number.isNaN(newEnd.getTime())
      ) {
        return false;
      }
      return newStart <= existingEnd && newEnd >= existingStart;
    });
    if (hasOverlap) {
      setNewLeaveError("You already have a leave request that overlaps these dates.");
      return;
    }
    // Max size we allow for local-only "data URL" storage (to allow confirmation flow to appear).
    // Increase slightly so typical PDFs don't get blocked unexpectedly.
    const maxDocSize = 6 * 1024 * 1024; // 6MB for localStorage
    let supportingDocDataUrl: string | undefined;
    if (supportingDocument) {
      const isPdf =
        supportingDocument.type === "application/pdf" ||
        supportingDocument.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setNewLeaveError("Only PDF documents are allowed for supporting files.");
        return;
      }
      if (supportingDocument.size > maxDocSize) {
        setNewLeaveError("Supporting document is too large to store (max 6MB). You can still submit without it or use a smaller file.");
        return;
      }
      supportingDocDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(supportingDocument);
      });
    }
    const id = generateLeaveRequestId(requests.map((r) => r.id));
    const now = new Date().toISOString();
    const initialStatus: LeaveStatus =
      currentUser.role === "HR_STAFF"
        ? "PENDING_HR_ADMIN_PROCESSING"
        : currentUser.role === "DEPARTMENT_MANAGER"
          ? "PENDING_HR_STAFF_PROCESSING"
          : currentUser.role === "HR_MANAGER"
            ? "PENDING_HR_ADMIN_PROCESSING_HR_MANAGER"
            : currentUser.role === "HR_ADMIN"
              ? "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN"
              : currentUser.role === "EXECUTIVE"
                ? "PENDING_RECORDING"
                : currentUser.role === "AUDITOR"
                  ? "PENDING_HR_STAFF_PROCESSING_AUDITOR"
                  : "PENDING_HR_STAFF_PROCESSING";
    const newRequest: LeaveRequest = {
      id,
      employeeId: currentUser.employeeId,
      employeeName: currentUser.name,
      employeeNumber: currentUser.employeeNumber,
      type: newLeaveType,
      startDate: start,
      endDate: end,
      reason,
      status: initialStatus,
      createdAt: now,
      supportingDocName: supportingDocument?.name,
      supportingDocDataUrl,
    };

    // Show confirmation first. Actual save happens on confirm.
    setPendingLeaveRequest(newRequest);
    setLeaveSubmitConfirmOpen(true);
  };

  const confirmSubmitLeaveRequest = () => {
    if (!pendingLeaveRequest) return;

    const newRequest = pendingLeaveRequest;
    setPendingLeaveRequest(null);
    setLeaveSubmitConfirmOpen(false);

    const reserved = reservePendingBalanceForRequest(
      newRequest,
      "Submitted leave request reserved pending days"
    );
    const submittedRequest: LeaveRequest = {
      ...newRequest,
      balanceReserved: newRequest.balanceReserved || reserved,
    };

    // Save into request list (use functional update to avoid stale state).
    setRequests((prev) => {
      const next = [submittedRequest, ...prev];
      if (isSupabaseLeaveConfigured()) {
        void pushLeaveRequestsToSupabase(next).then(({ error, skipped }) => {
          if (error) console.warn("[leave] Supabase save after submit:", error.message);
          else if (skipped > 0)
            console.warn(
              "[leave] After submit,",
              skipped,
              "row(s) not synced — check employee_code in Supabase matches mock employeeNumber (e.g. E001)."
            );
        });
      }
      return next;
    });

    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "LEAVE_REQUEST_CREATED",
      entityType: "LEAVE_REQUEST",
      entityId: submittedRequest.id,
      summary: `${currentUser.name} submitted a leave request (${submittedRequest.type}): ${submittedRequest.startDate} – ${submittedRequest.endDate}.`,
      after: {
        type: submittedRequest.type,
        startDate: submittedRequest.startDate,
        endDate: submittedRequest.endDate,
        status: submittedRequest.status,
        balanceReserved: submittedRequest.balanceReserved,
      },
    });

    setNewLeaveStart("");
    setNewLeaveEnd("");
    setNewLeaveReason("");
    setSupportingDocument(null);
    if (supportDocInputRef.current) supportDocInputRef.current.value = "";

    setRequestLeaveOpen(false);
    setTab("my-report");
    router.replace(`${portal.leave}?tab=my-report`);
  };

  const {
    myBalanceRows,
    companyBalanceByEmployee,
    companyLeaveReportRequests,
    myLeaveReportFiltered,
    companyLeaveReportFiltered,
    staffAllLeaveRequestsFiltered,
    reportRequests,
  } = useLeaveReports({
    balances,
    requests,
    currentUser,
    hrMaxLeaveCreditsPerYear: hrPoliciesSaved.maxLeaveCreditsPerYear,
    deptManagerEmployeeIds,
    isCurrentUsersLeave,
    statusFilter,
    mySearchTerm,
    staffAllStatusFilter,
    tab,
  });

  const handleExport = () => {
    const rows: string[][] = [
      ["Employee", "Employee #", "Leave type", "Start", "End", "Reason", "Supporting doc", "Status", "Created"],
      ...reportRequests.map((r) => [
        r.employeeName,
        r.employeeNumber,
        formatLeaveType(r.type),
        r.startDate,
        r.endDate,
        r.reason,
        r.supportingDocName ?? "",
        r.status.replace(/_/g, " "),
        new Date(r.createdAt).toLocaleDateString(),
      ]),
    ];
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----------------------------
  // Auditor: Audit Reports (Print + Export)
  // ----------------------------

  const executiveNow = useMemo(() => new Date(), []);
  const executiveMonthWindow = useMemo(() => getMonthWindow(executiveNow), [executiveNow]);

  const executiveRequestsThisMonth = useMemo(() => {
    const { start, end } = executiveMonthWindow;
    return requests.filter((r) => inWindow(r.createdAt, start, end));
  }, [requests, executiveMonthWindow]);

  const executiveOnLeaveTodaySet = useMemo(() => {
    const today = new Date();
    const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const onLeaveEmployeeIds = new Set<string>();
    for (const r of requests) {
      if (r.status === "CANCELLED" || r.status === "REJECTED") continue;
      if (!r.startDate || !r.endDate) continue;
      if (ymd >= r.startDate && ymd <= r.endDate) onLeaveEmployeeIds.add(r.employeeId);
    }
    return onLeaveEmployeeIds;
  }, [requests]);

  const executiveDeptSummaryThisMonth = useMemo(() => {
    const byDept = new Map<
      string,
      { departmentId: string; departmentName: string; total: number; approved: number; rejected: number; onLeaveToday: number }
    >();
    for (const d of departments) {
      byDept.set(d.id, { departmentId: d.id, departmentName: d.name, total: 0, approved: 0, rejected: 0, onLeaveToday: 0 });
    }

    for (const r of executiveRequestsThisMonth) {
      const deptId = getEmployeeById(r.employeeId)?.departmentId;
      if (!deptId) continue;
      const row = byDept.get(deptId);
      if (!row) continue;
      row.total += 1;
      if (r.status === "REJECTED") row.rejected += 1;
      if (r.status === "APPROVED" || r.status === "FINAL_APPROVED" || r.status === "APPLIED") row.approved += 1;
    }

    for (const empId of executiveOnLeaveTodaySet) {
      const deptId = getEmployeeById(empId)?.departmentId;
      if (!deptId) continue;
      const row = byDept.get(deptId);
      if (!row) continue;
      row.onLeaveToday += 1;
    }

    const rows = Array.from(byDept.values()).sort((a, b) => b.total - a.total || a.departmentName.localeCompare(b.departmentName));
    const max = Math.max(0, ...rows.map((r) => r.total));
    return rows.map((r) => ({
      ...r,
      pctOfMax: max > 0 ? Math.round((r.total / max) * 100) : 0,
    }));
  }, [executiveRequestsThisMonth, executiveOnLeaveTodaySet]);

  const executiveDeptTrendsThisMonth = useMemo(() => {
    const map = new Map<
      string,
      {
        departmentId: string;
        departmentName: string;
        total: number;
        approved: number;
        rejected: number;
        totalDays: number;
        typeCounts: Map<TimeOffType, number>;
      }
    >();
    for (const d of departments) {
      map.set(d.id, {
        departmentId: d.id,
        departmentName: d.name,
        total: 0,
        approved: 0,
        rejected: 0,
        totalDays: 0,
        typeCounts: new Map(),
      });
    }

    for (const r of executiveRequestsThisMonth) {
      const deptId = getEmployeeById(r.employeeId)?.departmentId;
      if (!deptId) continue;
      const row = map.get(deptId);
      if (!row) continue;
      row.total += 1;
      const days = calculateInclusiveDays(r.startDate, r.endDate);
      row.totalDays += Number.isFinite(days) ? days : 0;
      row.typeCounts.set(r.type, (row.typeCounts.get(r.type) ?? 0) + 1);
      if (r.status === "REJECTED") row.rejected += 1;
      if (r.status === "APPROVED" || r.status === "FINAL_APPROVED" || r.status === "APPLIED") row.approved += 1;
    }

    return Array.from(map.values())
      .map((r) => {
        let topLeaveType: TimeOffType | null = null;
        let topCount = 0;
        for (const [t, c] of r.typeCounts.entries()) {
          if (c > topCount) {
            topLeaveType = t;
            topCount = c;
          }
        }
        return {
          departmentId: r.departmentId,
          departmentName: r.departmentName,
          total: r.total,
          approved: r.approved,
          rejected: r.rejected,
          avgDays: r.total > 0 ? r.totalDays / r.total : 0,
          topLeaveTypeLabel: topLeaveType ? formatLeaveType(topLeaveType) : null,
        };
      })
      .sort((a, b) => b.total - a.total || a.departmentName.localeCompare(b.departmentName));
  }, [executiveRequestsThisMonth]);

  const executiveAvailability = useMemo(() => {
    const totalStaff = employees.length;
    const onLeaveToday = executiveOnLeaveTodaySet.size;
    const presentToday = Math.max(0, totalStaff - onLeaveToday);
    return { totalStaff, onLeaveToday, presentToday };
  }, [executiveOnLeaveTodaySet]);

  const executiveDeptAvailabilityToday = useMemo(() => {
    const byDept = new Map<
      string,
      { departmentId: string; departmentName: string; totalStaff: number; onLeave: number; present: number; statusLabel: string; statusVariant: "success" | "warning" | "destructive" | "secondary" }
    >();
    for (const d of departments) {
      byDept.set(d.id, {
        departmentId: d.id,
        departmentName: d.name,
        totalStaff: 0,
        onLeave: 0,
        present: 0,
        statusLabel: "OK",
        statusVariant: "success",
      });
    }
    for (const emp of employees) {
      const row = byDept.get(emp.departmentId);
      if (!row) continue;
      row.totalStaff += 1;
      if (executiveOnLeaveTodaySet.has(emp.id)) row.onLeave += 1;
    }
    const rows = Array.from(byDept.values()).map((r) => {
      const present = Math.max(0, r.totalStaff - r.onLeave);
      const ratio = r.totalStaff > 0 ? present / r.totalStaff : 1;
      const threshold = 0.7;
      let statusLabel = "OK";
      let statusVariant: "success" | "warning" | "destructive" | "secondary" = "success";
      if (r.totalStaff === 0) {
        statusLabel = "No staff";
        statusVariant = "secondary";
      } else if (ratio < 0.5) {
        statusLabel = "Critical";
        statusVariant = "destructive";
      } else if (ratio < threshold) {
        statusLabel = "Low";
        statusVariant = "warning";
      }
      return { ...r, present, statusLabel, statusVariant };
    });
    return rows.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  }, [executiveOnLeaveTodaySet]);

  const executiveKpis = useMemo(() => {
    const totalThisMonth = executiveRequestsThisMonth.length;
    const approvedOnlyThisMonth = executiveRequestsThisMonth.filter((r) => r.status === "APPROVED" || r.status === "FINAL_APPROVED" || r.status === "APPLIED").length;
    const rejectedThisMonth = executiveRequestsThisMonth.filter((r) => r.status === "REJECTED").length;
    const approvedThisMonth = approvedOnlyThisMonth;
    const onLeaveToday = executiveOnLeaveTodaySet.size;

    const typeCounts = new Map<TimeOffType, number>();
    for (const r of executiveRequestsThisMonth) typeCounts.set(r.type, (typeCounts.get(r.type) ?? 0) + 1);
    let topType: TimeOffType | null = null;
    let topTypeCount = 0;
    for (const [t, c] of typeCounts.entries()) {
      if (c > topTypeCount) {
        topType = t;
        topTypeCount = c;
      }
    }

    const topDepartments = executiveDeptSummaryThisMonth
      .filter((d) => d.total > 0)
      .slice(0, 3)
      .map((d) => d.departmentName);

    return {
      totalThisMonth,
      onLeaveToday,
      approvedThisMonth,
      approvedOnlyThisMonth,
      rejectedThisMonth,
      mostUsedLeaveTypeLabel: topType ? formatLeaveType(topType) : null,
      mostUsedLeaveTypeCount: topTypeCount,
      topDepartments,
    };
  }, [executiveRequestsThisMonth, executiveOnLeaveTodaySet, executiveDeptSummaryThisMonth]);

  const executiveAvailabilityWithThreshold = useMemo(() => {
    const deptsBelowThreshold = executiveDeptAvailabilityToday.filter((d) => d.statusVariant === "warning" || d.statusVariant === "destructive").length;
    return { ...executiveAvailability, deptsBelowThreshold };
  }, [executiveAvailability, executiveDeptAvailabilityToday]);

  const exportExecutiveReportCsv = (key: ExecutiveReportKey) => {
    const date = new Date().toISOString().slice(0, 10);
    const filename = `executive-leave-report-${key.toLowerCase()}-${date}.csv`;
    downloadCsv(
      filename,
      ["Department", "Total Requests (This Month)", "Approved", "Rejected", "Employees On Leave Today"],
      executiveDeptSummaryThisMonth.map((r) => [
        r.departmentName,
        String(r.total),
        String(r.approved),
        String(r.rejected),
        String(r.onLeaveToday),
      ])
    );
  };

  const getEmployeeDepartmentName = (employeeId: string) => {
    const emp = getEmployeeById(employeeId);
    if (!emp) return "—";
    return departments.find((d) => d.id === emp.departmentId)?.name ?? "—";
  };

  const buildPolicyViolations = () => {
    // Mirrors the “Policy compliance” logic, but returns structured rows for the reports.
    return requests.flatMap((r) => {
      const list: Array<{
        requestId: string;
        employeeName: string;
        leaveType: TimeOffType;
        issue: string;
        severity: "Low" | "Medium" | "High";
        status: string;
      }> = [];

      const needsDoc = hrPoliciesSaved.requireAttachmentsFor.includes(r.type);
      const createdOrFinalish =
        r.status === "PENDING_FINALIZATION" || r.status === "FINAL_APPROVED" || r.status === "RETURNED_FOR_REVIEW" || r.status === "REJECTED";

      if (needsDoc && !r.supportingDocName && createdOrFinalish) {
        // Keep consistent with the UI logic (the report is also for the Auditor, so “legit” means it matches what you already show).
        if (r.status === "PENDING_FINALIZATION" || r.status === "FINAL_APPROVED") {
          list.push({
            requestId: r.id,
            employeeName: r.employeeName,
            leaveType: r.type,
            issue: "Approved/finalized without required document",
            severity: "High",
            status: r.status.replace(/_/g, " "),
          });
        }
      }

      if (r.status === "FINAL_APPROVED" && !r.approvedBy) {
        list.push({
          requestId: r.id,
          employeeName: r.employeeName,
          leaveType: r.type,
          issue: "Finalized without approval metadata (approvedBy missing)",
          severity: "Medium",
          status: r.status.replace(/_/g, " "),
        });
      }

      if (r.status === "REJECTED" && !r.rejectionReason) {
        list.push({
          requestId: r.id,
          employeeName: r.employeeName,
          leaveType: r.type,
          issue: "Rejected without rejection reason",
          severity: "Low",
          status: r.status.replace(/_/g, " "),
        });
      }

      return list;
    });
  };

  const printAuditReport = (key: AuditorReportKey) => {
    const now = new Date();
    const { start: monthStart, end: monthEnd } = getMonthWindow(now);

    const generatedAt = now.toLocaleString();
    const reportingMonth = now.toLocaleString(undefined, { month: "long", year: "numeric" });

    const baseDoc = (_title: string, innerHtml: string) => {
      const styles = `
        body { font-family: var(--font-rubik), "Rubik", ui-sans-serif, system-ui, sans-serif; }

        /* Print isolation: show ONLY the report content. */
        @media print {
          body { background: #ffffff !important; }
          body * { visibility: hidden !important; }
          #audit-print-root, #audit-print-root * { visibility: visible !important; }
          #audit-print-root {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            background: #ffffff !important;
            padding: 20px;
          }
        }

        h1 { font-size: 18px; margin: 0 0 6px; }
        .audit-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .audit-header img {
          height: 44px;
          width: auto;
          display: block;
        }
        .audit-title {
          font-size: 18px;
          font-weight: 700;
          margin: 0;
          line-height: 1.2;
        }
        .meta { color: #555; font-size: 12px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
        th { background: #f3f4f6; text-align: left; }
        .section { margin-bottom: 18px; }
        .summary { display: flex; gap: 12px; flex-wrap: wrap; }
        .pill { border: 1px solid #e5e7eb; padding: 8px 10px; border-radius: 10px; background: #fafafa; }
        @page { margin: 0; }
      `;

      setAuditorPrintHtml(
        `<style>${styles}</style>` +
          `<div class="audit-header">` +
          `<img src="/newlogo.png" alt="Workzen HRIS logo" />` +
          `<div class="audit-title">${escapeHtml(_title)}</div>` +
          `</div>` +
          `${innerHtml}`
      );

      // Wait for the DOM to update before triggering print.
      window.setTimeout(() => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            window.print();
          });
        });
      }, 120);

      const prevOnAfterPrint = window.onafterprint;
      window.onafterprint = () => {
        setAuditorPrintHtml("");
        window.onafterprint = prevOnAfterPrint;
      };
    };

    if (key === "monthly-transactions") {
      const monthRequests = requests.filter((r) => inWindow(r.createdAt, monthStart, monthEnd));
      const rows = monthRequests
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const approvedCount = rows.filter((r) => r.status === "APPROVED" || r.status === "FINAL_APPROVED").length;
      const rejectedCount = rows.filter((r) => r.status === "REJECTED").length;

      baseDoc(
        "Monthly leave transactions",
        `
          <div class="meta">Reporting month: ${escapeHtml(reportingMonth)} • Generated: ${escapeHtml(generatedAt)}</div>
          <div class="summary section">
            <div class="pill">Total transactions: ${rows.length}</div>
            <div class="pill">Approved: ${approvedCount}</div>
            <div class="pill">Rejected: ${rejectedCount}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Date Range</th>
                  <th>Days</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Approved / Finalized</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length
                    ? rows
                        .map((r) => {
                          const deptName = getEmployeeDepartmentName(r.employeeId);
                          const days = calculateInclusiveDays(r.startDate, r.endDate);
                          const finalized =
                            r.status === "FINAL_APPROVED" || r.status === "APPROVED"
                              ? r.approvedAt ?? ""
                              : "";
                          return `
                            <tr>
                              <td>${escapeHtml(r.id)}</td>
                              <td>${escapeHtml(r.employeeName)}</td>
                              <td>${escapeHtml(deptName)}</td>
                              <td>${escapeHtml(formatLeaveType(r.type))}</td>
                              <td>${escapeHtml(new Date(r.startDate).toLocaleDateString())} – ${escapeHtml(new Date(r.endDate).toLocaleDateString())}</td>
                              <td>${days}</td>
                              <td>${escapeHtml(r.status.replace(/_/g, " "))}</td>
                              <td>${escapeHtml(new Date(r.createdAt).toLocaleDateString())}</td>
                              <td>${finalized ? escapeHtml(new Date(finalized).toLocaleDateString()) : "—"}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="10">No transactions found for this month.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `
      );
      return;
    }

    if (key === "approval-turnaround") {
      const approved = requests
        .filter((r) => (r.status === "APPROVED" || r.status === "FINAL_APPROVED") && r.approvedAt)
        .map((r) => {
          const turnaroundDays = calculateInclusiveDays(r.createdAt, r.approvedAt!);
          return {
            ...r,
            turnaroundDays,
            department: getEmployeeDepartmentName(r.employeeId),
          };
        });

      const inMonth = approved.filter((r) => inWindow(r.approvedAt!, monthStart, monthEnd));
      const avg = inMonth.length ? inMonth.reduce((sum, r) => sum + r.turnaroundDays, 0) / inMonth.length : 0;
      const min = inMonth.length ? Math.min(...inMonth.map((r) => r.turnaroundDays)) : 0;
      const max = inMonth.length ? Math.max(...inMonth.map((r) => r.turnaroundDays)) : 0;

      baseDoc(
        "Approval turnaround time",
        `
          <div class="meta">Reporting month: ${escapeHtml(reportingMonth)} • Generated: ${escapeHtml(generatedAt)}</div>
          <div class="summary section">
            <div class="pill">Finalized/approved count: ${inMonth.length}</div>
            <div class="pill">Average turnaround (days): ${avg.toFixed(1)}</div>
            <div class="pill">Min: ${min}</div>
            <div class="pill">Max: ${max}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Created</th>
                  <th>Approved / Finalized</th>
                  <th>Turnaround (days)</th>
                </tr>
              </thead>
              <tbody>
                ${
                  inMonth.length
                    ? inMonth
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.approvedAt!).getTime() - new Date(a.approvedAt!).getTime()
                        )
                        .map((r) => {
                          return `
                            <tr>
                              <td>${escapeHtml(r.id)}</td>
                              <td>${escapeHtml(r.employeeName)}</td>
                              <td>${escapeHtml(r.department)}</td>
                              <td>${escapeHtml(formatLeaveType(r.type))}</td>
                              <td>${escapeHtml(new Date(r.createdAt).toLocaleDateString())}</td>
                              <td>${escapeHtml(new Date(r.approvedAt!).toLocaleDateString())}</td>
                              <td>${r.turnaroundDays}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="7">No approved requests found for this month.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `
      );
      return;
    }

    if (key === "rejected-requests") {
      const rejected = requests
        .filter((r) => r.status === "REJECTED" && inWindow(r.approvedAt ?? r.createdAt, monthStart, monthEnd));

      baseDoc(
        "Rejected leave requests",
        `
          <div class="meta">Reporting month: ${escapeHtml(reportingMonth)} • Generated: ${escapeHtml(generatedAt)}</div>
          <div class="summary section">
            <div class="pill">Rejected count: ${rejected.length}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Leave Type</th>
                  <th>Date Range</th>
                  <th>Days</th>
                  <th>Rejection Reason</th>
                  <th>Created</th>
                  <th>Rejected / Updated</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rejected.length
                    ? rejected
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.approvedAt ?? b.createdAt).getTime() -
                            new Date(a.approvedAt ?? a.createdAt).getTime()
                        )
                        .map((r) => {
                          const days = calculateInclusiveDays(r.startDate, r.endDate);
                          return `
                            <tr>
                              <td>${escapeHtml(r.id)}</td>
                              <td>${escapeHtml(r.employeeName)}</td>
                              <td>${escapeHtml(getEmployeeDepartmentName(r.employeeId))}</td>
                              <td>${escapeHtml(formatLeaveType(r.type))}</td>
                              <td>${escapeHtml(new Date(r.startDate).toLocaleDateString())} – ${escapeHtml(new Date(r.endDate).toLocaleDateString())}</td>
                              <td>${days}</td>
                              <td>${escapeHtml(r.rejectionReason ?? r.remarks ?? r.reason ?? "—")}</td>
                              <td>${escapeHtml(new Date(r.createdAt).toLocaleDateString())}</td>
                              <td>${escapeHtml(new Date(r.approvedAt ?? r.createdAt).toLocaleDateString())}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="9">No rejected requests found for this month.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `
      );
      return;
    }

    if (key === "balance-adjustment-history") {
      const adjustments = balanceAdjustments
        .filter((a) => inWindow(a.dateAdjusted, monthStart, monthEnd))
        .slice()
        .sort((a, b) => new Date(b.dateAdjusted).getTime() - new Date(a.dateAdjusted).getTime());

      baseDoc(
        "Leave balance adjustment history",
        `
          <div class="meta">Reporting month: ${escapeHtml(reportingMonth)} • Generated: ${escapeHtml(generatedAt)}</div>
          <div class="summary section">
            <div class="pill">Adjustments count: ${adjustments.length}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Previous Balance</th>
                  <th>New Balance</th>
                  <th>Reason</th>
                  <th>Adjusted By</th>
                  <th>Date Adjusted</th>
                </tr>
              </thead>
              <tbody>
                ${
                  adjustments.length
                    ? adjustments
                        .map((a) => {
                          return `
                            <tr>
                              <td>${escapeHtml(a.employeeName)}</td>
                              <td>${escapeHtml(formatLeaveType(a.leaveType))}</td>
                              <td>${a.previousBalance}</td>
                              <td>${a.newBalance}</td>
                              <td>${escapeHtml(a.reason)}</td>
                              <td>${escapeHtml(a.adjustedBy)} (${escapeHtml(a.adjustedByRole)})</td>
                              <td>${escapeHtml(new Date(a.dateAdjusted).toLocaleDateString())}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="7">No balance adjustments found for this month.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `
      );
      return;
    }

    if (key === "policy-violations") {
      const monthReqIds = new Set(
        requests.filter((r) => inWindow(r.createdAt, monthStart, monthEnd)).map((r) => r.id)
      );
      const violations = buildPolicyViolations().filter((v) => monthReqIds.has(v.requestId));

      baseDoc(
        "Policy violation report",
        `
          <div class="meta">Reporting month: ${escapeHtml(reportingMonth)} • Generated: ${escapeHtml(generatedAt)}</div>
          <div class="summary section">
            <div class="pill">Issues found: ${violations.length}</div>
          </div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Employee</th>
                  <th>Leave Type</th>
                  <th>Compliance Issue</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${
                  violations.length
                    ? violations
                        .slice()
                        .sort((a, b) => a.severity.localeCompare(b.severity))
                        .map((i) => {
                          return `
                            <tr>
                              <td>${escapeHtml(i.requestId)}</td>
                              <td>${escapeHtml(i.employeeName)}</td>
                              <td>${escapeHtml(formatLeaveType(i.leaveType))}</td>
                              <td>${escapeHtml(i.issue)}</td>
                              <td>${escapeHtml(i.severity)}</td>
                              <td>${escapeHtml(i.status)}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="6">No policy violations found for this month.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `
      );
      return;
    }

    if (key === "department-leave-summaries") {
      const monthRequests = requests.filter(
        (r) => overlapDays(r.startDate, r.endDate, monthStart, monthEnd) > 0 && r.status !== "CANCELLED"
      );

      const deptMap = new Map<
        string,
        { deptId: string; deptName: string; total: number; approved: number; rejected: number; returned: number; approvedDays: number }
      >();

      for (const r of monthRequests) {
        const emp = getEmployeeById(r.employeeId);
        const deptId = emp?.departmentId ?? "unknown";
        const deptName = departments.find((d) => d.id === deptId)?.name ?? "Unknown";
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { deptId, deptName, total: 0, approved: 0, rejected: 0, returned: 0, approvedDays: 0 });
        }
        const row = deptMap.get(deptId)!;
        row.total += 1;
        const days = overlapDays(r.startDate, r.endDate, monthStart, monthEnd);
        if (r.status === "APPROVED" || r.status === "FINAL_APPROVED") {
          row.approved += 1;
          row.approvedDays += days;
        } else if (r.status === "REJECTED") {
          row.rejected += 1;
        } else if (r.status === "RETURNED_FOR_REVIEW") {
          row.returned += 1;
        }
      }

      const deptRows = Array.from(deptMap.values()).sort((a, b) => b.approvedDays - a.approvedDays);

      baseDoc(
        "Department leave summaries",
        `
          <div class="meta">Reporting month: ${escapeHtml(reportingMonth)} • Generated: ${escapeHtml(generatedAt)}</div>
          <div class="section">
            <table>
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Total requests (overlapping month)</th>
                  <th>Approved</th>
                  <th>Rejected</th>
                  <th>Returned for review</th>
                  <th>Approved leave days (overlapping)</th>
                </tr>
              </thead>
              <tbody>
                ${
                  deptRows.length
                    ? deptRows
                        .map((d) => {
                          return `
                            <tr>
                              <td>${escapeHtml(d.deptName)}</td>
                              <td>${d.total}</td>
                              <td>${d.approved}</td>
                              <td>${d.rejected}</td>
                              <td>${d.returned}</td>
                              <td>${d.approvedDays}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="6">No department leave activity found for this month.</td></tr>`
                }
              </tbody>
            </table>
          </div>
        `
      );
      return;
    }
  };

  const exportAuditReportCsv = (key: AuditorReportKey) => {
    const now = new Date();
    const { start: monthStart, end: monthEnd } = getMonthWindow(now);
    const reportingMonth = now.toLocaleString(undefined, { month: "short", year: "numeric" }).replace(",", "");

    if (key === "monthly-transactions") {
      const monthRequests = requests.filter((r) => inWindow(r.createdAt, monthStart, monthEnd));
      const rows = monthRequests.map((r) => [
        r.id,
        r.employeeName,
        getEmployeeDepartmentName(r.employeeId),
        formatLeaveType(r.type),
        r.startDate,
        r.endDate,
        String(calculateInclusiveDays(r.startDate, r.endDate)),
        r.status.replace(/_/g, " "),
        new Date(r.createdAt).toLocaleDateString(),
        r.approvedAt ? new Date(r.approvedAt).toLocaleDateString() : "—",
      ]);

      downloadCsv(
        `audit-monthly-transactions-${reportingMonth}-${now.toISOString().slice(0, 10)}.csv`,
        ["Request ID", "Employee", "Department", "Leave Type", "Start", "End", "Days", "Status", "Created", "Approved/Finalized"],
        rows
      );
      return;
    }

    if (key === "approval-turnaround") {
      const approved = requests
        .filter((r) => (r.status === "APPROVED" || r.status === "FINAL_APPROVED") && r.approvedAt)
        .filter((r) => inWindow(r.approvedAt!, monthStart, monthEnd))
        .map((r) => ({
          r,
          turnaroundDays: calculateInclusiveDays(r.createdAt, r.approvedAt!),
        }));

      const rows = approved.map(({ r, turnaroundDays }) => [
        r.id,
        r.employeeName,
        getEmployeeDepartmentName(r.employeeId),
        formatLeaveType(r.type),
        new Date(r.createdAt).toLocaleDateString(),
        new Date(r.approvedAt!).toLocaleDateString(),
        String(turnaroundDays),
      ]);

      downloadCsv(
        `audit-approval-turnaround-${reportingMonth}-${now.toISOString().slice(0, 10)}.csv`,
        ["Request ID", "Employee", "Department", "Leave Type", "Created", "Approved/Finalized", "Turnaround Days"],
        rows
      );
      return;
    }

    if (key === "rejected-requests") {
      const rejected = requests.filter(
        (r) => r.status === "REJECTED" && inWindow(r.approvedAt ?? r.createdAt, monthStart, monthEnd)
      );
      const rows = rejected.map((r) => [
        r.id,
        r.employeeName,
        getEmployeeDepartmentName(r.employeeId),
        formatLeaveType(r.type),
        r.startDate,
        r.endDate,
        String(calculateInclusiveDays(r.startDate, r.endDate)),
        r.rejectionReason ?? r.remarks ?? r.reason ?? "—",
        new Date(r.createdAt).toLocaleDateString(),
        new Date(r.approvedAt ?? r.createdAt).toLocaleDateString(),
      ]);

      downloadCsv(
        `audit-rejected-requests-${reportingMonth}-${now.toISOString().slice(0, 10)}.csv`,
        ["Request ID", "Employee", "Department", "Leave Type", "Start", "End", "Days", "Rejection Reason", "Created", "Rejected/Updated"],
        rows
      );
      return;
    }

    if (key === "balance-adjustment-history") {
      const adjustments = balanceAdjustments
        .filter((a) => inWindow(a.dateAdjusted, monthStart, monthEnd))
        .slice()
        .sort((a, b) => new Date(b.dateAdjusted).getTime() - new Date(a.dateAdjusted).getTime());

      const rows = adjustments.map((a) => [
        a.employeeName,
        formatLeaveType(a.leaveType),
        String(a.previousBalance),
        String(a.newBalance),
        a.reason,
        `${a.adjustedBy} (${a.adjustedByRole})`,
        new Date(a.dateAdjusted).toLocaleDateString(),
      ]);

      downloadCsv(
        `audit-balance-adjustments-${reportingMonth}-${now.toISOString().slice(0, 10)}.csv`,
        ["Employee", "Leave Type", "Previous Balance", "New Balance", "Reason", "Adjusted By", "Date Adjusted"],
        rows
      );
      return;
    }

    if (key === "policy-violations") {
      const monthReqIds = new Set(
        requests.filter((r) => inWindow(r.createdAt, monthStart, monthEnd)).map((r) => r.id)
      );
      const violations = buildPolicyViolations().filter((v) => monthReqIds.has(v.requestId));

      const rows = violations.map((i) => [
        i.requestId,
        i.employeeName,
        formatLeaveType(i.leaveType),
        i.issue,
        i.severity,
        i.status,
      ]);

      downloadCsv(
        `audit-policy-violations-${reportingMonth}-${now.toISOString().slice(0, 10)}.csv`,
        ["Request ID", "Employee", "Leave Type", "Compliance Issue", "Severity", "Status"],
        rows
      );
      return;
    }

    if (key === "department-leave-summaries") {
      const monthRequests = requests.filter(
        (r) => overlapDays(r.startDate, r.endDate, monthStart, monthEnd) > 0 && r.status !== "CANCELLED"
      );

      const deptMap = new Map<
        string,
        { deptId: string; deptName: string; total: number; approved: number; rejected: number; returned: number; approvedDays: number }
      >();

      for (const r of monthRequests) {
        const emp = getEmployeeById(r.employeeId);
        const deptId = emp?.departmentId ?? "unknown";
        const deptName = departments.find((d) => d.id === deptId)?.name ?? "Unknown";
        if (!deptMap.has(deptId)) {
          deptMap.set(deptId, { deptId, deptName, total: 0, approved: 0, rejected: 0, returned: 0, approvedDays: 0 });
        }
        const row = deptMap.get(deptId)!;
        row.total += 1;
        const days = overlapDays(r.startDate, r.endDate, monthStart, monthEnd);
        if (r.status === "APPROVED" || r.status === "FINAL_APPROVED") {
          row.approved += 1;
          row.approvedDays += days;
        } else if (r.status === "REJECTED") {
          row.rejected += 1;
        } else if (r.status === "RETURNED_FOR_REVIEW") {
          row.returned += 1;
        }
      }

      const deptRows = Array.from(deptMap.values()).sort((a, b) => b.approvedDays - a.approvedDays);
      const rows = deptRows.map((d) => [d.deptName, String(d.total), String(d.approved), String(d.rejected), String(d.returned), String(d.approvedDays)]);

      downloadCsv(
        `audit-department-leave-summaries-${reportingMonth}-${now.toISOString().slice(0, 10)}.csv`,
        ["Department", "Total Requests (overlapping)", "Approved", "Rejected", "Returned", "Approved Leave Days (overlapping)"],
        rows
      );
      return;
    }
  };

  const roleDescription =
    currentUser.role === "EMPLOYEE"
      ? "View your leave requests and balances; submit new requests."
      : currentUser.role === "DEPARTMENT_MANAGER"
        ? "Approve or reject leave from your department; your own leave is processed by HR Staff then HR Manager."
          : currentUser.role === "HR_STAFF"
          ? "Submit leave and track status; process Dept Manager and Auditor leave for HR Manager approval."
          : currentUser.role === "HR_MANAGER"
            ? "Approve or reject processed leave requests (from HR Admin or HR Staff). Your own leave is processed by HR Admin then Executive."
            : currentUser.role === "HR_ADMIN"
              ? "Process HR Staff and HR Manager leave. Record Executive leave (auto-approved). Your own leave is processed by HR Manager then Executive."
              : currentUser.role === "EXECUTIVE"
                ? "Approve or reject HR Manager and HR Admin leave. Your leave is auto-approved; HR Admin records it."
                : currentUser.role === "AUDITOR"
                  ? "View leave requests and balances (read-only). Submit leave; HR Staff processes, then HR Manager approves."
                  : currentUser.role === "BOARD"
                    ? "Approve or reject Executive leave requests (processed by HR Admin)."
                    : "View and manage all leave requests and balances.";

  return {
    auditLogs,
    auditorPrintHtml,
    balanceAdjustments,
    balances,
    breadcrumbRoot,
    bulkRouteHrStaffProcessing,
    bulkUpdateStatusFrom,
    cancelRequest,
    closeDocPreview,
    companyBalanceByEmployee,
    companyLeaveReportFiltered,
    companyLeaveReportRequests,
    confirmSubmitLeaveRequest,
    deptManagerEmployeeIds,
    detailRequest,
    dmApproveRequest,
    dmApproveTarget,
    dmApprovedRequests,
    dmPendingScrollRef,
    dmPendingScrollbarRef,
    dmPendingSyncingRef,
    dmRejectReason,
    dmRejectRequest,
    dmRejectTarget,
    dmRejectedRequests,
    dmRemarks,
    docMaximized,
    docPreview,
    employeesOnLeaveTodayCount,
    executiveAvailabilityWithThreshold,
    executiveDeptAvailabilityToday,
    executiveDeptSummaryThisMonth,
    executiveDeptTrendsThisMonth,
    executiveKpis,
    exportAuditReportCsv,
    exportExecutiveReportCsv,
    forwardedForHrStaff,
    handleExport,
    handleSubmitLeaveRequest,
    headerTitle,
    hmApproveRequest,
    hmApproveTarget,
    hmDepartmentOverview,
    hmEscalatedRequests,
    hmException,
    hmHighLevelApprovals,
    hmOverridesQueue,
    hmRejectReason,
    hmRejectRequest,
    hmRejectTarget,
    hmRemarks,
    hmReturnReason,
    hmReturnReview,
    hmReturnTarget,
    hrFinalRecords,
    hrFinalizationQueue,
    hrFinalizeRequest,
    hrFinalizeTarget,
    hrFinalizedThisMonthCount,
    hrPoliciesDraft,
    hrPoliciesEditing,
    hrPoliciesSaved,
    hrReturnForReview,
    hrReturnReason,
    hrReturnTarget,
    hrReturnTo,
    leaveDataLoading,
    leaveSubmitConfirmOpen,
    myBalanceRows,
    myLeaveReportFiltered,
    mySearchTerm,
    navigateTab,
    newLeaveEnd,
    newLeaveError,
    newLeaveReason,
    newLeaveStart,
    newLeaveType,
    openDocPreview,
    pendingApprovalForDeptManager,
    pendingApprovedLeaveToRecord,
    pendingHrAdminProcessing,
    pendingHrAdminProcessingHrManager,
    pendingHrManagerApproval,
    pendingHrManagerProcessingHrAdmin,
    pendingLeaveRequest,
    policyViewId,
    portal,
    printAuditReport,
    requestLeaveOpen,
    requests,
    roleDescription,
    router,
    selectedExecutiveReport,
    selectedIds,
    staffAllLeaveRequestsFiltered,
    staffAllStatusFilter,
    staffApprovedRequests,
    staffPendingValidationList,
    statusFilter,
    supportDocInputRef,
    supportingDocument,
    tab,
    toggleAllFor,
    toggleSelected,
  };
}
