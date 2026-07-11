"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import { supabase } from "@/lib/supabase/client";
import {
  appendAuditLog,
  ensureExampleAuditLogs,
  loadAuditLogs,
  type AuditLogEntry,
} from "@/features/leave/services/leaveAuditService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn, generateLeaveRequestId, randomUUID } from "@/lib/utils";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
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
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import {
  leaveRequests,
  leaveBalances,
  getEmployeeById,
  getEmployeeIdsUnderDepartmentManager,
  leaveTypeMetadata,
  departments,
  employees,
  type LeaveRequest,
  type LeaveStatus,
  type Role,
  type TimeOffType,
} from "@/lib/mock";
import {
  adjustLeaveBalanceInSupabase,
  fetchLeaveBalancesFromSupabase,
  fetchDepartmentManagerTeamEmployeeIdsFromSupabase,
  fetchLeaveRequestsFromSupabase,
  isSupabaseLeaveConfigured,
  pushLeaveRequestsToSupabase,
  seedMissingLeaveBalancesToSupabase,
  upsertLeaveBalanceToSupabase,
} from "@/features/leave/services/leaveSupabaseService";
import { resolveCurrentEmployeeUuid } from "@/features/leave/services/supabaseLeave";
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle,
  ClipboardList,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Filter,
  Maximize2,
  ShieldCheck,
  Printer,
  Moon,
  Plus,
  Search,
  Settings,
  Minimize2,
  Sun,
  Upload,
  X,
  User2,
} from "lucide-react";
import { LeaveReferenceAndBalancesTabs } from "@/features/leave/components/LeaveReferenceAndBalancesTabs";
import { LeaveCalendar } from "@/features/leave/components/LeaveCalendar";
import { LeaveRequestsTable } from "@/features/leave/components/LeaveRequestsTable";
import { LeaveReportsTabs } from "@/features/leave/components/LeaveReportsTabs";
import { LeaveRequestDialogs } from "@/features/leave/components/LeaveRequestDialogs";
import { LeaveDetailAndPreviewDialogs } from "@/features/leave/components/LeaveDetailAndPreviewDialogs";
import { LeaveDepartmentManagerDialogs } from "@/features/leave/components/LeaveDepartmentManagerDialogs";
import { LeaveHrActionDialogs } from "@/features/leave/components/LeaveHrActionDialogs";
import { LeavePolicyAndHrManagerDialogs } from "@/features/leave/components/LeavePolicyAndHrManagerDialogs";
import { LeaveHrManagerTabs } from "@/features/leave/components/LeaveHrManagerTabs";
import { LeaveAuditorTabs } from "@/features/leave/components/LeaveAuditorTabs";
import { LeaveHrStaffTabs } from "@/features/leave/components/LeaveHrStaffTabs";
import { leaveStatusVariant } from "@/features/leave/constants/leaveStatusVariant";
import {
  getLeaveDocsBucketName,
  uploadLeaveDocumentToSupabase,
} from "@/features/leave/services/leaveDocumentStorage";
import type { ExecutiveReportKey } from "@/features/leave/constants/executiveReports";
import { EXECUTIVE_REPORTS } from "@/features/leave/constants/executiveReports";
import { allowedTabsByRole, defaultTabByRole } from "@/features/leave/constants/leaveRoleTabs";
import { getLeaveTypeOptions } from "@/features/leave/utils/leaveOptions";
import {
  formatDateToDisplay,
  formatLeaveType,
  migrateLeaveType,
  parseDisplayToISO,
} from "@/features/leave/utils/leaveFormatting";
import {
  calculateInclusiveDays,
  clearLeaveRequestsStorage,
  loadLeaveRequestsFromStorage,
  mapStatusToStepForRole,
  saveLeaveRequestsToStorage,
  toLocalISODate,
} from "@/features/leave/utils/leavePageHelpers";
import {
  getInitialLeaveStatusOnSubmit,
  submitterRoutedToHrManagerAfterHrStaff,
} from "@/features/leave/utils/leaveWorkflowPolicy";

const departmentManagerApprovedStatuses = new Set<LeaveStatus>([
  "PENDING_HR_STAFF_PROCESSING",
  "PENDING_HR_MANAGER_APPROVAL",
  "PENDING_EXECUTIVE_APPROVAL",
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

function normalizeDocUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^(data:|blob:|https?:\/\/|\/)/i.test(value)) return value;
  if (/^\.{1,2}\//.test(value)) return value;
  return `/${value.replace(/^\/+/, "")}`;
}

function isDirectlyViewableDocUrl(value: string): boolean {
  return (
    value.startsWith("blob:") ||
    value.startsWith("data:") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  );
}

function buildDocPreviewCandidates(source: string, name: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const push = (value: string) => {
    const next = value.trim();
    if (!next || seen.has(next)) return;
    seen.add(next);
    candidates.push(next);
  };

  push(normalizeDocUrl(source));
  push(normalizeDocUrl(name));

  const supabaseBase = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!supabaseBase) return candidates;

  const bucketCandidates = ["leave-docs", "leave-documents", "leave", "documents", "uploads"];
  const rawPathCandidates = [source.trim(), name.trim()]
    .map((v) => v.replace(/^\/+/, ""))
    .filter((v) => !!v && !/^(data:|blob:|https?:\/\/)/i.test(v));

  for (const path of rawPathCandidates) {
    push(`${supabaseBase}/storage/v1/object/public/${path}`);
    for (const bucket of bucketCandidates) {
      if (!path.startsWith(`${bucket}/`)) {
        push(`${supabaseBase}/storage/v1/object/public/${bucket}/${path}`);
      }
    }
  }

  return candidates;
}

/** Old mock rows used the literal display name "Engineering Manager" as `employeeName` — exclude from lists. */
function legacyMislabeledEngineeringManagerRow(r: LeaveRequest): boolean {
  return (r.employeeName ?? "").trim().toLowerCase() === "engineering manager";
}

function resolveSubmitterRoleFromCurrentUser(currentUser: {
  role: Role;
  selectedSystemRoleCode?: string;
  selectedSystemRoleName?: string;
  jobTitle?: string;
}): Role {
  const candidates = [
    currentUser.selectedSystemRoleCode,
    currentUser.selectedSystemRoleName,
    currentUser.jobTitle,
    currentUser.role,
  ]
    .filter(Boolean)
    .map((value) =>
      String(value)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z_ ]/g, "")
        .replace(/\s+/g, "_")
    );

  for (const value of candidates) {
    if (
      [
        "EMPLOYEE",
        "AUDITOR",
        "SUPER_ADMIN",
        "BOARD",
        "DEPARTMENT_MANAGER",
        "MANAGER",
        "HR_STAFF",
        "HR_ADMIN",
        "HR_MANAGER",
        "EXECUTIVE",
      ].includes(value)
    ) {
      return value as Role;
    }
    if (value.includes("DEPARTMENT_MANAGER")) return "DEPARTMENT_MANAGER";
    if (value.includes("HR_MANAGER")) return "HR_MANAGER";
    if (value.includes("HR_ADMIN")) return "HR_ADMIN";
    if (value.includes("HR_STAFF")) return "HR_STAFF";
    if (value.includes("AUDITOR") || value.includes("AUDIT")) return "AUDITOR";
    if (value.includes("EXECUTIVE")) return "EXECUTIVE";
    if (value.includes("MANAGER")) return "MANAGER";
  }

  return currentUser.role;
}

const LEAVE_DOC_BUCKET_CANDIDATES = Array.from(
  new Set([
    getLeaveDocsBucketName(),
    "leave-documents",
    "leave-docs",
    "leave",
    "documents",
    "uploads",
  ].filter(Boolean))
);

function extractSupabaseStoragePath(raw: string): { bucket: string; objectPath: string } | null {
  const value = raw.trim();
  if (!value) return null;

  const decoded = decodeURIComponent(value);
  const marker = "/storage/v1/object/public/";
  const markerIdx = decoded.indexOf(marker);
  if (markerIdx >= 0) {
    const rest = decoded.slice(markerIdx + marker.length);
    const slashIdx = rest.indexOf("/");
    if (slashIdx <= 0) return null;
    const bucket = rest.slice(0, slashIdx).trim();
    const objectPath = rest.slice(slashIdx + 1).trim();
    if (!bucket || !objectPath) return null;
    return { bucket, objectPath };
  }

  if (/^(data:|blob:|https?:\/\/)/i.test(decoded)) return null;
  const normalized = decoded.replace(/^\/+/, "");
  if (!normalized) return null;

  if (normalized.includes("/")) {
    for (const bucket of LEAVE_DOC_BUCKET_CANDIDATES) {
      if (normalized.startsWith(`${bucket}/`)) {
        return {
          bucket,
          objectPath: normalized.slice(bucket.length + 1),
        };
      }
    }
  }

  return {
    bucket: getLeaveDocsBucketName(),
    objectPath: normalized,
  };
}

export default function LeavePage() {
  const [tab, setTab] = useState("my-report");
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [requests, setRequests] = useState<LeaveRequest[]>(leaveRequests);
  const requestsRef = useRef(requests);
  const [balances, setBalances] = useState(leaveBalances);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [requestLeaveOpen, setRequestLeaveOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null);
  const [newLeaveType, setNewLeaveType] = useState<TimeOffType>("VACATION_LEAVE");
  const [newLeaveStart, setNewLeaveStart] = useState("");
  const [newLeaveEnd, setNewLeaveEnd] = useState("");
  const [newLeaveReason, setNewLeaveReason] = useState("");
  const [newLeaveError, setNewLeaveError] = useState("");
  const [leaveSubmitConfirmOpen, setLeaveSubmitConfirmOpen] = useState(false);
  const [leaveSubmitInProgress, setLeaveSubmitInProgress] = useState(false);
  const [leaveDraftSaveInProgress, setLeaveDraftSaveInProgress] = useState(false);
  const [pendingLeaveRequest, setPendingLeaveRequest] = useState<LeaveRequest | null>(null);
  /** File picked for the pending confirm step (request form or draft detail); confirm prefers this over `supportingDocument`. */
  const [pendingSubmitAttachFile, setPendingSubmitAttachFile] = useState<File | null>(null);
  const [detailDraftSubmitError, setDetailDraftSubmitError] = useState("");
  const [mySearchTerm, setMySearchTerm] = useState("");
  /** HR Staff "All Requests" tab only — avoids hiding rows when `statusFilter` was changed on My Leave. */
  const [staffAllStatusFilter, setStaffAllStatusFilter] = useState<LeaveStatus | "ALL">("ALL");
  const [selectedExecutiveReport, setSelectedExecutiveReport] = useState<ExecutiveReportKey | "">("");
  const [dmApproveTarget, setDmApproveTarget] = useState<LeaveRequest | null>(null);
  const [dmRejectTarget, setDmRejectTarget] = useState<LeaveRequest | null>(null);
  const [dmRemarks, setDmRemarks] = useState("");
  const [dmRejectReason, setDmRejectReason] = useState("");
  const [hrFinalizeTarget, setHrFinalizeTarget] = useState<LeaveRequest | null>(null);
  const [hrReturnTarget, setHrReturnTarget] = useState<LeaveRequest | null>(null);
  const [hrReturnTo, setHrReturnTo] = useState<"HR_STAFF" | "DEPARTMENT_MANAGER">("HR_STAFF");
  const [hrReturnReason, setHrReturnReason] = useState("");
  const [hrPoliciesDraft, setHrPoliciesDraft] = useState({
    maxLeaveCreditsPerYear: 15,
    allowCarryOver: true,
    carryOverMaxDays: 5,
    noticePeriodDays: 3,
    requireAttachmentsFor: ["SICK_LEAVE", "EMERGENCY_LEAVE"] as TimeOffType[],
    minimumServiceMonths: 3,
  });
  const [hrPoliciesSaved, setHrPoliciesSaved] = useState({
    maxLeaveCreditsPerYear: 15,
    allowCarryOver: true,
    carryOverMaxDays: 5,
    noticePeriodDays: 3,
    requireAttachmentsFor: ["SICK_LEAVE", "EMERGENCY_LEAVE"] as TimeOffType[],
    minimumServiceMonths: 3,
  });
  const [hrPoliciesEditing, setHrPoliciesEditing] = useState(false);
  const [policyViewId, setPolicyViewId] = useState<
    | "maxLeaveCreditsPerYear"
    | "carryOverRules"
    | "noticePeriodDays"
    | "requiredAttachments"
    | "minimumServiceMonths"
    | null
  >(null);
  const [supportingDocument, setSupportingDocument] = useState<File | null>(null);
  const [hmApproveTarget, setHmApproveTarget] = useState<LeaveRequest | null>(null);
  const [hmRejectTarget, setHmRejectTarget] = useState<LeaveRequest | null>(null);
  const [hmRemarks, setHmRemarks] = useState("");
  const [hmRejectReason, setHmRejectReason] = useState("");
  const [hmReturnTarget, setHmReturnTarget] = useState<LeaveRequest | null>(null);
  const [hmReturnReason, setHmReturnReason] = useState("");
  const [hmException, setHmException] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    if (typeof window === "undefined") return [];
    ensureExampleAuditLogs();
    return loadAuditLogs();
  });
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
  const [supabaseDeptManagerEmployeeIds, setSupabaseDeptManagerEmployeeIds] = useState<string[]>([]);
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
  const isCurrentUsersLeave = useCallback((r: LeaveRequest) => {
    if (r.employeeId === currentUser.employeeId) return true;
    const reqNo = (r.employeeNumber ?? "").trim().toUpperCase();
    const curNo = (currentUser.employeeNumber ?? "").trim().toUpperCase();
    return Boolean(reqNo && curNo && reqNo === curNo);
  }, [currentUser.employeeId, currentUser.employeeNumber]);
  const { theme, toggleTheme } = useTheme();
  const dmPendingScrollRef = useRef<HTMLDivElement>(null);
  const dmPendingScrollbarRef = useRef<HTMLDivElement>(null);
  const dmPendingSyncingRef = useRef<"content" | "bar" | null>(null);

  const leaveDataLoading =
    !currentUserHydrated ||
    !hasLoadedStorage ||
    (isSupabaseLeaveConfigured() && !supabaseLeaveReady);

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

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const refreshLeaveBalancesFromSupabase = useCallback(async () => {
    if (!isSupabaseLeaveConfigured()) return;
    const { data, error } = await fetchLeaveBalancesFromSupabase();
    if (error) {
      console.warn("[leave] Supabase leave_balances refresh failed:", error.message);
      return;
    }
    setBalances(data);
  }, []);

  // Open tab from sidebar link (?tab=...) with role-safe fallback
  useEffect(() => {
    const requested = (searchParams.get("tab") ?? "").trim();
    const allowed = new Set(allowedTabsByRole[currentUser.role] ?? allowedTabsByRole.DEFAULT);
    if (currentUser.role === "HR_STAFF") {
      // Hard-allow HR Staff workspace tabs to avoid fallback/reset glitches.
      ["staff-all", "staff-pending", "staff-approved", "staff-forwarded", "calendar"].forEach((t) =>
        allowed.add(t)
      );
    }
    const fallback = defaultTabByRole[currentUser.role] ?? defaultTabByRole.DEFAULT;

    // Default behavior: opening `/leave` with no `tab` should always land on My Leave (personal view).
    // Team/workflow tabs should be explicit via sidebar links (?tab=...).
    const next =
      !requested
        ? currentUser.role === "HR_STAFF"
          ? "staff-all"
          : "my-report"
        : allowed.has(requested)
          ? requested
          : fallback;
    const leavePath = portal.leave;
    const id = window.setTimeout(() => {
      setTab(next);
      if (requested && requested !== next) {
        router.replace(`${leavePath}?tab=${encodeURIComponent(next)}`);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [searchParams, currentUser.role, router, portal.leave]);

  const openDocPreview = useCallback(async (dataUrl: string, name: string) => {
    const source = normalizeDocUrl(dataUrl);
    if (!source) {
      setDocPreview(null);
      setDocMaximized(false);
      return;
    }

    const candidates = buildDocPreviewCandidates(source, name);

    for (const candidate of candidates) {
      const storagePath = extractSupabaseStoragePath(candidate);
      if (storagePath) {
        try {
          const { data, error } = await supabase.storage
            .from(storagePath.bucket)
            .createSignedUrl(storagePath.objectPath, 60 * 10);
          if (!error && data?.signedUrl) {
            const signedRes = await fetch(data.signedUrl);
            if (signedRes.ok) {
              const signedBlob = await signedRes.blob();
              const signedBlobUrl = URL.createObjectURL(signedBlob);
              setDocPreview({ url: signedBlobUrl, name });
              setDocMaximized(false);
              return;
            }
          }
        } catch {
          // Continue to fallback candidate handling.
        }
      }

      if (isDirectlyViewableDocUrl(candidate)) {
        if (candidate.startsWith("blob:") || candidate.startsWith("data:")) {
          setDocPreview({ url: candidate, name });
          setDocMaximized(false);
          return;
        }
        try {
          const directRes = await fetch(candidate);
          if (!directRes.ok) continue;
          const directBlob = await directRes.blob();
          const directBlobUrl = URL.createObjectURL(directBlob);
          setDocPreview({ url: directBlobUrl, name });
          setDocMaximized(false);
          return;
        } catch {
          // Ignore and continue to next candidate.
        }
        continue;
      }

      try {
        const res = await fetch(candidate);
        if (!res.ok) continue;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setDocPreview({ url, name });
        setDocMaximized(false);
        return;
      } catch {
        // Ignore and continue to next candidate.
      }
    }

    setDocPreview(null);
    setDocMaximized(false);
  }, []);

  const closeDocPreview = useCallback(() => {
    setDocMaximized(false);
    setDocPreview((prev) => {
      if (prev?.url?.startsWith("blob:")) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  const syncLeaveBalanceDeltaToSupabase = (
    balance: typeof leaveBalances[number],
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
        const createdBalance = {
          employeeId,
          employeeName,
          employeeNumber,
          type: leaveType,
          totalDays: total,
          usedDays: used,
          pendingDays: pending,
          balanceDays: balance,
        };

        next.push(createdBalance);
        syncLeaveBalanceDeltaToSupabase(createdBalance, pendingDelta, usedDelta);

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

  // Without Supabase: hydrate from localStorage. With Supabase: use mock initial state, then fetch/seed from DB (no local merge).
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!isSupabaseLeaveConfigured()) {
        const stored = loadLeaveRequestsFromStorage();
        if (stored.length > 0) {
          setRequests(
            stored.map((r) => ({ ...r, type: migrateLeaveType(r.type as string) }))
          );
        }
      }
      setHasLoadedStorage(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // When Supabase is configured: shared leave list for every role/session; seed from current state if table is empty.
  useEffect(() => {
    if (!currentUserHydrated || !hasLoadedStorage || !isSupabaseLeaveConfigured()) return;
    let cancelled = false;
    const markNotReadyId = window.setTimeout(() => {
      if (!cancelled) setSupabaseLeaveReady(false);
    }, 0);
    (async () => {
      const { data, error } = await fetchLeaveRequestsFromSupabase();
      let loadedRequests = data;
      if (cancelled) return;
      if (error) {
        console.warn("[leave] Supabase load failed — using local/mock data:", error.message);
        if (!cancelled) setSupabaseLeaveReady(true);
        return;
      }
      if (data.length > 0) {
        setRequests(data);
      } else {
        const snapshot = requestsRef.current;
        loadedRequests = snapshot;
        const { error: pushError } = await pushLeaveRequestsToSupabase(snapshot);
        if (cancelled) return;
        if (pushError) {
          console.warn(
            "[leave] Supabase seed (optional):",
            pushError.message,
            "— new requests can still sync if your employee_code matches mock (e.g. E001)."
          );
        }
      }
      const { data: balanceRows, error: balanceError } = await fetchLeaveBalancesFromSupabase();
      if (cancelled) return;
      if (balanceError) {
        console.warn("[leave] Supabase leave_balances load failed — using default balances:", balanceError.message);
      } else {
        const { error: seedBalanceError } = await seedMissingLeaveBalancesToSupabase({
          defaultTotalDays: hrPoliciesSaved.maxLeaveCreditsPerYear,
          employeeId: canManageCompanyLeaveBalances ? undefined : currentUser.employeeId,
        });
        if (cancelled) return;
        if (seedBalanceError) {
          console.warn("[leave] Supabase leave_balances seed failed:", seedBalanceError.message);
          setBalances(balanceRows);
        } else {
          const { data: refreshedBalanceRows, error: refreshBalanceError } =
            await fetchLeaveBalancesFromSupabase();
          if (cancelled) return;
          if (refreshBalanceError) {
            console.warn("[leave] Supabase leave_balances refresh failed:", refreshBalanceError.message);
            setBalances(balanceRows);
          } else {
            const reconciled = reconcilePendingLeaveBalances(loadedRequests, refreshedBalanceRows);
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
          }
        }
      }
      if (cancelled) return;
      clearLeaveRequestsStorage();
      setSupabaseLeaveReady(true);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(markNotReadyId);
    };
  }, [
    canManageCompanyLeaveBalances,
    currentUser.employeeId,
    currentUserHydrated,
    hasLoadedStorage,
    hrPoliciesSaved.maxLeaveCreditsPerYear,
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

  // Persist to localStorage only when Supabase is not configured (single source of truth = DB when env is set).
  useEffect(() => {
    if (!hasLoadedStorage) return;
    if (isSupabaseLeaveConfigured()) return;
    saveLeaveRequestsToStorage(requests);
  }, [requests, hasLoadedStorage]);

  // Debounced upsert to Supabase after workflow edits (all users share the same rows).
  useEffect(() => {
    if (!hasLoadedStorage || !supabaseLeaveReady || !isSupabaseLeaveConfigured()) return;
    if (currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "MANAGER") return;
    const t = window.setTimeout(() => {
      void pushLeaveRequestsToSupabase(requests).then(({ error, skipped }) => {
        if (error) console.warn("[leave] Supabase sync:", error.message);
        else if (skipped > 0) console.warn("[leave] Supabase sync skipped", skipped, "row(s) (missing employee mapping)");
      });
    }, 650);
    return () => window.clearTimeout(t);
  }, [requests, hasLoadedStorage, supabaseLeaveReady, currentUser.role]);

  useEffect(() => {
    if (
      !currentUserHydrated ||
      currentUser.role !== "DEPARTMENT_MANAGER" ||
      !isSupabaseLeaveConfigured()
    ) {
      const id = window.setTimeout(() => setSupabaseDeptManagerEmployeeIds([]), 0);
      return () => window.clearTimeout(id);
    }

    let cancelled = false;
    void fetchDepartmentManagerTeamEmployeeIdsFromSupabase(currentUser.employeeId).then(
      ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[leave] Supabase department manager team lookup failed:", error.message);
          setSupabaseDeptManagerEmployeeIds([]);
          return;
        }
        setSupabaseDeptManagerEmployeeIds(data);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [currentUser.employeeId, currentUser.role, currentUserHydrated]);

  // Reset optional document when opening the request form
  useEffect(() => {
    if (!requestLeaveOpen) return;
    const id = window.setTimeout(() => {
      setSupportingDocument(null);
      if (supportDocInputRef.current) supportDocInputRef.current.value = "";
    }, 0);
    return () => window.clearTimeout(id);
  }, [requestLeaveOpen]);

  // Department Manager: employees in departments they manage (department.managerId === currentUser)
  const deptManagerEmployeeIds = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    if (isSupabaseLeaveConfigured()) return supabaseDeptManagerEmployeeIds;
    return getEmployeeIdsUnderDepartmentManager(currentUser.employeeId);
  }, [currentUser.role, currentUser.employeeId, supabaseDeptManagerEmployeeIds]);

  const resolveRequestSubmitterRoleForRouting = useCallback(
    (request: LeaveRequest): Role | undefined => {
      if (request.submitterRole) return request.submitterRole;

      const byId = getEmployeeById(request.employeeId)?.role;
      if (byId) return byId;

      const reqNo = (request.employeeNumber ?? "").trim().toUpperCase();
      if (reqNo) {
        const byNumber = employees.find(
          (e) => (e.employeeNumber ?? "").trim().toUpperCase() === reqNo
        )?.role;
        if (byNumber) return byNumber;
      }

      const reqName = (request.employeeName ?? "").trim().toLowerCase();
      if (reqName) {
        const byName = employees.find(
          (e) => `${e.firstName} ${e.lastName}`.trim().toLowerCase() === reqName
        )?.role;
        if (byName) return byName;
      }

      return undefined;
    },
    []
  );

  const isDepartmentManagerTeamRequest = useCallback(
    (request: LeaveRequest) => {
      if (currentUser.role !== "DEPARTMENT_MANAGER") return false;
      if (isCurrentUsersLeave(request)) return false;
      if (deptManagerEmployeeIds.includes(request.employeeId)) return true;

      // When Supabase RLS already scoped leave_requests to the manager's team but
      // employee/team lookup is blocked or incomplete, trust the visible DB rows.
      return isSupabaseLeaveConfigured() && deptManagerEmployeeIds.length === 0;
    },
    [currentUser.role, deptManagerEmployeeIds, isCurrentUsersLeave]
  );

  // Pending approval requests that the Dept Manager can approve (their department only)
  const pendingApprovalForDeptManager = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests.filter(
      (r) =>
        r.status === "PENDING_APPROVAL" &&
        isDepartmentManagerTeamRequest(r)
    );
  }, [requests, currentUser.role, isDepartmentManagerTeamRequest]);

  const dmApprovedRequests = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests
      .filter((r) => isDepartmentManagerTeamRequest(r))
      .filter((r) => isDepartmentManagerApprovedStatus(r.status))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, isDepartmentManagerTeamRequest]);

  const dmRejectedRequests = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests
      .filter((r) => isDepartmentManagerTeamRequest(r))
      .filter((r) => r.status === "REJECTED")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, isDepartmentManagerTeamRequest]);

  const dmTeamOnLeaveTodayCount = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return 0;
    const today = new Date();
    const key = toLocalISODate(today);
    return requests.filter((r) => {
      if (!isDepartmentManagerTeamRequest(r)) return false;
      if (r.status === "REJECTED" || r.status === "CANCELLED") return false;
      return key >= r.startDate && key <= r.endDate;
    }).length;
  }, [requests, currentUser.role, isDepartmentManagerTeamRequest]);

  const hrFinalizationQueue = useMemo(() => {
    if (currentUser.role !== "HR_ADMIN") return [];
    return requests
      .filter((r) => r.status === "PENDING_FINALIZATION" || r.status === "PENDING_RECORDING")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role]);

  const hmHighLevelApprovals = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    const allowedSubmitterRoles = new Set<Role>(["DEPARTMENT_MANAGER", "MANAGER", "HR_STAFF", "HR_ADMIN"]);
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
      const pending = deptRequests.filter(
        (r) =>
          r.status === "PENDING_HR_MANAGER_APPROVAL" ||
          r.status === "PENDING_APPROVAL" ||
          r.status === "PENDING_HR_STAFF_PROCESSING" ||
          r.status === "PENDING_EXECUTIVE_APPROVAL"
      ).length;
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

  // Department Manager: all leave requests from team members (for Team Leave Request tab)
  const teamLeaveRequestsForDeptManager = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [];
    return requests
      .filter((r) => isDepartmentManagerTeamRequest(r))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, isDepartmentManagerTeamRequest]);

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
      "PENDING_APPROVAL",
      "PENDING_HR_STAFF_PROCESSING",
      "PENDING_HR_STAFF_PROCESSING_AUDITOR",
      "PENDING_HR_MANAGER_APPROVAL",
      "PENDING_EXECUTIVE_APPROVAL",
      "APPROVED",
      "FINAL_APPROVED",
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
        const routedToHrManager = submitterRoutedToHrManagerAfterHrStaff(
          resolveRequestSubmitterRoleForRouting(r)
        );
        const isDecidedStatus =
          r.status === "APPROVED" ||
          r.status === "FINAL_APPROVED" ||
          r.status === "REJECTED" ||
          r.status === "APPLIED";
        const finalizedByAnotherApprover =
          isDecidedStatus &&
          Boolean(r.approvedBy) &&
          String(r.approvedBy).trim() !== String(currentUser.employeeId).trim();
        const decidedForwardedToName = routedToHrManager || finalizedByAnotherApprover
          ? "HR Manager"
          : manager
            ? manager.firstName + " " + manager.lastName
            : "Department Manager";
        const forwardedToName =
          r.status === "PENDING_HR_MANAGER_APPROVAL"
            ? "HR Manager"
            : r.status === "PENDING_EXECUTIVE_APPROVAL"
              ? "Executive"
              : r.status === "PENDING_HR_STAFF_PROCESSING" ||
                  r.status === "PENDING_HR_STAFF_PROCESSING_AUDITOR" ||
                  (r.status === "PENDING_APPROVAL" && routedToHrManager)
                ? "HR Staff"
                : isDecidedStatus
                  ? decidedForwardedToName
                : manager
                  ? manager.firstName + " " + manager.lastName
                  : "Department Manager";
        return {
          request: r,
          forwardedToName,
        };
      });
  }, [requests, currentUser.role]);

  const staffApprovedRequests = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    const approvedStatuses = new Set<LeaveStatus>(["FINAL_APPROVED", "APPROVED", "APPLIED"]);
    return requests
      .filter((r) => approvedStatuses.has(r.status))
      .filter((r) => {
        if (!r.approvedBy) return false;
        return getEmployeeById(r.approvedBy)?.role === "HR_STAFF";
      })
      .sort((a, b) => new Date((b.approvedAt ?? b.createdAt)).getTime() - new Date((a.approvedAt ?? a.createdAt)).getTime());
  }, [requests, currentUser.role]);

  const headerByTab: Record<string, string> = {
    "apply": "Apply Leave",
    "my-report": "My Leave Request",
    "balances": "My Leave Balance",
    "exec-summary": "Executive Summary",
    "exec-approvals": "Pending approvals",
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
      : currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER"
      ? "Leave"
      : currentUser.role === "AUDITOR"
      ? "Leave Audit"
      : "Leave Management";
  const initials = currentUser.name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navigateTab = (next: string) => {
    setTab(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    router.push(`${portal.leave}?${params.toString()}`);
  };

  // HR Manager: HR Admin leave requests awaiting processing (send to Executive)
  const pendingHrManagerProcessingHrAdmin = useMemo(() => {
    if (currentUser.role !== "HR_MANAGER") return [];
    return requests.filter((r) => r.status === "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN");
  }, [requests, currentUser.role]);

  // HR Staff: Dept Manager leave requests awaiting processing
  const pendingHrStaffProcessing = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    return requests.filter(
      (r) =>
        !legacyMislabeledEngineeringManagerRow(r) &&
        (r.status === "PENDING_HR_STAFF_PROCESSING" ||
          r.status === "PENDING_APPROVAL")
    );
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

  // Executive: processed HR Manager leave awaiting approve/reject
  const pendingExecutiveApproval = useMemo(() => {
    if (currentUser.role !== "EXECUTIVE") return [];
    return requests.filter((r) => r.status === "PENDING_EXECUTIVE_APPROVAL");
  }, [requests, currentUser.role]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const id = window.setTimeout(() => setSelectedIds([]), 0);
    return () => window.clearTimeout(id);
  }, [tab]);

  useEffect(() => {
    if (tab !== "staff-pending" || currentUser.role !== "HR_STAFF") return;
    const ids = requests
      .filter(
        (r) =>
          r.status === "PENDING_HR_STAFF_PROCESSING" ||
          r.status === "PENDING_HR_STAFF_PROCESSING_AUDITOR" ||
          r.status === "PENDING_APPROVAL"
      )
      .map((r) => r.id);
    const timeoutId = window.setTimeout(() => {
      if (ids.length === 1) setSelectedIds(ids);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [tab, currentUser.role, requests, resolveRequestSubmitterRoleForRouting]);

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

  const runBalanceFinalizeForRequest = (r: LeaveRequest) => {
    const days = calculateInclusiveDays(r.startDate, r.endDate);
    if (days <= 0) return;
    const wasReserved = requestHasReservedPendingBalance(r);
    adjustLeaveBalance(
      r.employeeId,
      r.employeeName,
      r.type,
      wasReserved ? -days : 0,
      days,
      "Finalized leave deduction"
    );
  };

  const finalizeLeaveRequestIds = (
    ids: string[],
    fromStatuses: Set<LeaveStatus>,
    auditSummaryFor: (request: LeaveRequest) => string,
    patch?: (request: LeaveRequest) => Partial<LeaveRequest>
  ) => {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const targets = requests.filter((r) => ids.includes(r.id) && fromStatuses.has(r.status));
    for (const r of targets) {
      runBalanceFinalizeForRequest(r);
    }
    setRequests((prev) =>
      prev.map((x) => {
        if (!ids.includes(x.id) || !fromStatuses.has(x.status)) return x;
        const extra = patch?.(x) ?? {};
        return {
          ...x,
          ...extra,
          status: "FINAL_APPROVED",
          approvedAt: now,
          approvedBy: currentUser.employeeId,
          balanceReserved: false,
        };
      })
    );
    targets.forEach((r) =>
      appendAuditLog({
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "LEAVE_STATUS_CHANGED",
        entityType: "LEAVE_REQUEST",
        entityId: r.id,
        summary: auditSummaryFor(r),
        before: { status: r.status },
        after: { status: "FINAL_APPROVED" },
      })
    );
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

  // HR Staff: dept heads’ own leave → HR Manager; everyone else in this queue → final approval (no HR Admin hop).
  const bulkRouteHrStaffProcessing = () => {
    if (selectedIds.length === 0) return;

    const staffQueueStatuses = new Set<LeaveStatus>([
      "PENDING_HR_STAFF_PROCESSING",
      "PENDING_HR_STAFF_PROCESSING_AUDITOR",
      "PENDING_APPROVAL",
    ]);
    const targets = requests.filter(
      (r) =>
        selectedIds.includes(r.id) &&
        (r.status === "PENDING_HR_STAFF_PROCESSING" ||
          r.status === "PENDING_HR_STAFF_PROCESSING_AUDITOR" ||
          r.status === "PENDING_APPROVAL")
    );
    if (targets.length === 0) {
      setSelectedIds([]);
      return;
    }

    const getSubmitterRoleForRouting = (request: LeaveRequest): Role | undefined =>
      resolveRequestSubmitterRoleForRouting(request);

    const forwardTargets = targets.filter(
      (r) =>
        r.status === "PENDING_APPROVAL" ||
        submitterRoutedToHrManagerAfterHrStaff(getSubmitterRoleForRouting(r))
    );
    const finalizeTargets = targets.filter(
      (r) => !submitterRoutedToHrManagerAfterHrStaff(getSubmitterRoleForRouting(r))
    );

    for (const r of finalizeTargets) {
      runBalanceFinalizeForRequest(r);
    }

    const now = new Date().toISOString();
    setRequests((prev) =>
      prev.map((r) => {
        if (!selectedIds.includes(r.id) || !staffQueueStatuses.has(r.status)) return r;
        if (submitterRoutedToHrManagerAfterHrStaff(getSubmitterRoleForRouting(r))) {
          return { ...r, status: "PENDING_HR_MANAGER_APPROVAL" as LeaveStatus };
        }
        return {
          ...r,
          status: "FINAL_APPROVED",
          approvedAt: now,
          approvedBy: currentUser.employeeId,
          balanceReserved: false,
        };
      })
    );

    forwardTargets.forEach((r) =>
      appendAuditLog({
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "LEAVE_STATUS_CHANGED",
        entityType: "LEAVE_REQUEST",
        entityId: r.id,
        summary: `${currentUser.name} forwarded leave request ${r.id} for ${r.employeeName} to HR Manager.`,
        before: { status: r.status },
        after: { status: "PENDING_HR_MANAGER_APPROVAL" },
      })
    );
    finalizeTargets.forEach((r) =>
      appendAuditLog({
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "LEAVE_STATUS_CHANGED",
        entityType: "LEAVE_REQUEST",
        entityId: r.id,
        summary: `${currentUser.name} finalized leave request ${r.id} for ${r.employeeName} (HR Staff).`,
        before: { status: r.status },
        after: { status: "FINAL_APPROVED" },
      })
    );

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
          ? {
              ...x,
              status: "PENDING_HR_STAFF_PROCESSING",
              approvedAt: now,
              approvedBy: currentUser.employeeId,
              remarks: remarks?.trim() || undefined,
              balanceReserved: x.balanceReserved || reserved,
            }
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
      after: { status: "PENDING_HR_STAFF_PROCESSING" },
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
    finalizeLeaveRequestIds(
      [id],
      new Set<LeaveStatus>(["PENDING_FINALIZATION", "PENDING_RECORDING"]),
      (req) => `${currentUser.name} finalized leave request ${req.id} for ${req.employeeName}.`
    );
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
    const submitterRole = getEmployeeById(r.employeeId)?.role;
    if (submitterRole === "HR_ADMIN") {
      const reserved = reservePendingBalanceForRequest(
        r,
        "HR Manager approval reserved pending days"
      );
      setRequests((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status: "PENDING_EXECUTIVE_APPROVAL",
                approvedAt: now,
                approvedBy: currentUser.employeeId,
                remarks: note || undefined,
                balanceReserved: x.balanceReserved || reserved,
              }
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
        summary: `${currentUser.name} approved leave request ${id} for ${r.employeeName} (sent to Executive).`,
        before: { status: r.status },
        after: { status: "PENDING_EXECUTIVE_APPROVAL" },
      });
      return;
    }
    finalizeLeaveRequestIds(
      [id],
      new Set<LeaveStatus>(["PENDING_HR_MANAGER_APPROVAL"]),
      (req) => `${currentUser.name} approved leave request ${req.id} for ${r.employeeName} (final).`,
      () => (note ? { remarks: note } : {})
    );
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

  const beginLeaveSubmitFlow = (
    type: TimeOffType,
    startRaw: string,
    endRaw: string,
    reasonRaw: string,
    flow: {
      reuseRequestId?: string;
      excludeOverlapRequestId?: string;
      attachFile: File | null;
      existingDoc?: { name?: string; dataUrl?: string };
      createdAt?: string;
    }
  ): string | null => {
    if (leaveSubmitConfirmOpen) {
      return "Please cancel or complete the pending confirmation first.";
    }
    const start = startRaw.trim();
    const end = endRaw.trim();
    const reason = reasonRaw.trim();
    if (!start || !end) {
      return "Please select start and end dates.";
    }
    if (new Date(end) < new Date(start)) {
      return "End date must be on or after start date.";
    }
    if (!reason) {
      return "Please enter a reason.";
    }
    const balanceRow = myBalanceRows.find((b) => b.type === type);
    const total = balanceRow?.totalDays ?? 0;
    const used = balanceRow?.usedDays ?? 0;
    const pending = balanceRow?.pendingDays ?? 0;
    const remaining = balanceRow?.balanceDays ?? Math.max(0, total - used - pending);
    const requestedDays = calculateInclusiveDays(start, end);
    if (requestedDays <= 0) {
      return "Please select a valid leave date range.";
    }
    if (type !== "UNPAID_LEAVE" && requestedDays > remaining) {
      return `You are requesting ${requestedDays} day(s) of ${formatLeaveType(
        type
      )}, but only ${remaining} day(s) remain.`;
    }
    const hasOverlap = requests.some((r) => {
      if (flow.excludeOverlapRequestId && r.id === flow.excludeOverlapRequestId) return false;
      if (!isCurrentUsersLeave(r)) return false;
      if (r.status === "CANCELLED" || r.status === "REJECTED" || r.status === "DRAFT") return false;
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
      return "You already have a leave request that overlaps these dates.";
    }
    const maxDocSize = 10 * 1024 * 1024;
    if (flow.attachFile) {
      const isPdf =
        flow.attachFile.type === "application/pdf" ||
        flow.attachFile.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        return "Only PDF documents are allowed for supporting files.";
      }
      if (flow.attachFile.size > maxDocSize) {
        return "Supporting document is too large (max 10MB). Please upload a smaller PDF.";
      }
    }
    const id = flow.reuseRequestId ?? generateLeaveRequestId(requests.map((r) => r.id));
    const now = new Date().toISOString();
    const submitterRole = resolveSubmitterRoleFromCurrentUser(currentUser);
    const initialStatus = getInitialLeaveStatusOnSubmit(submitterRole);
    const newRequest: LeaveRequest = {
      id,
      employeeId: currentUser.employeeId,
      employeeName: currentUser.name,
      employeeNumber: currentUser.employeeNumber,
      submitterRole,
      type,
      startDate: start,
      endDate: end,
      reason,
      status: initialStatus,
      createdAt: flow.createdAt ?? now,
      supportingDocName: flow.attachFile?.name ?? flow.existingDoc?.name,
      supportingDocDataUrl: flow.attachFile ? undefined : flow.existingDoc?.dataUrl,
    };

    setPendingSubmitAttachFile(flow.attachFile);
    setPendingLeaveRequest(newRequest);
    setLeaveSubmitConfirmOpen(true);
    return null;
  };

  const handleSubmitLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewLeaveError("");
    const err = beginLeaveSubmitFlow(newLeaveType, newLeaveStart, newLeaveEnd, newLeaveReason, {
      attachFile: supportingDocument,
    });
    if (err) setNewLeaveError(err);
  };

  const handleSubmitLeaveFromDraftDetail = (payload: {
    draft: LeaveRequest;
    type: TimeOffType;
    startDate: string;
    endDate: string;
    reason: string;
    attachFile: File | null;
  }) => {
    setDetailDraftSubmitError("");
    const err = beginLeaveSubmitFlow(
      payload.type,
      payload.startDate,
      payload.endDate,
      payload.reason,
      {
        reuseRequestId: payload.draft.id,
        excludeOverlapRequestId: payload.draft.id,
        attachFile: payload.attachFile,
        existingDoc: payload.attachFile
          ? undefined
          : {
              name: payload.draft.supportingDocName,
              dataUrl: payload.draft.supportingDocDataUrl,
            },
        createdAt: payload.draft.createdAt,
      }
    );
    if (err) {
      setDetailDraftSubmitError(err);
      return;
    }
    setDetailRequest(null);
  };

  const handleSaveLeaveDraft = async () => {
    setNewLeaveError("");
    if (leaveSubmitConfirmOpen) return;
    if (leaveDraftSaveInProgress || leaveSubmitInProgress) return;

    const start = newLeaveStart.trim();
    const end = newLeaveEnd.trim();
    const reason = newLeaveReason.trim();

    if ((start && !end) || (!start && end)) {
      setNewLeaveError("Leave both dates blank, or enter both start and end dates, to save a draft.");
      return;
    }
    if (start && end && new Date(end) < new Date(start)) {
      setNewLeaveError("End date must be on or after start date.");
      return;
    }

    const maxDocSize = 10 * 1024 * 1024;
    if (supportingDocument) {
      const isPdf =
        supportingDocument.type === "application/pdf" ||
        supportingDocument.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setNewLeaveError("Only PDF documents are allowed for supporting files.");
        return;
      }
      if (supportingDocument.size > maxDocSize) {
        setNewLeaveError("Supporting document is too large (max 10MB). Please upload a smaller PDF.");
        return;
      }
    }

    setLeaveDraftSaveInProgress(true);
    try {
      const id = generateLeaveRequestId(requests.map((r) => r.id));
      const now = new Date().toISOString();
      const resolvedSubmitterEmployeeId =
        (await resolveCurrentEmployeeUuid(currentUser.employeeId, currentUser.employeeNumber)) ??
        currentUser.employeeId;

      let persistedDocUrl: string | undefined;
      let persistedDocName: string | undefined;
      if (supportingDocument) {
        const uploadResult = await uploadLeaveDocumentToSupabase({
          file: supportingDocument,
          employeeId: currentUser.employeeId,
          employeeNumber: currentUser.employeeNumber,
          requestId: id,
        });
        if (uploadResult.error) {
          setNewLeaveError(`Failed to upload supporting document: ${uploadResult.error.message}`);
          return;
        }
        persistedDocUrl = uploadResult.path ?? uploadResult.publicUrl ?? undefined;
        persistedDocUrl = uploadResult.path ?? undefined;
      }

      const submitterRole = resolveSubmitterRoleFromCurrentUser(currentUser);
      const draftRequest: LeaveRequest = {
        id,
        employeeId: resolvedSubmitterEmployeeId,
        employeeName: currentUser.name,
        employeeNumber: currentUser.employeeNumber,
        submitterRole,
        type: newLeaveType,
        startDate: start,
        endDate: end,
        reason,
        status: "DRAFT",
        createdAt: now,
        supportingDocName: persistedDocName,
        supportingDocDataUrl: persistedDocUrl,
        balanceReserved: false,
      };

      setRequests((prev) => {
        const next = [draftRequest, ...prev];
        if (isSupabaseLeaveConfigured()) {
          void pushLeaveRequestsToSupabase([draftRequest]).then(({ error, skipped }) => {
            if (error) console.warn("[leave] Supabase save after draft:", error.message);
            else if (skipped > 0)
              console.warn(
                "[leave] After draft save,",
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
        entityId: draftRequest.id,
        summary: `${currentUser.name} saved a leave request draft (${draftRequest.type}).`,
        after: {
          type: draftRequest.type,
          startDate: draftRequest.startDate,
          endDate: draftRequest.endDate,
          status: draftRequest.status,
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
    } finally {
      setLeaveDraftSaveInProgress(false);
    }
  };

  const confirmSubmitLeaveRequest = async () => {
    if (!pendingLeaveRequest) return;
    if (leaveSubmitInProgress) return;

    setLeaveSubmitInProgress(true);
    setNewLeaveError("");
    try {
      const newRequest = pendingLeaveRequest;
      const resolvedSubmitterEmployeeId =
        (await resolveCurrentEmployeeUuid(currentUser.employeeId, currentUser.employeeNumber))
        ?? currentUser.employeeId;
      let persistedDocUrl = (newRequest.supportingDocDataUrl ?? "").trim() || undefined;
      const persistedDocName = (newRequest.supportingDocName ?? "").trim() || undefined;

      const fileToUpload = pendingSubmitAttachFile ?? supportingDocument;

      if (fileToUpload) {
        const uploadResult = await uploadLeaveDocumentToSupabase({
          file: fileToUpload,
          employeeId: currentUser.employeeId,
          employeeNumber: currentUser.employeeNumber,
          requestId: newRequest.id,
        });
        if (uploadResult.error) {
          setNewLeaveError(`Failed to upload supporting document: ${uploadResult.error.message}`);
          return;
        }
        // Prefer storage object path so private buckets can be resolved via signed URLs.
        persistedDocUrl = uploadResult.path ?? uploadResult.publicUrl ?? persistedDocUrl;
      }

      setPendingLeaveRequest(null);
      setLeaveSubmitConfirmOpen(false);

      const now = new Date().toISOString();
      let submittedRequest: LeaveRequest;

      if (currentUser.role === "EXECUTIVE") {
        const days = calculateInclusiveDays(newRequest.startDate, newRequest.endDate);
        if (days > 0) {
          adjustLeaveBalance(
            newRequest.employeeId,
            newRequest.employeeName,
            newRequest.type,
            0,
            days,
            "Executive self-approved leave"
          );
        }
        submittedRequest = {
          ...newRequest,
          employeeId: resolvedSubmitterEmployeeId,
          submitterRole:
            newRequest.submitterRole ?? resolveSubmitterRoleFromCurrentUser(currentUser),
          supportingDocName: persistedDocName,
          supportingDocDataUrl: persistedDocUrl,
          status: "FINAL_APPROVED",
          approvedAt: now,
          approvedBy: currentUser.employeeId,
          balanceReserved: false,
        };
      } else {
        const reserved = reservePendingBalanceForRequest(
          newRequest,
          "Submitted leave request reserved pending days"
        );
        submittedRequest = {
          ...newRequest,
          employeeId: resolvedSubmitterEmployeeId,
          submitterRole:
            newRequest.submitterRole ?? resolveSubmitterRoleFromCurrentUser(currentUser),
          supportingDocName: persistedDocName,
          supportingDocDataUrl: persistedDocUrl,
          balanceReserved: newRequest.balanceReserved || reserved,
        };
      }

      // Save into request list (use functional update to avoid stale state).
      setRequests((prev) => {
        const next = [submittedRequest, ...prev.filter((r) => r.id !== submittedRequest.id)];
        if (isSupabaseLeaveConfigured()) {
        void pushLeaveRequestsToSupabase([submittedRequest]).then(({ error, skipped }) => {
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

      setPendingSubmitAttachFile(null);
    } finally {
      setLeaveSubmitInProgress(false);
    }
  };

  const LEAVE_TYPE_OPTIONS = getLeaveTypeOptions();

  useEffect(() => {
    setDetailDraftSubmitError("");
  }, [detailRequest?.id]);

  // My Leave Balance: always current user's balances (all roles).
  // Always render rows for every leave type (so Total / Used / Pending / Balance stays functional).
  const myBalanceRows = (() => {
    const currentEmployeeNumber = (currentUser.employeeNumber ?? "").trim().toUpperCase();
    const rows = balances.filter((b) => {
      if (b.employeeId === currentUser.employeeId) return true;
      const balanceEmployeeNumber = (b.employeeNumber ?? "").trim().toUpperCase();
      return Boolean(currentEmployeeNumber && balanceEmployeeNumber === currentEmployeeNumber);
    });
    const existingByType = new Map(rows.map((r) => [r.type, r]));
    const defaultTotal = (type: TimeOffType) =>
      type === "UNPAID_LEAVE" ? 0 : hrPoliciesSaved.maxLeaveCreditsPerYear;

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
  })();

  // Company-wide balances by employee (all employees, for Employee Balances section)
  const companyBalanceByEmployee = useMemo(() => {
    const map = new Map<
      string,
      { employeeId: string; employeeName: string; employeeNumber: string; rows: typeof leaveBalances }
    >();
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

  // My Leave Report: only current user's personal leave requests (all roles)
  const myLeaveReportRequests = useMemo(() => {
    return requests.filter((r) => isCurrentUsersLeave(r));
  }, [requests, isCurrentUsersLeave]);

  // Company Report: scoped by role (Dept Manager = department; others = all)
  const companyLeaveReportRequests = useMemo(() => {
    if (currentUser.role === "DEPARTMENT_MANAGER") {
      return requests.filter(
        (r) => isDepartmentManagerTeamRequest(r) && !legacyMislabeledEngineeringManagerRow(r)
      );
    }
    if (currentUser.role === "HR_STAFF") {
      return requests.filter((r) => !legacyMislabeledEngineeringManagerRow(r));
    }
    return requests;
  }, [requests, currentUser.role, isDepartmentManagerTeamRequest]);

  // Filtered by status and search for each report tab
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

  // Report/export scope (for Export button - uses current tab context)
  const reportRequests = useMemo(() => {
    return tab === "my-report" ? myLeaveReportRequests : companyLeaveReportRequests;
  }, [tab, myLeaveReportRequests, companyLeaveReportRequests]);

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
  type AuditorReportKey =
    | "monthly-transactions"
    | "approval-turnaround"
    | "rejected-requests"
    | "balance-adjustment-history"
    | "policy-violations"
    | "department-leave-summaries";

  const AUDITOR_REPORTS: Array<{ key: AuditorReportKey; label: string }> = [
    { key: "monthly-transactions", label: "Monthly leave transactions" },
    { key: "approval-turnaround", label: "Approval turnaround time" },
    { key: "rejected-requests", label: "Rejected leave requests" },
    { key: "balance-adjustment-history", label: "Leave balance adjustment history" },
    { key: "policy-violations", label: "Policy violation report" },
    { key: "department-leave-summaries", label: "Department leave summaries" },
  ];

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // (Executive reports constants are defined above the component)

  const getMonthWindow = (d: Date) => {
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const inWindow = (iso: string, start: Date, end: Date) => {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    return t >= start.getTime() && t <= end.getTime();
  };

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

  const overlapDays = (startIso: string, endIso: string, start: Date, end: Date) => {
    const s = new Date(startIso);
    const e = new Date(endIso);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
    const left = s.getTime() > start.getTime() ? s : start;
    const right = e.getTime() < end.getTime() ? e : end;
    if (right.getTime() < left.getTime()) return 0;
    const diffMs = right.getTime() - left.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
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

  // Apply Leave: show only the request form (no tabs, no report)
  if (tab === "apply") {
    const referenceOrder: TimeOffType[] = [
      "VACATION_LEAVE",
      "SICK_LEAVE",
      "EMERGENCY_LEAVE",
      "BEREAVEMENT_LEAVE",
      "MATERNITY_LEAVE",
      "PATERNITY_LEAVE",
      "SOLO_PARENT_LEAVE",
      "UNPAID_LEAVE",
    ];
    return (
      <div
        className={
          currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF"
            ? "flex flex-col gap-6 -mt-2"
            : "space-y-6 -mt-2"
        }
      >
        {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title="My Leave"
              tabs={[
                { id: "apply", label: "Apply Leave" },
                { id: "my-report", label: "My Leave Requests" },
                { id: "balances", label: "My Leave Balance" },
                { id: "reference", label: "Leave Types" },
              ]}
              activeTab="apply"
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : (
          <div className="mt-[10px] flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Apply Leave</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Submit a new leave request. It will be sent for approval.
            </p>
          </div>
        )}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <Card className="h-[82vh] min-h-[480px] flex flex-col min-h-0">
            <CardHeader className="shrink-0">
              <CardTitle>Request leave</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 pt-0 overflow-visible px-6 pb-6">
            <form onSubmit={handleSubmitLeaveRequest} className="space-y-6 w-full max-w-none">
              <div className="space-y-3">
                <Label htmlFor="apply-leave-type">Leave type</Label>
                <select
                  id="apply-leave-type"
                  value={newLeaveType}
                  onChange={(e) => setNewLeaveType(e.target.value as TimeOffType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-w-0"
                >
                  {LEAVE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3 min-w-0">
                  <Label htmlFor="apply-leave-start">Start date</Label>
                  <Input
                    id="apply-leave-start"
                    type="date"
                    className="h-10 w-full min-w-0"
                    value={newLeaveStart}
                    onChange={(e) => {
                      setNewLeaveStart(e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-3 min-w-0">
                  <Label htmlFor="apply-leave-end">End date</Label>
                  <Input
                    id="apply-leave-end"
                    type="date"
                    className="h-10 w-full min-w-0"
                    value={newLeaveEnd}
                    onChange={(e) => {
                      setNewLeaveEnd(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-3">
                <Label htmlFor="apply-leave-reason">Reason</Label>
                <Input
                  id="apply-leave-reason"
                  value={newLeaveReason}
                  onChange={(e) => setNewLeaveReason(e.target.value)}
                  placeholder="e.g. Family trip, medical appointment"
                  className="h-10 w-full min-w-0"
                />
              </div>
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-muted-foreground font-normal">
                  <Upload className="size-4" />
                  Upload supporting document (optional)
                </Label>
                <div className="space-y-2 min-w-0 max-w-full">
                  <div className="flex h-10 items-center rounded-md border border-input bg-background overflow-hidden min-w-0">
                    <input
                      ref={supportDocInputRef}
                      id="apply-supporting-doc"
                      type="file"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      onChange={(e) => setSupportingDocument(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-full rounded-r-none border-0 border-r border-input bg-muted/50 px-4 font-medium shrink-0"
                      onClick={() => supportDocInputRef.current?.click()}
                    >
                      Choose file
                    </Button>
                    <span className="flex-1 min-w-0 px-3 py-2 text-sm text-muted-foreground truncate">
                      {supportingDocument?.name ?? "No file chosen"}
                    </span>
                  </div>
                  {supportingDocument && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 min-w-0 max-w-full overflow-hidden">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground truncate min-w-0" title={supportingDocument!.name}>
                          {supportingDocument!.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({(supportingDocument!.size / 1024).toFixed(1)} KB)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSupportingDocument(null);
                            if (supportDocInputRef.current) supportDocInputRef.current.value = "";
                          }}
                          aria-label="Remove file"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full max-w-full gap-2 shrink-0"
                        onClick={() => {
                          const url = URL.createObjectURL(supportingDocument!);
                          window.open(url, "_blank", "noopener,noreferrer");
                          setTimeout(() => URL.revokeObjectURL(url), 60000);
                        }}
                      >
                        <ExternalLink className="size-4" />
                        Open to review
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {newLeaveError && (
                <p className="text-sm text-destructive">{newLeaveError}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLeaveSubmitConfirmOpen(false);
                    setPendingLeaveRequest(null);
                    setTab("my-report");
                    router.replace(`${portal.leave}?tab=my-report`);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSaveLeaveDraft()}
                  disabled={leaveDraftSaveInProgress || leaveSubmitInProgress}
                >
                  {leaveDraftSaveInProgress ? "Saving…" : "Save as draft"}
                </Button>
                <Button type="submit" disabled={leaveSubmitInProgress || leaveDraftSaveInProgress}>
                  Submit request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

          <Card className="h-[83vh] min-h-[480px] flex flex-col min-h-0 pt-1 pb-2">
            <CardContent className="pt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="mt-2 rounded-md border border-border flex-1 min-h-0 overflow-auto scrollbar-hide p-0">
                <Table scrollable={false}>
                  <TableHeader>
                    <TableRow className="sticky top-0 z-10 bg-accent hover:bg-accent text-accent-foreground cursor-default [&>th:first-child]:rounded-tl-md [&>th:last-child]:rounded-tr-md shadow-[0_1px_0_0_var(--border)]">
                      <TableHead className="text-accent-foreground font-semibold">Leave type</TableHead>
                      <TableHead className="text-accent-foreground font-semibold">Paid or Unpaid</TableHead>
                      <TableHead className="text-accent-foreground font-semibold">Salary status</TableHead>
                      <TableHead className="text-accent-foreground font-semibold">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referenceOrder.map((type) => {
                      const meta = leaveTypeMetadata[type];
                      return (
                        <TableRow key={type}>
                          <TableCell className="font-medium">{meta.label}</TableCell>
                          <TableCell>{meta.paid ? "Paid" : "Unpaid"}</TableCell>
                          <TableCell>{meta.salaryStatus}</TableCell>
                          <TableCell>{meta.notes}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={!!docPreview} onOpenChange={(open) => { if (!open) closeDocPreview(); }}>
          <DialogContent
            className={`flex flex-col p-0 gap-0 max-w-4xl max-h-[90vh] ${docMaximized ? "w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] rounded-xl overflow-hidden" : ""}`}
          >
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" />
                {docPreview?.name ?? "Document preview"}
              </DialogTitle>
            </DialogHeader>
            <button
              type="button"
              aria-label={docMaximized ? "Exit maximize" : "Maximize"}
              onClick={() => setDocMaximized((v) => !v)}
              className="absolute right-14 top-4 rounded-full bg-muted/60 p-1.5 opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {docMaximized ? (
                <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="sr-only">Toggle maximize</span>
            </button>
            <div className={`flex-1 min-h-0 ${docMaximized ? "p-0" : "px-6 pb-6"}`}>
              {docPreview?.url && (
                <iframe
                  src={docPreview?.url ?? ""}
                  title={docPreview?.name ?? "Document preview"}
                  className={`w-full ${docMaximized ? "h-full min-h-0 rounded-md border border-border bg-muted/20" : "h-[70vh] min-h-[400px] rounded-md border border-border bg-muted/20"}`}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // My Leave Report: show only the table (no tab navbar)
  if (false && tab === "my-report") {
    return (
      <div className="space-y-6 -mt-2">
        <div className="mt-[10px] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">My Leave Request</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Overview of your leave taken, pending/approved/rejected. Use Export above to download.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setRequestLeaveOpen(true)}>
              <Plus className="size-4 mr-2" />
              Request leave
            </Button>
            <label htmlFor="my-report-status-filter-standalone" className="text-sm text-muted-foreground">
              Status:
            </label>
            <select
              id="my-report-status-filter-standalone"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as LeaveStatus | "ALL")}
              className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="ALL">All</option>
              <option value="CREATED">Created</option>
                  <option value="PENDING_FINALIZATION">Pending finalization</option>
                  <option value="RETURNED_FOR_REVIEW">Returned for review</option>
              <option value="PENDING_HR_ADMIN_PROCESSING">Pending processing</option>
              <option value="PENDING_HR_STAFF_PROCESSING">Pending HR Staff processing</option>
              <option value="PENDING_HR_STAFF_PROCESSING_AUDITOR">Pending HR Staff (Auditor)</option>
              <option value="PENDING_HR_MANAGER_APPROVAL">Pending HR Manager approval</option>
              <option value="PENDING_HR_ADMIN_PROCESSING_HR_MANAGER">Pending HR Admin (HR Mgr)</option>
              <option value="PENDING_HR_MANAGER_PROCESSING_HR_ADMIN">Pending HR Manager (HR Admin)</option>
              <option value="PENDING_HR_ADMIN_PROCESSING_EXECUTIVE">Pending HR Admin (Executive)</option>
              <option value="PENDING_EXECUTIVE_APPROVAL">Pending Executive approval</option>
              <option value="PENDING_EXECUTIVE_BOARD_APPROVAL">Pending Executive/Board approval</option>
              <option value="PENDING_APPROVAL">Pending approval</option>
              <option value="APPROVED">Approved</option>
                  <option value="FINAL_APPROVED">Final approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="APPLIED">Applied</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="size-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="flex">
          <div className="inline-flex items-center gap-3 rounded-3xl bg-white/5 px-4 py-1.5">
            <button
              type="button"
              className="relative inline-flex items-center gap-2 rounded-3xl px-4 py-1.5 text-xs sm:text-sm font-medium text-[#FDE047]"
              onClick={() => router.push(`${portal.leave}?tab=balances`)}
            >
              <BookOpen className="size-4" />
              <span>My Leave Balance</span>
              <span className="pointer-events-none absolute inset-x-4 -bottom-1 h-[3px] rounded-full bg-[#FDE047]" />
            </button>
            <button
              type="button"
              className="relative inline-flex items-center gap-2 rounded-3xl px-4 py-1.5 text-xs sm:text-sm font-medium text-[#e5e7eb] hover:text-white"
              onClick={() => router.push(`${portal.leave}?tab=reference`)}
            >
              <BookOpen className="size-4" />
              <span>Leave types</span>
            </button>
          </div>
        </div>

        <Card className="h-[83vh] min-h-[480px] flex flex-col min-h-0 pt-1 pb-2">
          <CardContent className="pt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="rounded-md border border-border flex-1 min-h-0 overflow-auto scrollbar-hide p-0">
              <Table scrollable={false}>
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-accent hover:bg-accent text-accent-foreground border-border [&>th:first-child]:rounded-tl-lg [&>th:last-child]:rounded-tr-lg shadow-[0_1px_0_0_var(--border)]">
                    <TableHead className="text-accent-foreground font-semibold">Leave type</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Start</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">End</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Reason</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Supporting doc</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Status</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveDataLoading ? (
                    <TableSkeletonRows columns={7} prefix="leave-my-report-sk" />
                  ) : myLeaveReportFiltered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No leave requests to report.
                      </TableCell>
                    </TableRow>
                  ) : (
                    myLeaveReportFiltered.map((req) => (
                      <TableRow key={req.id}>
                        <TableCell>{formatLeaveType(req.type)}</TableCell>
                        <TableCell>{new Date(req.startDate).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(req.endDate).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={req.reason}>
                          {req.reason}
                        </TableCell>
                        <TableCell className="max-w-[160px]">
                          {(() => {
                            const fallbackDocUrl = (req.supportingDocName ?? "").trim();
                            const resolvedDocUrl = normalizeDocUrl(req.supportingDocDataUrl ?? "")
                              || normalizeDocUrl(fallbackDocUrl);
                            if (!req.supportingDocName) {
                              return <span className="text-muted-foreground text-sm">—</span>;
                            }
                            if (!resolvedDocUrl) {
                              return (
                                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground truncate" title={req.supportingDocName}>
                                  <FileText className="size-4 shrink-0" />
                                  {req.supportingDocName}
                                </span>
                              );
                            }
                            return (
                              <button
                                type="button"
                                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline truncate max-w-full text-left"
                                title={`View ${req.supportingDocName}`}
                                onClick={() => openDocPreview(resolvedDocUrl, req.supportingDocName!)}
                              >
                                <FileText className="size-4 shrink-0 text-muted-foreground" />
                                <span className="truncate">{req.supportingDocName}</span>
                              </button>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={leaveStatusVariant[req.status]}>
                            {req.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={requestLeaveOpen}
          onOpenChange={(open) => {
            // Don't let the parent dialog close when the confirmation dialog opens
            // (Radix may interpret it as an outside interaction).
            if (!open && leaveSubmitConfirmOpen) return;
            setRequestLeaveOpen(open);
            if (!open) {
              setLeaveSubmitConfirmOpen(false);
              setPendingLeaveRequest(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request leave</DialogTitle>
              <DialogDescription>
                Submit a new leave request. It will follow the standard approval flow below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitLeaveRequest} className="space-y-5">
              <div className="rounded-md border border-dashed border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
                <div className="font-medium text-foreground text-sm flex items-center gap-2">
                  <ClipboardList className="size-4 text-muted-foreground" />
                  This request will be reviewed by:
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <span className="font-medium">HR Staff</span>
                  <span className="opacity-70 text-xs">PROCESS / VALIDATE</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="font-medium">Department Manager</span>
                  <span className="opacity-70 text-xs">APPROVE / REJECT</span>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <span className="font-medium">HR Admin</span>
                  <span className="opacity-70 text-xs">FINALIZE &amp; RECORD</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-leave-type-standalone">Leave type</Label>
                <select
                  id="new-leave-type-standalone"
                  value={newLeaveType}
                  onChange={(e) => setNewLeaveType(e.target.value as TimeOffType)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {LEAVE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ClipboardList className="size-4 text-muted-foreground" />
                    Leave policy for {leaveTypeMetadata[newLeaveType].label}
                  </div>
                  <dl className="grid gap-1.5 text-sm">
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted-foreground">Paid or Unpaid:</dt>
                      <dd className="font-medium">{leaveTypeMetadata[newLeaveType].paid ? "Paid" : "Unpaid"}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted-foreground">Salary status:</dt>
                      <dd>{leaveTypeMetadata[newLeaveType].salaryStatus}</dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2">
                      <dt className="text-muted-foreground">Notes:</dt>
                      <dd>{leaveTypeMetadata[newLeaveType].notes}</dd>
                    </div>
                  </dl>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-leave-start-standalone">Start date</Label>
                  <Input
                    id="new-leave-start-standalone"
                    type="date"
                    className="h-10"
                    value={newLeaveStart}
                    onChange={(e) => setNewLeaveStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-leave-end-standalone">End date</Label>
                  <Input
                    id="new-leave-end-standalone"
                    type="date"
                    className="h-10"
                    value={newLeaveEnd}
                    onChange={(e) => setNewLeaveEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {(() => {
                  const b = myBalanceRows.find((r) => r.type === newLeaveType);
                  const total = b?.totalDays ?? 0;
                  const used = b?.usedDays ?? 0;
                  const pending = b?.pendingDays ?? 0;
                  const balance = b?.balanceDays ?? Math.max(0, total - used - pending);
                  if (!total && !used && !pending && !balance) {
                    return "No configured balance for this leave type yet.";
                  }
                  return `For ${formatLeaveType(newLeaveType)} you have ${balance} day(s) remaining (Used ${used}, Pending ${pending}, Total ${total}).`;
                })()}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-leave-reason-standalone">Reason</Label>
                <Input
                  id="new-leave-reason-standalone"
                  value={newLeaveReason}
                  onChange={(e) => setNewLeaveReason(e.target.value)}
                  placeholder="e.g. Family trip, medical appointment"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground font-normal">
                  <Upload className="size-4" />
                  Upload supporting document (optional)
                </Label>
                <div className="space-y-2">
                  <div className="flex h-10 items-center rounded-md border border-input bg-background overflow-hidden">
                    <input
                      ref={supportDocInputRef}
                      id="supporting-doc-standalone"
                      type="file"
                      accept=".pdf,application/pdf"
                      className="sr-only"
                      onChange={(e) => setSupportingDocument(e.target.files?.[0] ?? null)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-full rounded-r-none border-0 border-r border-input bg-muted/50 px-4 font-medium shrink-0"
                      onClick={() => supportDocInputRef.current?.click()}
                    >
                      Choose file
                    </Button>
                    <span className="flex-1 min-w-0 px-3 py-2 text-sm text-muted-foreground truncate">
                      {supportingDocument?.name ?? "No file chosen"}
                    </span>
                  </div>
                  {supportingDocument && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground truncate flex-1" title={supportingDocument!.name}>
                          {supportingDocument!.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({(supportingDocument!.size / 1024).toFixed(1)} KB)
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setSupportingDocument(null);
                            if (supportDocInputRef.current) supportDocInputRef.current.value = "";
                          }}
                          aria-label="Remove file"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto gap-2"
                        onClick={() => {
                          const url = URL.createObjectURL(supportingDocument!);
                          window.open(url, "_blank", "noopener,noreferrer");
                          setTimeout(() => URL.revokeObjectURL(url), 60000);
                        }}
                      >
                        <ExternalLink className="size-4" />
                        Open to review
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {newLeaveError && (
                <p className="text-sm text-destructive">{newLeaveError}</p>
              )}
              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setRequestLeaveOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit request</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!docPreview} onOpenChange={(open) => { if (!open) closeDocPreview(); }}>
          <DialogContent
            className={`flex flex-col p-0 gap-0 max-w-4xl max-h-[90vh] ${docMaximized ? "w-[95vw] h-[95vh] max-w-[95vw] max-h-[95vh] rounded-xl overflow-hidden" : ""}`}
          >
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" />
                {docPreview?.name ?? "Document preview"}
              </DialogTitle>
            </DialogHeader>
            <button
              type="button"
              aria-label={docMaximized ? "Exit maximize" : "Maximize"}
              onClick={() => setDocMaximized((v) => !v)}
              className="absolute right-14 top-4 rounded-full bg-muted/60 p-1.5 opacity-80 ring-offset-background transition-all hover:bg-muted hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {docMaximized ? (
                <Minimize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Maximize2 className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
              <span className="sr-only">Toggle maximize</span>
            </button>
            <div className={`flex-1 min-h-0 ${docMaximized ? "p-0" : "px-6 pb-6"}`}>
              {docPreview?.url && (
                <iframe
                  src={docPreview?.url ?? ""}
                  title={docPreview?.name ?? "Document preview"}
                  className={`w-full ${docMaximized ? "h-full min-h-0 rounded-md border border-border bg-muted/20" : "h-[70vh] min-h-[400px] rounded-md border border-border bg-muted/20"}`}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const hrStaffLeaveManagementTabs = (() => {
    if (currentUser.role !== "HR_STAFF") return [];
    // Keep explicit list for HR Staff so "Approved" always appears in Leave Management.
    return [
      { value: "staff-all", label: "All Requests", Icon: ClipboardList },
      { value: "staff-pending", label: "Pending Validation", Icon: FileCheck },
      { value: "staff-approved", label: "Approved (HR Staff)", Icon: CheckCircle },
      { value: "staff-forwarded", label: "Forwarded", Icon: FileCheck },
      { value: "calendar", label: "Leave Calendar", Icon: CalendarDays },
    ];
  })();
  const hrAdminLeaveTabs = [
    { value: "hr-final", label: "Final Approvals" },
    { value: "hr-records", label: "Leave Records" },
    { value: "hr-balances", label: "Leave Balances" },
    { value: "hr-types", label: "Leave Types" },
    { value: "hr-policies", label: "Policies" },
  ].filter((t) => (allowedTabsByRole.HR_ADMIN ?? []).includes(t.value));
  const hrManagerLeaveTabs = [
    { value: "hm-high", label: "High-Level Approvals" },
    { value: "manager-approvals", label: "HR Manager queue" },
    { value: "manager-process-hr-admin", label: "Process HR Admin leave" },
    { value: "hm-escalated", label: "Escalated Requests" },
    { value: "hm-all", label: "All Leave Requests" },
    { value: "hm-overview", label: "Dept Overview" },
    { value: "hm-overrides", label: "Override Requests" },
  ].filter((t) => (allowedTabsByRole.HR_MANAGER ?? []).includes(t.value));
  const departmentManagerLeaveTabs = [
    { value: "dm-pending", label: "Pending Approvals" },
    { value: "dm-approved", label: "Approved Requests" },
    { value: "dm-rejected", label: "Rejected Requests" },
    { value: "calendar", label: "Team Leave Calendar" },
  ].filter((t) => (allowedTabsByRole.DEPARTMENT_MANAGER ?? []).includes(t.value));
  const auditorLeaveTabs = [
    { value: "audit-records", label: "Leave Records" },
    { value: "audit-trail", label: "Approval Trail" },
    { value: "audit-adjustments", label: "Balance Adjustments" },
    { value: "audit-compliance", label: "Policy Compliance" },
    { value: "audit-reports", label: "Audit Reports" },
  ].filter((t) => (allowedTabsByRole.AUDITOR ?? []).includes(t.value));
  const executiveLeaveTabs = [
    { value: "exec-summary", label: "Executive Summary" },
    { value: "exec-approvals", label: "Pending approvals" },
    { value: "exec-trends", label: "Department Trends" },
    { value: "exec-availability", label: "Workforce Availability" },
    { value: "exec-reports", label: "Leave Reports" },
  ].filter((t) => (allowedTabsByRole.EXECUTIVE ?? []).includes(t.value));

  return (
    <div
      className={`min-w-0 w-full max-w-full ${
        currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE"
          ? "flex flex-col gap-4"
          : "space-y-6"
      }`}
    >
      <div className={currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? "contents" : "min-w-0 space-y-3"}>
        {(currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF") && breadcrumbRoot === "My Leave" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title="My Leave"
              tabs={[
                { id: "apply", label: "Apply Leave" },
                { id: "my-report", label: "My Leave Requests" },
                { id: "balances", label: "My Leave Balance" },
                { id: "reference", label: "Leave Types" },
              ]}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : currentUser.role === "HR_STAFF" && breadcrumbRoot === "Leave Management" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search leave requests..." />
            <EmployeeSectionHeader
              title="Leave"
              tabs={hrStaffLeaveManagementTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : currentUser.role === "HR_ADMIN" && breadcrumbRoot === "Leave" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search leave requests..." />
            <EmployeeSectionHeader
              title="Leave"
              tabs={hrAdminLeaveTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : currentUser.role === "HR_MANAGER" && breadcrumbRoot === "Leave" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search leave requests..." />
            <EmployeeSectionHeader
              title="Leave"
              tabs={hrManagerLeaveTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : currentUser.role === "DEPARTMENT_MANAGER" && breadcrumbRoot === "Leave" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search leave requests..." />
            <EmployeeSectionHeader
              title="Leave"
              tabs={departmentManagerLeaveTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : currentUser.role === "AUDITOR" && breadcrumbRoot === "Leave Audit" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search leave records..." />
            <EmployeeSectionHeader
              title="Leave"
              tabs={auditorLeaveTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : currentUser.role === "EXECUTIVE" && breadcrumbRoot === "Leave Management" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search leave requests..." />
            <EmployeeSectionHeader
              title="Leave"
              tabs={executiveLeaveTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={tab}
              onTabChange={(id) => navigateTab(id)}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">{breadcrumbRoot}</span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">{headerTitle}</span>
                </>
              }
              searchPlaceholder="Search leave requests..."
            />
            {/* Navbar tabs (role/tab-aware) — scroll horizontally on small screens */}
            {currentUser.role !== "HR_STAFF" && (
            <div className="min-w-0">
              <div className="border-b border-border/70">
                <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                  {(
                    (() => {
                      const base = [
                        { value: "my-report", label: "My Leave Request", Icon: ClipboardList },
                        { value: "balances", label: "My Leave Balance", Icon: FileCheck },
                        { value: "reference", label: "Leave Types", Icon: BookOpen },
                      ];

                      const roleTabs: Record<
                        string,
                        Array<{ value: string; label: string; Icon: typeof ClipboardList }>
                      > = {
                        DEPARTMENT_MANAGER: [
                          { value: "dm-pending", label: "Pending Approvals", Icon: CheckCircle },
                          { value: "dm-approved", label: "Approved Requests", Icon: FileCheck },
                          { value: "dm-rejected", label: "Rejected Requests", Icon: X },
                          { value: "calendar", label: "Team Leave Calendar", Icon: CalendarDays },
                        ],
                        HR_MANAGER: [
                          { value: "hm-high", label: "High-Level Approvals", Icon: CheckCircle },
                          { value: "manager-approvals", label: "HR Manager queue", Icon: CheckCircle },
                          { value: "manager-process-hr-admin", label: "Process HR Admin leave", Icon: FileCheck },
                          { value: "hm-escalated", label: "Escalated Requests", Icon: FileCheck },
                          { value: "hm-all", label: "All Leave Requests", Icon: ClipboardList },
                          { value: "hm-overview", label: "Dept Overview", Icon: CalendarDays },
                          { value: "hm-overrides", label: "Override Requests", Icon: X },
                        ],
                        HR_STAFF: [
                          { value: "staff-all", label: "All Requests", Icon: ClipboardList },
                          { value: "staff-pending", label: "Pending Validation", Icon: FileCheck },
                          { value: "staff-approved", label: "Approved (HR Staff)", Icon: CheckCircle },
                          { value: "staff-forwarded", label: "Forwarded", Icon: FileCheck },
                          { value: "calendar", label: "Leave Calendar", Icon: CalendarDays },
                        ],
                        AUDITOR: [
                          { value: "audit-records", label: "Leave Records", Icon: ClipboardList },
                          { value: "audit-trail", label: "Approval Trail", Icon: FileCheck },
                          { value: "audit-adjustments", label: "Balance Adjustments", Icon: FileCheck },
                          { value: "audit-compliance", label: "Policy Compliance", Icon: ClipboardList },
                          { value: "audit-reports", label: "Audit Reports", Icon: Download },
                        ],
                        HR_ADMIN: [
                          { value: "hr-final", label: "Final Approvals", Icon: CheckCircle },
                          { value: "hr-records", label: "Leave Records", Icon: ClipboardList },
                          { value: "hr-balances", label: "Leave Balances", Icon: FileCheck },
                          { value: "hr-types", label: "Leave Types", Icon: BookOpen },
                          { value: "hr-policies", label: "Policies", Icon: ClipboardList },
                        ],
                        EXECUTIVE: [
                          { value: "exec-summary", label: "Executive Summary", Icon: ClipboardList },
                          { value: "exec-approvals", label: "Pending approvals", Icon: CheckCircle },
                          { value: "exec-trends", label: "Department Trends", Icon: FileCheck },
                          { value: "exec-availability", label: "Workforce Availability", Icon: CalendarDays },
                          { value: "exec-reports", label: "Leave Reports", Icon: Download },
                        ],
                      };

                      const allowed = allowedTabsByRole[currentUser.role] ?? allowedTabsByRole.DEFAULT;
                      const extras = (roleTabs[currentUser.role] ?? []).filter((t) =>
                        allowed.includes(t.value)
                      );

                      // Requirement: keep My Leave navbars separate from role-specific workflow/audit navbars
                      const isTeamContext =
                        breadcrumbRoot === "Leave Management" || breadcrumbRoot === "Leave Audit";
                      return isTeamContext ? extras : base;
                    })()
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => navigateTab(value)}
                      className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                        tab === value
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span>{label}</span>
                      <span
                        className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                          tab === value ? "scale-x-100" : "scale-x-0"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            )}
          </>
        )
        }
      </div>

      <Tabs value={tab} onValueChange={setTab} className="min-w-0 space-y-3 leave-management-theme">
        {/* Department Manager: Pending Approvals */}
        {currentUser.role === "DEPARTMENT_MANAGER" && (
          <TabsContent value="dm-pending" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-base">Pending approvals</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Review leave requests from your team. Approved requests go to HR Staff for balance check and final
                  approval.
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-2xl border border-border h-[62vh] min-h-[62vh] bg-background/60 overflow-hidden flex flex-col min-h-0">
                  <div
                    ref={dmPendingScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-hide"
                    onScroll={() => {
                      if (dmPendingSyncingRef.current === "bar") return;
                      const content = dmPendingScrollRef.current;
                      const bar = dmPendingScrollbarRef.current;
                      if (!content || !bar) return;
                      dmPendingSyncingRef.current = "content";
                      bar.scrollLeft = content.scrollLeft;
                      dmPendingSyncingRef.current = null;
                    }}
                  >
                    <Table scrollable={false} className="w-full table-fixed">
                    <TableHeader>
                      <TableRow className="sticky top-0 z-10 bg-[#FFE14E] hover:bg-[#FFE14E] text-[#192853] border-border shadow-[0_1px_0_0_var(--border)]">
                        <TableHead className="text-[#192853] font-semibold w-[16%] min-w-0">Employee Name</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[10%] min-w-0 whitespace-nowrap">Leave Type</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[12%] min-w-0 whitespace-nowrap">Date Range</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[6%] min-w-0 text-right whitespace-nowrap">Total Days</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[18%] min-w-0">Reason</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[12%] min-w-0">Supporting Doc</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[9%] min-w-0 whitespace-nowrap">Submitted</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[9%] min-w-0">Validation Status</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[12%] min-w-[180px] text-right whitespace-nowrap">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveDataLoading ? (
                        <TableSkeletonRows columns={9} prefix="leave-dm-pending-sk" />
                      ) : pendingApprovalForDeptManager.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No pending approvals.
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendingApprovalForDeptManager.map((req) => {
                          const days = calculateInclusiveDays(req.startDate, req.endDate);
                          const hasDoc = !!req.supportingDocName;
                          const overlapWithTeam = requests.some((r) => {
                            if (r.id === req.id) return false;
                            if (!deptManagerEmployeeIds.includes(r.employeeId)) return false;
                            if (r.status === "REJECTED" || r.status === "CANCELLED") return false;
                            return r.startDate <= req.endDate && r.endDate >= req.startDate;
                          });
                          const validationLabel = !hasDoc
                            ? "Missing document"
                            : overlapWithTeam
                            ? "Team conflict"
                            : "Validated";
                          const validationVariant: "success" | "warning" =
                            !hasDoc || overlapWithTeam ? "warning" : "success";

                          return (
                            <TableRow key={req.id} className="odd:bg-background even:bg-muted/20">
                              <TableCell className="align-top min-w-0">
                                <div className="min-w-0">
                                  <p className="font-medium break-words">{req.employeeName}</p>
                                  <p className="text-xs text-muted-foreground break-all">{req.employeeNumber}</p>
                                </div>
                              </TableCell>
                              <TableCell className="align-top min-w-0 whitespace-nowrap">
                                {formatLeaveType(req.type)}
                              </TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap align-top min-w-0">
                                {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right align-top min-w-0 whitespace-nowrap">{days}</TableCell>
                              <TableCell className="min-w-0 align-top">
                                <div className="break-words line-clamp-4" title={req.reason}>
                                  {req.reason}
                                </div>
                              </TableCell>
                              <TableCell className="min-w-0 align-top">
                                {(() => {
                                  const legacyDocUrl = String((req as { supporting_document_url?: unknown }).supporting_document_url ?? "").trim();
                                  const legacyDocName = String((req as { supporting_document_name?: unknown }).supporting_document_name ?? "").trim();
                                  const displayDocName = (req.supportingDocName ?? "").trim() || legacyDocName || "Supporting document";
                                  const fallbackDocUrl = displayDocName;
                                  const resolvedDocUrl = normalizeDocUrl(req.supportingDocDataUrl ?? "")
                                    || normalizeDocUrl(legacyDocUrl)
                                    || normalizeDocUrl(fallbackDocUrl);
                                  if (!displayDocName || displayDocName === "Supporting document" && !resolvedDocUrl) {
                                    return <span className="text-muted-foreground text-sm">—</span>;
                                  }
                                  if (!resolvedDocUrl) {
                                    return (
                                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground truncate" title={displayDocName}>
                                        <FileText className="size-4 shrink-0" />
                                        {displayDocName}
                                      </span>
                                    );
                                  }
                                  return (
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline truncate max-w-full text-left"
                                      title={`View ${displayDocName}`}
                                      onClick={() => openDocPreview(resolvedDocUrl, displayDocName)}
                                    >
                                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                                      <span className="truncate">{displayDocName}</span>
                                    </button>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm align-top whitespace-nowrap">
                                {new Date(req.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge variant={validationVariant}>{validationLabel}</Badge>
                              </TableCell>
                              <TableCell className="text-right min-w-[180px]">
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs rounded-[8px]" onClick={() => setDetailRequest(req)}>
                                    View
                                  </Button>
                                  <Button size="sm" className="h-7 px-2 text-xs rounded-[8px]" onClick={() => { setDmRemarks(""); setDmApproveTarget(req); }}>
                                    Approve
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs rounded-[8px] text-destructive hover:text-destructive" onClick={() => { setDmRejectReason(""); setDmRemarks(""); setDmRejectTarget(req); }}>
                                    Reject
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  </div>

                  {/* Sticky horizontal scrollbar at card bottom */}
                  <div className="hidden mt-auto z-10 border-t border-border bg-background/95 px-0 py-2">
                    <div
                      ref={dmPendingScrollbarRef}
                      className="overflow-x-auto overflow-y-hidden"
                      onScroll={() => {
                        if (dmPendingSyncingRef.current === "content") return;
                        const content = dmPendingScrollRef.current;
                        const bar = dmPendingScrollbarRef.current;
                        if (!content || !bar) return;
                        dmPendingSyncingRef.current = "bar";
                        content.scrollLeft = bar.scrollLeft;
                        dmPendingSyncingRef.current = null;
                      }}
                    >
                      {/* Dummy width equals table min width so scrollbar appears here */}
                      <div className="h-2" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Leave Calendar – monthly view to avoid schedule conflicts (HR Staff, Dept Manager, HR Admin, HR Manager, Executive, Super Admin) */}
        {(currentUser.role === "DEPARTMENT_MANAGER" ||
          currentUser.role === "HR_STAFF" ||
          currentUser.role === "HR_ADMIN" ||
          currentUser.role === "HR_MANAGER" ||
          currentUser.role === "EXECUTIVE" ||
          currentUser.role === "SUPER_ADMIN") && (
          <TabsContent value="calendar" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Leave calendar</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Monthly view of who is on leave, grouped by department, to help prevent scheduling conflicts.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <LeaveCalendar requests={companyLeaveReportRequests} />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Admin: Final Approvals */}
        {currentUser.role === "HR_ADMIN" && (
          <TabsContent value="hr-final" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Card
                className={`border-0 shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardContent className="pt-5">
                  <div className="text-xs opacity-80">Requests for Finalization</div>
                  <div className="mt-1 text-2xl font-semibold">{hrFinalizationQueue.length}</div>
                </CardContent>
              </Card>
              <Card
                className={`border-0 shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardContent className="pt-5">
                  <div className="text-xs opacity-80">Finalized This Month</div>
                  <div className="mt-1 text-2xl font-semibold">{hrFinalizedThisMonthCount}</div>
                </CardContent>
              </Card>
              <Card
                className={`border-0 shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardContent className="pt-5">
                  <div className="text-xs opacity-80">Employees on Leave Today</div>
                  <div className="mt-1 text-2xl font-semibold">{employeesOnLeaveTodayCount}</div>
                </CardContent>
              </Card>
              <Card
                className={`border-0 shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardContent className="pt-5">
                  <div className="text-xs opacity-80">Balance Adjustments</div>
                  <div className="mt-1 text-2xl font-semibold">0</div>
                </CardContent>
              </Card>
            </div>

            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-base">Final approvals</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Requests already validated by HR Staff and approved by the Department Manager, waiting for recording/finalization.
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-2xl border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0 bg-background/60">
                  <Table className="min-w-[1100px]">
                    <TableHeader>
                      <TableRow className="sticky top-0 z-10 bg-[#FFE14E] hover:bg-[#FFE14E] text-[#192853] border-border shadow-[0_1px_0_0_var(--border)]">
                        <TableHead className="text-[#192853] font-semibold w-[210px]">Employee</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[170px]">Department</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[160px]">Leave type</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[190px]">Date range</TableHead>
                        <TableHead className="text-[#192853] font-semibold text-right w-[90px]">Days</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[170px]">Manager approval</TableHead>
                        <TableHead className="text-[#192853] font-semibold w-[140px]">Status</TableHead>
                        <TableHead className="text-[#192853] font-semibold text-right w-[200px]">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hrFinalizationQueue.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            No requests waiting for finalization.
                          </TableCell>
                        </TableRow>
                      ) : (
                        hrFinalizationQueue.map((req) => {
                          const emp = getEmployeeById(req.employeeId);
                          const deptName =
                            departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                          const days = calculateInclusiveDays(req.startDate, req.endDate);
                          const manager = req.approvedBy ? getEmployeeById(req.approvedBy) : undefined;
                          return (
                            <TableRow key={req.id} className="odd:bg-background even:bg-muted/20">
                              <TableCell className="align-top">
                                <div className="font-medium">{req.employeeName}</div>
                                <div className="text-xs text-muted-foreground">{req.employeeNumber}</div>
                              </TableCell>
                              <TableCell className="align-top">{deptName}</TableCell>
                              <TableCell className="align-top">{formatLeaveType(req.type)}</TableCell>
                              <TableCell className="align-top text-muted-foreground whitespace-nowrap">
                                {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="align-top text-right">{days}</TableCell>
                              <TableCell className="align-top">
                                <div className="text-sm">{manager ? `${manager.firstName} ${manager.lastName}` : "Department Manager"}</div>
                                <div className="text-xs text-muted-foreground">{req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "—"}</div>
                              </TableCell>
                              <TableCell className="align-top">
                                <Badge variant={leaveStatusVariant[req.status]}>
                                  {req.status.replace(/_/g, " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="align-top text-right">
                                <div className="inline-flex flex-col lg:flex-row items-stretch lg:items-center justify-end gap-1.5">
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDetailRequest(req)}>
                                    View
                                  </Button>
                                  <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setHrFinalizeTarget(req)}>
                                    Finalize
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setHrReturnTo("HR_STAFF"); setHrReturnReason(""); setHrReturnTarget(req); }}>
                                    Return
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Admin: Leave Records */}
        {currentUser.role === "HR_ADMIN" && (
          <TabsContent value="hr-records" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-base">Leave records</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Archive of finalized leave requests (Final Approved).
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Leave type</TableHead>
                        <TableHead>Date range</TableHead>
                        <TableHead className="text-right">Days</TableHead>
                        <TableHead>Final status</TableHead>
                        <TableHead>Finalized date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hrFinalRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No finalized records yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        hrFinalRecords.map((req) => {
                          const emp = getEmployeeById(req.employeeId);
                          const deptName =
                            departments.find((d) => d.id === emp?.departmentId)?.name ?? "—";
                          return (
                            <TableRow key={req.id}>
                              <TableCell>
                                <div className="font-medium">{req.employeeName}</div>
                                <div className="text-xs text-muted-foreground">{req.employeeNumber}</div>
                              </TableCell>
                              <TableCell>{deptName}</TableCell>
                              <TableCell>{formatLeaveType(req.type)}</TableCell>
                              <TableCell className="text-muted-foreground whitespace-nowrap">
                                {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                {calculateInclusiveDays(req.startDate, req.endDate)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="success">FINAL APPROVED</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Admin: Leave Balances (reuse existing employee balances dataset/state) */}
        {currentUser.role === "HR_ADMIN" && (
          <TabsContent value="hr-balances" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader className="py-3">
                <CardTitle className="text-base">Leave balances</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Monitor employee leave balances. (Adjustments can be added later with audit logging.)
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  {companyBalanceByEmployee.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No leave balances found.
                    </p>
                  ) : (
                    <div className="space-y-6 p-4">
                      {companyBalanceByEmployee.map(({ employeeId, employeeName, employeeNumber, rows }) => (
                        <div key={employeeId} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="inline-flex items-center gap-2 rounded-md bg-[#FEE100] px-3 py-1.5 text-[#2C2E60] shadow-sm">
                              <CalendarDays className="size-4 text-[#2C2E60]" />
                              <span className="text-[15px] font-semibold leading-none">{employeeName}</span>
                              <span className="text-[13px] font-medium opacity-80 leading-none">({employeeNumber || "No employee number"})</span>
                            </div>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Leave type</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Used</TableHead>
                                <TableHead className="text-right">Pending</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(Object.keys(leaveTypeMetadata) as TimeOffType[]).map((type) => {
                                const b = rows.find((r) => r.type === type);
                                return (
                                  <TableRow key={type}>
                                    <TableCell>{formatLeaveType(type)}</TableCell>
                                    <TableCell className="text-right">{b?.totalDays ?? 0}</TableCell>
                                    <TableCell className="text-right">{b?.usedDays ?? 0}</TableCell>
                                    <TableCell className="text-right">{b?.pendingDays ?? 0}</TableCell>
                                    <TableCell className="text-right font-medium">{b?.balanceDays ?? 0}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Admin: Leave Types (configuration placeholder) */}
        {currentUser.role === "HR_ADMIN" && (
          <TabsContent value="hr-types" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-base">Leave types</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configuration view (Add/Edit/Deactivate can be wired to DB later).
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(Object.keys(leaveTypeMetadata) as TimeOffType[]).map((type) => (
                        <TableRow key={type}>
                          <TableCell className="font-medium">{leaveTypeMetadata[type].label}</TableCell>
                          <TableCell className="text-muted-foreground">{leaveTypeMetadata[type].notes}</TableCell>
                          <TableCell>{leaveTypeMetadata[type].paid ? "Paid" : "Unpaid"}</TableCell>
                          <TableCell><Badge variant="secondary">Active</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Admin: Policies */}
        {currentUser.role === "HR_ADMIN" && (
          <TabsContent value="hr-policies" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-base">Policies</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setHrPoliciesDraft(hrPoliciesSaved);
                      setHrPoliciesEditing(true);
                    }}
                    disabled={hrPoliciesEditing}
                  >
                    Update Policy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setHrPoliciesSaved(hrPoliciesDraft);
                      setHrPoliciesEditing(false);
                    }}
                    disabled={!hrPoliciesEditing}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-2xl border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-4 bg-background/60">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="border border-border shadow-sm">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm">Maximum leave credits per year</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sets the default max annual credits for vacation leave.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-xs text-muted-foreground">Max credits</Label>
                          <Input
                            type="number"
                            className="h-9 w-28 text-right"
                            value={hrPoliciesDraft.maxLeaveCreditsPerYear}
                            disabled={!hrPoliciesEditing}
                            onChange={(e) =>
                              setHrPoliciesDraft((p) => ({
                                ...p,
                                maxLeaveCreditsPerYear: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Button size="sm" variant="outline" onClick={() => setPolicyViewId("maxLeaveCreditsPerYear")}>
                            View Policy
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Current: {hrPoliciesSaved.maxLeaveCreditsPerYear} days
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border shadow-sm">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm">Carry-over rules</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Controls whether unused credits carry over to next year.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-xs text-muted-foreground">Allow carry-over</Label>
                          <select
                            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                            value={hrPoliciesDraft.allowCarryOver ? "YES" : "NO"}
                            disabled={!hrPoliciesEditing}
                            onChange={(e) =>
                              setHrPoliciesDraft((p) => ({
                                ...p,
                                allowCarryOver: e.target.value === "YES",
                              }))
                            }
                          >
                            <option value="YES">Yes</option>
                            <option value="NO">No</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-xs text-muted-foreground">Carry-over max</Label>
                          <Input
                            type="number"
                            className="h-9 w-28 text-right"
                            value={hrPoliciesDraft.carryOverMaxDays}
                            disabled={!hrPoliciesEditing || !hrPoliciesDraft.allowCarryOver}
                            onChange={(e) =>
                              setHrPoliciesDraft((p) => ({
                                ...p,
                                carryOverMaxDays: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Button size="sm" variant="outline" onClick={() => setPolicyViewId("carryOverRules")}>
                            View Policy
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Current: {hrPoliciesSaved.allowCarryOver ? `Up to ${hrPoliciesSaved.carryOverMaxDays}` : "Disabled"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border shadow-sm">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm">Notice period before applying</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requires employees to submit requests ahead of time.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-xs text-muted-foreground">Notice period</Label>
                          <Input
                            type="number"
                            className="h-9 w-28 text-right"
                            value={hrPoliciesDraft.noticePeriodDays}
                            disabled={!hrPoliciesEditing}
                            onChange={(e) =>
                              setHrPoliciesDraft((p) => ({
                                ...p,
                                noticePeriodDays: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Button size="sm" variant="outline" onClick={() => setPolicyViewId("noticePeriodDays")}>
                            View Policy
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Current: {hrPoliciesSaved.noticePeriodDays} day(s)
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border shadow-sm">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm">Required attachments</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Specifies which leave types require supporting documents.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4 space-y-3">
                        <div className="space-y-2">
                          {(Object.keys(leaveTypeMetadata) as TimeOffType[]).map((t) => {
                            const checked = hrPoliciesDraft.requireAttachmentsFor.includes(t);
                            return (
                              <label key={t} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-xs text-muted-foreground">{formatLeaveType(t)}</span>
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border border-input"
                                  checked={checked}
                                  disabled={!hrPoliciesEditing}
                                  onChange={(e) =>
                                    setHrPoliciesDraft((p) => ({
                                      ...p,
                                      requireAttachmentsFor: e.target.checked
                                        ? Array.from(new Set([...p.requireAttachmentsFor, t]))
                                        : p.requireAttachmentsFor.filter((x) => x !== t),
                                    }))
                                  }
                                />
                              </label>
                            );
                          })}
                        </div>
                        <div className="flex items-center justify-between">
                          <Button size="sm" variant="outline" onClick={() => setPolicyViewId("requiredAttachments")}>
                            View Policy
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Current: {hrPoliciesSaved.requireAttachmentsFor.length} type(s)
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border border-border shadow-sm lg:col-span-2">
                      <CardHeader className="py-4">
                        <CardTitle className="text-sm">Minimum service before eligibility</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Restricts leave eligibility until an employee reaches a minimum tenure.
                        </p>
                      </CardHeader>
                      <CardContent className="pt-0 pb-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <Label className="text-xs text-muted-foreground">Minimum service</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              className="h-9 w-28 text-right"
                              value={hrPoliciesDraft.minimumServiceMonths}
                              disabled={!hrPoliciesEditing}
                              onChange={(e) =>
                                setHrPoliciesDraft((p) => ({
                                  ...p,
                                  minimumServiceMonths: Math.max(0, Number(e.target.value || 0)),
                                }))
                              }
                            />
                            <span className="text-xs text-muted-foreground">months</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Button size="sm" variant="outline" onClick={() => setPolicyViewId("minimumServiceMonths")}>
                            View Policy
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            Current: {hrPoliciesSaved.minimumServiceMonths} month(s)
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <LeaveHrManagerTabs
          currentUserRole={currentUser.role}
          theme={theme}
          hmHighLevelApprovals={hmHighLevelApprovals}
          hmEscalatedRequests={hmEscalatedRequests}
          requests={requests}
          hmDepartmentOverview={hmDepartmentOverview}
          hmOverridesQueue={hmOverridesQueue}
          calculateInclusiveDays={calculateInclusiveDays}
          getStatusVariant={(status) => leaveStatusVariant[status]}
          setDetailRequest={setDetailRequest}
          setHmRemarks={setHmRemarks}
          setHmException={setHmException}
          setHmApproveTarget={setHmApproveTarget}
          setHmReturnReason={setHmReturnReason}
          setHmReturnTarget={setHmReturnTarget}
          setHmRejectReason={setHmRejectReason}
          setHmRejectTarget={setHmRejectTarget}
          hmApproveRequest={hmApproveRequest}
        />

        <LeaveAuditorTabs
          currentUserRole={currentUser.role}
          theme={theme}
          requests={requests}
          balanceAdjustments={balanceAdjustments}
          auditLogs={auditLogs}
          requiredAttachmentsFor={hrPoliciesSaved.requireAttachmentsFor}
          calculateInclusiveDays={calculateInclusiveDays}
          getStatusVariant={(status) => leaveStatusVariant[status]}
          setDetailRequest={setDetailRequest}
          handleExport={handleExport}
          exportAuditReportCsv={exportAuditReportCsv}
          printAuditReport={printAuditReport}
        />

        {/* Department Manager: Approved Requests */}
        {currentUser.role === "DEPARTMENT_MANAGER" && (
          <TabsContent value="dm-approved" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-base">Approved requests</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Requests you approved. HR Admin will finalize and record (Final Approved).
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Approved Date</TableHead>
                        <TableHead>Forwarded To</TableHead>
                        <TableHead>Final Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dmApprovedRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No approved requests yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dmApprovedRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>
                              <div className="font-medium">{req.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{req.employeeNumber}</div>
                            </TableCell>
                            <TableCell>{formatLeaveType(req.type)}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "—"}
                            </TableCell>
                            <TableCell>HR Admin</TableCell>
                            <TableCell>
                              <Badge variant={req.status === "FINAL_APPROVED" || req.status === "APPLIED" ? "success" : "warning"}>
                                {req.status === "FINAL_APPROVED" || req.status === "APPLIED"
                                  ? "FINAL APPROVED"
                                  : req.status === "PENDING_RECORDING"
                                    ? "PENDING RECORDING"
                                    : "APPROVED"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Department Manager: Rejected Requests */}
        {currentUser.role === "DEPARTMENT_MANAGER" && (
          <TabsContent value="dm-rejected" className="space-y-4">
            <Card
              className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
              }`}
            >
              <CardHeader>
                <CardTitle className="text-base">Rejected requests</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Requests you rejected for records and transparency.
                </p>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee Name</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Date Range</TableHead>
                        <TableHead>Rejection Reason</TableHead>
                        <TableHead>Rejected Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dmRejectedRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No rejected requests yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dmRejectedRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell>
                              <div className="font-medium">{req.employeeName}</div>
                              <div className="text-xs text-muted-foreground">{req.employeeNumber}</div>
                            </TableCell>
                            <TableCell>{formatLeaveType(req.type)}</TableCell>
                            <TableCell className="text-muted-foreground whitespace-nowrap">
                              {new Date(req.startDate).toLocaleDateString()} – {new Date(req.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="max-w-[220px] truncate" title={req.rejectionReason ?? req.remarks ?? ""}>
                              {req.rejectionReason ?? req.remarks ?? "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <LeaveHrStaffTabs
          currentUserRole={currentUser.role}
          theme={theme}
          leaveDataLoading={leaveDataLoading}
          staffAllStatusFilter={staffAllStatusFilter}
          setStaffAllStatusFilter={setStaffAllStatusFilter}
          staffAllLeaveRequestsFiltered={staffAllLeaveRequestsFiltered}
          selectedIds={selectedIds}
          toggleSelected={toggleSelected}
          toggleAllFor={toggleAllFor}
          openDocPreview={openDocPreview}
          staffPendingValidationList={staffPendingValidationList}
          bulkRouteHrStaffProcessing={bulkRouteHrStaffProcessing}
          forwardedForHrStaff={forwardedForHrStaff}
          staffApprovedRequests={staffApprovedRequests}
          getStatusVariant={(status) => leaveStatusVariant[status]}
        />

        {/* HR Admin legacy tabs (hidden; replaced by Leave Management tabs) */}
        {currentUser.role === "HR_ADMIN" && false && (
          <TabsContent value="admin-process" className="space-y-4">
            <Card className="pt-1 pb-2 min-h-[72vh]">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="size-4 text-muted-foreground" />
                    Process (HR Staff)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    HR Staff leave requests awaiting HR Admin processing. Process selected items to send to HR Manager for approval.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      bulkUpdateStatusFrom(
                        "PENDING_HR_ADMIN_PROCESSING",
                        "PENDING_HR_MANAGER_APPROVAL"
                      )
                    }
                    disabled={selectedIds.length === 0}
                  >
                    Process selected
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <LeaveRequestsTable
                    loading={leaveDataLoading}
                    requests={pendingHrAdminProcessing}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    onToggleAll={(checked) =>
                      toggleAllFor(
                        pendingHrAdminProcessing,
                        ["PENDING_HR_ADMIN_PROCESSING"],
                        checked
                      )
                    }
                    canApprove={true}
                    selectableStatuses={["PENDING_HR_ADMIN_PROCESSING"]}
                    showEmployeeColumn={true}
                    onViewSupportingDoc={openDocPreview}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {currentUser.role === "HR_ADMIN" && false && (
          <TabsContent value="admin-process-hr-manager" className="space-y-4">
            <Card className="pt-1 pb-2 min-h-[72vh]">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="size-4 text-muted-foreground" />
                    Process (HR Manager)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    HR Manager leave requests awaiting HR Admin processing. Process selected to send to Executive for approval.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      bulkUpdateStatusFrom(
                        "PENDING_HR_ADMIN_PROCESSING_HR_MANAGER",
                        "PENDING_EXECUTIVE_APPROVAL"
                      )
                    }
                    disabled={selectedIds.length === 0}
                  >
                    Process selected
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <LeaveRequestsTable
                    loading={leaveDataLoading}
                    requests={pendingHrAdminProcessingHrManager}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    onToggleAll={(checked) =>
                      toggleAllFor(
                        pendingHrAdminProcessingHrManager,
                        ["PENDING_HR_ADMIN_PROCESSING_HR_MANAGER"],
                        checked
                      )
                    }
                    canApprove={true}
                    selectableStatuses={["PENDING_HR_ADMIN_PROCESSING_HR_MANAGER"]}
                    showEmployeeColumn={true}
                    onViewSupportingDoc={openDocPreview}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {currentUser.role === "HR_ADMIN" && false && (
          <TabsContent value="admin-record-executive" className="space-y-4">
            <Card className="pt-1 pb-2 min-h-[72vh]">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="size-4 text-muted-foreground" />
                    Record (Approved leave)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Record selected approved items when leave has been entered in the system.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      bulkUpdateStatusFrom("APPROVED", "APPLIED")
                    }
                    disabled={selectedIds.length === 0}
                  >
                    Record selected
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <LeaveRequestsTable
                    loading={leaveDataLoading}
                    requests={pendingApprovedLeaveToRecord}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    onToggleAll={(checked) =>
                      toggleAllFor(
                        pendingApprovedLeaveToRecord,
                        ["APPROVED"],
                        checked
                      )
                    }
                    canApprove={true}
                    selectableStatuses={["APPROVED"]}
                    showEmployeeColumn={true}
                    onViewSupportingDoc={openDocPreview}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Manager: approve/reject processed requests */}
        {currentUser.role === "HR_MANAGER" && (
          <TabsContent value="manager-approvals" className="space-y-4">
            <Card className="pt-1 pb-2 min-h-[72vh]">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle className="size-4 text-muted-foreground" />
                    Approvals
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Leave requests processed by HR Admin or HR Staff, ready for HR Manager decision.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      bulkUpdateStatusFrom(
                        "PENDING_HR_MANAGER_APPROVAL",
                        "REJECTED"
                      )
                    }
                    disabled={selectedIds.length === 0}
                  >
                    Reject selected
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      const approvable = selectedIds.filter((id) => {
                        const row = requests.find((x) => x.id === id);
                        return (
                          row?.status === "PENDING_HR_MANAGER_APPROVAL" &&
                          getEmployeeById(row.employeeId)?.role !== "HR_ADMIN"
                        );
                      });
                      finalizeLeaveRequestIds(
                        approvable,
                        new Set<LeaveStatus>(["PENDING_HR_MANAGER_APPROVAL"]),
                        (req) =>
                          `${currentUser.name} approved leave request ${req.id} for ${req.employeeName} (HR Manager).`
                      );
                      setSelectedIds([]);
                    }}
                    disabled={selectedIds.length === 0}
                  >
                    Approve selected (final)
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <LeaveRequestsTable
                    loading={leaveDataLoading}
                    requests={pendingHrManagerApproval}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    onToggleAll={(checked) =>
                      toggleAllFor(
                        pendingHrManagerApproval,
                        ["PENDING_HR_MANAGER_APPROVAL"],
                        checked
                      )
                    }
                    canApprove={true}
                    selectableStatuses={["PENDING_HR_MANAGER_APPROVAL"]}
                    showEmployeeColumn={true}
                    onViewSupportingDoc={openDocPreview}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* HR Manager: process HR Admin submissions (send to Executive) */}
        {currentUser.role === "HR_MANAGER" && (
          <TabsContent value="manager-process-hr-admin" className="space-y-4">
            <Card className="pt-1 pb-2 min-h-[72vh]">
              <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="size-4 text-muted-foreground" />
                    Process (HR Admin)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    HR Admin leave requests awaiting HR Manager processing. Process selected to send to Executive for approval.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() =>
                      bulkUpdateStatusFrom(
                        "PENDING_HR_MANAGER_PROCESSING_HR_ADMIN",
                        "PENDING_EXECUTIVE_APPROVAL"
                      )
                    }
                    disabled={selectedIds.length === 0}
                  >
                    Process selected
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                  <LeaveRequestsTable
                    loading={leaveDataLoading}
                    requests={pendingHrManagerProcessingHrAdmin}
                    selectedIds={selectedIds}
                    onToggle={toggleSelected}
                    onToggleAll={(checked) =>
                      toggleAllFor(
                        pendingHrManagerProcessingHrAdmin,
                        ["PENDING_HR_MANAGER_PROCESSING_HR_ADMIN"],
                        checked
                      )
                    }
                    canApprove={true}
                    selectableStatuses={["PENDING_HR_MANAGER_PROCESSING_HR_ADMIN"]}
                    showEmployeeColumn={true}
                    onViewSupportingDoc={openDocPreview}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Executive: Leave Overview (summary / trends / availability / reports) */}
        {currentUser.role === "EXECUTIVE" && (
          <>
            <TabsContent value="exec-summary" className="space-y-4">
              <Card
                className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-base">Executive Summary</CardTitle>
                  <p
                    className={cn(
                      "text-sm mt-1",
                      theme === "dark" ? "text-slate-200" : "text-[#2f55a5]"
                    )}
                  >
                    Organization-wide snapshot of leave activity for the selected period.
                  </p>
                </CardHeader>
                <CardContent className="pt-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        theme === "dark"
                          ? "border-border bg-background"
                          : "border-[#9ac4ff] bg-[#eaf4ff]"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs",
                          theme === "dark" ? "text-slate-200" : "text-[#2f55a5]"
                        )}
                      >
                        Total leave requests (this month)
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-2xl font-semibold tabular-nums",
                          theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                        )}
                      >
                        {executiveKpis.totalThisMonth}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        theme === "dark"
                          ? "border-border bg-background"
                          : "border-[#9ac4ff] bg-[#eaf4ff]"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs",
                          theme === "dark" ? "text-slate-200" : "text-[#2f55a5]"
                        )}
                      >
                        Employees on leave today
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-2xl font-semibold tabular-nums",
                          theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                        )}
                      >
                        {executiveKpis.onLeaveToday}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        theme === "dark"
                          ? "border-border bg-background"
                          : "border-[#9ac4ff] bg-[#eaf4ff]"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs",
                          theme === "dark" ? "text-slate-200" : "text-[#2f55a5]"
                        )}
                      >
                        Approved / Final approved (this month)
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-2xl font-semibold tabular-nums",
                          theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                        )}
                      >
                        {executiveKpis.approvedThisMonth}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        theme === "dark"
                          ? "border-border bg-background"
                          : "border-[#9ac4ff] bg-[#eaf4ff]"
                      )}
                    >
                      <div
                        className={cn(
                          "text-xs",
                          theme === "dark" ? "text-slate-200" : "text-[#2f55a5]"
                        )}
                      >
                        Departments with highest leave usage
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-sm font-medium",
                          theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                        )}
                      >
                        {executiveKpis.topDepartments.length > 0 ? executiveKpis.topDepartments.join(", ") : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div
                      className={cn(
                        "rounded-xl border p-4",
                        theme === "dark"
                          ? "border-border bg-background"
                          : "border-[#9ac4ff] bg-[#eaf4ff]"
                      )}
                    >
                      <div
                        className={cn(
                          "text-sm font-medium",
                          theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                        )}
                      >
                        Leave requests by department (this month)
                      </div>
                      <div className="mt-3 space-y-2">
                        {executiveDeptSummaryThisMonth.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No records found.</div>
                        ) : (
                          executiveDeptSummaryThisMonth.slice(0, 8).map((row) => (
                            <div key={row.departmentId} className="flex items-center gap-3">
                              <div
                                className={cn(
                                  "w-40 truncate text-sm",
                                  theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                                )}
                              >
                                {row.departmentName}
                              </div>
                              <div
                                className="flex-1 h-2 rounded-full overflow-hidden"
                                style={{
                                  backgroundColor:
                                    theme === "dark" ? undefined : "#e3efff",
                                }}
                              >
                                <div
                                  className={cn(
                                    "h-full",
                                    theme === "dark" ? "bg-primary" : "bg-[#0f2d61]"
                                  )}
                                  style={{ width: `${row.pctOfMax}%` }}
                                />
                              </div>
                              <div
                                className={cn(
                                  "w-10 text-right text-sm tabular-nums",
                                  theme === "dark" ? "text-slate-50" : "text-[#0f2d61]"
                                )}
                              >
                                {row.total}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-sm font-medium">Most used leave type (this month)</div>
                      <div className="mt-3">
                        <div className="text-2xl font-semibold">{executiveKpis.mostUsedLeaveTypeLabel ?? "—"}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {executiveKpis.mostUsedLeaveTypeCount > 0 ? `${executiveKpis.mostUsedLeaveTypeCount} request(s)` : "No records found."}
                        </div>
                      </div>
                      <div className="mt-6 text-sm font-medium">Approval vs rejection (this month)</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-xs text-muted-foreground">Approved</div>
                          <div className="mt-1 text-lg font-semibold">{executiveKpis.approvedOnlyThisMonth}</div>
                        </div>
                        <div className="rounded-lg border border-border bg-muted/20 p-3">
                          <div className="text-xs text-muted-foreground">Rejected</div>
                          <div className="mt-1 text-lg font-semibold">{executiveKpis.rejectedThisMonth}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-sm font-medium">Department summary (this month)</div>
                    <div className="mt-3 rounded-md border border-border overflow-auto scrollbar-hide">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-accent hover:bg-accent">
                            <TableHead className="font-semibold text-[#192853]">Department</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Total</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Approved</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Rejected</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">On leave today</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {executiveDeptSummaryThisMonth.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                No records found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            executiveDeptSummaryThisMonth.map((row) => (
                              <TableRow key={row.departmentId}>
                                <TableCell>{row.departmentName}</TableCell>
                                <TableCell className="text-right">{row.total}</TableCell>
                                <TableCell className="text-right">{row.approved}</TableCell>
                                <TableCell className="text-right">{row.rejected}</TableCell>
                                <TableCell className="text-right">{row.onLeaveToday}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exec-approvals" className="space-y-4">
              <Card
                className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-base">Pending executive approval</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      HR Manager and other escalated leave awaiting your final decision.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        bulkUpdateStatusFrom("PENDING_EXECUTIVE_APPROVAL", "REJECTED");
                      }}
                      disabled={selectedIds.length === 0}
                    >
                      Reject selected
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        finalizeLeaveRequestIds(
                          selectedIds,
                          new Set<LeaveStatus>(["PENDING_EXECUTIVE_APPROVAL"]),
                          (req) =>
                            `${currentUser.name} approved leave request ${req.id} for ${req.employeeName} (Executive).`
                        );
                        setSelectedIds([]);
                      }}
                      disabled={selectedIds.length === 0}
                    >
                      Approve selected (final)
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
                    <LeaveRequestsTable
                      loading={leaveDataLoading}
                      requests={pendingExecutiveApproval}
                      selectedIds={selectedIds}
                      onToggle={toggleSelected}
                      onToggleAll={(checked) =>
                        toggleAllFor(pendingExecutiveApproval, ["PENDING_EXECUTIVE_APPROVAL"], checked)
                      }
                      canApprove={true}
                      selectableStatuses={["PENDING_EXECUTIVE_APPROVAL"]}
                      showEmployeeColumn={true}
                      onViewSupportingDoc={openDocPreview}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exec-trends" className="space-y-4">
              <Card
                className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-base">Department Trends</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Compare leave behavior across departments.
                  </p>
                </CardHeader>
                <CardContent className="pt-2 space-y-3">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-sm font-medium">Department comparison (this month)</div>
                    <div className="mt-3 rounded-md border border-border overflow-auto scrollbar-hide">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-accent hover:bg-accent">
                            <TableHead className="font-semibold text-[#192853]">Department</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Total requests</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Approved</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Rejected</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Avg leave days</TableHead>
                            <TableHead className="font-semibold text-[#192853]">Most used leave type</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {executiveDeptTrendsThisMonth.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                No records found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            executiveDeptTrendsThisMonth.map((row) => (
                              <TableRow key={row.departmentId}>
                                <TableCell>{row.departmentName}</TableCell>
                                <TableCell className="text-right">{row.total}</TableCell>
                                <TableCell className="text-right">{row.approved}</TableCell>
                                <TableCell className="text-right">{row.rejected}</TableCell>
                                <TableCell className="text-right">{row.avgDays.toFixed(1)}</TableCell>
                                <TableCell className="text-muted-foreground">{row.topLeaveTypeLabel ?? "—"}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exec-availability" className="space-y-4">
              <Card
                className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardHeader>
                  <CardTitle className="text-base">Workforce Availability</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Today’s workforce availability across departments.
                  </p>
                </CardHeader>
                <CardContent className="pt-2 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-xs text-muted-foreground">Active employees (mock)</div>
                      <div className="mt-1 text-2xl font-semibold">{executiveAvailabilityWithThreshold.totalStaff}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-xs text-muted-foreground">Employees on leave today</div>
                      <div className="mt-1 text-2xl font-semibold">{executiveAvailabilityWithThreshold.onLeaveToday}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-xs text-muted-foreground">Present today</div>
                      <div className="mt-1 text-2xl font-semibold">{executiveAvailabilityWithThreshold.presentToday}</div>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-xs text-muted-foreground">Departments below threshold</div>
                      <div className="mt-1 text-2xl font-semibold">{executiveAvailabilityWithThreshold.deptsBelowThreshold}</div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="text-sm font-medium">Department availability (today)</div>
                    <div className="mt-3 rounded-md border border-border overflow-auto scrollbar-hide">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-accent hover:bg-accent">
                            <TableHead className="font-semibold text-[#192853]">Department</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Total staff</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">Present</TableHead>
                            <TableHead className="font-semibold text-[#192853] text-right">On leave</TableHead>
                            <TableHead className="font-semibold text-[#192853]">Availability status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {executiveDeptAvailabilityToday.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                No records found.
                              </TableCell>
                            </TableRow>
                          ) : (
                            executiveDeptAvailabilityToday.map((row) => (
                              <TableRow key={row.departmentId}>
                                <TableCell>{row.departmentName}</TableCell>
                                <TableCell className="text-right">{row.totalStaff}</TableCell>
                                <TableCell className="text-right">{row.present}</TableCell>
                                <TableCell className="text-right">{row.onLeave}</TableCell>
                                <TableCell>
                                  <Badge variant={row.statusVariant}>{row.statusLabel}</Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exec-reports" className="space-y-4">
              <Card
                className={`pt-1 pb-2 min-h-[72vh] rounded-[32px] border-none shadow-sm ${
                  theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
                }`}
              >
                <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-base">Leave Reports</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Generate high-level summaries for executive review.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 rounded-full px-4"
                      onClick={() => exportExecutiveReportCsv("MONTHLY_LEAVE_SUMMARY")}
                    >
                      <Download className="size-4 mr-2" />
                      Export Excel
                    </Button>
                    <Button
                      type="button"
                      className="h-9 rounded-full px-4"
                      onClick={() => {
                        window.print();
                      }}
                    >
                      <Printer className="size-4 mr-2" />
                      Print
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {EXECUTIVE_REPORTS.map((rep) => (
                      <div key={rep.key} className="rounded-xl border border-border bg-background p-4">
                        <div className="text-sm font-semibold">{rep.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">{rep.description}</div>
                        <div className="mt-4 flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-full"
                            onClick={() => setSelectedExecutiveReport(rep.key)}
                          >
                            Generate report
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-full"
                            onClick={() => exportExecutiveReportCsv(rep.key)}
                          >
                            <Download className="size-4 mr-2" />
                            Export
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedExecutiveReport && (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <div className="text-sm font-medium">
                        Preview: {EXECUTIVE_REPORTS.find((r) => r.key === selectedExecutiveReport)?.title}
                      </div>
                      <div className="mt-3 rounded-md border border-border overflow-auto scrollbar-hide">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-accent hover:bg-accent">
                              <TableHead className="font-semibold text-[#192853]">Department</TableHead>
                              <TableHead className="font-semibold text-[#192853] text-right">Total</TableHead>
                              <TableHead className="font-semibold text-[#192853] text-right">Approved</TableHead>
                              <TableHead className="font-semibold text-[#192853] text-right">Rejected</TableHead>
                              <TableHead className="font-semibold text-[#192853] text-right">On leave today</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {executiveDeptSummaryThisMonth.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                  No records found.
                                </TableCell>
                              </TableRow>
                            ) : (
                              executiveDeptSummaryThisMonth.map((row) => (
                                <TableRow key={row.departmentId}>
                                  <TableCell>{row.departmentName}</TableCell>
                                  <TableCell className="text-right">{row.total}</TableCell>
                                  <TableCell className="text-right">{row.approved}</TableCell>
                                  <TableCell className="text-right">{row.rejected}</TableCell>
                                  <TableCell className="text-right">{row.onLeaveToday}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}

        <LeaveReferenceAndBalancesTabs
          theme={theme}
          currentUser={currentUser}
          myBalanceRows={myBalanceRows}
          companyBalanceByEmployee={companyBalanceByEmployee}
        />

        <LeaveReportsTabs
          currentRole={currentUser.role}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onRequestLeave={() => setRequestLeaveOpen(true)}
          myLeaveReportFiltered={myLeaveReportFiltered}
          companyLeaveReportFiltered={companyLeaveReportFiltered}
          onSetDetailRequest={setDetailRequest}
          onCancelRequest={cancelRequest}
          onOpenDocPreview={openDocPreview}
          calculateInclusiveDays={calculateInclusiveDays}
          getRecordedByName={(approvedBy) => {
            if (!approvedBy) return "—";
            const emp = getEmployeeById(approvedBy);
            const fullName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : "";
            return fullName || approvedBy;
          }}
          getStatusVariant={(status) => leaveStatusVariant[status]}
        />
      </Tabs>

      <LeaveRequestDialogs
        currentUserRole={currentUser.role as Role}
        requestLeaveOpen={requestLeaveOpen}
        leaveSubmitConfirmOpen={leaveSubmitConfirmOpen}
        pendingLeaveRequest={pendingLeaveRequest}
        setRequestLeaveOpen={setRequestLeaveOpen}
        setLeaveSubmitConfirmOpen={setLeaveSubmitConfirmOpen}
        setPendingLeaveRequest={setPendingLeaveRequest}
        onLeaveSubmitConfirmDismiss={() => setPendingSubmitAttachFile(null)}
        handleSubmitLeaveRequest={handleSubmitLeaveRequest}
        confirmSubmitLeaveRequest={confirmSubmitLeaveRequest}
        leaveSubmitInProgress={leaveSubmitInProgress}
        onSaveLeaveDraft={handleSaveLeaveDraft}
        leaveDraftSaveInProgress={leaveDraftSaveInProgress}
        leaveTypeOptions={LEAVE_TYPE_OPTIONS}
        newLeaveType={newLeaveType}
        setNewLeaveType={setNewLeaveType}
        newLeaveStart={newLeaveStart}
        setNewLeaveStart={setNewLeaveStart}
        newLeaveEnd={newLeaveEnd}
        setNewLeaveEnd={setNewLeaveEnd}
        newLeaveReason={newLeaveReason}
        setNewLeaveReason={setNewLeaveReason}
        newLeaveError={newLeaveError}
        supportingDocument={supportingDocument}
        setSupportingDocument={setSupportingDocument}
        supportDocInputRef={supportDocInputRef}
        myBalanceRows={myBalanceRows}
      />

      <LeaveDetailAndPreviewDialogs
        detailRequest={detailRequest}
        setDetailRequest={setDetailRequest}
        leaveTypeOptions={LEAVE_TYPE_OPTIONS}
        draftBalanceRows={myBalanceRows}
        onSubmitLeaveDraft={handleSubmitLeaveFromDraftDetail}
        detailDraftSubmitError={detailDraftSubmitError}
        mapStatusToStep={mapStatusToStepForRole}
        getSubmitterRole={(request) => {
          if (request.submitterRole) return request.submitterRole;
          const resolvedCurrentSubmitterRole = resolveSubmitterRoleFromCurrentUser(currentUser);
          if (
            tab === "my-report" &&
            (currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "MANAGER")
          ) {
            return resolvedCurrentSubmitterRole;
          }
          if (isCurrentUsersLeave(request)) {
            return resolvedCurrentSubmitterRole;
          }
          const byId = getEmployeeById(request.employeeId);
          if (byId?.role) return byId.role;

          const reqNo = (request.employeeNumber ?? "").trim().toUpperCase();
          if (reqNo) {
            const byNumber = employees.find(
              (e) => (e.employeeNumber ?? "").trim().toUpperCase() === reqNo
            );
            if (byNumber?.role) return byNumber.role;
          }

          const reqName = (request.employeeName ?? "").trim().toLowerCase();
          if (reqName) {
            const byName = employees.find(
              (e) => `${e.firstName} ${e.lastName}`.trim().toLowerCase() === reqName
            );
            if (byName?.role) return byName.role;
          }

          return "EMPLOYEE";
        }}
        currentUserRole={currentUser.role}
        currentResolvedSubmitterRole={resolveSubmitterRoleFromCurrentUser(currentUser)}
        currentUserName={currentUser.name}
        currentUserEmployeeNumber={currentUser.employeeNumber}
        isOwnRequest={isCurrentUsersLeave}
        calculateInclusiveDays={calculateInclusiveDays}
        openDocPreview={openDocPreview}
        docPreview={docPreview}
        docMaximized={docMaximized}
        setDocMaximized={setDocMaximized}
        closeDocPreview={closeDocPreview}
      />

      <LeaveDepartmentManagerDialogs
        dmApproveTarget={dmApproveTarget}
        setDmApproveTarget={setDmApproveTarget}
        dmRejectTarget={dmRejectTarget}
        setDmRejectTarget={setDmRejectTarget}
        dmRemarks={dmRemarks}
        setDmRemarks={setDmRemarks}
        dmRejectReason={dmRejectReason}
        setDmRejectReason={setDmRejectReason}
        calculateInclusiveDays={calculateInclusiveDays}
        requests={requests}
        deptManagerEmployeeIds={deptManagerEmployeeIds}
        dmApproveRequest={dmApproveRequest}
        dmRejectRequest={dmRejectRequest}
      />

      <LeaveHrActionDialogs
        hrFinalizeTarget={hrFinalizeTarget}
        setHrFinalizeTarget={setHrFinalizeTarget}
        hrReturnTarget={hrReturnTarget}
        setHrReturnTarget={setHrReturnTarget}
        hrReturnReason={hrReturnReason}
        setHrReturnReason={setHrReturnReason}
        hrReturnTo={hrReturnTo}
        setHrReturnTo={setHrReturnTo}
        calculateInclusiveDays={calculateInclusiveDays}
        balances={balances}
        hrFinalizeRequest={hrFinalizeRequest}
        hrReturnForReview={hrReturnForReview}
      />

      <LeavePolicyAndHrManagerDialogs
        policyViewId={policyViewId}
        setPolicyViewId={setPolicyViewId}
        hrPoliciesSaved={hrPoliciesSaved}
        hmApproveTarget={hmApproveTarget}
        setHmApproveTarget={setHmApproveTarget}
        hmRejectTarget={hmRejectTarget}
        setHmRejectTarget={setHmRejectTarget}
        hmReturnTarget={hmReturnTarget}
        setHmReturnTarget={setHmReturnTarget}
        hmRemarks={hmRemarks}
        setHmRemarks={setHmRemarks}
        hmRejectReason={hmRejectReason}
        setHmRejectReason={setHmRejectReason}
        hmReturnReason={hmReturnReason}
        setHmReturnReason={setHmReturnReason}
        hmException={hmException}
        setHmException={setHmException}
        hmApproveRequest={hmApproveRequest}
        hmRejectRequest={hmRejectRequest}
        hmReturnReview={hmReturnReview}
      />


      {/* Auditor print root (same page, no extra tab). Hidden during normal browsing. */}
      <div
        id="audit-print-root"
        style={{ display: auditorPrintHtml ? "block" : "none" }}
        dangerouslySetInnerHTML={{ __html: auditorPrintHtml }}
      />

    </div>
  );
}
