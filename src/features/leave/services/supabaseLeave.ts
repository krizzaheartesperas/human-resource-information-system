import { supabase } from "@/lib/supabase/client";
import type {
  LeaveBalanceInsert,
  LeaveBalanceRow,
  LeaveRequestInsert,
  LeaveRequestRow,
  EmployeeRow,
  ProfileRow,
} from "@/lib/supabase/client";
import {
  getEmployeeById,
  leaveTypeMetadata,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveStatus,
  type Role,
type TimeOffType,
} from "@/lib/mock";

type SupabaseRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export function isSupabaseLeaveConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.length &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
  );
}

let employeeRowCache: Map<string, EmployeeRow> | null = null;
let employeeNumberToIdCache: Map<string, string> | null = null;

export function invalidateLeaveEmployeeCache() {
  employeeRowCache = null;
  employeeNumberToIdCache = null;
}

/** Match mock `employeeNumber` to Supabase `employee_number` or teammate `employee_code`. */
export function businessEmployeeNumberFromRow(e: EmployeeRow): string {
  const raw = e.employee_number ?? e.employee_code;
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

/** Normalize for map keys / lookups (mock uses E001-style). */
function normalizeEmployeeNumberKey(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Lookup keys for the same human-readable code. Does NOT map EMP-0002 ↔ E002 by digit
 * (different schemes would collide: Glen EMP-0002 vs Juan E002).
 */
function employeeCodeCandidateKeys(code: string): string[] {
  const normalized = normalizeEmployeeNumberKey(code);
  if (!normalized) return [];
  const keys = new Set<string>([normalized]);

  if (normalized.startsWith("EMP")) {
    const digits = normalized.replace(/[^0-9]/g, "");
    if (digits) {
      const p4 = digits.padStart(4, "0");
      keys.add(`EMP-${p4}`);
      keys.add(`EMP${p4}`);
    }
    return [...keys];
  }

  if (/^E\d+$/.test(normalized)) {
    const n = parseInt(normalized.slice(1), 10);
    if (!Number.isNaN(n)) {
      keys.add(`E${n}`);
      keys.add(`E${String(n).padStart(3, "0")}`);
    }
  }

  return [...keys];
}

function displayNameFromEmployeeRow(e: EmployeeRow, fallbackNumber: string): string {
  const full = (e.full_name ?? e.name ?? "").trim();
  if (full) return full;
  const fn = (e.first_name ?? "").trim();
  const ln = (e.last_name ?? "").trim();
  const combined = `${fn} ${ln}`.trim();
  if (combined) return combined;
  const email = (e.email ?? "").trim();
  if (email) return email;
  const pos = (e.position ?? e.job_title ?? "").trim();
  if (pos) return pos;
  if (fallbackNumber) return `Employee ${fallbackNumber}`;
  return "Unknown employee";
}

function inferRoleFromEmployeeRow(e: EmployeeRow | undefined): Role | undefined {
  if (!e) return undefined;
  const values = [e.role, e.portal_role, e.position, e.job_title]
    .filter(Boolean)
    .map((v) => String(v).trim().toUpperCase().replace(/[^A-Z_ ]/g, "").replace(/\s+/g, "_"));

  const direct = values.find((v) =>
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
    ].includes(v)
  ) as Role | undefined;
  if (direct) return direct;

  if (values.some((v) => v.includes("DEPARTMENT_MANAGER"))) return "DEPARTMENT_MANAGER";
  if (values.some((v) => v.includes("HR_MANAGER"))) return "HR_MANAGER";
  if (values.some((v) => v.includes("HR_ADMIN"))) return "HR_ADMIN";
  if (values.some((v) => v.includes("HR_STAFF"))) return "HR_STAFF";
  if (values.some((v) => v.includes("AUDITOR") || v.includes("AUDIT"))) return "AUDITOR";
  if (values.some((v) => v.includes("EXECUTIVE"))) return "EXECUTIVE";
  if (values.some((v) => v.includes("MANAGER"))) return "MANAGER";
  return undefined;
}

async function getEmployeeNumberToIdMap(): Promise<Map<string, string>> {
  // Only reuse cache when it has entries. (An empty Map is truthy in JS — caching {} caused
  // "never refetch" after fixing RLS or adding employee_code until full page reload.)
  if (employeeNumberToIdCache && employeeNumberToIdCache.size > 0) {
    return employeeNumberToIdCache;
  }

  const { data, error } = await supabase
    .from("employees")
    .select(
      "id,employee_number,employee_code,full_name,name,first_name,last_name,email,position,job_title,role,portal_role,user_id,auth_user_id,department_id,manager_id"
    );

  if (error) {
    console.warn("[leave] employees query failed:", error.message, error.code ?? "", error);
    employeeNumberToIdCache = null;
    employeeRowCache = null;
    return new Map();
  }

  const rows = (data ?? []) as EmployeeRow[];
  const profileUserIds = Array.from(
    new Set(
      rows
        .flatMap((e) => [e.auth_user_id, e.user_id])
        .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    )
  );
  let profileByUserId = new Map<string, ProfileRow>();
  if (profileUserIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("user_id,first_name,last_name")
      .in("user_id", profileUserIds);
    profileByUserId = new Map(
      ((profileRows ?? []) as ProfileRow[])
        .filter((p) => p.user_id !== null && p.user_id !== undefined)
        .map((p) => [String(p.user_id), p])
    );
  }

  const enrichedRows = rows.map((e) => {
    const hasName =
      Boolean((e.full_name ?? "").trim()) ||
      Boolean((e.name ?? "").trim()) ||
      Boolean((e.first_name ?? "").trim()) ||
      Boolean((e.last_name ?? "").trim());
    if (hasName) return e;

    const profile =
      (e.auth_user_id ? profileByUserId.get(String(e.auth_user_id)) : undefined) ??
      (e.user_id ? profileByUserId.get(String(e.user_id)) : undefined);
    if (!profile) return e;

    return {
      ...e,
      first_name: (profile.first_name ?? e.first_name ?? "").trim() || e.first_name,
      last_name: (profile.last_name ?? e.last_name ?? "").trim() || e.last_name,
    };
  });

  employeeRowCache = new Map(enrichedRows.map((e) => [e.id, e]));

  const byNumber = new Map<string, string>();
  for (const e of enrichedRows) {
    const key = businessEmployeeNumberFromRow(e);
    if (!key) continue;
    for (const candidate of employeeCodeCandidateKeys(key)) {
      if (!byNumber.has(candidate)) byNumber.set(candidate, e.id);
    }
  }

  if (enrichedRows.length === 0) {
    console.warn(
      "[leave] employees: 0 rows returned. If rows exist in Table Editor, RLS is blocking SELECT for the anon key — add a SELECT policy on public.employees for role anon."
    );
    employeeNumberToIdCache = null;
    return new Map();
  }

  if (byNumber.size === 0) {
    console.warn(
      "[leave] employees:",
      enrichedRows.length,
      "row(s) but no employee_code / employee_number — set codes to match mock (e.g. E001 for default user’s mock employee)."
    );
    employeeNumberToIdCache = null;
    return new Map();
  }

  employeeNumberToIdCache = byNumber;
  return byNumber;
}

async function resolveEmployeeUuidForLeaveBalance(
  employeeId: string,
  employeeNumber?: string
): Promise<string | null> {
  if (isEmployeeUuidString(employeeId)) return employeeId.trim();

  const sourceEmployeeNumber = (employeeNumber ?? "").trim();
  if (!sourceEmployeeNumber) return null;

  const numberToId = await getEmployeeNumberToIdMap();
  return (
    employeeCodeCandidateKeys(sourceEmployeeNumber)
      .map((key) => numberToId.get(key))
      .find(Boolean) ?? null
  );
}

export async function resolveCurrentEmployeeUuid(
  employeeId: string,
  employeeNumber?: string
): Promise<string | null> {
  if (isEmployeeUuidString(employeeId)) return employeeId.trim();

  const fromCode = await resolveEmployeeUuidForLeaveBalance(employeeId, employeeNumber);
  if (fromCode) return fromCode;

  const { data: authData } = await supabase.auth.getUser();
  const authUserId = String(authData.user?.id ?? "").trim();
  if (!authUserId) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .or(`auth_user_id.eq.${authUserId},user_id.eq.${authUserId}`)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[leave] resolveCurrentEmployeeUuid auth-user lookup failed:", error.message);
    return null;
  }

  const resolved = String(data?.id ?? "").trim();
  return resolved || null;
}

async function getEmployeeRowsById(): Promise<Map<string, EmployeeRow>> {
  await getEmployeeNumberToIdMap();
  return employeeRowCache ?? new Map();
}

function isDepartmentManagerLike(row: EmployeeRow): boolean {
  return [row.role, row.portal_role, row.position, row.job_title]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase().replace(/_/g, " "))
    .some((value) =>
      [
        "department manager",
        "engineering manager",
        "it manager",
      ].includes(value)
    );
}

export async function fetchDepartmentManagerTeamEmployeeIdsFromSupabase(
  managerEmployeeId: string
): Promise<{ data: string[]; error: Error | null }> {
  invalidateLeaveEmployeeCache();
  const byId = await getEmployeeRowsById();
  const manager = byId.get(managerEmployeeId);

  if (!manager) {
    return { data: [], error: null };
  }

  const managerKeys = new Set(
    [manager.id, manager.user_id, manager.auth_user_id].filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    )
  );

  const { data: departmentRows, error } = await supabase
    .from("departments")
    .select("id,manager_id");

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const managedDepartmentIds = new Set<string>();
  for (const row of (departmentRows ?? []) as Array<{ id?: string; manager_id?: string | null }>) {
    if (row.id && row.manager_id && managerKeys.has(row.manager_id)) {
      managedDepartmentIds.add(row.id);
    }
  }

  // Some shared DB rows do not have departments.manager_id populated yet.
  // If the signed-in user is a manager-like employee, treat their own department as their team.
  if (managedDepartmentIds.size === 0 && manager.department_id && isDepartmentManagerLike(manager)) {
    managedDepartmentIds.add(manager.department_id);
  }

  const teamIds = new Set<string>();
  for (const employee of byId.values()) {
    if (employee.id === manager.id) continue;
    const isDirectReport = Boolean(employee.manager_id && managerKeys.has(employee.manager_id));
    const isInManagedDepartment = Boolean(
      employee.department_id && managedDepartmentIds.has(employee.department_id)
    );
    if (isDirectReport || isInManagedDepartment) {
      teamIds.add(employee.id);
    }
  }

  return { data: [...teamIds], error: null };
}

function migrateLeaveType(type: string): TimeOffType {
  const normalized = type.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+/g, "_");
  const map: Record<string, TimeOffType> = {
    ANNUAL_LEAVE: "VACATION_LEAVE",
    WORK_FROM_HOME: "VACATION_LEAVE",
    MATERNITY: "MATERNITY_LEAVE",
    OTHER: "UNPAID_LEAVE",
  };
  return (map[normalized] ?? normalized) as TimeOffType;
}

function normalizeLeaveStatus(status: string): LeaveStatus {
  return status.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+/g, "_") as LeaveStatus;
}

function coerceLeaveBalanceRow(raw: Record<string, unknown>): LeaveBalanceRow {
  return {
    id: String(raw.id ?? ""),
    employee_id: String(raw.employee_id ?? ""),
    type: migrateLeaveType(String(raw.type ?? "VACATION_LEAVE")) as LeaveBalanceRow["type"],
    year:
      typeof raw.year === "number"
        ? raw.year
        : Number.parseInt(String(raw.year ?? new Date().getFullYear()), 10),
    total_days:
      typeof raw.total_days === "number"
        ? raw.total_days
        : Number.parseInt(String(raw.total_days ?? 0), 10),
    used_days:
      typeof raw.used_days === "number"
        ? raw.used_days
        : Number.parseInt(String(raw.used_days ?? 0), 10),
    pending_days:
      typeof raw.pending_days === "number"
        ? raw.pending_days
        : Number.parseInt(String(raw.pending_days ?? 0), 10),
    created_at:
      typeof raw.created_at === "string" && raw.created_at
        ? raw.created_at
        : new Date().toISOString(),
    updated_at:
      typeof raw.updated_at === "string" && raw.updated_at
        ? raw.updated_at
        : new Date().toISOString(),
  };
}

function leaveBalanceRowToBalance(
  row: LeaveBalanceRow,
  byId: Map<string, EmployeeRow>,
  labels?: { employeeName?: string; employeeNumber?: string }
): LeaveBalance {
  const empRow = byId.get(row.employee_id);
  const employeeNumber = empRow
    ? businessEmployeeNumberFromRow(empRow)
    : (labels?.employeeNumber ?? "").trim();
  const employeeName = empRow
    ? displayNameFromEmployeeRow(empRow, employeeNumber)
    : (labels?.employeeName ?? "").trim() ||
      (employeeNumber ? `Employee ${employeeNumber}` : "Unknown employee");
  const totalDays = row.total_days ?? 0;
  const usedDays = row.used_days ?? 0;
  const pendingDays = row.pending_days ?? 0;

  return {
    employeeId: row.employee_id,
    employeeName,
    employeeNumber,
    type: migrateLeaveType(row.type),
    totalDays,
    usedDays,
    pendingDays,
    balanceDays: Math.max(0, totalDays - usedDays - pendingDays),
  };
}

function buildMetadata(req: LeaveRequest): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  if (req.remarks) m.remarks = req.remarks;
  if (req.rejectionReason) m.rejectionReason = req.rejectionReason;
  if (req.returnedTo) m.returnedTo = req.returnedTo;
  if (req.supportingDocName) m.supportingDocName = req.supportingDocName;
  if (req.supportingDocDataUrl) m.supportingDocDataUrl = req.supportingDocDataUrl;
  if (typeof req.balanceReserved === "boolean") m.balanceReserved = req.balanceReserved;
  const en = (req.employeeName ?? "").trim();
  const ec = (req.employeeNumber ?? "").trim();
  if (en) m.employeeName = en;
  if (ec) m.employeeNumber = ec;
  if (req.submitterRole) m.submitterRole = req.submitterRole;
  if (req.status === "DRAFT") {
    m.draftForm = {
      startDate: req.startDate ?? "",
      endDate: req.endDate ?? "",
      reason: req.reason ?? "",
    };
  }
  return m;
}

function parseMetadata(meta: unknown): Partial<
  Pick<
    LeaveRequest,
    | "remarks"
    | "rejectionReason"
    | "returnedTo"
    | "supportingDocName"
    | "supportingDocDataUrl"
    | "employeeName"
    | "employeeNumber"
    | "submitterRole"
    | "balanceReserved"
  >
> {
  if (!meta || typeof meta !== "object") return {};
  const o = meta as Record<string, unknown>;
  const out: Partial<
    Pick<
      LeaveRequest,
      | "remarks"
      | "rejectionReason"
      | "returnedTo"
      | "supportingDocName"
      | "supportingDocDataUrl"
      | "employeeName"
      | "employeeNumber"
      | "submitterRole"
      | "balanceReserved"
    >
  > = {};
  if (typeof o.remarks === "string") out.remarks = o.remarks;
  if (typeof o.rejectionReason === "string") out.rejectionReason = o.rejectionReason;
  if (o.returnedTo === "HR_STAFF" || o.returnedTo === "DEPARTMENT_MANAGER" || o.returnedTo === "HR_ADMIN") {
    out.returnedTo = o.returnedTo;
  }
  if (typeof o.supportingDocName === "string") out.supportingDocName = o.supportingDocName;
  if (typeof o.supportingDocDataUrl === "string" && o.supportingDocDataUrl.trim()) {
    out.supportingDocDataUrl = o.supportingDocDataUrl;
  } else if (typeof o.supporting_document_url === "string" && o.supporting_document_url.trim()) {
    // Backward compat for snake_case keys from DB payloads.
    out.supportingDocDataUrl = o.supporting_document_url;
  }
  if (
    (!out.supportingDocName || !out.supportingDocName.trim()) &&
    typeof o.supporting_document_name === "string" &&
    o.supporting_document_name.trim()
  ) {
    out.supportingDocName = o.supporting_document_name;
  }
  if (typeof o.employeeName === "string" && o.employeeName.trim()) out.employeeName = o.employeeName.trim();
  if (typeof o.employeeNumber === "string" && o.employeeNumber.trim()) out.employeeNumber = o.employeeNumber.trim();
  if (typeof o.submitterRole === "string" && o.submitterRole.trim()) {
    out.submitterRole = o.submitterRole.trim().toUpperCase().replace(/[^A-Z_]/g, "_") as Role;
  }
  if (typeof o.balanceReserved === "boolean") out.balanceReserved = o.balanceReserved;
  return out;
}

/** Supabase `employees.id` / `leave_requests.employee_id` (uuid). */
function isEmployeeUuidString(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function metadataObjectFromRaw(metaRaw: unknown): Record<string, unknown> {
  if (metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)) {
    return metaRaw as Record<string, unknown>;
  }
  if (typeof metaRaw === "string" && metaRaw.trim()) {
    try {
      const parsed = JSON.parse(metaRaw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function coerceLeaveRequestRow(raw: Record<string, unknown>): LeaveRequestRow {
  const metadata = metadataObjectFromRaw(raw.metadata);
  if (
    typeof raw.supporting_document_url === "string" &&
    raw.supporting_document_url.trim() &&
    typeof metadata.supportingDocDataUrl !== "string"
  ) {
    metadata.supportingDocDataUrl = raw.supporting_document_url;
  }
  if (
    typeof raw.supporting_document_name === "string" &&
    raw.supporting_document_name.trim() &&
    typeof metadata.supportingDocName !== "string"
  ) {
    metadata.supportingDocName = raw.supporting_document_name;
  }
  return {
    id: String(raw.id ?? ""),
    employee_id: String(raw.employee_id ?? ""),
    type: String(raw.type ?? "SICK_LEAVE"),
    start_date: String(raw.start_date ?? ""),
    end_date: String(raw.end_date ?? ""),
    reason: typeof raw.reason === "string" ? raw.reason : "",
    status: normalizeLeaveStatus(String(raw.status ?? "PENDING_HR_STAFF_PROCESSING")),
    created_at:
      typeof raw.created_at === "string" && raw.created_at
        ? raw.created_at
        : new Date().toISOString(),
    approved_by: raw.approved_by == null || raw.approved_by === "" ? null : String(raw.approved_by),
    approved_at: raw.approved_at == null || raw.approved_at === "" ? null : String(raw.approved_at),
    metadata,
  };
}

export function leaveRowToRequest(row: LeaveRequestRow, byId: Map<string, EmployeeRow>): LeaveRequest {
  const meta = parseMetadata(row.metadata);
  const rawMeta = metadataObjectFromRaw(row.metadata);
  const empRow = byId.get(row.employee_id);
  const inferredSubmitterRole = inferRoleFromEmployeeRow(empRow);
  const employeeNumber = empRow
    ? businessEmployeeNumberFromRow(empRow)
    : (meta.employeeNumber?.trim() ?? "");
  // Always use DB employee PK. Mock IDs (emp-4, …) break "My Leave" when auth uses Supabase UUID (row.id).
  const employeeId = row.employee_id;
  const nameFromRow = empRow ? displayNameFromEmployeeRow(empRow, employeeNumber) : "";
  const nameFromMeta = meta.employeeName?.trim() ?? "";
  const employeeName =
    nameFromMeta ||
    nameFromRow ||
    (employeeNumber ? `Employee ${employeeNumber}` : "") ||
    "Unknown employee";

  const approvedBy = row.approved_by ?? undefined;

  const status = row.status as LeaveStatus;
  let startDate = row.start_date;
  let endDate = row.end_date;
  let reason = row.reason;
  if (status === "DRAFT" && rawMeta.draftForm && typeof rawMeta.draftForm === "object" && !Array.isArray(rawMeta.draftForm)) {
    const df = rawMeta.draftForm as Record<string, unknown>;
    if (typeof df.startDate === "string") startDate = df.startDate;
    if (typeof df.endDate === "string") endDate = df.endDate;
    if (typeof df.reason === "string") reason = df.reason;
  }

  return {
    ...meta,
    submitterRole: meta.submitterRole ?? inferredSubmitterRole,
    id: row.id,
    employeeId,
    employeeName,
    employeeNumber,
    type: migrateLeaveType(row.type),
    startDate,
    endDate,
    reason,
    status,
    createdAt: row.created_at,
    approvedBy,
    approvedAt: row.approved_at ?? undefined,
  };
}

export async function leaveRequestToInsert(
  req: LeaveRequest,
  numberToId: Map<string, string>
): Promise<LeaveRequestInsert | null> {
  const requestedEmployeeNumber = (req.employeeNumber ?? "").trim();
  const submitter = getEmployeeById(req.employeeId);
  const mockEmployeeNumber = submitter?.employeeNumber?.trim() ?? "";
  const sourceEmployeeNumber = requestedEmployeeNumber || mockEmployeeNumber;

  let employeeUuid: string | null = null;
  if (isEmployeeUuidString(req.employeeId)) {
    employeeUuid = req.employeeId.trim();
  } else {
    if (!sourceEmployeeNumber) {
      console.warn(
        "[leave] Supabase sync skipped: no employee number on request and no mock fallback for employeeId",
        req.employeeId
      );
      return null;
    }
    employeeUuid =
      employeeCodeCandidateKeys(sourceEmployeeNumber)
        .map((k) => numberToId.get(k))
        .find(Boolean) ?? null;
    if (!employeeUuid) {
      console.warn(
        "[leave] Supabase sync skipped: no employees row for employee_number / employee_code",
        sourceEmployeeNumber,
        "(set employee_code or employee_number in Supabase to match mock, e.g. E001)"
      );
      return null;
    }
  }

  let approvedByUuid: string | null = null;
  if (req.approvedBy) {
    if (isEmployeeUuidString(req.approvedBy)) {
      approvedByUuid = req.approvedBy.trim();
    } else {
      const approver = getEmployeeById(req.approvedBy);
      if (approver) {
        approvedByUuid =
          employeeCodeCandidateKeys(approver.employeeNumber)
            .map((k) => numberToId.get(k))
            .find(Boolean) ?? null;
      }
    }
  }

  const isDraft = req.status === "DRAFT";
  const startTrim = (req.startDate ?? "").trim();
  const endTrim = (req.endDate ?? "").trim();
  const usePlaceholderDates = isDraft && (!startTrim || !endTrim);
  const start_date = usePlaceholderDates ? "2099-01-01" : startTrim;
  const end_date = usePlaceholderDates ? "2099-01-01" : endTrim;

  return {
    id: req.id,
    employee_id: employeeUuid,
    type: req.type,
    start_date,
    end_date,
    reason: req.reason ?? "",
    status: req.status,
    created_at: req.createdAt,
    approved_by: approvedByUuid,
    approved_at: req.approvedAt ?? null,
    metadata: buildMetadata(req),
  };
}

export async function fetchLeaveRequestsFromSupabase(): Promise<{
  data: LeaveRequest[];
  error: Error | null;
}> {
  invalidateLeaveEmployeeCache();
  const { data: rows, error } = await supabase
    .from("leave_requests")
    .select("id,employee_id,type,start_date,end_date,reason,status,created_at,approved_by,approved_at,metadata")
    .order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const rowCount = rows?.length ?? 0;
  if (rowCount === 0) {
    console.warn(
      "[leave] Supabase returned 0 leave_requests rows. If the table has data in the dashboard, RLS is likely blocking the authenticated client. Run 20260408160000_current_employee_id_auth_user_id.sql and ensure leave_requests policies exist, including 20260424200000_leave_requests_department_manager_rls.sql for Department Manager team approvals."
    );
  }

  const byId = await getEmployeeRowsById();
  const rawList = (rows ?? []) as Record<string, unknown>[];
  const data: LeaveRequest[] = [];
  for (const raw of rawList) {
    try {
      const row = coerceLeaveRequestRow(raw);
      if (!row.id || !row.employee_id) {
        console.warn("[leave] Skipping leave_requests row missing id or employee_id:", raw);
        continue;
      }
      data.push(leaveRowToRequest(row, byId));
    } catch (e) {
      console.warn("[leave] Skipping malformed leave_requests row:", e, raw);
    }
  }
  return {
    data,
    error: null,
  };
}

export async function fetchLeaveBalancesFromSupabase(
  year = new Date().getFullYear()
): Promise<{
  data: LeaveBalance[];
  error: Error | null;
}> {
  invalidateLeaveEmployeeCache();
  const { data: rows, error } = await supabase
    .from("leave_balances")
    .select("id,employee_id,type,year,total_days,used_days,pending_days,created_at,updated_at")
    .eq("year", year)
    .order("type", { ascending: true });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const byId = await getEmployeeRowsById();
  const rawList = (rows ?? []) as Record<string, unknown>[];
  const data: LeaveBalance[] = [];
  for (const raw of rawList) {
    try {
      const row = coerceLeaveBalanceRow(raw);
      if (!row.id || !row.employee_id || !row.type) {
        console.warn("[leave] Skipping leave_balances row missing id, employee_id, or type:", raw);
        continue;
      }
      data.push(leaveBalanceRowToBalance(row, byId));
    } catch (e) {
      console.warn("[leave] Skipping malformed leave_balances row:", e, raw);
    }
  }

  return { data, error: null };
}

export async function upsertLeaveBalanceToSupabase(
  balance: LeaveBalance,
  year = new Date().getFullYear()
): Promise<{ error: Error | null }> {
  const employeeUuid = await resolveEmployeeUuidForLeaveBalance(
    balance.employeeId,
    balance.employeeNumber
  );
  if (!employeeUuid) {
    return {
      error: new Error(
        `No Supabase employee row found for leave balance employee ${balance.employeeId} (${balance.employeeNumber || "no employee number"})`
      ),
    };
  }

  const row: LeaveBalanceInsert = {
    employee_id: employeeUuid,
    type: balance.type as LeaveBalanceInsert["type"],
    year,
    total_days: Math.max(0, Math.round(balance.totalDays ?? 0)),
    used_days: Math.max(0, Math.round(balance.usedDays ?? 0)),
    pending_days: Math.max(0, Math.round(balance.pendingDays ?? 0)),
  };

  const { error } = await supabase
    .from("leave_balances")
    .upsert(row, { onConflict: "employee_id,type,year" });

  if (error) {
    console.warn("[leave] leave_balances upsert detail:", error.message, error);
  }

  return { error: error ? new Error(error.message) : null };
}

export async function adjustLeaveBalanceInSupabase({
  employeeId,
  employeeNumber,
  leaveType,
  totalDays,
  pendingDelta,
  usedDelta,
  year = new Date().getFullYear(),
}: {
  employeeId: string;
  employeeNumber?: string;
  leaveType: TimeOffType;
  totalDays: number;
  pendingDelta: number;
  usedDelta: number;
  year?: number;
}): Promise<{ data: LeaveBalance | null; error: Error | null }> {
  const employeeUuid = await resolveEmployeeUuidForLeaveBalance(employeeId, employeeNumber);
  if (!employeeUuid) {
    return {
      data: null,
      error: new Error(
        `No Supabase employee row found for leave balance employee ${employeeId} (${employeeNumber || "no employee number"})`
      ),
    };
  }

  const { data, error } = await (supabase as unknown as SupabaseRpcClient).rpc(
    "adjust_leave_balance",
    {
      p_employee_id: employeeUuid,
      p_type: leaveType,
      p_year: year,
      p_total_days: Math.max(0, Math.round(totalDays ?? 0)),
      p_pending_delta: Math.round(pendingDelta ?? 0),
      p_used_delta: Math.round(usedDelta ?? 0),
    }
  );

  if (error) {
    console.warn("[leave] adjust_leave_balance RPC detail:", error.message, error);
    return { data: null, error: new Error(error.message) };
  }

  try {
    const row = coerceLeaveBalanceRow((data ?? {}) as Record<string, unknown>);
    const byId = await getEmployeeRowsById();
    return { data: leaveBalanceRowToBalance(row, byId), error: null };
  } catch (e) {
    console.warn("[leave] adjust_leave_balance RPC returned malformed row:", e, data);
    return { data: null, error: new Error("Malformed leave balance response") };
  }
}

export async function seedMissingLeaveBalancesToSupabase({
  year = new Date().getFullYear(),
  defaultTotalDays,
  employeeId,
}: {
  year?: number;
  defaultTotalDays: number;
  employeeId?: string;
}): Promise<{ error: Error | null; attempted: number }> {
  invalidateLeaveEmployeeCache();
  const byId = await getEmployeeRowsById();
  const employees = Array.from(byId.values()).filter((employee) => {
    if (!employeeId) return true;
    return employee.id === employeeId;
  });

  if (employees.length === 0) {
    return { error: null, attempted: 0 };
  }

  const inserts: LeaveBalanceInsert[] = [];
  for (const employee of employees) {
    for (const type of Object.keys(leaveTypeMetadata) as TimeOffType[]) {
      inserts.push({
        employee_id: employee.id,
        type: type as LeaveBalanceInsert["type"],
        year,
        total_days: type === "UNPAID_LEAVE" ? 0 : Math.max(0, Math.round(defaultTotalDays)),
        used_days: 0,
        pending_days: 0,
      });
    }
  }

  if (inserts.length === 0) {
    return { error: null, attempted: 0 };
  }

  const { error } = await supabase
    .from("leave_balances")
    .upsert(inserts, {
      onConflict: "employee_id,type,year",
      ignoreDuplicates: true,
    });

  if (error) {
    console.warn("[leave] leave_balances seed detail:", error.message, error);
  }

  return { error: error ? new Error(error.message) : null, attempted: inserts.length };
}

export async function pushLeaveRequestsToSupabase(requests: LeaveRequest[]): Promise<{
  error: Error | null;
  skipped: number;
}> {
  invalidateLeaveEmployeeCache();
  const numberToId = await getEmployeeNumberToIdMap();
  if (numberToId.size === 0) {
    // Don't hard-fail here: requests may already carry a valid Supabase employee UUID,
    // which can be inserted without employee_number/employee_code mapping.
    console.warn(
      "[leave] employees mapping is empty; attempting UUID-based leave_requests upsert fallback."
    );
  }

  const inserts: LeaveRequestInsert[] = [];
  let skipped = 0;
  for (const r of requests) {
    const row = await leaveRequestToInsert(r, numberToId);
    if (row) inserts.push(row);
    else skipped += 1;
  }

  if (inserts.length === 0) {
    return { error: skipped > 0 ? new Error("All leave requests were skipped (employee mapping failed).") : null, skipped };
  }

  const { error } = await supabase.from("leave_requests").upsert(inserts, { onConflict: "id" });
  if (error) {
    console.warn("[leave] Supabase upsert detail:", error.message, error);
  }
  return { error: error ? new Error(error.message) : null, skipped };
}
