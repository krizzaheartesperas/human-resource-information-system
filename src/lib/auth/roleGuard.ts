import type { Role } from "@/lib/mock";
import { roleToPortalId, type PortalId } from "@/core/routes/portal-routes";

export function assertRolePortal(role: Role, expected: PortalId): boolean {
  return roleToPortalId(role) === expected;
}
