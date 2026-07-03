import type { Role } from "@/lib/mock";
import { normalizeSystemCode } from "@/lib/auth/sessionAccess";
import { getPortalPathsForId } from "@/core/routes/portal-routes";

/** Roles allowed to open HR payroll configuration surfaces (demo). */
export const PAYROLL_CONFIG_ROLES: Role[] = [
  "HR_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
];

export function canAccessPayrollConfig(role: Role): boolean {
  return PAYROLL_CONFIG_ROLES.includes(role);
}

/** Roles allowed to open the "My Time" module (timeclock, timecards, OT). */
export const MY_TIME_ROLES: Role[] = [
  "EMPLOYEE",
];

/** Roles allowed to open the "Team Time" module (team attendance management). */
export const TEAM_TIME_ROLES: Role[] = [
  "HR_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "DEPARTMENT_MANAGER",
  "MANAGER",
  "AUDITOR",
  "EXECUTIVE",
  "SUPER_ADMIN",
];

export function canAccessMyTime(role: Role): boolean {
  return MY_TIME_ROLES.includes(role);
}

export function canAccessTeamTime(role: Role): boolean {
  return TEAM_TIME_ROLES.includes(role);
}

/**
 * Route allowlist for IT/System Admin ("SUPER_ADMIN") to enforce least-privilege.
 * Other roles keep the current behaviour (no route-level restriction yet).
 */
export function canAccessAppPath(role: Role, pathname: string): boolean {
  if (role !== "SUPER_ADMIN") return true;
  const p = getPortalPathsForId("dashboard");
  const allowed = [
    p.dashboard,
    p.myTime,
    p.account,
    p.profile,
    p.notifications,
    p.settings,
    p.userManagement,
    p.help,
    p.handbook,
    p.audit,
    p.offboardingIt,
    p.offboardingMy,
  ];
  return allowed.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

export function canAccessSystem(
  user: {
    selectedSystemCode?: string;
    accessibleSystems?: Array<{ systemCode: string; status: string }>;
  },
  systemCode: string
): boolean {
  const normalized = normalizeSystemCode(systemCode);
  if (normalizeSystemCode(user.selectedSystemCode ?? "") === normalized) return true;
  return (user.accessibleSystems ?? []).some(
    (entry) =>
      normalizeSystemCode(entry.systemCode) === normalized &&
      String(entry.status).toLowerCase() === "active"
  );
}
