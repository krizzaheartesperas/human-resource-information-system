/**
 * Supabase Auth + public.employees hydration for the HRIS UI.
 * Expects `employees.user_id` (or legacy `auth_user_id`) = auth.users.id.
 */
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { EmployeeRow, ProfileRow } from "@/lib/supabase/client";
import {
  getDemoNameForEmail,
  type CurrentUser,
  type EmploymentType,
  type Role,
} from "@/lib/mock";
import {
  normalizeSystemCode,
  pickSystemAccess,
  roleFromSystemRoleCode,
  type SystemAccess,
} from "@/lib/auth/sessionAccess";
import { formatPersonName } from "@/lib/utils";

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.length &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
  );
}

function isLegacyFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_LEGACY_FALLBACK === "true";
}

const ROLE_VALUES = new Set<string>([
  "SUPER_ADMIN",
  "HR_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "DEPARTMENT_MANAGER",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
  "EXECUTIVE",
  "BOARD",
]);

function normalizeRoleToken(raw: string | null | undefined): Role | null {
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase().replace(/\s+/g, "_");
  if (ROLE_VALUES.has(s)) return s as Role;
  // Common DB variants
  if (s === "HR_ADMINISTRATOR" || s === "HRADMIN") return "HR_ADMIN";
  if (s === "DEPT_MANAGER" || s === "DEPARTMENTMANAGER") return "DEPARTMENT_MANAGER";
  if (s === "HR_OFFICER" || s === "HRSTAFF") return "HR_STAFF";
  if (s === "AUDIT_OFFICER" || s === "AUDITOR_OFFICER" || s === "COMPLIANCE_OFFICER") return "AUDITOR";
  return null;
}

/**
 * Map `position` (and legacy `job_title`) to app Role when `employees.role` is empty.
 */
function mapPositionToRole(position: string | null | undefined): Role {
  const p = (position ?? "").toLowerCase().trim();
  if (!p) return "EMPLOYEE";

  const rules: { test: (s: string) => boolean; role: Role }[] = [
    { test: (s) => s.includes("super admin") || s === "super_admin", role: "SUPER_ADMIN" },
    { test: (s) => s.includes("system admin") || s.includes("system administrator"), role: "SUPER_ADMIN" },
    { test: (s) => s.includes("hr admin") || s.includes("hr administrator"), role: "HR_ADMIN" },
    { test: (s) => s.includes("hr manager") && !s.includes("department"), role: "HR_MANAGER" },
    { test: (s) => s.includes("hr staff") || s.includes("hr officer"), role: "HR_STAFF" },
    { test: (s) => s.includes("audit") || s.includes("compliance officer"), role: "AUDITOR" },
    { test: (s) => s.includes("chief executive") || s.includes("ceo") || s === "executive", role: "EXECUTIVE" },
    { test: (s) => s.includes("board"), role: "BOARD" },
    {
      test: (s) =>
        s.includes("engineering manager") ||
        s.includes("department manager") ||
        s.includes("dept manager"),
      role: "DEPARTMENT_MANAGER",
    },
    { test: (s) => s.includes("manager") && !s.includes("hr"), role: "MANAGER" },
  ];

  for (const { test, role } of rules) {
    if (test(p)) return role;
  }
  return "EMPLOYEE";
}

function mapPortalRoleToRole(portalRole: string | null | undefined): Role | null {
  const p = String(portalRole ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!p) return null;
  if (p === "hr_admin" || p === "hradmin" || p === "hr-admin") return "HR_ADMIN";
  if (p === "hr_manager" || p === "hrmanager") return "HR_MANAGER";
  if (p === "hr" || p === "hr_staff" || p === "hrstaff") return "HR_STAFF";
  if (p === "auditor" || p === "audit" || p === "audit_officer") return "AUDITOR";
  if (p === "executive" || p === "management") return "EXECUTIVE";
  if (p === "system_admin" || p === "super_admin") return "SUPER_ADMIN";
  if (p === "department_manager" || p === "dept_manager") return "DEPARTMENT_MANAGER";
  if (p === "manager") return "MANAGER";
  if (p === "interviewer" || p === "employee" || p === "staff") return "EMPLOYEE";
  return null;
}

function resolveAppRole(row: EmployeeRow): Role {
  const fromPosition = mapPositionToRole(row.position ?? row.job_title);
  const fromPortalRole = mapPortalRoleToRole(row.portal_role ?? null);
  // Prefer title/position when it encodes a real workflow role.
  if (fromPosition !== "EMPLOYEE") {
    return fromPosition;
  }
  if (fromPortalRole) return fromPortalRole;
  const fromColumn = normalizeRoleToken(row.role ?? null);
  if (fromColumn) return fromColumn;
  return "EMPLOYEE";
}

/** Turn email local parts like `glen.ramos1212` or `mary_jane` into separate words before title-casing. */
function displayNameFromEmailLocal(local: string): string {
  const base = (local.split("+")[0] ?? local).trim();
  if (!base) return "User";
  const segments = base.split(/[._-]+/).filter(Boolean);
  const words = segments
    .map((s) => s.replace(/\d+$/g, "").trim())
    .filter((s) => s.length > 0);
  if (words.length >= 2) {
    return words.join(" ");
  }
  const camelSplit = base.replace(/([a-z])([A-Z])/g, "$1 $2");
  if (camelSplit.includes(" ")) {
    return camelSplit;
  }
  return base;
}

function displayName(row: EmployeeRow, authUser: SupabaseAuthUser): string {
  const fn = (row.first_name ?? "").trim();
  const ln = (row.last_name ?? "").trim();
  const combined = `${fn} ${ln}`.trim();
  if (combined) return formatPersonName(combined);

  const fromFull = (row.full_name ?? "").trim();
  if (fromFull) return formatPersonName(fromFull);
  const fromNameCol = (row.name ?? "").trim();
  if (fromNameCol) return formatPersonName(fromNameCol);

  const meta = authUser.user_metadata as Record<string, unknown> | undefined;
  const mfn = typeof meta?.first_name === "string" ? meta.first_name.trim() : "";
  const mln = typeof meta?.last_name === "string" ? meta.last_name.trim() : "";
  const metaCombined = `${mfn} ${mln}`.trim();
  if (metaCombined) return formatPersonName(metaCombined);

  const full =
    (typeof meta?.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta?.name === "string" && meta.name.trim());
  if (full) return formatPersonName(full);

  const email = (row.email ?? authUser.email ?? "").trim();
  const demoHint = email ? getDemoNameForEmail(email) : null;
  if (demoHint) return formatPersonName(demoHint);

  if (email) {
    const localPart = email.split("@")[0] ?? email;
    return formatPersonName(displayNameFromEmailLocal(localPart));
  }
  return "User";
}

function mapEmploymentType(raw: string | null | undefined): EmploymentType {
  const u = (raw ?? "").toUpperCase().replace(/\s+/g, "_");
  if (u === "FULL_TIME" || u === "FULLTIME") return "FULL_TIME";
  if (u === "PART_TIME" || u === "PARTTIME") return "PART_TIME";
  if (u === "CONTRACT") return "CONTRACT";
  if (u === "INTERNSHIP") return "INTERNSHIP";
  if (u === "PROBATION") return "PROBATION";
  return "FULL_TIME";
}

function normalizeToken(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function parseFirstLastFromName(fullName: string): { first: string; last: string } {
  const cleaned = fullName.trim();
  if (!cleaned) return { first: "", last: "" };
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] ?? "", last: "" };
  return { first: parts[0] ?? "", last: parts[parts.length - 1] ?? "" };
}

export async function fetchProfileForAuthUser(
  authUser: SupabaseAuthUser,
  row: EmployeeRow
): Promise<{ data: ProfileRow | null; error: string | null }> {
  const { data: profileByAuthUid, error: profileByUidErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (profileByUidErr) {
    return { data: null, error: profileByUidErr.message };
  }
  if (profileByAuthUid) {
    return { data: profileByAuthUid as ProfileRow, error: null };
  }

  const employeeFirst = (row.first_name ?? "").trim();
  const employeeLast = (row.last_name ?? "").trim();
  if (employeeFirst && employeeLast) {
    const { data: byExactName, error: byExactNameErr } = await supabase
      .from("profiles")
      .select("*")
      .ilike("first_name", employeeFirst)
      .ilike("last_name", employeeLast)
      .limit(1);
    if (byExactNameErr) {
      return { data: null, error: byExactNameErr.message };
    }
    if ((byExactName?.length ?? 0) > 0) {
      return { data: (byExactName?.[0] as ProfileRow) ?? null, error: null };
    }
  }

  const inferred = parseFirstLastFromName(displayName(row, authUser));
  if (inferred.first && inferred.last) {
    const { data: byInferredName, error: byInferredNameErr } = await supabase
      .from("profiles")
      .select("*")
      .ilike("first_name", inferred.first)
      .ilike("last_name", inferred.last)
      .limit(1);
    if (byInferredNameErr) {
      return { data: null, error: byInferredNameErr.message };
    }
    if ((byInferredName?.length ?? 0) > 0) {
      return { data: (byInferredName?.[0] as ProfileRow) ?? null, error: null };
    }
  }

  // Fetch then match in JS to avoid bigint/uuid filter mismatches across schemas.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .limit(5000);
  if (error) {
    return { data: null, error: error.message };
  }
  const profiles = (data as ProfileRow[] | null) ?? [];
  if (profiles.length === 0) {
    return { data: null, error: null };
  }

  const idCandidates = new Set<string>([
    normalizeToken(authUser.id),
    normalizeToken(row.user_id),
    normalizeToken(row.auth_user_id),
    normalizeToken(row.id),
  ]);
  idCandidates.delete("");

  for (const p of profiles) {
    const pid = normalizeToken(p.id);
    const pUserId = normalizeToken(p.user_id);
    if ((pid && idCandidates.has(pid)) || (pUserId && idCandidates.has(pUserId))) {
      return { data: p, error: null };
    }
  }

  const employeeFirstToken = normalizeToken(row.first_name);
  const employeeLastToken = normalizeToken(row.last_name);
  if (employeeFirstToken && employeeLastToken) {
    const byNames = profiles.find(
      (p) =>
        normalizeToken(p.first_name) === employeeFirstToken &&
        normalizeToken(p.last_name) === employeeLastToken
    );
    if (byNames) return { data: byNames, error: null };
  }

  const inferredFirst = normalizeToken(inferred.first);
  const inferredLast = normalizeToken(inferred.last);
  if (inferredFirst && inferredLast) {
    const byInferredName = profiles.find(
      (p) =>
        normalizeToken(p.first_name) === inferredFirst &&
        normalizeToken(p.last_name) === inferredLast
    );
    if (byInferredName) return { data: byInferredName, error: null };
  }

  return { data: null, error: null };
}

function avatarUrl(name: string, email: string): string {
  const q = encodeURIComponent(name || email || "User");
  return `https://ui-avatars.com/api/?name=${q}&size=256&background=6366f1&color=fff`;
}

function isMissingEmployeesColumnError(message: string, column: string): boolean {
  const m = message.toLowerCase();
  const c = column.toLowerCase();
  return (
    m.includes("employees") &&
    m.includes(c) &&
    (m.includes("does not exist") || m.includes("schema cache"))
  );
}

/**
 * Load the employee row for the signed-in auth user.
 * Order: `user_id`, legacy `auth_user_id`, then `email` if the table has that column.
 */
export async function fetchEmployeeForAuthUser(
  authUserId: string,
  authEmail?: string | null
): Promise<{ data: EmployeeRow | null; error: string | null }> {
  const { data: byUserId, error: err1 } = await supabase
    .from("employees")
    .select("*")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (err1) {
    return { data: null, error: err1.message };
  }
  if (byUserId) {
    return { data: byUserId as EmployeeRow, error: null };
  }

  const { data: byAuthUserId, error: err2 } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (err2) {
    const msg = (err2.message ?? "").toLowerCase();
    if (
      msg.includes("auth_user_id") &&
      (msg.includes("does not exist") || msg.includes("schema cache"))
    ) {
      // Fall through — try email when schema has no auth_user_id.
    } else {
      return { data: null, error: err2.message };
    }
  } else if (byAuthUserId) {
    return { data: byAuthUserId as EmployeeRow, error: null };
  }

  const email = (authEmail ?? "").trim();
  if (!email) {
    return { data: null, error: null };
  }

  for (const em of Array.from(new Set([email, email.toLowerCase()]))) {
    const { data: byEmail, error: err3 } = await supabase
      .from("employees")
      .select("*")
      .eq("email", em)
      .maybeSingle();
    if (err3) {
      if (isMissingEmployeesColumnError(err3.message, "email")) {
        return { data: null, error: null };
      }
      continue;
    }
    if (byEmail) {
      return { data: byEmail as EmployeeRow, error: null };
    }
  }

  return { data: null, error: null };
}

export function employeeRowToCurrentUser(
  row: EmployeeRow,
  authUser: SupabaseAuthUser,
  profile?: ProfileRow | null,
  selectedAccess?: SystemAccess | null,
  accessibleSystems?: SystemAccess[]
): CurrentUser {
  const role = selectedAccess
    ? roleFromSystemRoleCode(selectedAccess.roleCode, selectedAccess.roleName)
    : resolveAppRole(row);
  const profileName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();
  const name = profileName ? formatPersonName(profileName) : displayName(row, authUser);
  const email = (row.email ?? authUser.email ?? "").trim() || "user@unknown.local";
  const employeeNumber =
    (row.employee_code ?? row.employee_number ?? "").trim() || row.id.slice(0, 8).toUpperCase();
  const jobTitle = (row.position ?? row.job_title ?? "").trim() || role.replace(/_/g, " ");
  const profileAddress = (profile?.current_address ?? profile?.currentAddress ?? "").trim();
  const profileBirthday = (profile?.birthday ?? "").trim();

  const prefRaw = (row.payout_preference ?? "").trim().toLowerCase();
  const payoutPreference: "maya" | "bank" | null =
    prefRaw === "bank" ? "bank" : prefRaw === "maya" || prefRaw === "paymaya" ? "maya" : null;

  return {
    id: `auth-${authUser.id}`,
    employeeId: row.id,
    name,
    role,
    profilePhoto: (row.profile_photo ?? "").trim() || avatarUrl(name, email),
    email,
    employeeNumber,
    jobTitle,
    departmentId: row.department_id,
    managerId: row.manager_id ?? null,
    startDate: (row.start_date ?? "").trim() || new Date().toISOString().slice(0, 10),
    employmentType: mapEmploymentType(row.employment_type),
    birthday: profileBirthday || (row.birthday ?? "").trim() || "1990-01-01",
    currentAddress: profileAddress || (row.current_address ?? "").trim() || "—",
    personalPhone: (profile?.phone ?? row.personal_phone ?? "").trim() || "—",
    lastLoginAt: new Date().toISOString(),
    payoutCardHolderName: (row.card_holder_name ?? "").trim() || null,
    payoutCardNumberMasked: (row.card_number ?? "").trim() || null,
    payoutPreference,
    selectedAccessId: selectedAccess?.id,
    selectedSystemCode: selectedAccess?.systemCode,
    selectedSystemName: selectedAccess?.systemName,
    selectedSystemRoleCode: selectedAccess?.roleCode,
    selectedSystemRoleName: selectedAccess?.roleName,
    accessibleSystems,
  };
}

/**
 * When RLS hides `employees` from the anon client, the Next.js API uses the service role
 * after verifying the access token — only for rows with user_id = JWT sub.
 */
async function tryHydrateCurrentUserFromServer(
  authUser: SupabaseAuthUser,
  accessToken: string,
  selectedAccessId?: string | null,
  selectedSystemCode?: string | null
): Promise<{ user: CurrentUser | null; systems: SystemAccess[] }> {
  try {
    const params = new URLSearchParams();
    if (selectedAccessId) params.set("accessId", selectedAccessId);
    if (selectedSystemCode) params.set("system", normalizeSystemCode(selectedSystemCode));
    const qs = params.toString();
    const query = qs ? `?${qs}` : "";
    const res = await fetch(`/api/auth/session-user${query}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json()) as {
      error?: string;
      employee?: EmployeeRow | null;
      profile?: ProfileRow | null;
      accessibleSystems?: SystemAccess[];
      defaultSystem?: SystemAccess | null;
    };
    if (res.status === 503 || !res.ok) {
      return { user: null, systems: [] };
    }
    if (!body.employee) {
      return { user: null, systems: [] };
    }
    const systems = body.accessibleSystems ?? [];
    const preferred = pickSystemAccess(systems, selectedAccessId, selectedSystemCode);
    const selected = preferred ?? body.defaultSystem ?? null;
    if (!selected && systems.length > 0) {
      return { user: null, systems };
    }
    return {
      user: employeeRowToCurrentUser(
        body.employee,
        authUser,
        body.profile ?? null,
        selected,
        systems
      ),
      systems,
    };
  } catch {
    return { user: null, systems: [] };
  }
}

export type BuildCurrentUserOptions = {
  accessToken?: string | null;
  selectedAccessId?: string | null;
  selectedSystemCode?: string | null;
};

type BuildCurrentUserResult = { data: CurrentUser | null; error: string | null };

const HYDRATION_CACHE_TTL_MS = 60_000;
const hydrationCache = new Map<
  string,
  { expiresAt: number; promise: Promise<BuildCurrentUserResult> }
>();

function hydrationCacheKey(
  authUser: SupabaseAuthUser,
  options: BuildCurrentUserOptions
): string {
  return [
    authUser.id,
    options.selectedAccessId ?? "",
    normalizeSystemCode(options.selectedSystemCode ?? ""),
  ].join("|");
}

export function clearCurrentUserHydrationCache(): void {
  hydrationCache.clear();
}

async function buildCurrentUserForAuthSessionUncached(
  authUser: SupabaseAuthUser,
  options: BuildCurrentUserOptions = {}
): Promise<BuildCurrentUserResult> {
  // Mock fallback route
  if (!isSupabaseAuthConfigured() || !authUser.email) {
    return { data: authUser as unknown as CurrentUser, error: null };
  }

  if (options?.accessToken) {
    const fromServer = await tryHydrateCurrentUserFromServer(
      authUser,
      options.accessToken,
      options.selectedAccessId,
      options.selectedSystemCode
    );
    if (fromServer.systems.length === 0 && !isLegacyFallbackEnabled()) {
      return {
        data: null,
        error:
          "No active system access found. Ask your administrator to add an active user_system_access row.",
      };
    }
    if (fromServer.user) {
      return { data: fromServer.user, error: null };
    }
  }

  const { data: emp, error: empErr } = await fetchEmployeeForAuthUser(
    authUser.id,
    authUser.email
  );
  if (empErr) {
    return { data: null, error: empErr };
  }

  if (!emp && options?.accessToken) {
    const fromServer = await tryHydrateCurrentUserFromServer(
      authUser,
      options.accessToken,
      options.selectedAccessId,
      options.selectedSystemCode
    );
    if (fromServer.systems.length === 0 && !isLegacyFallbackEnabled()) {
      return {
        data: null,
        error:
          "No active system access found. Ask your administrator to add an active user_system_access row.",
      };
    }
    if (fromServer.user) {
      return { data: fromServer.user, error: null };
    }
  }

  if (!emp) {
    const uid = authUser.id;
    const needServiceRole =
      " If login still fails with correct data, add SUPABASE_SERVICE_ROLE_KEY to .env.local (server only) so the app can load your row when RLS blocks the browser.";
    return {
      data: null,
      error:
        `No employee row for user_id=${uid}. In Supabase → Table Editor → employees, set user_id to that value (not only profiles). If it is already set, fix employees RLS (e.g. migration 20260407120000) or use the service role on the server.${needServiceRole}`,
    };
  }

  const { data: profile, error: profileErr } = await fetchProfileForAuthUser(authUser, emp);
  if (profileErr) {
    return { data: null, error: `Could not load profile row: ${profileErr}` };
  }

  const localSystemAccesses: SystemAccess[] = [];
  if (options?.accessToken) {
    const fromServer = await tryHydrateCurrentUserFromServer(
      authUser,
      options.accessToken,
      options.selectedAccessId,
      options.selectedSystemCode
    );
    if (fromServer.systems.length === 0 && !isLegacyFallbackEnabled()) {
      return {
        data: null,
        error:
          "No active system access found. Ask your administrator to add an active user_system_access row.",
      };
    }
    const selectedAccess = pickSystemAccess(
      fromServer.systems,
      options.selectedAccessId,
      options.selectedSystemCode
    );
    if (selectedAccess) {
      return {
        data: employeeRowToCurrentUser(
          emp,
          authUser,
          profile,
          selectedAccess,
          fromServer.systems
        ),
        error: null,
      };
    }
  }

  return {
    data: employeeRowToCurrentUser(emp, authUser, profile, null, localSystemAccesses),
    error: null,
  };
}

export async function buildCurrentUserForAuthSession(
  authUser: SupabaseAuthUser,
  options: BuildCurrentUserOptions = {}
): Promise<BuildCurrentUserResult> {
  if (typeof window === "undefined") {
    return buildCurrentUserForAuthSessionUncached(authUser, options);
  }

  const now = Date.now();
  const key = hydrationCacheKey(authUser, options);
  const cached = hydrationCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = buildCurrentUserForAuthSessionUncached(authUser, options).catch(
    (error: unknown) => {
      hydrationCache.delete(key);
      throw error;
    }
  );
  hydrationCache.set(key, { expiresAt: now + HYDRATION_CACHE_TTL_MS, promise });
  return promise;
}

export async function signOutSupabase(): Promise<void> {
  clearCurrentUserHydrationCache();
  await supabase.auth.signOut();
}
