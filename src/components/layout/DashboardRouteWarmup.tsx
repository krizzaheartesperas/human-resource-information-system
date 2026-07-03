"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";

const warmedGroups = new Set<string>();

function uniqueRoutes(routes: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      routes
        .filter((route): route is string => Boolean(route))
        .map((route) => route.trim())
        .filter(Boolean)
    )
  );
}

export default function DashboardRouteWarmup() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useCurrentUser();
  const routes = useMemo(() => {
    const paths = getPortalPaths(user.role);
    const offboardingHref =
      user.role === "EMPLOYEE"
        ? paths.offboardingMy
        : user.role === "HR_STAFF"
          ? paths.offboardingTasks
          : user.role === "HR_ADMIN"
            ? paths.offboardingAdmin
            : user.role === "DEPARTMENT_MANAGER" ||
                user.role === "MANAGER" ||
                user.role === "HR_MANAGER"
              ? paths.offboardingApprovals
              : user.role === "AUDITOR"
                ? paths.offboardingAudit
                : user.role === "EXECUTIVE"
                  ? paths.offboardingAnalytics
                  : paths.offboarding;

    return uniqueRoutes([
      paths.dashboard,
      paths.myTime,
      paths.leave,
      paths.requests,
      paths.payroll,
      paths.organization,
      paths.departments,
      paths.employees,
      paths.complaints,
      offboardingHref,
      paths.handbook,
      paths.notifications,
      paths.account,
      paths.profile,
      paths.settings,
      paths.help,
      paths.reportsAttendance,
      paths.reportsWorkflow,
      paths.reportsWorkforce,
      paths.audit,
    ]);
  }, [user.role]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const conn = navigator.connection as
      | { saveData?: boolean; effectiveType?: string }
      | undefined;
    const onConstrainedNetwork =
      conn?.saveData === true ||
      conn?.effectiveType === "slow-2g" ||
      conn?.effectiveType === "2g";
    if (onConstrainedNetwork) return;

    const normalizedPath = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
    const filteredRoutes = routes.filter((route) => {
      const normalizedRoute = route.endsWith("/") && route !== "/" ? route.slice(0, -1) : route;
      return normalizedRoute !== normalizedPath;
    });
    if (!filteredRoutes.length) return;

    const warmupKey = `${user.role}:${filteredRoutes.join("|")}`;
    if (warmedGroups.has(warmupKey)) return;
    warmedGroups.add(warmupKey);

    let cancelled = false;
    const criticalRoutes = filteredRoutes.slice(0, 3);
    const deferredRoutes = filteredRoutes.slice(3);
    const timeoutIds: number[] = [];

    // Stage critical prefetches to avoid competing with in-view section data requests.
    criticalRoutes.forEach((route, index) => {
      const id = window.setTimeout(() => {
        if (cancelled) return;
        router.prefetch(route);
      }, 300 + index * 300);
      timeoutIds.push(id);
    });

    const schedule =
      window.requestIdleCallback ??
      ((callback: IdleRequestCallback) =>
        window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 250));

    const cancel =
      window.cancelIdleCallback ??
      ((id: number) => {
        window.clearTimeout(id);
      });

    const idleId = schedule(async () => {
      if (cancelled) return;
      for (const route of deferredRoutes) {
        if (cancelled) return;
        router.prefetch(route);
        await new Promise((resolve) => window.setTimeout(resolve, 120));
      }
    });

    return () => {
      cancelled = true;
      cancel(idleId);
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [pathname, router, routes, user.role]);

  return null;
}
