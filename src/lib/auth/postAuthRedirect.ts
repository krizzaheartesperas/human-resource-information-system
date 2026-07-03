import type { CurrentUser } from "@/lib/mock";
import { getHomePathForSystemRole } from "@/core/routes/portal-routes";
import { safeNextPath } from "@/lib/auth/safeNextPath";
import { resolveExternalSystemRedirect } from "@/lib/auth/systemRedirect";
import { normalizeSystemCode, pickSystemAccess } from "@/lib/auth/sessionAccess";

export type PostAuthRedirectInput = {
  user: CurrentUser;
  nextParam?: string | null;
  /** Legacy: `from=main-portal` / `selectSystem=1` — remove after LEGACY_MAIN_PORTAL_QUERY_REMOVAL_DATE */
  forceSelector?: boolean;
};

/**
 * After login or SSO, choose destination: optional system selector if multiple systems exist,
 * otherwise proceed directly to the assigned system or next path.
 */
export function resolvePostAuthRedirectPath(input: PostAuthRedirectInput): string {
  const safeNext = safeNextPath(input.nextParam);
  const systems = input.user.accessibleSystems ?? [];

  if (input.forceSelector && systems.length > 1) {
    const qs = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
    return `/system-selector${qs}`;
  }

  const selectedSystem = pickSystemAccess(
    systems,
    input.user.selectedAccessId,
    normalizeSystemCode(input.user.selectedSystemCode ?? "")
  );

  if (selectedSystem) {
    const externalRedirect = resolveExternalSystemRedirect(selectedSystem.systemCode, safeNext);
    if (externalRedirect) return externalRedirect;
    if (safeNext) return safeNext;
    return getHomePathForSystemRole(input.user.role, selectedSystem.systemCode);
  }

  // If user has multiple systems, they MUST choose one first.
  if (systems.length > 1) {
    const qs = safeNext ? `?next=${encodeURIComponent(safeNext)}` : "";
    return `/system-selector${qs}`;
  }

  // If user has exactly one system, assign it automatically and proceed.
  if (systems.length === 1) {
    const system = systems[0];
    const externalRedirect = resolveExternalSystemRedirect(system.systemCode, safeNext);
    if (externalRedirect) return externalRedirect;
    if (safeNext) return safeNext;
    return getHomePathForSystemRole(input.user.role, system.systemCode);
  }

  // Fallback: No specific systems assigned (e.g. system admin with global role)
  if (safeNext) return safeNext;
  return getHomePathForSystemRole(input.user.role, input.user.selectedSystemCode);
}
