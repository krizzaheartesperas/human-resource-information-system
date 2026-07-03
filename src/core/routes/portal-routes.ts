import type { Role } from "@/lib/mock";
import { normalizeSystemCode } from "@/lib/auth/sessionAccess";

/** Unified dashboard route group id (all roles share one route tree). */
export type PortalId = "dashboard";

export function roleToPortalId(role: Role): PortalId {
  void role;
  return "dashboard";
}

function j(root: string, path: string): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `${root}/${p}`.replace(/\/{2,}/g, "/");
}

export type PortalPaths = {
  root: string;
  dashboard: string;
  /** Employee timeclock & timecards (My Time module). */
  myTime: string;
  /** HR staff team attendance management landing. */
  teamTime: string;
  attendance: string;
  /** Leave module URL (HR Staff uses `leave-management`). */
  leave: string;
  /** Canonical Account / profile settings URL (all roles). */
  account: string;
  /** Legacy profile URL; same app surface as `account`. */
  profile: string;
  requests: string;
  payroll: string;
  payrollPayslips: string;
  organization: string;
  departments: string;
  employees: string;
  employeesNew: string;
  /** Alias for employee “My payslips” — canonical route is `/payroll` with query. */
  payslips: string;
  notifications: string;
  settings: string;
  userManagement: string;
  help: string;
  handbook: string;
  audit: string;
  discipline: string;
  reportsAttendance: string;
  reportsWorkflow: string;
  reportsWorkforce: string;
  workforceOverview: string;
  complaints: string;
  complaintDetail: (id: string) => string;
  complaintManagerApproval: (id: string) => string;
  complaintManagerEscalated: (id: string) => string;
  offboarding: string;
  offboardingMy: string;
  offboardingTasks: string;
  offboardingAdmin: string;
  offboardingIt: string;
  offboardingApprovals: string;
  offboardingAudit: string;
  offboardingAnalytics: string;
};

type PortalDef = { root: string; leaveSegment: string };

const REGISTRY: Record<PortalId, PortalDef> = {
  dashboard: { root: "", leaveSegment: "leave" },
};

function buildPaths({ root, leaveSegment }: PortalDef): PortalPaths {
  const complaintsBase = j(root, "complaints");
  const payrollBase = j(root, "payroll");
  return {
    root,
    dashboard: j(root, "dashboard"),
    myTime: j(root, "my-time"),
    teamTime: j(root, "attendance"),
    attendance: j(root, "attendance"),
    leave: j(root, leaveSegment),
    account: j(root, "account"),
    profile: j(root, "profile"),
    requests: j(root, "requests"),
    payroll: payrollBase,
    payrollPayslips: j(root, "payroll/payslips"),
    organization: j(root, "organization"),
    departments: j(root, "departments"),
    employees: j(root, "employees"),
    employeesNew: j(root, "employees/new"),
    payslips: `${payrollBase}?tab=overview&mode=my-payslips`,
    notifications: j(root, "notifications"),
    settings: j(root, "settings"),
    userManagement: j(root, "user-management"),
    help: j(root, "help"),
    handbook: j(root, "handbook"),
    audit: j(root, "audit"),
    discipline: j(root, "discipline"),
    reportsAttendance: j(root, "reports/attendance"),
    reportsWorkflow: j(root, "reports/workflow"),
    reportsWorkforce: j(root, "reports/workforce"),
    workforceOverview: j(root, "workforce-overview"),
    complaints: complaintsBase,
    complaintDetail: (id) => j(root, `complaints/${id}`),
    complaintManagerApproval: (id) =>
      `${j(root, `complaints/${id}`)}?context=manager-approval`,
    complaintManagerEscalated: (id) =>
      `${j(root, `complaints/${id}`)}?context=manager-escalated`,
    offboarding: j(root, "offboarding"),
    offboardingMy: j(root, "offboarding/my"),
    offboardingTasks: j(root, "offboarding/tasks"),
    offboardingAdmin: j(root, "offboarding/admin"),
    offboardingIt: j(root, "offboarding/it"),
    offboardingApprovals: j(root, "offboarding/approvals"),
    offboardingAudit: j(root, "offboarding/audit"),
    offboardingAnalytics: j(root, "offboarding/analytics"),
  };
}

/** Bump when `PortalPaths` shape changes so long-lived dev servers refresh cached URLs. */
const PORTAL_PATHS_VERSION = 7;
const CACHE: Partial<Record<PortalId, { v: number; paths: PortalPaths }>> = {};

/** Stable account URL (same as `buildPaths` with empty root). Used if cached maps are stale. */
export const FALLBACK_ACCOUNT_HREF = "/account";

export function getPortalPathsForId(id: PortalId): PortalPaths {
  const hit = CACHE[id];
  const pathsStale =
    !hit ||
    hit.v !== PORTAL_PATHS_VERSION ||
    typeof hit.paths.account !== "string" ||
    typeof hit.paths.profile !== "string";
  if (pathsStale) {
    CACHE[id] = { v: PORTAL_PATHS_VERSION, paths: buildPaths(REGISTRY[id]) };
  }
  return CACHE[id]!.paths;
}

export function getPortalPaths(role: Role): PortalPaths {
  return getPortalPathsForId(roleToPortalId(role));
}

/** Deep link after login (same behaviour as legacy `auth-routing`, new URLs). */
export function getHomePathForRole(role: Role): string {
  const p = getPortalPaths(role);
  return p.dashboard;
}

export function getHomePathForSystemRole(role: Role, systemCode?: string | null): string {
  const normalized = normalizeSystemCode(systemCode ?? "hris");
  if (normalized === "hris" || !normalized) {
    return getHomePathForRole(role);
  }
  return `/dashboard?system=${encodeURIComponent(normalized)}`;
}

export {
  pathMatchesLeave,
  matchesComplaintsHref,
} from "./portal-route-match";

/** Complaints list or detail under the single `/complaints` tree (no role path segments). */
export function pathMatchesComplaintsList(pathname: string, complaintsPath: string): boolean {
  return pathname === complaintsPath || pathname.startsWith(`${complaintsPath}/`);
}
