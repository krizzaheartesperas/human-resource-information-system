"use client";

import { useState, useMemo, useEffect, useRef, useCallback, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  workflowRequests,
  employees,
  departments,
  getDirectReportIds,
  getEmployeeIdsUnderDepartmentManager,
  type RequestStatus,
  type WorkflowRequest,
  type RequestType,
} from "@/lib/mock";
import { loadRequestsFromStorage, saveRequestsToStorage } from "@/features/workflow/services/workflowRequests";
import { RequestTable } from "@/features/workflow/components/RequestTable";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { appendAuditLog } from "@/features/audit/services/audit.service";
import { DashboardSectionTopBar } from "@/components/layout/DashboardSectionTopBar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";
import {
  canApproveRequestAtCurrentStage,
  canCreateWorkflowRequest,
  canRoleSubmitRequestType,
  getAllowedRequestTypesForRole,
  getInitialStageForType,
  getNextStage,
  type WorkflowStage,
} from "@/features/workflow/policies";
import {
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  FileText,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  TrendingUp,
  Upload,
  User,
  Wallet,
  X,
} from "lucide-react";

/** Navbar + create-dialog options: one tab per workflow type the employee can file. */
const MY_WORKFLOW_REQUEST_TABS: ReadonlyArray<{ value: RequestType; label: string }> = [
  { value: "PROMOTION", label: "Promotion" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "SALARY_CHANGE", label: "Salary Change" },
  { value: "DEPARTMENT_CHANGE", label: "Department Change" },
  { value: "MANAGER_CHANGE", label: "Manager Change" },
  { value: "PERSONAL_INFO_CHANGE", label: "Personal Information Change" },
];

const PROMOTION_POSITION_SUGGESTIONS = [
  "Software Engineer",
  "Software Engineer II",
  "Senior Software Engineer",
  "Lead Software Engineer",
  "Technical Lead",
  "Engineering Manager",
  "Data Analyst",
  "Senior Data Analyst",
  "QA Engineer",
  "Senior QA Engineer",
];

const TRANSFER_LOCATION_OPTIONS = [
  "Main Office",
  "Cebu Branch",
  "Davao Branch",
  "Clark Office",
  "Remote",
];

const SALARY_INCREASE_PERCENT_OPTIONS = ["3%", "5%", "8%", "10%", "12%", "15%", "20%"];

const WORKFLOW_TAB_ICON: Record<RequestType, React.ComponentType<{ className?: string }>> = {
  PROMOTION: TrendingUp,
  TRANSFER: ArrowRightLeft,
  SALARY_CHANGE: Wallet,
  PERSONAL_INFO_CHANGE: User,
  DEPARTMENT_CHANGE: FileText,
  MANAGER_CHANGE: FileText,
  ROLE_CHANGE: FileText,
};

function inferPositionLevel(title: string): number {
  const n = title.toLowerCase();
  if (/(director|chief|vp|head)/.test(n)) return 7;
  if (/(manager)/.test(n)) return 6;
  if (/(lead|principal|architect)/.test(n)) return 5;
  if (/(senior|sr\.)/.test(n)) return 4;
  if (/( ii|mid|intermediate)/.test(n)) return 3;
  if (/(junior|jr\.)/.test(n)) return 2;
  return 1;
}

function inferDefaultWorkLocation(address: string, departmentName: string): string {
  const normalizedAddress = address.trim().toLowerCase();
  if (normalizedAddress.includes("cebu")) return "Cebu Branch";
  if (normalizedAddress.includes("davao")) return "Davao Branch";
  if (normalizedAddress.includes("clark")) return "Clark Office";
  if (normalizedAddress.includes("remote") || normalizedAddress.includes("wfh")) return "Remote";
  if (departmentName.toLowerCase().includes("technology") || departmentName.toLowerCase().includes("engineering")) {
    return "Main Office";
  }
  return "Main Office";
}

function inferDefaultTeamBranch(departmentName: string): string {
  const dept = departmentName.trim().toLowerCase();
  if (dept.includes("technology") || dept.includes("engineering")) return "Platform Team";
  if (dept.includes("human resources")) return "HR Operations Team";
  if (dept.includes("finance")) return "Accounting Team";
  return "Main Branch Team";
}

function isMyWorkflowTab(tab: string): tab is RequestType {
  return MY_WORKFLOW_REQUEST_TABS.some((x) => x.value === tab);
}

type WorkflowRequestsTab = RequestType | "approve";

/** Loose row from dynamic Supabase selects (schema varies by migration). */
type JsonObject = Record<string, unknown>;

type SupabaseFunctionsClient = {
  functions: {
    invoke: (
      name: string,
      options: { body: Record<string, unknown> }
    ) => Promise<{ data?: unknown; error?: { message?: string } | null }>;
  };
};

export default function RequestsPage() {
  const { user: currentUser, updateUser } = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<WorkflowRequestsTab>("PROMOTION");
  const [myStatusFilter, setMyStatusFilter] = useState<RequestStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const typeForMyList = isMyWorkflowTab(tab) ? tab : null;
  const [requests, setRequests] = useState<WorkflowRequest[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = loadRequestsFromStorage();
    if (stored.length > 0) return stored;
    return isSupabaseAuthConfigured() ? [] : workflowRequests;
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<RequestType | "">("");
  const [createTitle, setCreateTitle] = useState("");
  const [createEntityId, setCreateEntityId] = useState<string>("");
  const [createEffectiveDate, setCreateEffectiveDate] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPersonalInfoField, setCreatePersonalInfoField] = useState<
    | "EMAIL"
    | "BIRTHDATE"
    | "FULLNAME"
    | "ADDRESS"
    | "CONTACT_NUMBER"
    | "CIVIL_STATUS"
    | "SSS"
    | "PHILHEALTH"
    | "PAGIBIG"
    | "TIN"
    | ""
  >("");
  const [createPersonalInfoNewValue, setCreatePersonalInfoNewValue] = useState("");
  const [promotionNewPosition, setPromotionNewPosition] = useState("");
  const [roleChangeNewPosition, setRoleChangeNewPosition] = useState("");
  const [transferTargetTeamBranch, setTransferTargetTeamBranch] = useState("");
  const [transferToLocation, setTransferToLocation] = useState("");
  const [transferImpactNotes, setTransferImpactNotes] = useState("");
  const [departmentChangeTargetDepartmentId, setDepartmentChangeTargetDepartmentId] = useState("");
  const [departmentChangeTargetManagerId, setDepartmentChangeTargetManagerId] = useState("");
  const [departmentChangeBusinessImpact, setDepartmentChangeBusinessImpact] = useState("");
  const [salaryChangePerformanceReference, setSalaryChangePerformanceReference] = useState("");
  const [salaryChangeBudgetJustification, setSalaryChangeBudgetJustification] = useState("");
  const [salaryChangeCurrentSalary, setSalaryChangeCurrentSalary] = useState<number | null>(null);
  const [managerChangeNewManagerId, setManagerChangeNewManagerId] = useState("");
  const [managerChangeTeamImpactNotes, setManagerChangeTeamImpactNotes] = useState("");
  const [createAttachment, setCreateAttachment] = useState<File | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string>("");
  const [reviewFieldFilter, setReviewFieldFilter] = useState<
    | "ALL"
    | "EMAIL"
    | "BIRTHDATE"
    | "FULLNAME"
    | "ADDRESS"
    | "CONTACT_NUMBER"
    | "CIVIL_STATUS"
    | "SSS"
    | "PHILHEALTH"
    | "PAGIBIG"
    | "TIN"
  >("ALL");
  const [reviewDateFilter, setReviewDateFilter] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRequestId, setRejectRequestId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [attachmentPreviewOpen, setAttachmentPreviewOpen] = useState(false);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [attachmentPreviewName, setAttachmentPreviewName] = useState("");
  const [attachmentPreviewMaximized, setAttachmentPreviewMaximized] = useState(false);
  const [teamMemberIdsFromDb, setTeamMemberIdsFromDb] = useState<string[]>([]);
  const [departmentNameById, setDepartmentNameById] = useState<Record<string, string>>({});
  const [resolvedOwnEmployeeDbId, setResolvedOwnEmployeeDbId] = useState<string>("");
  const createAttachmentInputRef = useRef<HTMLInputElement>(null);
  const skipSaveRef = useRef(true); // Skip first save (initial mount) to avoid overwriting stored data
  const stableOwnEmployeeIdRef = useRef<string>(currentUser.employeeId);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ensureUuidRequest = (req: WorkflowRequest): WorkflowRequest =>
    UUID_RE.test(req.id) ? req : { ...req, id: crypto.randomUUID() };

  const isOwnWorkflowRequest = useCallback(
    (r: WorkflowRequest) => {
      const ownerIds = new Set(
        [
          String(currentUser.employeeId ?? "").trim(),
          String(stableOwnEmployeeIdRef.current ?? "").trim(),
          String(resolvedOwnEmployeeDbId ?? "").trim(),
        ].filter(Boolean)
      );
      const currentName = String(currentUser.name ?? "").trim().toLowerCase();
      const currentEmployeeCode = String(currentUser.employeeNumber ?? "").trim().toLowerCase();
      if (ownerIds.has(r.createdBy)) return true;
      const createdByName = String(r.createdByName ?? "").trim().toLowerCase();
      if (currentName && createdByName === currentName) return true;
      if (currentEmployeeCode && createdByName === currentEmployeeCode) return true;
      if (currentEmployeeCode && String(r.createdBy ?? "").trim().toLowerCase() === currentEmployeeCode) return true;
      return false;
    },
    [currentUser.employeeId, currentUser.name, currentUser.employeeNumber, resolvedOwnEmployeeDbId]
  );
  const [requestsUiReady, setRequestsUiReady] = useState(false);
  /** When using Supabase, hydrate immediately from cached list then refresh in background. */
  const [workflowDbHydrated, setWorkflowDbHydrated] = useState(!isSupabaseAuthConfigured());
  const workflowTableLoading =
    !requestsUiReady || (isSupabaseAuthConfigured() && !workflowDbHydrated && requests.length === 0);
  const allowedSubmitTypes = useMemo(
    () => getAllowedRequestTypesForRole(currentUser.role),
    [currentUser.role]
  );
  const visibleWorkflowTabs = useMemo(
    () =>
      MY_WORKFLOW_REQUEST_TABS.filter(
        (x) =>
          allowedSubmitTypes.includes(x.value) &&
          (x.value !== "DEPARTMENT_CHANGE" || currentUser.role === "DEPARTMENT_MANAGER")
      ),
    [allowedSubmitTypes, currentUser.role]
  );
  const requestTypeOptions = visibleWorkflowTabs;
  const activeTabRequestType = isMyWorkflowTab(tab) ? tab : null;
  const activeTabRequestLabel =
    activeTabRequestType
      ? visibleWorkflowTabs.find((opt) => opt.value === activeTabRequestType)?.label ??
        activeTabRequestType.replace(/_/g, " ")
      : "";

  async function refreshRequestsFromDb() {
    if (!isSupabaseAuthConfigured()) return;
    try {
      // Some deployments have older/newer workflow_requests schemas.
      // Retry after removing missing columns to avoid hard failures like:
      // "column workflow_requests.entity_id does not exist"
    let selectCols = [
      "id",
      "employee_id",
      "created_by", // backward compat
      "type",
      "title",
      "status",
      "current_step",
      "remarks",
      "created_at",
      "updated_at",
      "entity_id",
      "entity_type",
      "request_code",
    ];

    let wrRows: JsonObject[] | null = null;
    let wrErr: { message: string } | null = null;
    for (let i = 0; i < 6; i++) {
      const { data, error } = await supabase
        .from("workflow_requests")
        .select(selectCols.join(", "))
        .order("created_at", { ascending: false });
      if (!error) {
        wrRows = (data as unknown as JsonObject[]) ?? [];
        wrErr = null;
        break;
      }
      wrErr = error;
      const missingColumn = error.message.match(/column workflow_requests\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
      if (!missingColumn) break;
      selectCols = selectCols.filter((c) => c !== missingColumn);
      if (selectCols.length === 0) break;
    }

    if (wrErr) {
      setActionMessage(`Could not load workflow requests: ${wrErr.message}`);
      return;
    }

    const wrList = wrRows ?? [];
    if (wrList.length === 0) {
      setRequests([]);
      return;
    }

    const ids = wrList.map((r) => r.id).filter(Boolean).map(String);

    const transferSelectColsBase = [
      "request_id",
      "reason",
      "current_location",
      "new_location",
      "current_team",
      "target_team",
      "target_team_branch",
      "effective_date",
      "impact_notes",
    ];

    const loadTransferRows = async (): Promise<JsonObject[]> => {
      let transferSelectCols = [...transferSelectColsBase];
      for (let i = 0; i < 8; i++) {
        const { data, error } = await supabase
          .from("transfer_requests")
          .select(transferSelectCols.join(", "))
          .in("request_id", ids);
        if (!error) {
          return (data as unknown as JsonObject[]) ?? [];
        }
        const missingColumn =
          error.message.match(/column transfer_requests\.([a-zA-Z0-9_]+) does not exist/i)?.[1] ??
          error.message.match(/Could not find the '([^']+)' column/i)?.[1];
        if (!missingColumn) break;
        transferSelectCols = transferSelectCols.filter((c) => c !== missingColumn);
        if (transferSelectCols.length === 0) break;
      }
      return [];
    };

    const [picRes, attRes, promoRes, roleRes, transferRows] = await Promise.all([
      supabase
        .from("personal_info_changes")
        .select("request_id, field_name, old_value, new_value, reason, supporting_document_url, supporting_document_name")
        .in("request_id", ids),
      supabase
        .from("request_attachments")
        .select("request_id, file_url, file_name, uploaded_at")
        .in("request_id", ids)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("promotion_requests")
        .select("request_id,current_position,proposed_position,effective_date,justification")
        .in("request_id", ids),
      supabase
        .from("role_change_request")
        .select("request_id,current_department,current_position,new_position,effective_date,reason")
        .in("request_id", ids),
      loadTransferRows(),
    ]);

    const picRows = (picRes.error ? [] : picRes.data ?? []) as unknown as JsonObject[];
    const attachmentRows = (attRes.error ? [] : attRes.data ?? []) as unknown as JsonObject[];
    const promotionRows = (promoRes.error ? [] : promoRes.data ?? []) as unknown as JsonObject[];
    const roleChangeRows = (roleRes.error ? [] : roleRes.data ?? []) as unknown as JsonObject[];

    const picByReq = new Map<string, JsonObject>();
    for (const p of picRows ?? []) {
      if (p?.request_id) picByReq.set(String(p.request_id), p);
    }
    const attachmentByReq = new Map<string, JsonObject>();
    for (const a of attachmentRows ?? []) {
      if (!a?.request_id) continue;
      const requestId = String(a.request_id);
      if (!attachmentByReq.has(requestId)) {
        attachmentByReq.set(requestId, a);
      }
    }
    const transferByReq = new Map<string, JsonObject>();
    for (const row of transferRows) {
      if (!row?.request_id) continue;
      transferByReq.set(String(row.request_id), row);
    }
    const promotionByReq = new Map<string, JsonObject>();
    for (const row of promotionRows ?? []) {
      if (!row?.request_id) continue;
      promotionByReq.set(String(row.request_id), row);
    }
    const roleChangeByReq = new Map<string, JsonObject>();
    for (const row of roleChangeRows ?? []) {
      if (!row?.request_id) continue;
      roleChangeByReq.set(String(row.request_id), row);
    }

    const wrListForMapping = wrList.filter((wr) => {
      const typeUpper = String(wr.type ?? "").toUpperCase().replace(/ /g, "_");
      if (typeUpper !== "PROMOTION") return true;
      const statusUpper = String(wr.status ?? "").toUpperCase().replace(/ /g, "_");
      if (statusUpper === "CREATED") return true;
      return promotionByReq.has(String(wr.id));
    });

    const employeeIds = Array.from(
      new Set(
        wrListForMapping
          .map((r) => r.employee_id ?? r.created_by ?? null)
          .filter((x) => typeof x === "string" && x.length > 0)
          .map(String)
      )
    );

    // Hydrate display names (profiles.first_name/last_name) via employees.user_id.
    const empById = new Map<string, JsonObject>();
    const userIds: string[] = [];
    if (employeeIds.length > 0) {
      const { data: empRows } = await supabase
        .from("employees")
        .select("id,user_id,employee_code,position,portal_role")
        .in("id", employeeIds);
      for (const e of (empRows ?? []) as unknown as JsonObject[]) {
        if (!e?.id) continue;
        empById.set(String(e.id), e);
        if (e.user_id) userIds.push(String(e.user_id));
      }
    }

    const profileNameByUserId = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profRows } = await supabase
        .from("profiles")
        .select("user_id,first_name,last_name")
        .in("user_id", Array.from(new Set(userIds)));
      for (const p of (profRows ?? []) as unknown as JsonObject[]) {
        const uid = p?.user_id ? String(p.user_id) : null;
        if (!uid) continue;
        const full = `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim();
        if (full) profileNameByUserId.set(uid, full);
      }
    }

    const mapRequestType = (t: unknown): RequestType =>
      String(t ?? "").toUpperCase().replace(/ /g, "_") as RequestType;
    const mapRequestStatus = (s: unknown): RequestStatus =>
      String(s ?? "").toUpperCase().replace(/ /g, "_") as RequestStatus;
    const parseTransferReasonParts = (raw: unknown) => {
      const text = String(raw ?? "").trim();
      if (!text) {
        return {
          mainReason: "",
          fromLocation: "",
          currentTeamBranch: "",
          toLocation: "",
          teamBranch: "",
          impactNotes: "",
        };
      }
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const fromLine = lines.find((line) => /^from location:/i.test(line));
      const currentTeamBranchLine = lines.find(
        (line) => /^current team\/branch:/i.test(line) || /^current team:/i.test(line)
      );
      const toLine = lines.find((line) => /^to location:/i.test(line));
      const teamBranchLine = lines.find(
        (line) => /^target team\/branch:/i.test(line) || /^target team:/i.test(line)
      );
      const impactLine = lines.find((line) => /^impact notes:/i.test(line));
      const mainReason = lines.find(
        (line) =>
          !/^from location:/i.test(line) &&
          !/^current team\/branch:/i.test(line) &&
          !/^current team:/i.test(line) &&
          !/^to location:/i.test(line) &&
          !/^target team\/branch:/i.test(line) &&
          !/^target team:/i.test(line) &&
          !/^impact notes:/i.test(line)
      ) ?? "";
      return {
        mainReason,
        fromLocation: fromLine ? fromLine.replace(/^from location:\s*/i, "").trim() : "",
        currentTeamBranch: currentTeamBranchLine
          ? currentTeamBranchLine.replace(/^current team(\/branch)?:\s*/i, "").trim()
          : "",
        toLocation: toLine ? toLine.replace(/^to location:\s*/i, "").trim() : "",
        teamBranch: teamBranchLine ? teamBranchLine.replace(/^target team(\/branch)?:\s*/i, "").trim() : "",
        impactNotes: impactLine ? impactLine.replace(/^impact notes:\s*/i, "").trim() : "",
      };
    };
    const mapReviewStage = (step: unknown, type: RequestType): WorkflowRequest["reviewStage"] => {
      const normalized = String(step ?? "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
      const asStage = normalized as WorkflowStage;
      const knownStages = new Set<WorkflowStage>([
        "DEPARTMENT_MANAGER",
        "HR_MANAGER",
        "HR_STAFF",
        "HR_ADMIN",
        "CURRENT_MANAGER",
        "TARGET_MANAGER",
        "NEW_MANAGER",
        "EXECUTIVE",
      ]);
      return knownStages.has(asStage) ? asStage : getInitialStageForType(type);
    };

    const mapped: WorkflowRequest[] = wrListForMapping.map((wr) => {
      const personal = picByReq.get(String(wr.id));
      const attachment = attachmentByReq.get(String(wr.id));
      const transfer = transferByReq.get(String(wr.id));
      const promotion = promotionByReq.get(String(wr.id));
      const roleChange = roleChangeByReq.get(String(wr.id));
      const createdBy = String(wr.employee_id ?? wr.created_by ?? "");
      const emp = createdBy ? empById.get(createdBy) : null;
      const createdByName =
        emp?.user_id && profileNameByUserId.get(String(emp.user_id))
          ? profileNameByUserId.get(String(emp.user_id))
          : emp?.employee_code
          ? String(emp.employee_code)
          : createdBy;
      const type = mapRequestType(wr.type);
      const status = mapRequestStatus(wr.status);
      const transferReasonParts = parseTransferReasonParts(transfer?.reason);
      const promotionJustification = String(promotion?.justification ?? "").trim();
      const promotionReason = promotionJustification
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !/^expected salary \(optional\):/i.test(line)) ?? "";
      const promotionCurrentPosition =
        (promotion?.current_position as string | undefined)?.trim() ||
        (emp?.position ? String(emp.position).trim() : "") ||
        (emp?.job_title ? String(emp.job_title).trim() : "") ||
        (createdBy === currentUser.employeeId ? currentUser.jobTitle?.trim() : "") ||
        "—";

      const reviewStage = mapReviewStage(wr.current_step, type);

      return {
        id: String(wr.id),
        type,
        title: wr.title ?? "",
        createdBy,
        createdByName: createdByName ?? "",
        status,
        createdAt: wr.created_at ?? wr.createdAt ?? new Date().toISOString(),
        entityId: wr.entity_id ?? undefined,
        entityType: wr.entity_type ?? undefined,
        effectiveDate:
          type === "TRANSFER"
            ? (transfer?.effective_date as string | undefined) ?? undefined
            : type === "ROLE_CHANGE"
            ? (roleChange?.effective_date as string | undefined) ?? undefined
            : undefined,
        personalInfoField: personal?.field_name
          ? String(personal.field_name).toUpperCase()
          : undefined,
        currentValue: personal?.old_value ?? undefined,
        newValue: personal?.new_value ?? undefined,
        reason:
          type === "PERSONAL_INFO_CHANGE"
            ? (personal?.reason as string | undefined)
            : type === "PROMOTION"
            ? (promotionReason || undefined)
            : type === "TRANSFER"
            ? (transferReasonParts.mainReason || (transfer?.reason as string | undefined))
            : type === "ROLE_CHANGE"
            ? (roleChange?.reason as string | undefined)
            : undefined,
        attachmentDataUrl:
          (personal?.supporting_document_url as string | undefined) ??
          (attachment?.file_url as string | undefined),
        attachmentName:
          (personal?.supporting_document_name as string | undefined) ??
          (attachment?.file_name as string | undefined) ??
          ((attachment?.file_url as string | undefined) ? "Supporting document" : undefined),
        reviewStage: reviewStage,
        reviewNotes: wr.remarks ?? undefined,
        description:
          type === "PERSONAL_INFO_CHANGE" && personal
            ? `Personal Info Change (${personal.field_name}).`
            : type === "PROMOTION" && promotion
            ? `Promotion Request
Employee: ${createdByName ?? "—"}
Current Position: ${promotionCurrentPosition}
New Position: ${(promotion?.proposed_position as string | undefined) ?? "—"}
Effective Date: ${(promotion?.effective_date as string | undefined) ?? "—"}
Reason: ${promotionReason || "—"}`
            : type === "TRANSFER" && transfer
            ? `Transfer Request
Employee: ${createdByName ?? "—"}
From Location: ${
                (transfer?.current_location as string | undefined) || transferReasonParts.fromLocation || "—"
              }
Current Team: ${(transfer?.current_team as string | undefined) || transferReasonParts.currentTeamBranch || "—"}
To Location: ${(transfer?.new_location as string | undefined) || transferReasonParts.toLocation || "—"}
Target Team: ${
                (transfer?.target_team as string | undefined) ||
                (transfer?.target_team_branch as string | undefined) ||
                transferReasonParts.teamBranch ||
                "—"
              }
Effective Date: ${(transfer?.effective_date as string | undefined) ?? "—"}
Reason: ${transferReasonParts.mainReason || "—"}
Impact Notes: ${
                (transfer?.impact_notes as string | undefined) || transferReasonParts.impactNotes || "—"
              }`
            : type === "ROLE_CHANGE" && roleChange
            ? `Role Change Request
Employee: ${createdByName ?? "—"}
Department: ${(roleChange?.current_department as string | undefined) ?? "—"}
Current Position: ${(roleChange?.current_position as string | undefined) ?? "—"}
New Position: ${(roleChange?.new_position as string | undefined) ?? "—"}
Effective Date: ${(roleChange?.effective_date as string | undefined) ?? "—"}
Reason: ${(roleChange?.reason as string | undefined) ?? "—"}`
            : undefined,
      } as WorkflowRequest;
    });

    setRequests(mapped);
    } finally {
      setWorkflowDbHydrated(true);
    }
  }

  useEffect(() => {
    setRequestsUiReady(true);
    if (isSupabaseAuthConfigured()) {
      setWorkflowDbHydrated(loadRequestsFromStorage().length > 0);
    }
  }, []);

  useEffect(() => {
    void refreshRequestsFromDb();
  }, []);

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) return;
    if (!currentUser.employeeId) return;
    void refreshRequestsFromDb();
  }, [currentUser.employeeId]);

  useEffect(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") {
      setTeamMemberIdsFromDb([]);
      return;
    }
    if (!isSupabaseAuthConfigured()) return;

    let cancelled = false;
    void (async () => {
      let selectCols = ["id", "manager_id"];
      let rows: JsonObject[] | null = null;
      for (let i = 0; i < 4; i++) {
        const { data, error } = await supabase.from("employees").select(selectCols.join(", "));
        if (!error) {
          rows = (data as unknown as JsonObject[]) ?? [];
          break;
        }
        const missingColumn = error.message.match(/column employees\.([a-zA-Z0-9_]+) does not exist/i)?.[1];
        if (!missingColumn) {
          rows = [];
          break;
        }
        selectCols = selectCols.filter((c) => c !== missingColumn);
        if (selectCols.length === 0) {
          rows = [];
          break;
        }
      }

      const teamIds = (rows ?? [])
        .filter((r) => String(r?.manager_id ?? "") === currentUser.employeeId)
        .map((r) => String(r?.id ?? ""))
        .filter(Boolean);

      if (!cancelled) setTeamMemberIdsFromDb(Array.from(new Set(teamIds)));
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser.role, currentUser.employeeId, requests.length]);

  // Open tab from sidebar link (?tab=...)
  useEffect(() => {
    const t = searchParams.get("tab");
    const fallback = visibleWorkflowTabs[0]?.value ?? "PROMOTION";
    if (t === "approve" && currentUser.role !== "EMPLOYEE" && currentUser.role !== "AUDITOR") setTab("approve");
    else if (t && isMyWorkflowTab(t) && allowedSubmitTypes.includes(t)) setTab(t);
    else setTab(fallback);
  }, [searchParams, currentUser.role, visibleWorkflowTabs, allowedSubmitTypes]);

  useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false; // Allow saves after first run
      return;
    }
    saveRequestsToStorage(requests);
  }, [requests]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = window.setTimeout(() => {
      setActionMessage("");
    }, 60000); // Auto-hide after 1 minute
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  useEffect(() => {
    const currentId = String(currentUser.employeeId ?? "").trim();
    if (!currentId) return;
    const isUuidLike =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(currentId);
    const hasRowsForCurrentId = requests.some((r) => r.createdBy === currentId);
    if (isUuidLike || hasRowsForCurrentId) {
      stableOwnEmployeeIdRef.current = currentId;
    }
    const currentName = String(currentUser.name ?? "").trim().toLowerCase();
    const currentEmployeeCode = String(currentUser.employeeNumber ?? "").trim().toLowerCase();
    const inferredOwnerId = requests.find((r) => {
      const byName = currentName && String(r.createdByName ?? "").trim().toLowerCase() === currentName;
      const byCode = currentEmployeeCode && (
        String(r.createdByName ?? "").trim().toLowerCase() === currentEmployeeCode ||
        String(r.createdBy ?? "").trim().toLowerCase() === currentEmployeeCode
      );
      return Boolean(byName || byCode);
    })?.createdBy;
    if (inferredOwnerId?.trim()) {
      stableOwnEmployeeIdRef.current = inferredOwnerId.trim();
    }
  }, [currentUser.employeeId, currentUser.name, currentUser.employeeNumber, requests]);

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) return;
    let cancelled = false;
    void (async () => {
      const resolved = await resolveEmployeeUuidForDb(currentUser.employeeNumber?.trim());
      if (cancelled) return;
      if (resolved.id) setResolvedOwnEmployeeDbId(resolved.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser.employeeId, currentUser.employeeNumber]);

  useEffect(() => {
    if (!isSupabaseAuthConfigured()) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("departments").select("id,name").limit(500);
      if (cancelled || error || !data) return;
      const next: Record<string, string> = {};
      for (const row of data as Array<{ id?: string; name?: string }>) {
        if (row.id && row.name) next[row.id] = row.name;
      }
      setDepartmentNameById(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!createOpen || editingRequestId) return;
    if (activeTabRequestType) {
      setCreateType(activeTabRequestType);
    }
  }, [createOpen, editingRequestId, activeTabRequestType]);

  const myRequests = useMemo(() => {
    if (!typeForMyList) return [] as WorkflowRequest[];
    let list = requests
      .filter((r) => isOwnWorkflowRequest(r) && r.type === typeForMyList)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    if (myStatusFilter !== "ALL") {
      const target = myStatusFilter.toUpperCase();
      list = list.filter(
        (r) => r.status.toUpperCase() === target
      );
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const title = r.title.toLowerCase();
        const date = new Date(r.createdAt).toLocaleDateString().toLowerCase();
        return title.includes(q) || date.includes(q);
      });
    }
    return list;
  }, [requests, isOwnWorkflowRequest, myStatusFilter, searchQuery, typeForMyList]);

  const teamRequests = useMemo(() => {
    if (currentUser.role !== "DEPARTMENT_MANAGER") return [] as WorkflowRequest[];
    const fallbackTeamEmployeeIds = getEmployeeIdsUnderDepartmentManager(currentUser.employeeId);
    const teamEmployeeIds =
      teamMemberIdsFromDb.length > 0
        ? teamMemberIdsFromDb
        : fallbackTeamEmployeeIds;
    return requests
      .filter(
        (r) =>
          r.type === "PERSONAL_INFO_CHANGE" &&
          r.createdBy !== currentUser.employeeId &&
          teamEmployeeIds.includes(r.createdBy)
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, currentUser.employeeId, teamMemberIdsFromDb]);

  async function resolveEmployeeUuidForDb(rawEmployeeRef?: string): Promise<{ id: string | null; debug: string }> {
    if (rawEmployeeRef && UUID_RE.test(rawEmployeeRef)) {
      return { id: rawEmployeeRef, debug: "rawEmployeeRef-is-uuid" };
    }
    if (!isSupabaseAuthConfigured()) return { id: null, debug: "supabase-not-configured" };

    if (UUID_RE.test(currentUser.employeeId)) {
      return { id: currentUser.employeeId, debug: "currentUser.employeeId-is-uuid" };
    }

    // Real Supabase identity path: auth uid -> employees.user_id/auth_user_id -> employees.id
    const { data: auth } = await supabase.auth.getSession();
    const { data: authUserData } = await supabase.auth.getUser();
    const authUidFromSession = auth.session?.user?.id ?? null;
    const authUidFromUser = authUserData.user?.id ?? null;
    const authUidFromCurrentUser =
      currentUser.id.startsWith("auth-") && UUID_RE.test(currentUser.id.slice("auth-".length))
        ? currentUser.id.slice("auth-".length)
        : null;
    const authUid =
      (authUidFromSession && UUID_RE.test(authUidFromSession) ? authUidFromSession : null) ??
      (authUidFromUser && UUID_RE.test(authUidFromUser) ? authUidFromUser : null) ??
      authUidFromCurrentUser;

    // Use server-side hydration endpoint first (bypasses client-side RLS issues).
    const debugParts: string[] = [];
    debugParts.push(`currentUser.employeeId=${currentUser.employeeId}`);
    debugParts.push(`currentUser.employeeNumber=${currentUser.employeeNumber}`);
    debugParts.push(`authUid=${authUid ?? "null"}`);

    if (authUid && auth.session?.access_token) {
      try {
        const res = await fetch("/api/auth/session-user", {
          method: "GET",
          headers: { Authorization: `Bearer ${auth.session.access_token}` },
          cache: "no-store",
        });
        debugParts.push(`/api/auth/session-user status=${res.status}`);
        if (res.ok) {
          const body = (await res.json()) as { employee?: { id?: string | null } | null };
          const eid = body?.employee?.id ?? null;
          debugParts.push(`api.employee.id=${eid ?? "null"}`);
          if (eid && UUID_RE.test(eid)) {
            return { id: eid, debug: debugParts.join(" | ") };
          }
        }
      } catch {
        debugParts.push("api-session-user-fetch-error");
      }
    }

    if (authUid) {
      const byAuthCols = ["id", "user_id", "auth_user_id"];
      for (const userCol of ["user_id", "auth_user_id"]) {
        const { data, error } = await supabase
          .from("employees")
          .select(byAuthCols.join(","))
          .eq(userCol, authUid)
          .limit(1)
          .maybeSingle();
        const typedData = data as Record<string, unknown> | null;
        debugParts.push(`employees-by-${userCol} error=${error?.message ?? "none"} id=${typedData?.id ?? "null"}`);
        if (!error && typedData?.id && UUID_RE.test(String(typedData.id))) {
          return { id: String(typedData.id), debug: debugParts.join(" | ") };
        }
      }
    }

    // Fallback by employee code (prefer explicit raw ref, then current user context).
    const employeeCode = rawEmployeeRef?.trim() || currentUser.employeeNumber?.trim();
    if (employeeCode) {
      const { data, error } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_code", employeeCode)
        .limit(1)
        .maybeSingle();
      const typedData = data as Record<string, unknown> | null;
      debugParts.push(`employees-by-employee_code(${employeeCode}) error=${error?.message ?? "none"} id=${typedData?.id ?? "null"}`);
      if (!error && typedData?.id && UUID_RE.test(String(typedData.id))) {
        return { id: String(typedData.id), debug: debugParts.join(" | ") };
      }
    }

    return { id: null, debug: debugParts.join(" | ") || "no-debug-data" };
  }

  async function resolveWorkflowLogActorId(): Promise<string | null> {
    const { data: auth } = await supabase.auth.getSession();
    const sid = auth.session?.user?.id;
    if (sid && UUID_RE.test(sid)) return sid;
    if (currentUser.id.startsWith("auth-")) {
      const tail = currentUser.id.slice("auth-".length);
      if (UUID_RE.test(tail)) return tail;
    }
    return null;
  }

  function workflowDbCurrentStep(req: WorkflowRequest): string {
    const stage = (req.reviewStage ?? getInitialStageForType(req.type)) as WorkflowStage;
    return String(stage).toLowerCase();
  }

  function mapPersonalInfoFieldNameToDb(
    field: NonNullable<WorkflowRequest["personalInfoField"]>
  ): string {
    const m: Record<string, string> = {
      EMAIL: "email",
      BIRTHDATE: "birthdate",
      FULLNAME: "fullname",
      ADDRESS: "address",
      CONTACT_NUMBER: "contact_number",
      CIVIL_STATUS: "civil_status",
      SSS: "sss",
      PHILHEALTH: "philhealth",
      PAGIBIG: "pagibig",
      TIN: "tin",
    };
    return m[field] ?? field.toLowerCase();
  }

  async function saveRequestRowToDb(req: WorkflowRequest): Promise<WorkflowRequest> {
    if (!isSupabaseAuthConfigured()) return req;
    const normalizedReq = ensureUuidRequest(req);
    const subjectRef = normalizedReq.entityId?.trim();
    let employeeIdForDb: string | null = null;
    if (subjectRef && UUID_RE.test(subjectRef)) {
      employeeIdForDb = subjectRef;
    } else if (subjectRef) {
      const sub = await resolveEmployeeUuidForDb(subjectRef);
      employeeIdForDb = sub.id;
    }
    if (!employeeIdForDb) {
      const self = await resolveEmployeeUuidForDb();
      employeeIdForDb = self.id;
      if (!employeeIdForDb) {
        throw new Error(
          `Could not resolve employee UUID for this workflow row. Debug: ${self.debug}`
        );
      }
    }
    const typeToDb = (t: RequestType) => t.toLowerCase();
    const statusToDb = (s: RequestStatus) => s.toLowerCase();
    const payload = {
      id: normalizedReq.id,
      employee_id: employeeIdForDb,
      type: typeToDb(normalizedReq.type),
      title: normalizedReq.title,
      status: statusToDb(normalizedReq.status),
      current_step: workflowDbCurrentStep(normalizedReq),
      remarks: normalizedReq.reviewNotes ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("workflow_requests").upsert(payload);
    if (error) {
      throw new Error(`Could not save workflow request: ${error.message}`);
    }
    return normalizedReq;
  }

  async function savePersonalInfoDetailsToDb(req: WorkflowRequest) {
    if (!isSupabaseAuthConfigured() || req.type !== "PERSONAL_INFO_CHANGE" || !req.personalInfoField) return;
    const { error } = await supabase.from("personal_info_changes").upsert(
      {
        request_id: req.id,
        field_name: mapPersonalInfoFieldNameToDb(req.personalInfoField),
        old_value: req.currentValue ?? "",
        new_value: req.newValue ?? "",
        reason: req.reason ?? "",
        supporting_document_url: req.attachmentDataUrl ?? null,
        supporting_document_name: req.attachmentName ?? null,
      },
      { onConflict: "request_id" }
    );
    if (error) {
      throw new Error(`Could not save personal info change details: ${error.message}`);
    }
  }

  async function saveWorkflowLogToDb(
    requestId: string,
    action: "submitted" | "forwarded" | "approved" | "rejected" | "applied",
    remarks?: string
  ) {
    if (!isSupabaseAuthConfigured()) return;
    const actionBy = await resolveWorkflowLogActorId();
    if (!actionBy) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Skipping workflow_logs insert: no Supabase auth user id (action_by).");
      }
      return;
    }
    const { error } = await supabase.from("workflow_logs").insert({
      request_id: requestId,
      action_by: actionBy,
      role: currentUser.role.toLowerCase(),
      action,
      remarks: remarks ?? null,
    });
    if (error) {
      throw new Error(`Could not save workflow log: ${error.message}`);
    }
  }

  async function upsertTypedWorkflowRequestDetails(requestId: string, type: RequestType) {
    if (!isSupabaseAuthConfigured()) return;

    if (type === "PROMOTION") {
      const currentPositionForPromotion =
        selectedEmployee?.jobTitle?.trim() ||
        (selectedEmployeePosition !== "—" ? selectedEmployeePosition : "") ||
        currentUser.jobTitle?.trim() ||
        null;
      const { error } = await supabase.from("promotion_requests").upsert(
        {
          request_id: requestId,
          current_position: currentPositionForPromotion,
          proposed_position: promotionNewPosition.trim(),
          effective_date: createEffectiveDate || null,
          justification: createDescription.trim() || null,
        },
        { onConflict: "request_id" }
      );
      if (error) throw new Error(`Could not save promotion request details: ${error.message}`);
    }

    if (type === "TRANSFER") {
      const baseRow: Record<string, unknown> = {
        request_id: requestId,
        reason: createDescription.trim() || null,
        current_location: selectedEmployeeLocation || null,
        new_location: transferToLocation.trim() || null,
        current_team: selectedEmployeeTeamBranch || null,
        target_team: transferTargetTeamBranch.trim() || null,
        target_team_branch: transferTargetTeamBranch.trim() || null,
        effective_date: createEffectiveDate || null,
        impact_notes: transferImpactNotes.trim() || null,
      };
      const payload = { ...baseRow };
      let lastError: string | null = null;
      for (let i = 0; i < 8; i++) {
        const res = await supabase.from("transfer_requests").upsert(payload, { onConflict: "request_id" });
        if (!res.error) {
          lastError = null;
          break;
        }
        lastError = res.error.message;
        const missingColumn =
          res.error.message.match(/column transfer_requests\.([a-zA-Z0-9_]+) does not exist/i)?.[1] ??
          res.error.message.match(/Could not find the '([^']+)' column/i)?.[1];
        if (!missingColumn || !(missingColumn in payload)) break;
        delete payload[missingColumn];
        if (Object.keys(payload).length === 0) break;
      }
      if (lastError) throw new Error(`Could not save transfer request details: ${lastError}`);
    }

    if (type === "ROLE_CHANGE") {
      const { error } = await supabase.from("role_change_request").upsert(
        {
          request_id: requestId,
          current_department: selectedDepartmentName !== "—" ? selectedDepartmentName : null,
          current_position: selectedEmployeePosition !== "—" ? selectedEmployeePosition : null,
          new_position: roleChangeNewPosition.trim(),
          effective_date: createEffectiveDate || null,
          reason: createDescription.trim() || null,
        },
        { onConflict: "request_id" }
      );
      if (error) throw new Error(`Could not save role change details: ${error.message}`);
    }

    if (type === "DEPARTMENT_CHANGE") {
      const newDeptName =
        departments.find((d) => d.id === departmentChangeTargetDepartmentId)?.name ?? "";
      const { error } = await supabase.from("department_change_requests").upsert(
        {
          request_id: requestId,
          current_department: selectedDepartment?.name ?? "",
          new_department: newDeptName,
          reason: [
            createDescription.trim(),
            departmentChangeBusinessImpact.trim()
              ? `Business impact: ${departmentChangeBusinessImpact.trim()}`
              : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
        { onConflict: "request_id" }
      );
      if (error) throw new Error(`Could not save department change details: ${error.message}`);
    }

    if (type === "SALARY_CHANGE") {
      const proposed = Number(salaryChangeCurrentSalary);
      if (!Number.isFinite(proposed) || proposed <= 0) {
        throw new Error("Current salary is not available for this employee.");
      }
      const { error } = await supabase.from("salary_change_requests").upsert(
        {
          request_id: requestId,
          current_salary: proposed,
          percentage_increase: salaryChangePerformanceReference.trim() || null,
          reason: createDescription.trim() || null,
          budget_justification: salaryChangeBudgetJustification.trim() || null,
        },
        { onConflict: "request_id" }
      );
      if (error) throw new Error(`Could not save salary change details: ${error.message}`);
    }
  }

  /** Remove typed detail rows for this workflow type (promotion_requests, transfer_requests, etc.). */
  async function deleteWorkflowRequestTypedDetailsFromDb(requestId: string, type: RequestType) {
    if (!isSupabaseAuthConfigured()) return;
    const delByRequestId = async (table: string) => {
      const { error } = await supabase.from(table).delete().eq("request_id", requestId);
      if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    };
    switch (type) {
      case "PROMOTION":
        await delByRequestId("promotion_requests");
        break;
      case "TRANSFER":
        await delByRequestId("transfer_requests");
        break;
      case "SALARY_CHANGE":
        await delByRequestId("salary_change_requests");
        break;
      case "PERSONAL_INFO_CHANGE":
        await delByRequestId("personal_info_changes");
        break;
      case "DEPARTMENT_CHANGE":
        await delByRequestId("department_change_requests");
        break;
      case "ROLE_CHANGE": {
        const { error } = await supabase.from("role_change_request").delete().eq("request_id", requestId);
        if (error) {
          const msg = error.message.toLowerCase();
          if (!msg.includes("does not exist") && !msg.includes("schema cache")) {
            throw new Error(`Could not delete role change details: ${error.message}`);
          }
        }
        break;
      }
      case "MANAGER_CHANGE":
        break;
      default:
        break;
    }
  }

  /** Logs + attachments (call before removing workflow_requests so cascades/RLS succeed). */
  async function deleteWorkflowRequestLogsAndAttachmentsFromDb(requestId: string) {
    if (!isSupabaseAuthConfigured()) return;
    for (const table of ["request_attachments", "workflow_logs"] as const) {
      const { error } = await supabase.from(table).delete().eq("request_id", requestId);
      if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    }
  }

  async function saveAttachmentToDb(requestId: string, fileUrl: string, fileName?: string) {
    if (!isSupabaseAuthConfigured() || !fileUrl) return;
    const { error } = await supabase.from("request_attachments").insert({
      request_id: requestId,
      file_url: fileUrl,
      file_name: fileName ?? null,
    });
    if (error) {
      throw new Error(`Could not save request attachment: ${error.message}`);
    }
  }

  async function applyPersonalInfoChange(req: WorkflowRequest) {
    if (!isSupabaseAuthConfigured()) return;
    const field = req.personalInfoField;
    const newValue = req.newValue?.trim() ?? "";
    if (!field || !newValue) return;
    const targetEmployeeId = req.entityId ?? req.createdBy;
    const { data: targetEmp } = await supabase
      .from("employees")
      .select("*")
      .eq("id", targetEmployeeId)
      .maybeSingle();
    if (!targetEmp) return;
    const empRow = targetEmp as Record<string, unknown>;

    const updateEmployeesWithFallback = async (initialPayload: Record<string, unknown>) => {
      const payload = { ...initialPayload };
      let lastError: Error | null = null;
      for (let i = 0; i < 6; i++) {
        const { error } = await supabase.from("employees").update(payload).eq("id", targetEmployeeId);
        if (!error) return;
        const missingColumn = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
        if (missingColumn && missingColumn in payload) {
          delete payload[missingColumn];
          if (Object.keys(payload).length === 0) break;
          continue;
        }
        lastError = new Error(error.message);
        break;
      }
      throw lastError ?? new Error("Could not update employee row with available columns.");
    };

    // Prefer linking profiles via employees.user_id (your schema).
    const empUserId = (empRow.user_id as string | undefined) ?? null;
    let targetProfile: JsonObject[] | null = null;
    if (empUserId) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", empUserId)
        .limit(1);
      targetProfile = (data as unknown as JsonObject[]) ?? null;
    } else {
      // Fallback: best-effort name match (legacy schemas only).
      const maybeFirst = (empRow.first_name as string | undefined) ?? "";
      const maybeLast = (empRow.last_name as string | undefined) ?? "";
      if (maybeFirst && maybeLast) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .ilike("first_name", maybeFirst)
          .ilike("last_name", maybeLast)
          .limit(1);
        targetProfile = (data as unknown as JsonObject[]) ?? null;
      }
    }

    if (field === "EMAIL") {
      const emailColumns = ["email", "company_email", "work_email", "employee_email"] as const;
      const chosenEmailColumn = emailColumns.find((col) => col in empRow) ?? null;

      // Your setup may store login email only in `auth.users` (Authentication),
      // while `employees` has no `email` column. Support both cases:
      if (chosenEmailColumn) {
        try {
          await updateEmployeesWithFallback({ [chosenEmailColumn]: newValue });
        } catch (error) {
          throw new Error(
            `Could not update employee email in employees.${chosenEmailColumn}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`
          );
        }
      }

      // Also update auth login email (required when email is used for login).
      // Client SDK can only update the CURRENT signed-in user, so for others
      // you must use a Supabase Edge Function / server endpoint with service role.
      if (isSupabaseAuthConfigured()) {
        const targetAuthUserId =
          (empRow.auth_user_id as string | undefined) ??
          (empRow.user_id as string | undefined) ??
          null;

        const {
          data: { session },
        } = await supabase.auth.getSession();
        const currentAuthUserId = session?.user?.id ?? null;

        if (targetAuthUserId) {
          if (targetAuthUserId === currentAuthUserId) {
            const { error } = await supabase.auth.updateUser({ email: newValue });
            if (error) throw new Error(`Could not update login email: ${error.message}`);
            updateUser({ email: newValue });
          } else {
            if (!session?.access_token) {
              throw new Error("No access token found for Edge Function authorization.");
            }

            // Prefer Supabase JS invoke helper (handles URL/CORS/header details more reliably).
            // NOTE: Supabase Edge Function endpoint slug in your dashboard shows as `clever-processor`
            // even though the function "Name" displays `update-auth-email`.
            // We must invoke using the deployed slug.
            const invokeResult = await (supabase as unknown as SupabaseFunctionsClient).functions.invoke(
              "clever-processor",
              { body: { userId: targetAuthUserId, newEmail: newValue } }
            );

            const invokeError = invokeResult?.error ?? null;
            if (invokeError) {
              // Try to fetch the JSON error body too (Supabase invoke often hides the payload).
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              let edgeErrorBody: unknown = null;
              if (supabaseUrl) {
                try {
                  const resp = await fetch(`${supabaseUrl}/functions/v1/clever-processor`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ userId: targetAuthUserId, newEmail: newValue }),
                  });
                  edgeErrorBody = await resp.json().catch(() => null);
                } catch {
                  // ignore
                }
              }

              const payloadStr = edgeErrorBody
                ? JSON.stringify(edgeErrorBody, null, 0)
                : invokeError.message ?? String(invokeError);

              throw new Error(`Could not update auth email via Edge Function: ${payloadStr}`);
            }
          }
        }
      }
    } else if (field === "BIRTHDATE") {
      const birthColumns = ["birthday", "birthdate"] as const;
      const chosenBirthColumn = birthColumns.find((col) => col in empRow) ?? null;

      // Only update employees table if this schema actually has a birthdate column.
      if (chosenBirthColumn) {
        try {
          await updateEmployeesWithFallback({ [chosenBirthColumn]: newValue });
        } catch (error) {
          throw new Error(
            `Could not update employee birthdate: ${
              error instanceof Error ? error.message : "No supported birthdate column found in employees."
            }`
          );
        }
      }
    } else if (field === "FULLNAME") {
      const parts = newValue.split(/\s+/).filter(Boolean);
      const first = parts[0] ?? "";
      const last = parts.slice(1).join(" ");
      const namePayload: Record<string, unknown> = {};
      if ("first_name" in empRow || "last_name" in empRow) {
        namePayload.first_name = first;
        namePayload.last_name = last;
      } else if ("full_name" in empRow) {
        namePayload.full_name = newValue;
      } else if ("name" in empRow) {
        namePayload.name = newValue;
      }

      // Only update employees table when a supported name column exists in this schema.
      if (Object.keys(namePayload).length > 0) {
        try {
          await updateEmployeesWithFallback(namePayload);
        } catch (error) {
          throw new Error(
            `Could not update employee name: ${
              error instanceof Error ? error.message : "No supported name columns found in employees."
            }`
          );
        }
      }
    } else if (field === "ADDRESS") {
      const addressColumns = ["current_address", "address"] as const;
      const chosenAddressColumn = addressColumns.find((col) => col in empRow) ?? "current_address";
      try {
        await updateEmployeesWithFallback({ [chosenAddressColumn]: newValue });
      } catch (error) {
        throw new Error(
          `Could not update employee address: ${
            error instanceof Error ? error.message : "No supported address column found."
          }`
        );
      }
    } else if (field === "CONTACT_NUMBER") {
      const phoneColumns = ["personal_phone", "phone_number", "contact_number"] as const;
      const chosenPhoneColumn = phoneColumns.find((col) => col in empRow) ?? "personal_phone";
      try {
        await updateEmployeesWithFallback({ [chosenPhoneColumn]: newValue });
      } catch (error) {
        throw new Error(
          `Could not update employee contact number: ${
            error instanceof Error ? error.message : "No supported contact column found."
          }`
        );
      }
    } else if (field === "CIVIL_STATUS") {
      const civilStatusColumns = ["civil_status", "marital_status"] as const;
      const chosenCivilStatusColumn = civilStatusColumns.find((col) => col in empRow) ?? "civil_status";
      try {
        await updateEmployeesWithFallback({ [chosenCivilStatusColumn]: newValue });
      } catch (error) {
        throw new Error(
          `Could not update employee civil status: ${
            error instanceof Error ? error.message : "No supported civil status column found."
          }`
        );
      }
    }

    const p = targetProfile?.[0];
    if (p) {
      if (field === "EMAIL") {
        // profiles has no company email column in this schema
      } else if (field === "BIRTHDATE") {
        const profileBirthColumns = ["birthday", "birthdate"] as const;
        const chosenProfileBirthColumn = profileBirthColumns.find((col) => col in p) ?? "birthday";
        const { error } = await supabase
          .from("profiles")
          .update({ [chosenProfileBirthColumn]: newValue })
          .eq("id", p.id);
        if (error) throw new Error(`Could not update profile birthdate: ${error.message}`);
      } else if (field === "FULLNAME") {
        const parts = newValue.split(/\s+/).filter(Boolean);
        const first = parts[0] ?? "";
        const last = parts.slice(1).join(" ");
        const { error } = await supabase.from("profiles").update({ first_name: first, last_name: last }).eq("id", p.id);
        if (error) throw new Error(`Could not update profile name: ${error.message}`);
      }
    } else if (field === "FULLNAME") {
      // In schemas where employees has no name columns, profiles is the source of truth for names.
      throw new Error("Could not apply fullname change: no matching profile row found for this employee.");
    } else if (field === "BIRTHDATE") {
      // Birthdate is stored in profiles in your schema.
      throw new Error("Could not apply birthdate change: no matching profile row found for this employee.");
    }

    // Keep the currently logged-in user's account/profile UI in sync immediately.
    if (targetEmployeeId === currentUser.employeeId) {
      if (field === "BIRTHDATE") {
        updateUser({ birthday: newValue });
      } else if (field === "FULLNAME") {
        updateUser({ name: newValue });
      } else if (field === "ADDRESS") {
        updateUser({ currentAddress: newValue });
      } else if (field === "CONTACT_NUMBER") {
        updateUser({ personalPhone: newValue });
      }
      // EMAIL is handled above (updates auth + context only when targetAuthUserId === current session user id).
    }
  }

  const myCounts = useMemo(() => {
    const mine = requests.filter((r) => r.createdBy === currentUser.employeeId);
    const scoped = typeForMyList ? mine.filter((r) => r.type === typeForMyList) : mine;
    const countBy = (s: RequestStatus) => scoped.filter((r) => r.status === s).length;
    return {
      CREATED: countBy("CREATED"),
      PENDING: countBy("PENDING"),
      APPROVED: countBy("APPROVED"),
      REJECTED: countBy("REJECTED"),
      APPLIED_CLOSED: scoped.filter((r) => r.status === "APPLIED" || r.status === "CLOSED").length,
    };
  }, [requests, currentUser.employeeId, typeForMyList]);

  const toApprove = useMemo(() => {
    if (currentUser.role === "EMPLOYEE" || currentUser.role === "AUDITOR") return [];
    return requests.filter((r) => {
        if (r.createdBy === currentUser.employeeId) return false;
      if (!(r.status === "PENDING" || r.status === "CREATED")) return false;
      const stagePermission = canApproveRequestAtCurrentStage(currentUser.role, r);
      if (!stagePermission.allowed) return false;
      if (currentUser.role === "MANAGER" || currentUser.role === "DEPARTMENT_MANAGER") {
      const directReportIds = getDirectReportIds(currentUser.employeeId);
        return directReportIds.includes(r.createdBy);
    }
      return true;
    });
  }, [requests, currentUser.role, currentUser.employeeId]);

  const forReview = useMemo(() => {
    if (currentUser.role !== "HR_STAFF") return [];
    return requests
      .filter(
        (r) =>
          r.type === "PERSONAL_INFO_CHANGE" &&
          r.createdBy !== currentUser.employeeId &&
          (r.reviewStage ?? "HR_STAFF") === "HR_STAFF" &&
          (r.status === "CREATED" || r.status === "PENDING")
      )
      .filter((r) =>
        reviewFieldFilter === "ALL" ? true : (r.personalInfoField ?? "") === reviewFieldFilter
      )
      .filter((r) =>
        reviewDateFilter
          ? new Date(r.createdAt).toISOString().slice(0, 10) === reviewDateFilter
          : true
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [requests, currentUser.role, currentUser.employeeId, reviewFieldFilter, reviewDateFilter]);

  const pendingCount = currentUser.role === "HR_STAFF" ? forReview.length : toApprove.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(toApprove.map((r) => r.id));
  };

  const updateStatus = async (id: string, status: RequestStatus, rejectRemarks?: string) => {
    const before = requests.find((r) => r.id === id);
    if (!before) return;
    try {
      if (!(before.status === "PENDING" || before.status === "CREATED")) return;
      const stageCheck = canApproveRequestAtCurrentStage(currentUser.role, before);
      if (!stageCheck.allowed) {
        setActionMessage(stageCheck.reason ?? "You are not allowed to process this request.");
        return;
      }
      const stage = (before.reviewStage as WorkflowStage | undefined) ?? getInitialStageForType(before.type);
      let nextReq: WorkflowRequest = { ...before };
    let auditAction = "REQUEST_STATUS_CHANGED";
    let summaryVerb = status === "REJECTED" ? "rejected" : "approved";

      if (status === "REJECTED") {
        const remarks = (rejectRemarks ?? before.reviewNotes ?? "").trim();
        if (!remarks) {
          setActionMessage("Rejection remarks are required.");
          return;
        }
        nextReq = { ...before, status: "REJECTED", reviewNotes: remarks };
        await saveWorkflowLogToDb(before.id, "rejected", remarks);
        setActionMessage("Request rejected. Remarks were recorded.");
      } else {
        const nextStage = getNextStage(before.type, stage);
        if (nextStage) {
          nextReq = { ...before, status: "PENDING", reviewStage: nextStage };
        auditAction = "REQUEST_FORWARDED";
          summaryVerb = `forwarded to ${nextStage.replace(/_/g, " ")}`;
        await saveWorkflowLogToDb(before.id, "forwarded");
          setActionMessage(`Request forwarded to ${nextStage.replace(/_/g, " ")}.`);
      } else {
        nextReq = { ...before, status: "APPROVED", reviewStage: stage };
        await saveWorkflowLogToDb(before.id, "approved");
          if (before.type === "PERSONAL_INFO_CHANGE") {
        await applyPersonalInfoChange(before);
          }
        nextReq = { ...nextReq, status: "APPLIED" };
        await saveWorkflowLogToDb(before.id, "applied");
          setActionMessage("Request approved and applied.");
      }
    }

    setRequests((prev) => prev.map((r) => (r.id === id ? nextReq : r)));
    await saveRequestRowToDb(nextReq);
        appendAuditLog({
          actorId: currentUser.employeeId,
          actorName: currentUser.name,
          actorRole: currentUser.role,
      action: auditAction,
          entityType: "WORKFLOW_REQUEST",
          entityId: before.id,
      summary: `${currentUser.name} ${summaryVerb} workflow request ${before.id}.`,
          before: { status: before.status, title: before.title },
      after: { status: nextReq.status, title: before.title, reviewStage: nextReq.reviewStage },
    });
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to process request action.");
    }
  };

  const cancelCreatedRequest = async (id: string) => {
    const target = requests.find((r) => r.id === id);
    if (!target) return;
    const canCancel =
      isOwnWorkflowRequest(target) &&
      (target.status === "CREATED" || target.status === "PENDING" || target.status === "CLOSED");
    if (!canCancel) return;
    try {
      if (target.status === "CREATED" || target.status === "CLOSED") {
        if (isSupabaseAuthConfigured()) {
          await deleteWorkflowRequestTypedDetailsFromDb(id, target.type);
          await deleteWorkflowRequestLogsAndAttachmentsFromDb(id);
          const { data: deletedWr, error } = await supabase.from("workflow_requests").delete().eq("id", id).select("id");
          if (error) throw new Error(`Could not delete workflow request: ${error.message}`);
          if (!deletedWr?.length) {
            throw new Error(
              "Could not delete this request in the database (nothing was removed). Apply the latest Supabase migration for workflow delete policies (20260415133000 and 20260415180000_workflow_delete_rls_auth_link.sql), then refresh."
            );
          }
        }
        setRequests((prev) =>
          prev.filter(
            (r) =>
              !(
                r.id === id &&
                isOwnWorkflowRequest(r) &&
                (r.status === "CREATED" || r.status === "CLOSED")
              )
          )
        );
        setActionMessage(target.status === "CREATED" ? "Draft request deleted." : "Closed request deleted.");
        void refreshRequestsFromDb();
      } else {
        const cancelledReq: WorkflowRequest = {
          ...target,
          status: "CLOSED",
          reviewNotes: "Cancelled by employee while pending.",
        };
        if (isSupabaseAuthConfigured()) {
          await deleteWorkflowRequestTypedDetailsFromDb(id, target.type);
        }
        setRequests((prev) => prev.map((r) => (r.id === id ? cancelledReq : r)));
        await saveRequestRowToDb(cancelledReq);
        setActionMessage("Pending request cancelled.");
        void refreshRequestsFromDb();
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Could not delete request.");
      return;
    }

    appendAuditLog({
      actorId: currentUser.employeeId,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: "REQUEST_CANCELLED",
      entityType: "WORKFLOW_REQUEST",
      entityId: id,
      summary: `${currentUser.name} cancelled workflow request ${id}.`,
    });
  };

  const startEditDraft = (id: string) => {
    const draft = requests.find((r) => r.id === id);
    if (!draft || !isOwnWorkflowRequest(draft) || draft.status !== "CREATED") return;

    setEditingRequestId(draft.id);
    setCreateType(draft.type);
    setCreateTitle(draft.title);
    setCreateEntityId(draft.entityId ?? "");
    setCreateEffectiveDate(draft.effectiveDate ?? "");
    setCreateDescription(draft.reason ?? "");
    setCreatePersonalInfoField(draft.personalInfoField ?? "");
    setCreatePersonalInfoNewValue(draft.newValue ?? "");
    setPromotionNewPosition("");
    setRoleChangeNewPosition("");
    setTransferTargetTeamBranch("");
    setTransferToLocation("");
    setTransferImpactNotes("");
    setDepartmentChangeTargetDepartmentId("");
    setDepartmentChangeTargetManagerId("");
    setDepartmentChangeBusinessImpact("");
    setSalaryChangePerformanceReference("");
    setSalaryChangeBudgetJustification("");
    setManagerChangeNewManagerId("");
    setManagerChangeTeamImpactNotes("");
    setCreateAttachment(null);
    setCreateError("");

    if (draft.type === "PROMOTION" && draft.description) {
      const newPosition = draft.description.match(/New Position:\s*(.*)/)?.[1] ?? "";
      setPromotionNewPosition(newPosition === "—" ? "" : newPosition);
    }

    if (draft.type === "TRANSFER" && draft.description) {
      const toLocation = draft.description.match(/To Location:\s*(.*)/)?.[1] ?? "";
      const teamBranch =
        draft.description.match(/Target Team:\s*(.*)/)?.[1] ??
        draft.description.match(/Target Team\/Branch:\s*(.*)/)?.[1] ??
        "";
      const impact = draft.description.match(/Impact Notes:\s*(.*)/)?.[1] ?? "";
      setTransferToLocation(toLocation === "—" ? "" : toLocation);
      setTransferTargetTeamBranch(teamBranch === "—" ? "" : teamBranch);
      setTransferImpactNotes(impact === "—" ? "" : impact);
    }
    if (draft.type === "ROLE_CHANGE" && draft.description) {
      const newPosition = draft.description.match(/New Position:\s*(.*)/)?.[1] ?? "";
      setRoleChangeNewPosition(newPosition === "—" ? "" : newPosition);
    }

    setCreateOpen(true);
  };

  const bulkApprove = () => {
    selectedIds.forEach((id) => updateStatus(id, "APPROVED"));
    setSelectedIds([]);
  };

  const bulkReject = () => {
    selectedIds.forEach((id) => updateStatus(id, "REJECTED"));
    setSelectedIds([]);
  };

  const forwardToHrAdmin = async (id: string) => {
    await updateStatus(id, "APPROVED");
  };

  const openRejectModal = (id: string) => {
    setRejectRequestId(id);
    setRejectReason("");
    setRejectOpen(true);
  };

  const rejectForReview = async () => {
    if (!rejectRequestId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setActionMessage("Please provide rejection reason.");
      return;
    }
    const before = requests.find((r) => r.id === rejectRequestId);
    if (!before) return;
    const stage = before.reviewStage ?? "HR_STAFF";
    const canRejectAtStage =
      (stage === "HR_STAFF" && currentUser.role === "HR_STAFF") ||
      (stage === "HR_ADMIN" && currentUser.role === "HR_ADMIN") ||
      (stage === "EXECUTIVE" && currentUser.role === "EXECUTIVE");
    if (!canRejectAtStage) return;
    setRejectSubmitting(true);
    try {
      await updateStatus(rejectRequestId, "REJECTED", reason);
      setRejectOpen(false);
      setRejectRequestId(null);
      setRejectReason("");
    } finally {
      setRejectSubmitting(false);
    }
  };

  /** Employee + HR Staff share the same self-service New Request layout and title behavior. */
  const sameAsEmployeeNewRequestForm =
    currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF";
  const isHrRole =
    currentUser.role === "HR_STAFF" || currentUser.role === "HR_MANAGER" || currentUser.role === "HR_ADMIN";
  const getCurrentPersonalInfoValue = () =>
    createPersonalInfoField === "EMAIL"
      ? currentUser.email
      : createPersonalInfoField === "BIRTHDATE"
      ? currentUser.birthday
      : createPersonalInfoField === "ADDRESS"
      ? currentUser.currentAddress
      : createPersonalInfoField === "CONTACT_NUMBER"
      ? currentUser.personalPhone
      : createPersonalInfoField === "CIVIL_STATUS"
      ? selectedEmployeeCivilStatus
      : createPersonalInfoField === "SSS" || createPersonalInfoField === "PHILHEALTH" || createPersonalInfoField === "PAGIBIG" || createPersonalInfoField === "TIN"
      ? "Managed by HR"
      : currentUser.name;

  const validateTypeSpecificFields = (): string | null => {
    if (createType === "PROMOTION") {
      if (!promotionNewPosition.trim()) return "New position/title is required.";
      if (isHrRole && !createEffectiveDate) return "Effective date is required for HR role submissions.";
      if (!createDescription.trim()) return "Reason for promotion is required.";
    }
    if (createType === "TRANSFER") {
      if (!transferToLocation.trim() && !transferTargetTeamBranch.trim()) {
        return "Provide at least target location or target team/branch.";
      }
      if (
        selectedEmployeeLocation &&
        transferToLocation.trim() &&
        transferToLocation.trim().toLowerCase() === selectedEmployeeLocation.trim().toLowerCase() &&
        !transferTargetTeamBranch.trim()
      ) {
        return "Choose a different location or provide a target team/branch for an in-location transfer.";
      }
      if (
        selectedEmployeeLocation &&
        transferToLocation.trim() &&
        transferToLocation.trim().toLowerCase() === selectedEmployeeLocation.trim().toLowerCase() &&
        transferTargetTeamBranch.trim().toLowerCase() === selectedEmployeeTeamBranch.trim().toLowerCase()
      ) {
        return "When target location is the same, target team must be different from current team.";
      }
      if (isHrRole && !createEffectiveDate) return "Effective date is required for HR role submissions.";
      if (!createDescription.trim()) return "Reason for transfer is required.";
    }
    if (createType === "ROLE_CHANGE") {
      const currentPosition = selectedEmployeePosition.trim();
      const nextPosition = roleChangeNewPosition.trim();
      if (!currentPosition) return "Current position is required.";
      if (!nextPosition) return "New position is required.";
      if (currentPosition.toLowerCase() === nextPosition.toLowerCase()) {
        return "New position must be different from current position.";
      }
      if (!departmentPositionOptions.some((title) => title.toLowerCase() === nextPosition.toLowerCase())) {
        return "Selected position is not available in the employee's current department.";
      }
      if (!roleChangePositionOptions.some((title) => title.toLowerCase() === nextPosition.toLowerCase())) {
        return "Selected position is not a valid career progression role.";
      }
      if (isHrRole && !createEffectiveDate) return "Effective date is required for HR role submissions.";
      if (!createDescription.trim()) return "Reason for role change is required.";
    }
    if (createType === "DEPARTMENT_CHANGE") {
      if (!departmentChangeTargetDepartmentId) return "Target department is required.";
      if (selectedEmployee?.departmentId === departmentChangeTargetDepartmentId) {
        return "Target department must be different from current department.";
      }
      if (!departmentChangeTargetManagerId) return "Target manager is required.";
      if (!createDescription.trim()) return "Reason for department change is required.";
    }
    if (createType === "SALARY_CHANGE") {
      if (!Number.isFinite(Number(salaryChangeCurrentSalary)) || Number(salaryChangeCurrentSalary) <= 0) {
        return "Current salary is not available for this employee.";
      }
      if (!createDescription.trim()) return "Reason for salary change is required.";
      if (!salaryChangePerformanceReference.trim()) return "Percentage increase is required.";
    }
    if (createType === "MANAGER_CHANGE") {
      if (!managerChangeNewManagerId) return "New manager is required.";
      if (selectedEmployee?.managerId === managerChangeNewManagerId) return "New manager must be different from current manager.";
      if (selectedEmployee?.id === managerChangeNewManagerId) return "Employee cannot be their own manager.";
      if (selectedEmployee && getDirectReportIds(selectedEmployee.id).includes(managerChangeNewManagerId)) {
        return "Manager hierarchy is invalid (circular reporting).";
      }
      if (!createEffectiveDate) return "Effective date is required.";
      if (!createDescription.trim()) return "Reason for manager change is required.";
    }
    return null;
  };

  const createRequestRecord = async () => {
    const titleInput = sameAsEmployeeNewRequestForm ? "" : createTitle.trim();
    const currentPersonalInfoValue = getCurrentPersonalInfoValue();
    const normalizedPersonalInfoNewValue =
      createPersonalInfoField === "FULLNAME"
        ? createPersonalInfoNewValue.trim().replace(/\s+/g, " ")
        : createPersonalInfoNewValue.trim();

    if (
      createType === "PERSONAL_INFO_CHANGE" &&
      normalizedPersonalInfoNewValue === currentPersonalInfoValue
    ) {
      setCreateError("New value must be different from current value.");
      return;
    }
    if (createType === "PERSONAL_INFO_CHANGE" && createPersonalInfoField === "EMAIL") {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPersonalInfoNewValue);
      if (!isValidEmail) {
        setCreateError("Please enter a valid email address.");
        return;
      }
      if (isSupabaseAuthConfigured()) {
        const { data: emailTaken } = await supabase
          .from("employees")
          .select("id")
          .ilike("email", normalizedPersonalInfoNewValue)
          .limit(1);
        if ((emailTaken?.length ?? 0) > 0) {
          setCreateError("Email is already used by another employee.");
          return;
        }
      }
    }
    if (createType === "PERSONAL_INFO_CHANGE" && !createAttachment) {
      setCreateError("Supporting document is required for personal info change.");
      return;
    }
    const typeError = validateTypeSpecificFields();
    if (typeError) {
      setCreateError(typeError);
      return;
    }
    const computedTitle =
      createType === "PERSONAL_INFO_CHANGE"
        ? `Personal Info Change: ${createPersonalInfoField.replace(/_/g, " ")}`
        : createType.replace(/_/g, " ");
    const title = titleInput || computedTitle;

    let attachmentName: string | undefined;
    let attachmentDataUrl: string | undefined;
    if (createAttachment) {
      const isPdf =
        createAttachment.type === "application/pdf" ||
        createAttachment.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        setCreateError("Only PDF documents are allowed for supporting files.");
        return;
      }
      attachmentDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(createAttachment);
      });
      attachmentName = createAttachment.name;
    }
    const id = editingRequestId ?? crypto.randomUUID();
    const resolvedEntityId = canTargetOtherEmployees
      ? createEntityId || undefined
      : currentUser.employeeId;
    const creationGuard = canCreateWorkflowRequest({
      actorRole: currentUser.role,
      actorEmployeeId: currentUser.employeeId,
      targetEmployeeId: resolvedEntityId,
      type: createType as RequestType,
    });
    if (!creationGuard.allowed) {
      setCreateError(creationGuard.reason ?? "You are not allowed to create this request.");
      return;
    }
    const firstStage = getInitialStageForType(createType as RequestType);
    const newReq: WorkflowRequest = {
      id,
      type: createType as RequestType,
      title,
      createdBy: currentUser.employeeId,
      createdByName: currentUser.name,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      entityId: resolvedEntityId,
      entityType: resolvedEntityId ? "employee" : undefined,
      effectiveDate: createEffectiveDate || undefined,
      personalInfoField:
        createType === "PERSONAL_INFO_CHANGE" && createPersonalInfoField
          ? createPersonalInfoField
          : undefined,
      currentValue:
        createType === "PERSONAL_INFO_CHANGE" ? currentPersonalInfoValue : undefined,
      newValue:
        createType === "PERSONAL_INFO_CHANGE" ? normalizedPersonalInfoNewValue : undefined,
      reason:
        createType === "PERSONAL_INFO_CHANGE" || createType === "ROLE_CHANGE"
          ? createDescription.trim()
          : undefined,
      reviewStage: firstStage,
      description:
        createType === "PERSONAL_INFO_CHANGE"
          ? `Personal Info Change (${createPersonalInfoField})
Current: ${currentPersonalInfoValue || "—"}
New: ${normalizedPersonalInfoNewValue || "—"}
Reason: ${createDescription.trim() || "—"}`
          : createType === "PROMOTION"
          ? `Promotion Request
Employee: ${selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : currentUser.name}
Current Position: ${selectedEmployeePosition}
New Position: ${promotionNewPosition.trim()}
Effective Date: ${createEffectiveDate || "—"}
Reason: ${createDescription.trim() || "—"}`
          : createType === "TRANSFER"
          ? `Transfer Request
Employee: ${selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : currentUser.name}
From Location: ${selectedEmployeeLocation || "—"}
Current Team: ${selectedEmployeeTeamBranch || "—"}
To Location: ${transferToLocation.trim() || "—"}
Target Team: ${transferTargetTeamBranch.trim() || "—"}
Effective Date: ${createEffectiveDate || "—"}
Reason: ${createDescription.trim() || "—"}
Impact Notes: ${transferImpactNotes.trim() || "—"}`
          : createType === "ROLE_CHANGE"
          ? `Role Change Request
Employee: ${selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : currentUser.name}
Department: ${selectedDepartmentName}
Current Position: ${selectedEmployeePosition}
New Position: ${roleChangeNewPosition.trim() || "—"}
Effective Date: ${createEffectiveDate || "—"}
Reason: ${createDescription.trim() || "—"}`
          : createType === "DEPARTMENT_CHANGE"
          ? `Department Change Request
Employee: ${selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : currentUser.name}
Current Department: ${selectedDepartment?.name ?? "—"}
Current Manager: ${selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}` : "—"}
Target Department: ${departments.find((d) => d.id === departmentChangeTargetDepartmentId)?.name ?? "—"}
Target Manager: ${
              employees.find((emp) => emp.id === departmentChangeTargetManagerId)
                ? `${employees.find((emp) => emp.id === departmentChangeTargetManagerId)?.firstName} ${employees.find((emp) => emp.id === departmentChangeTargetManagerId)?.lastName}`
                : "—"
            }
Effective Date: ${createEffectiveDate || "—"}
Reason: ${createDescription.trim() || "—"}
Business Impact Notes: ${departmentChangeBusinessImpact.trim() || "—"}`
          : createType === "SALARY_CHANGE"
          ? `Salary Change Request
Employee: ${selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : currentUser.name}
Position: ${selectedEmployee?.jobTitle ?? "—"}
Current Salary: ${
              Number.isFinite(Number(salaryChangeCurrentSalary)) && Number(salaryChangeCurrentSalary) > 0
                ? Number(salaryChangeCurrentSalary).toLocaleString()
                : "Not available in salary table"
            }
Reason: ${createDescription.trim() || "—"}
Percentage Increase: ${salaryChangePerformanceReference.trim()}
Budget Justification: ${salaryChangeBudgetJustification.trim() || "—"}`
          : createType === "MANAGER_CHANGE"
          ? `Manager Change Request
Employee: ${selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}` : currentUser.name}
Current Manager: ${selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}` : "—"}
New Manager: ${
              employees.find((emp) => emp.id === managerChangeNewManagerId)
                ? `${employees.find((emp) => emp.id === managerChangeNewManagerId)?.firstName} ${employees.find((emp) => emp.id === managerChangeNewManagerId)?.lastName}`
                : "—"
            }
Department: ${selectedDepartment?.name ?? "—"}
Effective Date: ${createEffectiveDate || "—"}
Reason: ${createDescription.trim() || "—"}
Team Impact Notes: ${managerChangeTeamImpactNotes.trim() || "—"}`
          : createDescription.trim() || undefined,
      attachmentName,
      attachmentDataUrl,
    };
    setRequests((prev) => {
      const next = editingRequestId
        ? prev.map((r) => (r.id === editingRequestId ? { ...newReq, createdAt: r.createdAt } : r))
        : [newReq, ...prev];
      saveRequestsToStorage(next);
      return next;
    });
    let persistedWorkflow: WorkflowRequest | null = null;
    try {
      persistedWorkflow = await saveRequestRowToDb(newReq);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === newReq.id
            ? {
                ...persistedWorkflow!,
                createdAt: editingRequestId ? r.createdAt : persistedWorkflow!.createdAt,
              }
            : r
        )
      );
      if (persistedWorkflow.type === "PERSONAL_INFO_CHANGE") {
        await savePersonalInfoDetailsToDb(persistedWorkflow);
      } else if (
        persistedWorkflow.type === "PROMOTION" ||
        persistedWorkflow.type === "TRANSFER" ||
        persistedWorkflow.type === "ROLE_CHANGE" ||
        persistedWorkflow.type === "DEPARTMENT_CHANGE" ||
        persistedWorkflow.type === "SALARY_CHANGE"
      ) {
        await upsertTypedWorkflowRequestDetails(persistedWorkflow.id, persistedWorkflow.type);
      }
      if (attachmentDataUrl) {
        await saveAttachmentToDb(persistedWorkflow.id, attachmentDataUrl, attachmentName);
      }
      await saveWorkflowLogToDb(persistedWorkflow.id, "submitted", "Request submitted.");
      appendAuditLog({
        actorId: currentUser.employeeId,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: "REQUEST_SUBMITTED",
        entityType: "WORKFLOW_REQUEST",
        entityId: persistedWorkflow.id,
        summary: editingRequestId
          ? `${currentUser.name} updated and submitted workflow request: ${title}.`
          : `${currentUser.name} submitted workflow request: ${title}.`,
        after: { type: createType, title, status: "PENDING", reviewStage: firstStage },
      });
    } catch (err) {
      if (isSupabaseAuthConfigured() && persistedWorkflow?.id) {
        await supabase.from("workflow_requests").delete().eq("id", persistedWorkflow.id);
      }
      setRequests((prev) => prev.filter((r) => r.id !== newReq.id && r.id !== persistedWorkflow?.id));
      throw err;
    }
    void refreshRequestsFromDb();
    setCreateTitle("");
    setCreateEntityId("");
    setCreateEffectiveDate("");
    setCreateDescription("");
    setCreatePersonalInfoField("");
    setCreatePersonalInfoNewValue("");
    setPromotionNewPosition("");
    setRoleChangeNewPosition("");
    setTransferTargetTeamBranch("");
    setTransferToLocation("");
    setTransferImpactNotes("");
    setDepartmentChangeTargetDepartmentId("");
    setDepartmentChangeTargetManagerId("");
    setDepartmentChangeBusinessImpact("");
    setSalaryChangePerformanceReference("");
    setSalaryChangeBudgetJustification("");
    setManagerChangeNewManagerId("");
    setManagerChangeTeamImpactNotes("");
    setCreateAttachment(null);
    setEditingRequestId(null);
    setCreateConfirmOpen(false);
    setCreateOpen(false);
  };

  const handleCreateRequest = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createType) {
      setCreateError("Please select a request type.");
      return;
    }
    if (!canRoleSubmitRequestType(currentUser.role, createType)) {
      setCreateError("Your role cannot submit this request type.");
      return;
    }
    if (createType === "PERSONAL_INFO_CHANGE" && !createPersonalInfoField) {
      setCreateError("Please select which personal info field to change.");
      return;
    }
    if (createType === "PERSONAL_INFO_CHANGE" && !createPersonalInfoNewValue.trim()) {
      setCreateError("Please enter the new value for personal info change.");
      return;
    }
    if (createType === "PERSONAL_INFO_CHANGE" && !createDescription.trim()) {
      setCreateError("Reason for change is required.");
      return;
    }
    const currentPersonalInfoValue = getCurrentPersonalInfoValue();
    const normalizedPersonalInfoNewValue =
      createPersonalInfoField === "FULLNAME"
        ? createPersonalInfoNewValue.trim().replace(/\s+/g, " ")
        : createPersonalInfoNewValue.trim();

    if (
      createType === "PERSONAL_INFO_CHANGE" &&
      normalizedPersonalInfoNewValue === currentPersonalInfoValue
    ) {
      setCreateError("New value must be different from current value.");
      return;
    }
    if (createType === "PERSONAL_INFO_CHANGE" && createPersonalInfoField === "EMAIL") {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPersonalInfoNewValue);
      if (!isValidEmail) {
        setCreateError("Please enter a valid email address.");
        return;
      }
      if (isSupabaseAuthConfigured()) {
        const { data: emailTaken } = await supabase
          .from("employees")
          .select("id")
          .ilike("email", normalizedPersonalInfoNewValue)
          .limit(1);
        if ((emailTaken?.length ?? 0) > 0) {
          setCreateError("Email is already used by another employee.");
          return;
        }
      }
    }
    if (createType === "PERSONAL_INFO_CHANGE" && !createAttachment) {
      setCreateError("Supporting document is required for personal info change.");
      return;
    }
    const typeError = validateTypeSpecificFields();
    if (typeError) {
      setCreateError(typeError);
      return;
    }
    setCreateConfirmOpen(true);
  };

  const confirmCreateRequest = async () => {
    setCreateSubmitting(true);
    setCreateError("");
    try {
      await createRequestRecord();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create request. Please try again.");
      setCreateConfirmOpen(false);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const selectedRequest = useMemo(
    () => requests.find((r) => r.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );
  const attachmentPreviewIsImage = useMemo(() => {
    const url = attachmentPreviewUrl ?? "";
    return url.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(url);
  }, [attachmentPreviewUrl]);
  const attachmentPreviewIsPdf = useMemo(() => {
    const url = attachmentPreviewUrl ?? "";
    return url.startsWith("data:application/pdf") || /\.pdf(\?.*)?$/i.test(url);
  }, [attachmentPreviewUrl]);

  function resolveAttachmentUrl(url?: string, name?: string): string | undefined {
    const primary = (url ?? "").trim();
    if (primary) return primary;
    const fallback = (name ?? "").trim();
    if (!fallback) return undefined;
    if (/^(data:|blob:|https?:\/\/|\/|\.\/|\.\.\/)/i.test(fallback)) return fallback;
    return `/${fallback}`;
  }

  function openAttachmentPreview(url: string, fileName?: string) {
    if (!url) return;
    setAttachmentPreviewUrl(url);
    setAttachmentPreviewName(fileName?.trim() || "Attachment");
    setAttachmentPreviewMaximized(false);
    setAttachmentPreviewOpen(true);
  }
  const canTargetOtherEmployees =
    createType !== "PERSONAL_INFO_CHANGE" &&
    currentUser.role !== "EMPLOYEE" &&
    new Set(["HR_ADMIN", "HR_MANAGER", "HR_STAFF", "DEPARTMENT_MANAGER", "MANAGER"]).has(
      currentUser.role
    );
  const selectedEmployeeId = canTargetOtherEmployees
    ? createEntityId || currentUser.employeeId
    : currentUser.employeeId;
  const selectedEmployee = employees.find((emp) => emp.id === selectedEmployeeId);
  const selectedDepartment = departments.find((d) => d.id === selectedEmployee?.departmentId);
  const selectedManager = employees.find((emp) => emp.id === selectedEmployee?.managerId);
  const selectedEmployeeName = selectedEmployee
    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
    : currentUser.name;
  const selectedEmployeeCode = selectedEmployee?.employeeNumber ?? currentUser.employeeNumber ?? "—";
  const selectedEmployeePosition = selectedEmployee?.jobTitle ?? currentUser.jobTitle ?? "—";
  const selectedDepartmentName =
    selectedDepartment?.name ??
    departmentNameById[selectedEmployee?.departmentId ?? ""] ??
    departmentNameById[currentUser.departmentId] ??
    "—";
  const selectedEmployeeLocation = useMemo(() => {
    const explicitWorkLocation = (
      selectedEmployee as unknown as { workLocation?: string } | undefined
    )?.workLocation;
    const fallbackAddress = selectedEmployee?.currentAddress ?? currentUser.currentAddress ?? "";
    if (explicitWorkLocation?.trim()) return explicitWorkLocation.trim();
    return inferDefaultWorkLocation(fallbackAddress, selectedDepartmentName);
  }, [selectedEmployee, currentUser.currentAddress, selectedDepartmentName]);
  const selectedEmployeeTeamBranch = useMemo(() => {
    const withTeam = selectedEmployee as
      | { currentTeamBranch?: string; teamName?: string; team?: string; branch?: string }
      | undefined;
    const explicitTeamBranch =
      withTeam?.currentTeamBranch ?? withTeam?.teamName ?? withTeam?.team ?? withTeam?.branch;
    if (explicitTeamBranch?.trim()) return explicitTeamBranch.trim();
    return inferDefaultTeamBranch(selectedDepartmentName);
  }, [selectedEmployee, selectedDepartmentName]);
  const selectedEmployeeCivilStatus =
    (selectedEmployee as unknown as { civilStatus?: string } | undefined)?.civilStatus ?? "";
  useEffect(() => {
    if (!isSupabaseAuthConfigured()) {
      setSalaryChangeCurrentSalary(null);
      return;
    }
    if (createType !== "SALARY_CHANGE" || !selectedEmployeeId) {
      setSalaryChangeCurrentSalary(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const salaryEmployeeResolution = await resolveEmployeeUuidForDb(
        selectedEmployeeCode !== "—" ? selectedEmployeeCode : selectedEmployeeId
      );
      if (!salaryEmployeeResolution.id) {
        setSalaryChangeCurrentSalary(null);
        return;
      }
      const { data, error } = await supabase
        .from("employee_salary")
        .select("base_salary,effective_from")
        .eq("employee_id", salaryEmployeeResolution.id)
        .eq("is_current", true)
        .order("effective_from", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (error || !data || data.length === 0) {
        setSalaryChangeCurrentSalary(null);
        return;
      }
      const salary = Number((data[0] as { base_salary?: number | string }).base_salary);
      setSalaryChangeCurrentSalary(Number.isFinite(salary) ? salary : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [createType, selectedEmployeeId]);
  const departmentPositionOptions = useMemo(() => {
    const sameDepartmentPositions = employees
      .filter((emp) => emp.departmentId === selectedEmployee?.departmentId)
      .map((emp) => emp.jobTitle?.trim() ?? "")
      .filter(Boolean);
    const base = sameDepartmentPositions.length > 0 ? sameDepartmentPositions : PROMOTION_POSITION_SUGGESTIONS;
    return Array.from(new Set(base));
  }, [selectedEmployee?.departmentId]);
  const roleChangePositionOptions = useMemo(() => {
    const currentTitle = (selectedEmployee?.jobTitle ?? "").trim();
    const currentLevel = inferPositionLevel(currentTitle);
    return departmentPositionOptions.filter((title) => {
      if (title.trim().toLowerCase() === currentTitle.toLowerCase()) return false;
      return inferPositionLevel(title) > currentLevel;
    });
  }, [departmentPositionOptions, selectedEmployee?.jobTitle]);
  const transferTeamBranchOptions = useMemo(() => {
    const dept = selectedDepartmentName.toLowerCase();
    if (dept.includes("technology") || dept.includes("engineering")) {
      return ["Platform Team", "Applications Team", "QA Team", "Infrastructure Team", "Support Team"];
    }
    if (dept.includes("human resources")) {
      return ["Recruitment Team", "Benefits Team", "HR Operations Team"];
    }
    if (dept.includes("finance")) {
      return ["Accounting Team", "Treasury Team", "Budget Team"];
    }
    return ["Operations Team", "Main Branch Team", "Field Team"];
  }, [selectedDepartmentName]);
  const transferTargetTeamOptions = useMemo(() => {
    const currentLocation = selectedEmployeeLocation.trim().toLowerCase();
    const targetLocation = transferToLocation.trim().toLowerCase();
    const sameLocation = Boolean(currentLocation) && Boolean(targetLocation) && currentLocation === targetLocation;
    if (!sameLocation) return transferTeamBranchOptions;
    return transferTeamBranchOptions.filter(
      (team) => team.trim().toLowerCase() !== selectedEmployeeTeamBranch.trim().toLowerCase()
    );
  }, [transferTeamBranchOptions, selectedEmployeeLocation, transferToLocation, selectedEmployeeTeamBranch]);
  const availableManagers = employees.filter(
    (emp) => emp.role === "MANAGER" || emp.role === "DEPARTMENT_MANAGER"
  );
  const departmentTargetManagers = employees.filter((emp) => emp.departmentId === departmentChangeTargetDepartmentId);
  const salaryChangeCurrentSalaryDisplay = useMemo(() => {
    if (!Number.isFinite(Number(salaryChangeCurrentSalary)) || Number(salaryChangeCurrentSalary) <= 0) {
      return "Not available in salary table";
    }
    return Number(salaryChangeCurrentSalary).toLocaleString();
  }, [salaryChangeCurrentSalary]);

  const headerTitle =
    currentUser.role === "HR_ADMIN"
      ? "Requests"
      : tab === "approve"
        ? "For Review / Approval"
      : visibleWorkflowTabs.find((x) => x.value === tab)?.label ?? "Workflow requests";
  const initials = currentUser.name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const syncWorkflowTabToUrl = useCallback(
    (next: WorkflowRequestsTab) => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", next);
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="min-w-0 w-full max-w-full flex flex-col gap-4">
      {/* Workflow Request topbar + navbar (mirrors Complaints layout) */}
      <div className={currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? "contents" : "min-w-0 space-y-3"}>
        {currentUser.role === "EMPLOYEE" || currentUser.role === "HR_STAFF" || currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? (
          <div className="flex flex-col gap-6">
            <EmployeeModuleTopbar searchPlaceholder="Search" />
            <EmployeeSectionHeader
              title={currentUser.role === "HR_STAFF" || currentUser.role === "HR_ADMIN" || currentUser.role === "HR_MANAGER" || currentUser.role === "DEPARTMENT_MANAGER" || currentUser.role === "AUDITOR" || currentUser.role === "EXECUTIVE" ? "Requests" : "My Requests"}
              tabs={visibleWorkflowTabs.map(({ value, label }) => ({ id: value, label }))}
              activeTab={
                isMyWorkflowTab(tab) ? tab : (visibleWorkflowTabs[0]?.value ?? "PROMOTION")
              }
              onTabChange={(id) => {
                const next = id as WorkflowRequestsTab;
                setTab(next);
                syncWorkflowTabToUrl(next);
              }}
            />
          </div>
        ) : (
          <>
            <DashboardSectionTopBar
              breadcrumb={
                <>
                  <span className="truncate font-semibold">
                    Workflow Requests
                  </span>
                  <span className="shrink-0 opacity-70">&gt;</span>
                  <span className="truncate font-semibold text-foreground">
                    {headerTitle}
                  </span>
                 </>
              }
              searchPlaceholder="Search workflow requests..."
            />

            <div className="border-b border-border/70">
              <div className="-mx-1 flex gap-1 overflow-x-auto py-1 [scrollbar-width:thin] sm:gap-6 lg:gap-8 [&::-webkit-scrollbar]:h-1.5">
                {tab === "approve" ? (
                  <button
                    type="button"
                    onClick={() => setTab("approve")}
                    className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                      tab === "approve"
                        ? "text-primary font-medium"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>For Review / Approval</span>
                    <span
                      className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                        tab === "approve" ? "scale-x-100" : "scale-x-0"
                      }`}
                    />
                  </button>
                ) : (
                  visibleWorkflowTabs.map(({ value, label }) => {
                    const TabIcon = WORKFLOW_TAB_ICON[value] ?? FileText;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTab(value)}
                        className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap pb-3 -mb-px px-2 text-sm transition-colors sm:text-base ${
                          tab === value
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-primary"
                        }`}
                      >
                        <TabIcon className="size-4 shrink-0" />
                        <span>{label}</span>
                        <span
                          className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary transition-transform duration-200 ${
                            tab === value ? "scale-x-100" : "scale-x-0"
                          }`}
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {actionMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {actionMessage}
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(v) => {
          if (v === "approve" || isMyWorkflowTab(v)) {
            setTab(v as WorkflowRequestsTab);
          }
        }}
        className="min-w-0 space-y-4"
      >
        {visibleWorkflowTabs.map(({ value, label }) => (
          <TabsContent key={value} value={value} className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingRequestId(null);
                    setCreateType(value);
                    setCreateOpen(true);
                  }}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                <Plus className="size-4 mr-2" />
                New request
              </Button>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or date"
                  className="h-9 w-56 pl-8"
                />
              </div>
                <label htmlFor={`my-status-filter-${value}`} className="text-sm text-muted-foreground">
                Status:
              </label>
              <select
                  id={`my-status-filter-${value}`}
                value={myStatusFilter}
                onChange={(e) => setMyStatusFilter(e.target.value as RequestStatus | "ALL")}
                className="flex h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
              >
                <option value="ALL">All</option>
                <option value="CREATED">Created</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="APPLIED">Applied</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          <Card className="h-[83vh] min-h-[480px] flex flex-col pt-1 pb-2">
            <CardContent className="pt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="rounded-md flex-1 min-h-0 overflow-auto scrollbar-hide p-0">
                <RequestTable
                  loading={workflowTableLoading}
                  requests={myRequests}
                  onViewDetails={(id) => {
                    setSelectedRequestId(id);
                    setDetailsOpen(true);
                  }}
                  onCancelCreated={cancelCreatedRequest}
                  onEditDraft={startEditDraft}
                  accentHeader
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        ))}
        <TabsContent value="approve" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {currentUser.role === "HR_STAFF"
                  ? "For Review"
                  : currentUser.role === "HR_ADMIN"
                  ? "For Review / Approval"
                  : "To Approve"}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {currentUser.role === "HR_STAFF"
                  ? "Personal info change requests assigned to HR Staff."
                  : currentUser.role === "HR_ADMIN"
                  ? "Personal info change requests from Employees and HR Staff that are assigned to HR Admin."
                  : "Approve or reject these requests. You can select multiple and use the buttons below, or use the row actions."}
              </p>
            </CardHeader>
            <CardContent>
              {currentUser.role === "HR_STAFF" ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="review-field-filter" className="text-sm text-muted-foreground">
                      Field:
                    </label>
                    <select
                      id="review-field-filter"
                      value={reviewFieldFilter}
                      onChange={(e) =>
                        setReviewFieldFilter(
                          e.target.value as
                            | "ALL"
                            | "EMAIL"
                            | "BIRTHDATE"
                            | "FULLNAME"
                            | "ADDRESS"
                            | "CONTACT_NUMBER"
                            | "CIVIL_STATUS"
                            | "SSS"
                            | "PHILHEALTH"
                            | "PAGIBIG"
                            | "TIN"
                        )
                      }
                      className="flex h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm"
                    >
                      <option value="ALL">All</option>
                      <option value="EMAIL">Email</option>
                      <option value="BIRTHDATE">Birthdate</option>
                      <option value="FULLNAME">Fullname</option>
                      <option value="ADDRESS">Address</option>
                      <option value="CONTACT_NUMBER">Contact Number</option>
                      <option value="CIVIL_STATUS">Civil Status</option>
                      <option value="SSS">SSS</option>
                      <option value="PHILHEALTH">PhilHealth</option>
                      <option value="PAGIBIG">Pag-IBIG</option>
                      <option value="TIN">TIN</option>
                    </select>
                    <label htmlFor="review-date-filter" className="text-sm text-muted-foreground">
                      Date:
                    </label>
                    <Input
                      id="review-date-filter"
                      type="date"
                      value={reviewDateFilter}
                      onChange={(e) => setReviewDateFilter(e.target.value)}
                      className="h-9 w-[170px]"
                    />
                  </div>
                  <div className="rounded-md border border-border overflow-auto scrollbar-hide">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead>
                        <tr>
                          <th className="px-3 py-2 text-left">Employee</th>
                          <th className="px-3 py-2 text-left">Field</th>
                          <th className="px-3 py-2 text-left">Old Value</th>
                          <th className="px-3 py-2 text-left">New Value</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forReview.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                              No requests to review
                            </td>
                          </tr>
                        ) : (
                          forReview.map((req) => (
                            <tr key={req.id} className="border-t border-border">
                              <td className="px-3 py-2">{req.createdByName}</td>
                              <td className="px-3 py-2">{req.personalInfoField ?? "—"}</td>
                              <td className="px-3 py-2 max-w-[180px] truncate" title={req.currentValue}>
                                {req.currentValue ?? "—"}
                              </td>
                              <td className="px-3 py-2 max-w-[180px] truncate" title={req.newValue}>
                                {req.newValue ?? "—"}
                              </td>
                              <td className="px-3 py-2">{new Date(req.createdAt).toLocaleDateString()}</td>
                              <td className="px-3 py-2">
                                <Badge
                                  className={
                                    req.status === "CREATED"
                                      ? "rounded-full border-transparent bg-zinc-500 px-3 py-1 font-bold text-white"
                                      : "rounded-full border-transparent bg-blue-600 px-3 py-1 font-bold text-white"
                                  }
                                >
                                  {req.status}
                                </Badge>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <Button size="sm" variant="outline" onClick={() => forwardToHrAdmin(req.id)}>
                                    Forward
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => openRejectModal(req.id)}>
                                    Reject
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedRequestId(req.id);
                                      setDetailsOpen(true);
                                    }}
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : currentUser.role === "HR_ADMIN" ? (
                <div className="rounded-md border border-border overflow-auto scrollbar-hide">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead>
                      <tr>
                        <th className="px-3 py-2 text-left">Employee</th>
                        <th className="px-3 py-2 text-left">Field</th>
                        <th className="px-3 py-2 text-left">Old Value</th>
                        <th className="px-3 py-2 text-left">New Value</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Status</th>
                        <th className="px-3 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toApprove.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                            No requests to review
                          </td>
                        </tr>
                      ) : (
                        toApprove.map((req) => (
                          <tr key={req.id} className="border-t border-border">
                            <td className="px-3 py-2">{req.createdByName}</td>
                            <td className="px-3 py-2">{req.personalInfoField ?? "—"}</td>
                            <td className="px-3 py-2 max-w-[180px] truncate" title={req.currentValue}>
                              {req.currentValue ?? "—"}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate" title={req.newValue}>
                              {req.newValue ?? "—"}
                            </td>
                            <td className="px-3 py-2">{new Date(req.createdAt).toLocaleDateString()}</td>
                            <td className="px-3 py-2">
                              <Badge
                                className={
                                  req.status === "CREATED"
                                    ? "rounded-full border-transparent bg-zinc-500 px-3 py-1 font-bold text-white"
                                    : "rounded-full border-transparent bg-blue-600 px-3 py-1 font-bold text-white"
                                }
                              >
                                {req.status}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => updateStatus(req.id, "APPROVED")}>
                                  Approve &amp; Apply
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => openRejectModal(req.id)}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRequestId(req.id);
                                    setDetailsOpen(true);
                                  }}
                                >
                                  View Details
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
              <RequestTable
                loading={workflowTableLoading}
                requests={toApprove}
                selectable
                selectedIds={selectedIds}
                onToggle={toggleSelected}
                onToggleAll={toggleAll}
                showRowActions
                onApprove={(id) => updateStatus(id, "APPROVED")}
                    onReject={openRejectModal}
                    onViewDetails={(id) => {
                      setSelectedRequestId(id);
                      setDetailsOpen(true);
                    }}
              />
              {pendingCount > 0 && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                  <Button
                    size="sm"
                    onClick={bulkApprove}
                    disabled={selectedIds.length === 0}
                  >
                    Approve selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={bulkReject}
                    disabled={selectedIds.length === 0}
                  >
                    Reject
                  </Button>
                </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setEditingRequestId(null);
            setCreateConfirmOpen(false);
            setCreateType("");
            setCreateTitle("");
            setCreateEntityId("");
            setCreateEffectiveDate("");
            setCreateDescription("");
            setCreatePersonalInfoField("");
            setCreatePersonalInfoNewValue("");
            setPromotionNewPosition("");
            setRoleChangeNewPosition("");
            setTransferTargetTeamBranch("");
            setTransferToLocation("");
            setTransferImpactNotes("");
            setDepartmentChangeTargetDepartmentId("");
            setDepartmentChangeTargetManagerId("");
            setDepartmentChangeBusinessImpact("");
            setSalaryChangePerformanceReference("");
            setSalaryChangeBudgetJustification("");
            setManagerChangeNewManagerId("");
            setManagerChangeTeamImpactNotes("");
            setCreateAttachment(null);
            if (createAttachmentInputRef.current) createAttachmentInputRef.current.value = "";
            setCreateError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto scrollbar-hide">
          <DialogHeader>
            <DialogTitle>{editingRequestId ? "Edit Draft Request" : "New Request"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRequest} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-type">Type</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-foreground">
                  {createType
                    ? requestTypeOptions.find((opt) => opt.value === createType)?.label ??
                      createType.replace(/_/g, " ")
                    : activeTabRequestLabel || "Select request type"}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-title">
                  Title{" "}
                  {sameAsEmployeeNewRequestForm ? (
                    <span className="text-muted-foreground">(Auto-generated if empty)</span>
                  ) : null}
                </Label>
                <Input
                  id="create-title"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder={
                    createType === "PERSONAL_INFO_CHANGE"
                      ? "Auto-generated: Personal Info Change: Email/Birthdate/Fullname"
                      : createType === "PROMOTION"
                      ? "Auto-generated: Promotion Request"
                      : createType === "TRANSFER"
                      ? "Auto-generated: Transfer Request"
                      : createType === "ROLE_CHANGE"
                      ? "Auto-generated: Role Change Request"
                      : "Optional - auto-generated if empty"
                  }
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {createType === "PERSONAL_INFO_CHANGE" && (
                <div className="space-y-3 md:col-span-2">
                  <Label htmlFor="create-personal-field">Personal Info Field</Label>
                  <select
                    id="create-personal-field"
                    value={createPersonalInfoField}
                    onChange={(e) => {
                      setCreatePersonalInfoField(
                        e.target.value as
                          | "EMAIL"
                          | "BIRTHDATE"
                          | "FULLNAME"
                          | "ADDRESS"
                          | "CONTACT_NUMBER"
                          | "CIVIL_STATUS"
                          | "SSS"
                          | "PHILHEALTH"
                          | "PAGIBIG"
                          | "TIN"
                          | ""
                      );
                      // Reset input value when switching field type (email/date/text).
                      setCreatePersonalInfoNewValue("");
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select field to change</option>
                    <option value="EMAIL">Email</option>
                    <option value="BIRTHDATE">Birthdate</option>
                    <option value="FULLNAME">Fullname</option>
                    <option value="ADDRESS">Address</option>
                    <option value="CONTACT_NUMBER">Contact Number</option>
                    <option value="CIVIL_STATUS">Civil Status</option>
                    <option value="SSS">SSS</option>
                    <option value="PHILHEALTH">PhilHealth</option>
                    <option value="PAGIBIG">Pag-IBIG</option>
                    <option value="TIN">TIN</option>
                  </select>
                  {createPersonalInfoField && (
                    <>
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                        <span className="font-medium">Current Value:</span>{" "}
                        {getCurrentPersonalInfoValue() || "—"}
                      </div>
              <div className="space-y-2">
                        <Label htmlFor="create-personal-new-value">New Value</Label>
                        <Input
                          id="create-personal-new-value"
                          type={createPersonalInfoField === "EMAIL" ? "email" : createPersonalInfoField === "BIRTHDATE" ? "date" : "text"}
                          value={createPersonalInfoNewValue}
                          onChange={(e) => setCreatePersonalInfoNewValue(e.target.value)}
                          placeholder={
                            createPersonalInfoField === "EMAIL"
                              ? "e.g. glen.new@company.com"
                              : createPersonalInfoField === "FULLNAME"
                              ? "e.g. Glean Ramos"
                              : createPersonalInfoField === "ADDRESS"
                              ? "e.g. 123 Main St, Makati City"
                              : createPersonalInfoField === "CONTACT_NUMBER"
                              ? "e.g. +63 912 345 6789"
                              : createPersonalInfoField === "CIVIL_STATUS"
                              ? "e.g. Single / Married"
                              : createPersonalInfoField === "SSS"
                              ? "e.g. 12-3456789-0"
                              : createPersonalInfoField === "PHILHEALTH" || createPersonalInfoField === "PAGIBIG"
                              ? "e.g. 1234-5678-9012"
                              : createPersonalInfoField === "TIN"
                              ? "e.g. 123-456-789"
                              : undefined
                          }
                          className="h-10"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              {(canTargetOtherEmployees || !sameAsEmployeeNewRequestForm) ? (
                <div className="space-y-2">
                  {canTargetOtherEmployees ? (
                    <>
                <Label htmlFor="create-entity">Related Employee</Label>
                <select
                  id="create-entity"
                  value={createEntityId}
                  onChange={(e) => setCreateEntityId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                    </option>
                  ))}
                </select>
                    </>
                  ) : (
                    <>
                      <Label>Related Employee</Label>
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                        Auto-set to your employee profile
              </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
            {createType && createType !== "PERSONAL_INFO_CHANGE" && (
              <div className="space-y-4 rounded-md border border-border p-4">
                <p className="text-sm font-semibold text-foreground">Employee Details</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">Employee Name:</span>{" "}
                    {selectedEmployeeName}
                  </div>
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">Employee ID:</span>{" "}
                    {selectedEmployeeCode}
                  </div>
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">Current Position:</span> {selectedEmployeePosition}
                  </div>
                  <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                    <span className="font-medium">Department:</span> {selectedDepartmentName}
                  </div>
                </div>
              </div>
            )}
            {createType === "PROMOTION" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="promotion-current-position">Current Position</Label>
                  <Input
                    id="promotion-current-position"
                    value={selectedEmployeePosition}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotion-new-position">New Position / Title</Label>
                  <select
                    id="promotion-new-position"
                    value={promotionNewPosition}
                    onChange={(e) => setPromotionNewPosition(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select suggested position/title</option>
                    {PROMOTION_POSITION_SUGGESTIONS.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>
                {isHrRole && (
                  <div className="space-y-2">
                    <Label htmlFor="create-effective-date">Effective Date</Label>
                    <Input id="create-effective-date" type="date" value={createEffectiveDate} onChange={(e) => setCreateEffectiveDate(e.target.value)} className="h-10 date-input" />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-description">Reason for Promotion</Label>
                  <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
                </div>
              </div>
              )}
            {createType === "TRANSFER" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {selectedDepartmentName}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Current Position</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {selectedEmployeePosition}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-from-location">From Location</Label>
                  <Input
                    id="transfer-from-location"
                    value={selectedEmployeeLocation}
                    readOnly
                    placeholder="Current location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-to-location">To Location</Label>
                  <select
                    id="transfer-to-location"
                    value={transferToLocation}
                    onChange={(e) => setTransferToLocation(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select target location</option>
                    {TRANSFER_LOCATION_OPTIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-current-team">Current Team</Label>
                  <Input
                    id="transfer-current-team"
                    value={selectedEmployeeTeamBranch}
                    readOnly
                    placeholder="Current team"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transfer-target-team">Target Team</Label>
                  <select
                    id="transfer-target-team"
                    value={transferTargetTeamBranch}
                    onChange={(e) => setTransferTargetTeamBranch(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select target team</option>
                    {transferTargetTeamOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                {isHrRole && (
                  <div className="space-y-2">
                    <Label htmlFor="create-effective-date">Effective Date</Label>
                    <Input id="create-effective-date" type="date" value={createEffectiveDate} onChange={(e) => setCreateEffectiveDate(e.target.value)} className="h-10 date-input" />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-description">Reason for Transfer</Label>
                  <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="transfer-impact-notes">Impact Notes</Label>
                  <textarea id="transfer-impact-notes" value={transferImpactNotes} onChange={(e) => setTransferImpactNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px] resize-y" />
                </div>
              </div>
            )}
            {createType === "ROLE_CHANGE" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {selectedDepartmentName}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Current Position</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {selectedEmployeePosition}
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="role-change-new-position">New Position</Label>
                  <select
                    id="role-change-new-position"
                    value={roleChangeNewPosition}
                    onChange={(e) => setRoleChangeNewPosition(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select next valid position</option>
                    {roleChangePositionOptions.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>
                {isHrRole && (
                  <div className="space-y-2">
                    <Label htmlFor="create-effective-date">Effective Date</Label>
                    <Input id="create-effective-date" type="date" value={createEffectiveDate} onChange={(e) => setCreateEffectiveDate(e.target.value)} className="h-10 date-input" />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-description">Reason for Role Change</Label>
                  <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
                </div>
              </div>
            )}
            {createType === "DEPARTMENT_CHANGE" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Current Manager</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}` : "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dept-change-target-dept">Target Department</Label>
                  <select
                    id="dept-change-target-dept"
                    value={departmentChangeTargetDepartmentId}
                    onChange={(e) => setDepartmentChangeTargetDepartmentId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select target department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dept-change-target-manager">Target Manager</Label>
                  <select
                    id="dept-change-target-manager"
                    value={departmentChangeTargetManagerId}
                    onChange={(e) => setDepartmentChangeTargetManagerId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select target manager</option>
                    {departmentTargetManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName}</option>
                    ))}
                  </select>
                </div>
                {isHrRole && (
                  <div className="space-y-2">
                    <Label htmlFor="create-effective-date">Effective Date</Label>
                    <Input id="create-effective-date" type="date" value={createEffectiveDate} onChange={(e) => setCreateEffectiveDate(e.target.value)} className="h-10 date-input" />
                  </div>
                )}
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-description">Reason for Department Change</Label>
                  <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="dept-change-impact">Business Impact Notes</Label>
                  <textarea id="dept-change-impact" value={departmentChangeBusinessImpact} onChange={(e) => setDepartmentChangeBusinessImpact(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px] resize-y" />
                </div>
              </div>
            )}
            {createType === "SALARY_CHANGE" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Current Salary</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {salaryChangeCurrentSalaryDisplay}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="salary-performance-reference">Percentage Increase</Label>
                  <select
                    id="salary-performance-reference"
                    value={salaryChangePerformanceReference}
                    onChange={(e) => setSalaryChangePerformanceReference(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select percentage increase</option>
                    {SALARY_INCREASE_PERCENT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-description">Reason for Salary Change</Label>
                  <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="salary-budget-justification">Budget Justification (HR use)</Label>
                  <textarea id="salary-budget-justification" value={salaryChangeBudgetJustification} onChange={(e) => setSalaryChangeBudgetJustification(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px] resize-y" />
                </div>
              </div>
            )}
            {createType === "MANAGER_CHANGE" && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Current Manager</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">
                    {selectedManager ? `${selectedManager.firstName} ${selectedManager.lastName}` : "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager-change-new-manager">New Manager</Label>
                  <select id="manager-change-new-manager" value={managerChangeNewManagerId} onChange={(e) => setManagerChangeNewManagerId(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select new manager</option>
                    {availableManagers.map((manager) => (
                      <option key={manager.id} value={manager.id}>{manager.firstName} {manager.lastName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/30 px-3 text-sm">{selectedDepartment?.name ?? "—"}</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-effective-date">Effective Date</Label>
                  <Input id="create-effective-date" type="date" value={createEffectiveDate} onChange={(e) => setCreateEffectiveDate(e.target.value)} className="h-10 date-input" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="create-description">Reason for Manager Change</Label>
                  <textarea id="create-description" value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="manager-change-impact">Team Impact Notes</Label>
                  <textarea id="manager-change-impact" value={managerChangeTeamImpactNotes} onChange={(e) => setManagerChangeTeamImpactNotes(e.target.value)} rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[70px] resize-y" />
                </div>
              </div>
            )}
            {(!createType || createType === "PERSONAL_INFO_CHANGE") && (
            <div className="space-y-2">
              <Label htmlFor="create-description">Reason / Details</Label>
              <textarea
                id="create-description"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Provide reason and relevant details..."
                rows={4}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
              />
            </div>
            )}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-muted-foreground font-normal">
                <Upload className="size-4" />
                Upload supporting document (optional)
              </Label>
              <div className="space-y-2">
                <div className="flex h-10 items-center rounded-md border border-input bg-background overflow-hidden">
                  <input
                    ref={createAttachmentInputRef}
                    type="file"
                    id="create-attachment"
                    className="sr-only"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setCreateAttachment(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-full rounded-r-none border-0 border-r border-input bg-muted/50 px-4 font-medium shrink-0"
                    onClick={() => document.getElementById("create-attachment")?.click()}
                  >
                    Choose file
                  </Button>
                  <span className="flex-1 min-w-0 px-3 py-2 text-sm text-muted-foreground truncate">
                    {createAttachment ? createAttachment.name : "No file chosen"}
                  </span>
                </div>
                {createAttachment && (
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground truncate flex-1" title={createAttachment.name}>
                        {createAttachment.name}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(createAttachment.size / 1024).toFixed(1)} KB)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setCreateAttachment(null);
                          if (createAttachmentInputRef.current) createAttachmentInputRef.current.value = "";
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
                        const url = URL.createObjectURL(createAttachment);
                        openAttachmentPreview(url, createAttachment.name);
                        setTimeout(() => URL.revokeObjectURL(url), 60000);
                      }}
                    >
                      Preview
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editingRequestId ? "Update Draft" : "Create Request"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-center">Confirm Request Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit this request? Please ensure all information is accurate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateConfirmOpen(false)}
              disabled={createSubmitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={confirmCreateRequest} disabled={createSubmitting}>
              {createSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) setSelectedRequestId(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              Review request details, old/new values, and workflow progress.
            </DialogDescription>
          </DialogHeader>
          {selectedRequest ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-sm"><span className="font-medium">Title:</span> {selectedRequest.title}</p>
                <p className="text-sm mt-1"><span className="font-medium">Type:</span> {selectedRequest.type.replace(/_/g, " ")}</p>
                <p className="text-sm mt-1"><span className="font-medium">Status:</span> {selectedRequest.status}</p>
                {selectedRequest.description && (
                  <p className="text-sm mt-2 whitespace-pre-line">
                    <span className="font-medium">Description:</span> {selectedRequest.description}
                  </p>
                )}
                {selectedRequest.type === "PERSONAL_INFO_CHANGE" && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-sm">
                    <p><span className="font-medium">Field:</span> {selectedRequest.personalInfoField ?? "—"}</p>
                    <p><span className="font-medium">Old Value:</span> {selectedRequest.currentValue ?? "—"}</p>
                    <p><span className="font-medium">New Value:</span> {selectedRequest.newValue ?? "—"}</p>
                    <p><span className="font-medium">Reason:</span> {selectedRequest.reason ?? "—"}</p>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium mb-2">Attachments</p>
                {selectedRequest.attachmentName ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm">{selectedRequest.attachmentName}</p>
                    {resolveAttachmentUrl(selectedRequest.attachmentDataUrl as string | undefined, selectedRequest.attachmentName) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openAttachmentPreview(
                            resolveAttachmentUrl(
                              selectedRequest.attachmentDataUrl as string | undefined,
                              selectedRequest.attachmentName
                            ) as string,
                            selectedRequest.attachmentName
                          )
                        }
                      >
                        Preview
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No attachment</p>
                )}
              </div>

              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="px-3 py-2 text-left">Step</th>
                      <th className="px-3 py-2 text-left">Actor</th>
                      <th className="px-3 py-2 text-left">Action</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2">1</td>
                      <td className="px-3 py-2">{selectedRequest.createdByName}</td>
                      <td className="px-3 py-2">Created</td>
                      <td className="px-3 py-2">{new Date(selectedRequest.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2">2</td>
                      <td className="px-3 py-2">
                        {selectedRequest.type === "PERSONAL_INFO_CHANGE"
                          ? selectedRequest.reviewStage === "HR_ADMIN"
                            ? "HR Admin"
                            : selectedRequest.reviewStage === "EXECUTIVE"
                            ? "Executive"
                            : "HR Staff"
                          : selectedRequest.status === "PENDING"
                          ? "Pending Reviewer"
                          : "Workflow"}
                      </td>
                      <td className="px-3 py-2">
                        {selectedRequest.type === "PERSONAL_INFO_CHANGE" && selectedRequest.status === "PENDING"
                          ? selectedRequest.reviewStage === "HR_ADMIN"
                            ? "Final Verification"
                            : "Initial Review"
                          : selectedRequest.status}
                      </td>
                      <td className="px-3 py-2">{new Date(selectedRequest.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        {selectedRequest.status === "PENDING"
                          ? selectedRequest.type === "PERSONAL_INFO_CHANGE"
                            ? selectedRequest.reviewStage === "HR_ADMIN"
                              ? "Awaiting final HR Admin approval"
                              : selectedRequest.reviewStage === "EXECUTIVE"
                              ? "Awaiting Executive review"
                              : "Awaiting HR Staff review"
                            : "Awaiting approval"
                          : selectedRequest.status === "REJECTED"
                          ? "Rejected with remarks"
                          : "Latest status"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No request selected.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={attachmentPreviewOpen}
        onOpenChange={(open) => {
          setAttachmentPreviewOpen(open);
          if (!open) {
            setAttachmentPreviewUrl(null);
            setAttachmentPreviewName("");
            setAttachmentPreviewMaximized(false);
          }
        }}
      >
        <DialogContent
          className={attachmentPreviewMaximized ? "sm:max-w-[96vw] w-[96vw]" : "sm:max-w-5xl"}
          overlayClassName="bg-transparent"
        >
          <div className="flex items-start justify-between gap-3">
            <DialogHeader>
              <DialogTitle>Attachment Preview</DialogTitle>
              <DialogDescription>{attachmentPreviewName || "Preview"}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-1 pr-9">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setAttachmentPreviewMaximized((prev) => !prev)}
                title={attachmentPreviewMaximized ? "Restore down" : "Maximize"}
              >
                {attachmentPreviewMaximized ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          {attachmentPreviewUrl ? (
            <div
              className={
                attachmentPreviewMaximized
                  ? "h-[82vh] w-full overflow-hidden rounded-md border border-border bg-muted/20"
                  : "h-[65vh] w-full overflow-hidden rounded-md border border-border bg-muted/20"
              }
            >
              {attachmentPreviewIsImage ? (
                <div className="h-full w-full overflow-auto p-2">
                  <Image
                    src={attachmentPreviewUrl}
                    alt={attachmentPreviewName || "Attachment preview"}
                    width={1600}
                    height={1200}
                    unoptimized
                    loading="lazy"
                    className="mx-auto h-auto max-h-full w-auto max-w-full object-contain"
                  />
                </div>
              ) : attachmentPreviewIsPdf ? (
                <iframe
                  src={attachmentPreviewUrl}
                  title={attachmentPreviewName || "Attachment preview"}
                  className="h-full w-full"
                />
              ) : (
                <iframe
                  src={attachmentPreviewUrl}
                  title={attachmentPreviewName || "Attachment preview"}
                  className="h-full w-full"
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No attachment selected for preview.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAttachmentPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Request</DialogTitle>
            <DialogDescription>
              Provide reason for rejection. This will be saved in workflow logs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
              placeholder="Enter rejection reason"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={rejectSubmitting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={rejectForReview} disabled={rejectSubmitting}>
              {rejectSubmitting ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
