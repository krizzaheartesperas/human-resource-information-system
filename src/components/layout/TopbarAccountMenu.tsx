"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, CircleUserRound } from "lucide-react";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import {
  FALLBACK_ACCOUNT_HREF,
  getHomePathForSystemRole,
  getPortalPaths,
} from "@/core/routes/portal-routes";
import { signOutApp } from "@/lib/auth-actions";
import { normalizeSystemCode, roleFromSystemRoleCode } from "@/lib/auth/sessionAccess";
import type { Role } from "@/lib/mock";
import { cn } from "@/lib/utils";

const ROLE_SWITCH_ORDER = [
  "EMPLOYEE",
  "SUPER_ADMIN",
  "HR_STAFF",
  "HR_ADMIN",
  "DEPARTMENT_MANAGER",
  "HR_MANAGER",
  "AUDITOR",
  "EXECUTIVE",
] as const;

type RoleWorkspace = {
  id: string;
  role: Role;
  roleName: string;
  systemCode: string;
  systemName: string;
  accessId?: string;
};

type TopbarAccountMenuProps = {
  triggerClassName?: string;
  userIconClassName?: string;
  chevronIconClassName?: string;
  showName?: boolean;
  nameClassName?: string;
};

export default function TopbarAccountMenu({
  triggerClassName,
  userIconClassName,
  chevronIconClassName,
  showName = false,
  nameClassName,
}: TopbarAccountMenuProps = {}) {
  const { user, switchAccess, switchRole } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleWorkspaces = useMemo(() => {
    const seen = new Set<Role>();
    const hrisAccesses = (user.accessibleSystems ?? [])
      .filter((access) => {
        if (String(access.status ?? "").trim().toLowerCase() !== "active") return false;
        if (normalizeSystemCode(access.systemCode) !== "hris") return false;
        const accessRole = roleFromSystemRoleCode(access.roleCode, access.roleName);
        if (!ROLE_SWITCH_ORDER.includes(accessRole as (typeof ROLE_SWITCH_ORDER)[number])) return false;
        return true;
      })
      .map((access): RoleWorkspace => {
        const role = roleFromSystemRoleCode(access.roleCode, access.roleName);
        return {
          id: access.id,
          accessId: access.id,
          role,
          roleName: access.roleName?.trim() || role.replace(/_/g, " "),
          systemCode: access.systemCode,
          systemName: access.systemName,
        };
      });
    const hasBusinessHrisRole = hrisAccesses.some((access) => access.role !== "EMPLOYEE");
    const employeeWorkspace: RoleWorkspace[] = hasBusinessHrisRole
      ? [
          {
            id: "__base_employee__",
            role: "EMPLOYEE",
            roleName: "Employee",
            systemCode: "hris",
            systemName: "HRIS",
          },
        ]
      : [];

    return [...employeeWorkspace, ...hrisAccesses]
      .filter((workspace) => {
        if (seen.has(workspace.role)) return false;
        seen.add(workspace.role);
        return true;
      })
      .sort(
        (a, b) =>
          ROLE_SWITCH_ORDER.indexOf(a.role as (typeof ROLE_SWITCH_ORDER)[number]) -
          ROLE_SWITCH_ORDER.indexOf(b.role as (typeof ROLE_SWITCH_ORDER)[number])
      );
  }, [user.accessibleSystems]);

  const roleLabel =
    user.selectedSystemRoleName?.trim() ||
    (user.role === "DEPARTMENT_MANAGER"
      ? user.jobTitle || "Department Manager"
      : user.role === "SUPER_ADMIN"
        ? "System Admin"
        : user.role.replace(/_/g, " "));
  const canSwitchRole = roleWorkspaces.length > 1;

  const handleSwitchWorkspace = (workspace: RoleWorkspace) => {
    if (workspace.accessId) {
      switchAccess(workspace.accessId);
    } else {
      switchRole(workspace.role);
    }
    setOpen(false);
    setRoleMenuOpen(false);
    router.push(getHomePathForSystemRole(workspace.role, workspace.systemCode));
  };

  const handleSignOut = async () => {
    setOpen(false);
    await signOutApp();
    router.push("/login");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-1.5 text-foreground shadow-sm backdrop-blur-md transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          triggerClassName
        )}
      >
        <CircleUserRound className={cn("size-7 shrink-0", userIconClassName)} aria-hidden />
        {showName ? (
          <span className={cn("max-w-36 truncate text-sm font-medium", nameClassName)}>{user.name}</span>
        ) : null}
        <ChevronDown className={cn("size-4 shrink-0 opacity-70", chevronIconClassName)} aria-hidden />
      </button>

      {open && (
        <div
          className="absolute right-0 top-[110%] z-50 w-72 rounded-3xl border border-border/70 bg-background/95 shadow-xl py-2 text-sm backdrop-blur-md"
        >
          <div className="flex flex-col gap-1 px-2">
            <div className="px-3 py-1.5">
              <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">Acting as {roleLabel}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              href={paths.account ?? FALLBACK_ACCOUNT_HREF}
              className="block px-3 py-1.5 rounded-3xl hover:bg-muted text-left transition-colors"
              onClick={() => setOpen(false)}
            >
              View account
            </Link>
            {canSwitchRole ? (
              <>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-3xl px-3 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => setRoleMenuOpen((value) => !value)}
                  aria-expanded={roleMenuOpen}
                >
                  <span>Switch role</span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 opacity-70 transition-transform",
                      roleMenuOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>
                {roleMenuOpen ? (
                  <div className="max-h-64 overflow-y-auto rounded-2xl bg-muted/40 p-1">
                    {roleWorkspaces.map((workspace) => {
                      const selected =
                        user.role === workspace.role &&
                        (workspace.role === "EMPLOYEE" ||
                          user.selectedAccessId === workspace.accessId ||
                          (!user.selectedAccessId &&
                            normalizeSystemCode(user.selectedSystemCode) === normalizeSystemCode(workspace.systemCode)));

                      return (
                        <button
                          key={workspace.id}
                          type="button"
                          className={cn(
                            "block w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-background/80",
                            selected && "bg-background"
                          )}
                          onClick={() => handleSwitchWorkspace(workspace)}
                          aria-current={selected ? "true" : undefined}
                        >
                          <span className="block truncate text-sm font-medium text-foreground">
                            {workspace.roleName}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {selected ? "Current role" : "Switch HRIS workspace"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="block w-full px-3 py-1.5 rounded-3xl text-left hover:bg-muted transition-colors"
              onClick={() => {
                setOpen(false);
                router.push("/system-selector");
              }}
            >
              Switch system
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              type="button"
              className="block w-full px-3 py-1.5 rounded-3xl text-left text-red-700 hover:bg-red-50 transition-colors"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
