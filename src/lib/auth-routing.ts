/**
 * Role-based routing (demo auth + Supabase).
 * Canonical paths live in `@/core/routes/portal-routes`.
 */
import { demoUsersByRole, type CurrentUser, type Role } from "@/lib/mock";

export {
  getHomePathForRole,
  getHomePathForSystemRole,
  getPortalPaths,
  getPortalPathsForId,
  roleToPortalId,
  pathMatchesLeave,
} from "@/core/routes/portal-routes";

/** @deprecated Use `getHomePathForRole` from `@/core/routes/portal-routes` */
export const EMPLOYEE_HOME = "/dashboard";

const ROLE_HOME_PATHS: Record<Role, string> = {
  SUPER_ADMIN: "/settings",
  HR_ADMIN: "/leave?tab=hr-final",
  HR_MANAGER: "/leave?tab=hm-high",
  HR_STAFF: "/leave?tab=staff-all",
  DEPARTMENT_MANAGER: "/leave?tab=dm-pending",
  MANAGER: "/leave?tab=dm-pending",
  EMPLOYEE: "/dashboard",
  AUDITOR: "/audit",
  EXECUTIVE: "/complaints?scope=executive",
  BOARD: "/organization",
};

/** Legacy table kept for reference; prefer `getHomePathForRole` from portal-routes. */
export function getLegacyHomePathForRole(role: Role): string {
  return ROLE_HOME_PATHS[role] ?? EMPLOYEE_HOME;
}

export function resolveDemoUserByEmail(email: string): CurrentUser | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const roles = Object.keys(demoUsersByRole) as Role[];
  for (const role of roles) {
    const u = demoUsersByRole[role];
    if (u.email.toLowerCase() === normalized) {
      return { ...u };
    }
  }
  return null;
}
