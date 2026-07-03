import type { Role } from "@/lib/mock";

export type PortalSystemCode =
  | "hris"
  | "recruitment"
  | "payroll"
  | "project_management"
  | string;

export type SystemAccess = {
  id: string;
  userId: string;
  systemId: string;
  systemCode: PortalSystemCode;
  systemName: string;
  roleCode: string;
  roleName: string;
  status: string;
  systemRoleId?: number | null;
};

const roleMap: Record<string, Role> = {
  executive: "EXECUTIVE",
  hr_manager: "HR_MANAGER",
  hr_admin: "HR_ADMIN",
  hr_administrator: "HR_ADMIN",
  hr_staff: "HR_STAFF",
  recruiter: "HR_STAFF",
  recruiter_hris: "HR_STAFF",
  recruiter_pm: "HR_STAFF",
  interviewer: "EMPLOYEE",
  employee: "EMPLOYEE",
  regular_employee: "EMPLOYEE",
  department_manager: "DEPARTMENT_MANAGER",
  manager: "MANAGER",
  it_manager: "MANAGER",
  engineering_manager: "DEPARTMENT_MANAGER",
  audit_officer: "AUDITOR",
  auditor: "AUDITOR",
  auditor_compliance: "AUDITOR",
  system_admin: "SUPER_ADMIN",
  super_admin: "SUPER_ADMIN",
  board: "BOARD",
};

export function normalizeSystemCode(input: string | null | undefined): PortalSystemCode {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export function roleFromSystemRoleCode(
  roleCode: string | null | undefined,
  roleName?: string | null
): Role {
  const normalizedCode = String(roleCode ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalizedCode && roleMap[normalizedCode]) {
    return roleMap[normalizedCode];
  }
  const normalizedName = String(roleName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (normalizedName && roleMap[normalizedName]) {
    return roleMap[normalizedName];
  }
  return "EMPLOYEE";
}

export function pickDefaultSystemAccess(
  accesses: SystemAccess[],
  preferredSystemCode?: string | null
): SystemAccess | null {
  if (accesses.length === 0) return null;
  const preferred = normalizeSystemCode(preferredSystemCode ?? "");
  if (preferred) {
    const match = accesses.find((a) => normalizeSystemCode(a.systemCode) === preferred);
    if (match) return match;
  }
  const hris = accesses.find((a) => normalizeSystemCode(a.systemCode) === "hris");
  return hris ?? accesses[0] ?? null;
}

export function pickSystemAccess(
  accesses: SystemAccess[],
  preferredAccessId?: string | null,
  preferredSystemCode?: string | null
): SystemAccess | null {
  if (accesses.length === 0) return null;

  const accessId = String(preferredAccessId ?? "").trim();
  if (accessId) {
    const byId = accesses.find((access) => String(access.id) === accessId);
    if (byId) return byId;
  }

  return pickDefaultSystemAccess(accesses, preferredSystemCode);
}
