"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import {
  LayoutDashboard,
  Users,
  Building2,
  CalendarDays,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  PanelLeft,
  X,
  Bell,
  ClipboardList,
  FileText,
  CreditCard,
  Wallet,
  UserMinus,
  Timer,
  BookOpenText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { departments, type Role } from "@/lib/mock";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { useSidebarLayout } from "@/components/layout/SidebarLayoutContext";
import { Button } from "@/components/ui/button";
import { canAccessMyTime, canAccessTeamTime } from "@/lib/auth/permissions";
import { getPortalPaths } from "@/core/routes/portal-routes";
import {
  matchesComplaintsHref,
  pathMatchesLeave,
} from "@/core/routes/portal-route-match";
import {
  buildSidebarNav,
  type SidebarNavItem as NavItem,
  type SidebarReportNavItem as ReportNavItem,
} from "@/components/layout/buildSidebarNav";

const deptColors: Record<string, string> = {
  "dept-1": "bg-blue-500",
  "dept-2": "bg-emerald-500",
  "dept-3": "bg-amber-500",
  "dept-4": "bg-purple-500",
};

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [deptOpen, setDeptOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(true);
  const [payrollOpen, setPayrollOpen] = useState(true);
  const [workflowOpen, setWorkflowOpen] = useState(true);
  const [orgOpen, setOrgOpen] = useState(true);
  const [employeesOpen, setEmployeesOpen] = useState(true);
  const [deptManagerMyLeaveOpen, setDeptManagerMyLeaveOpen] = useState(true);
  const [deptManagerTeamLeaveOpen, setDeptManagerTeamLeaveOpen] = useState(true);
  const [myLeaveFlyoutOpen, setMyLeaveFlyoutOpen] = useState(false);
  const [teamLeaveFlyoutOpen, setTeamLeaveFlyoutOpen] = useState(false);
  const [workflowFlyoutOpen, setWorkflowFlyoutOpen] = useState(false);
  const [complaintsFlyoutOpen, setComplaintsFlyoutOpen] = useState(false);
  const [orgFlyoutOpen, setOrgFlyoutOpen] = useState(false);
  const [employeesFlyoutOpen, setEmployeesFlyoutOpen] = useState(false);
  const [hrReportsFlyoutOpen, setHrReportsFlyoutOpen] = useState(false);
  const [workforceAnalyticsFlyoutOpen, setWorkforceAnalyticsFlyoutOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const { user: currentUser } = useCurrentUser();
  const { mobileOpen, closeMobile } = useSidebarLayout();
  const [isLg, setIsLg] = useState(false);
  const paths = useMemo(
    () => getPortalPaths(currentUser.role),
    [currentUser.role]
  );
  const navModel = useMemo(() => buildSidebarNav(paths), [paths]);
  const {
    mainNav: nav,
    deptManagerMyLeaveNav,
    deptManagerTeamLeaveNav,
    deptManagerWorkflowNav,
    deptManagerOrgNav,
    hrOrgNav,
    employeeLeaveNav,
    hrAdminLeaveNav,
    employeeMyLeaveNav,
    employeeWorkflowNav,
    employeeOrgNav,
    employeeComplaintsNav,
  } = navModel;
  const leaveTab = pathMatchesLeave(pathname, paths.leave)
    ? searchParams.get("tab")
    : null;
  const complaintsTab =
    pathname === paths.complaints ? searchParams.get("tab") : null;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      setIsLg(mq.matches);
      if (mq.matches) closeMobile();
    };
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [closeMobile]);

  useEffect(() => {
    closeMobile();
  }, [pathname, searchParams.toString(), closeMobile]);

  /** Icon-only sidebar only applies at lg+; mobile drawer always shows full labels */
  const collapsed = isLg && desktopNavCollapsed;

  const closeAllFlyouts = () => {
    setMyLeaveFlyoutOpen(false);
    setTeamLeaveFlyoutOpen(false);
    setWorkflowFlyoutOpen(false);
    setComplaintsFlyoutOpen(false);
    setOrgFlyoutOpen(false);
    setEmployeesFlyoutOpen(false);
    setHrReportsFlyoutOpen(false);
    setWorkforceAnalyticsFlyoutOpen(false);
    setPayrollOpen(false);
  };

  const canSeeLeaveSection =
    currentUser.role === "EMPLOYEE" ||
    currentUser.role === "DEPARTMENT_MANAGER" ||
    currentUser.role === "HR_STAFF" ||
    currentUser.role === "HR_MANAGER" ||
    currentUser.role === "HR_ADMIN" ||
    currentUser.role === "AUDITOR" ||
    currentUser.role === "EXECUTIVE";

  const isEmployee = currentUser.role === "EMPLOYEE";
  const isEmployeeDashboardHome = isEmployee && pathname === paths.dashboard;
  const isDepartmentManager = currentUser.role === "DEPARTMENT_MANAGER";
  const isManager = currentUser.role === "MANAGER";
  const isHRStaff = currentUser.role === "HR_STAFF";
  const isHRManager = currentUser.role === "HR_MANAGER";

  const isMyLeaveTab =
    pathMatchesLeave(pathname, paths.leave) &&
    (leaveTab === "my-report" || leaveTab === "balances" || leaveTab === "reference");
  const isTeamLeaveTab =
    pathMatchesLeave(pathname, paths.leave) &&
    leaveTab !== null &&
    !(
      leaveTab === "my-report" ||
      leaveTab === "balances" ||
      leaveTab === "reference" ||
      leaveTab === "apply"
    );
  const isSystemAdmin = currentUser.role === "SUPER_ADMIN";
  const isHrAdminLike = currentUser.role === "HR_ADMIN";
  const isAuditorLike = currentUser.role === "AUDITOR";
  const isExecutiveLike = currentUser.role === "EXECUTIVE";
  const isWorkflowPage = pathname === paths.requests;
  const isWorkflowApprovalTab = searchParams.get("tab") === "approve";
  const isTimeSection =
    pathname === paths.myTime ||
    pathname === paths.teamTime ||
    pathname.startsWith(`${paths.teamTime}/`);
  const isOffboardingSection =
    pathname === paths.offboarding || pathname.startsWith(`${paths.offboarding}/`);
  const offboardingHref =
    currentUser.role === "EMPLOYEE"
      ? paths.offboardingMy
      : currentUser.role === "HR_STAFF"
        ? paths.offboardingTasks
      : currentUser.role === "HR_ADMIN"
        ? paths.offboardingAdmin
      : currentUser.role === "DEPARTMENT_MANAGER" ||
          currentUser.role === "MANAGER" ||
          currentUser.role === "HR_MANAGER"
        ? paths.offboardingApprovals
      : currentUser.role === "AUDITOR"
        ? paths.offboardingAudit
      : currentUser.role === "EXECUTIVE"
        ? paths.offboardingAnalytics
      : paths.offboarding;
  const canSeeWorkflowApprovalSubsection = currentUser.role !== "EMPLOYEE";
  const profileRoleLabel =
    currentUser.role === "DEPARTMENT_MANAGER"
      ? currentUser.jobTitle || "Department Manager"
      : currentUser.role === "SUPER_ADMIN"
        ? "System Admin"
      : currentUser.role.replace(/_/g, " ");
  const useDirectLeaveLinks = isHrAdminLike || isAuditorLike || isExecutiveLike;
  const isComplaintsSection =
    pathname === paths.complaints &&
    (complaintsTab === "file" ||
      complaintsTab === "my" ||
      complaintsTab === "status" ||
      complaintsTab === null);

  const canSeeMyTime = canAccessMyTime(currentUser.role);
  const canSeeTeamTime = canAccessTeamTime(currentUser.role);
  const activeSidebarItemClass =
    "bg-[#FFE14E] !text-[#111827] dark:bg-[#FFE14E] dark:!text-[#111827] [&_svg]:!text-[#111827] shadow-md after:absolute after:right-2.5 after:top-1/2 after:h-6 after:w-0.5 after:-translate-y-1/2 after:rounded-full after:bg-[#111827]/80";

  /** Pointsale-style nav row (light: slate pills, dark: subtle glass) */
  const empItem = (active: boolean) =>
    cn(
      "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] hover:translate-x-px motion-reduce:hover:translate-x-0",
      "text-slate-200 dark:text-slate-300 dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
      collapsed && "lg:justify-center lg:px-2",
      active && activeSidebarItemClass
    );

  return (
    <aside
      id="app-sidebar"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden shadow-sm dark:shadow-none transition-[transform,width] duration-300 ease-in-out",
        "[&_svg]:transition-transform [&_svg]:duration-300 [&_svg]:ease-out [&_a:hover_svg]:-translate-y-1 [&_a:hover_svg]:scale-110 [&_button:hover_svg]:-translate-y-1 [&_button:hover_svg]:scale-110 active:[&_svg]:translate-y-0 active:[&_svg]:scale-100",
        "[&_a:hover_.lucide-layout-dashboard]:rotate-180 [&_a:hover_.lucide-layout-dashboard]:translate-y-0 [&_button:hover_.lucide-layout-dashboard]:rotate-180 [&_button:hover_.lucide-layout-dashboard]:translate-y-0",
        "[&_a:hover_.lucide-settings]:rotate-180 [&_a:hover_.lucide-settings]:translate-y-0 [&_button:hover_.lucide-settings]:rotate-180 [&_button:hover_.lucide-settings]:translate-y-0",
        "active:[&_.lucide-layout-dashboard]:rotate-0 active:[&_.lucide-settings]:rotate-0",
        "rounded-none border-r border-[#26335f] bg-[#1B2447] text-slate-100 dark:border-transparent dark:bg-[#0f172a] dark:text-slate-100",
        // Mobile drawer: clip chrome; scroll lives in inner region with scrollbar-hide
        "fixed inset-y-0 left-0 z-100 h-dvh max-h-dvh w-[min(17.5rem,calc(100vw-1rem))] max-w-70 overflow-x-hidden",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: fill row height; inner column scrolls
        "lg:static lg:z-auto lg:h-full lg:min-h-0 lg:translate-x-0 lg:overflow-hidden",
        collapsed ? "lg:w-20" : "lg:w-66"
      )}
    >
      <div
        className={cn(
          "flex gap-2 px-3 py-3",
          collapsed ? "lg:flex-col lg:items-center lg:gap-3" : "items-center"
        )}
      >
        <Link
          href={paths.dashboard}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-white/10 dark:hover:bg-white/5",
            collapsed ? "lg:w-full lg:justify-center" : "flex-1"
          )}
        >
          <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/workzen.png"
              alt=""
              width={28}
              height={28}
              className="object-contain"
            />
          </span>
          <span
            className={cn(
              "truncate text-[15px] font-semibold tracking-tight text-slate-100 dark:text-slate-50",
              collapsed && "lg:hidden"
            )}
          >
            Workzen HRIS
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setDesktopNavCollapsed((v) => !v)}
            className="hidden size-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-slate-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 dark:focus-visible:ring-slate-500 lg:inline-flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelLeft className={cn("size-[18px]", collapsed && "rotate-180")} />
          </button>
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-slate-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 lg:hidden dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            aria-label="Close navigation menu"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain scrollbar-hide">
          <nav
            className={cn(
              "min-w-0 px-3 py-4",
              isEmployee && "flex min-h-full flex-col",
              isEmployee ? "space-y-0" : "space-y-3",
              isEmployeeDashboardHome && isLg && isEmployee && "lg:pt-2"
            )}
          >
        {/* Employee: Pointsale-style sections + promo + profile */}
        {isEmployee ? (
          <>
            <div className="min-h-0 min-w-0 flex-1 space-y-4">
            {!collapsed && (
              <p className="px-3 pb-2 pt-0 text-[11px] font-semibold uppercase tracking-wider text-slate-300 dark:text-slate-500">
                Menu
              </p>
            )}
            <div className="space-y-1">
              <Link href={paths.dashboard} className={empItem(pathname === paths.dashboard)} title={collapsed ? "Home" : undefined}>
                <LayoutDashboard className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Home
                </span>
              </Link>
              <Link
                href={paths.myTime}
                className={empItem(pathname === paths.myTime)}
                title={collapsed ? "My Time" : undefined}
              >
                <Timer className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  My Time
                </span>
              </Link>
              <Link href={paths.leave} className={empItem(pathMatchesLeave(pathname, paths.leave))} title={collapsed ? "My Leave" : undefined}>
                <CalendarDays className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  My Leave
                </span>
              </Link>
              <Link
                href={paths.requests}
                className={empItem(pathname === paths.requests)}
                title={collapsed ? "My Requests" : undefined}
              >
                <ClipboardList className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  My Requests
                </span>
              </Link>
              <Link
                href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                className={empItem(pathname === paths.payroll)}
                title={collapsed ? "My Pay" : undefined}
              >
                <Wallet className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  My Pay
                </span>
              </Link>
              <Link
                href={paths.organization}
                className={empItem(pathname === paths.organization || pathname === paths.departments)}
                title={collapsed ? "People Directory" : undefined}
              >
                <Building2 className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  People Directory
                </span>
              </Link>
              <Link
                href={paths.complaints}
                className={empItem(isComplaintsSection)}
                title={collapsed ? "Issues & Feedback" : undefined}
              >
                <FileText className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Issues & Feedback
                </span>
              </Link>
              <Link href={paths.offboardingMy} className={empItem(isOffboardingSection)} title={collapsed ? "Exit" : undefined}>
                <UserMinus className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Exit
                </span>
              </Link>
              <Link href={paths.handbook} className={empItem(pathname === paths.handbook)} title={collapsed ? "Guidelines" : undefined}>
                <BookOpenText className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Guidelines
                </span>
              </Link>
              <Link
                href={paths.notifications}
                className={empItem(pathname === paths.notifications)}
                title={collapsed ? "Updates" : undefined}
              >
                <Bell className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Updates
                </span>
              </Link>
            </div>

            {!collapsed && (
              <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-slate-300 dark:text-slate-500">
                Support
              </p>
            )}
            <div className={cn("space-y-1", !collapsed && "pt-0")}>
              <Link href={paths.settings} className={empItem(pathname === paths.settings)} title={collapsed ? "Settings" : undefined}>
                <Settings className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Settings
                </span>
              </Link>
              <Link
                href={paths.help}
                className={empItem(pathname === paths.help)}
                aria-label="Help Center"
                title="Help"
              >
                <HelpCircle className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-2 w-auto opacity-100"
                  )}
                >
                  Help
                </span>
              </Link>
            </div>
            </div>

            <div className="mt-auto shrink-0 border-t border-white/20 pt-4 dark:border-white/20">
              <Link
                href={paths.account}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-white/10 dark:hover:bg-white/10",
                  (pathname === paths.account || pathname === paths.profile) && "bg-white/10 dark:bg-white/10"
                )}
              >
                <div className="relative flex size-9 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-white/20 dark:ring-white/30">
                  <Image
                    src={currentUser.profilePhoto}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </div>
                <div
                  className={cn(
                    "min-w-0 transition-all duration-300 ease-in-out",
                    collapsed ? "ml-0 w-0 flex-none overflow-hidden opacity-0" : "ml-2 flex-1 opacity-100"
                  )}
                >
                  <p className="truncate text-sm font-semibold text-slate-100 dark:text-slate-50">
                    {currentUser.name}
                  </p>
                  <p className="truncate text-xs text-slate-300 dark:text-slate-400">{profileRoleLabel}</p>
                </div>
                {!collapsed && (
                  <ChevronRight className="size-4 shrink-0 text-slate-300 dark:text-slate-500" aria-hidden />
                )}
              </Link>
            </div>
          </>
        ) : isSystemAdmin ? (
          <>
            <Link
              href={paths.dashboard}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.dashboard && activeSidebarItemClass
              )}
            >
              <LayoutDashboard className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Dashboard
              </span>
            </Link>

            {canSeeMyTime && (
              <Link
                href={paths.myTime}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  pathname === paths.myTime && "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
                title={collapsed ? "My Time" : undefined}
              >
                <Timer className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  My Time
                </span>
              </Link>
            )}

            <Link
              href={paths.userManagement}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.userManagement && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "User Management" : undefined}
            >
              <Users className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                User Management
              </span>
            </Link>

            <Link
              href={paths.offboardingIt}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                (pathname === paths.offboardingIt ||
                  pathname.startsWith(`${paths.offboardingIt}/`)) &&
                  "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Offboarding" : undefined}
            >
              <UserMinus className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                {currentUser.role === "HR_STAFF" ? "Offboarding Management" : "Offboarding"}
              </span>
            </Link>

            <Link
              href={paths.offboardingMy}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.offboardingMy && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "My Offboarding" : undefined}
            >
              <UserMinus className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                My Offboarding
              </span>
            </Link>

            <Link
              href={paths.audit}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.audit && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Audit logs" : undefined}
            >
              <ClipboardList className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Audit logs
              </span>
            </Link>

            <Link
              href={paths.notifications}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.notifications && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Notifications" : undefined}
            >
              <Bell className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Notifications
              </span>
            </Link>

            <Link
              href={paths.settings}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.settings && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Settings
              </span>
            </Link>

            <Link
              href={paths.help}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.help && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Help Center" : undefined}
            >
              <HelpCircle className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Help Center
              </span>
            </Link>

            <Link
              href={paths.handbook}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.handbook && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Handbook" : undefined}
            >
              <BookOpenText className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Handbook
              </span>
            </Link>

            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/20">
              <Link
                href={paths.account}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors text-inherit hover:bg-[#FFE14E] hover:text-[#111827]",
                  (pathname === paths.account || pathname === paths.profile) &&
                    "bg-[#FFE14E] text-[#111827] font-medium [&_p]:text-[#111827]"
                )}
              >
                <div className="relative flex size-9 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-white/20 dark:ring-white/30">
                  <Image
                    src={currentUser.profilePhoto}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </div>
                <div
                  className={cn(
                    "min-w-0 whitespace-nowrap transition-all duration-300 ease-in-out",
                    collapsed
                      ? "opacity-0 w-0 overflow-hidden ml-0 flex-none"
                      : "opacity-100 flex-1 ml-2"
                  )}
                >
                  <p className="text-sm font-medium truncate text-inherit">{currentUser.name}</p>
                  <p className="text-xs truncate text-inherit">{profileRoleLabel}</p>
                </div>
              </Link>
            </div>
          </>
        ) : isHRStaff ? (
          <>
            <Link
              href={paths.dashboard}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.dashboard && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Dashboard" : undefined}
            >
              <LayoutDashboard className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Dashboard
              </span>
            </Link>

            <Link
              href={`${paths.employees}?view=records`}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.employees && activeSidebarItemClass
              )}
              title={collapsed ? "Employees" : undefined}
            >
              <Users className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Employees
              </span>
            </Link>

            {canSeeMyTime && (
              <Link
                href={paths.myTime}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  pathname === paths.myTime && activeSidebarItemClass
                )}
                title={collapsed ? "My Time" : undefined}
              >
                <Timer className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  My Time
                </span>
              </Link>
            )}
            <Link
              href={paths.teamTime}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                (pathname === paths.teamTime || pathname.startsWith(`${paths.teamTime}/`)) &&
                  activeSidebarItemClass
              )}
              title={collapsed ? "Team Time" : undefined}
            >
              <Timer className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Team Time
              </span>
            </Link>

            <Link
              href={`${paths.leave}?tab=staff-process`}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathMatchesLeave(pathname, paths.leave) && activeSidebarItemClass
              )}
              title={collapsed ? "Leave" : undefined}
            >
              <CalendarDays className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Leave
              </span>
            </Link>

            <Link
              href={paths.requests}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.requests && activeSidebarItemClass
              )}
              title={collapsed ? "Requests" : undefined}
            >
              <ClipboardList className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Requests
              </span>
            </Link>

            <Link
              href={`${paths.complaints}?panel=dashboard`}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?panel=dashboard`) &&
                  activeSidebarItemClass
              )}
              title={collapsed ? "Complaints" : undefined}
            >
              <FileText className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Complaints
              </span>
            </Link>

            <Link
              href={paths.offboardingTasks}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                isOffboardingSection && activeSidebarItemClass
              )}
              title={collapsed ? "Offboarding" : undefined}
            >
              <UserMinus className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Offboarding
              </span>
            </Link>

            <Link
              href={paths.audit}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.audit && activeSidebarItemClass
              )}
              title={collapsed ? "Audit Logs" : undefined}
            >
              <ClipboardList className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Audit Logs
              </span>
            </Link>
          </>
        ) : isHrAdminLike ? (
          <>
            {[
              {
                label: "Dashboard",
                href: paths.dashboard,
                icon: LayoutDashboard,
                active: pathname === paths.dashboard,
              },
              {
                label: "Employees",
                href: `${paths.employees}?view=records`,
                icon: Users,
                active: pathname === paths.employees,
              },
              {
                label: "Team Time",
                href: paths.teamTime,
                icon: Timer,
                active:
                  pathname === paths.teamTime || pathname.startsWith(`${paths.teamTime}/`),
              },
              {
                label: "Leave",
                href: `${paths.leave}?tab=hr-final`,
                icon: CalendarDays,
                active: pathMatchesLeave(pathname, paths.leave),
              },
              {
                label: "Requests",
                href: paths.requests,
                icon: ClipboardList,
                active: pathname === paths.requests,
              },
              {
                label: "Complaints",
                href: `${paths.complaints}?tab=all`,
                icon: FileText,
                active:
                  pathname === paths.complaints ||
                  pathname.startsWith(`${paths.complaints}/`),
              },
              {
                label: "Offboarding",
                href: paths.offboardingAdmin,
                icon: UserMinus,
                active: isOffboardingSection,
              },
              {
                label: "Audit Logs",
                href: paths.audit,
                icon: ClipboardList,
                active: pathname === paths.audit,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                    item.active && activeSidebarItemClass
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-200 ease-out",
                      collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        ) : isHRManager ? (
          <>
            {[
              {
                label: "Dashboard",
                href: paths.dashboard,
                icon: LayoutDashboard,
                active: pathname === paths.dashboard,
              },
              {
                label: "Employees",
                href: `${paths.employees}?view=records`,
                icon: Users,
                active: pathname === paths.employees,
              },
              {
                label: "Team Time",
                href: paths.teamTime,
                icon: Timer,
                active:
                  pathname === paths.teamTime || pathname.startsWith(`${paths.teamTime}/`),
              },
              {
                label: "Leave",
                href: `${paths.leave}?tab=hm-high`,
                icon: CalendarDays,
                active: pathMatchesLeave(pathname, paths.leave),
              },
              {
                label: "Requests",
                href: paths.requests,
                icon: ClipboardList,
                active: pathname === paths.requests,
              },
              {
                label: "Complaints",
                href: `${paths.complaints}?panel=overview`,
                icon: FileText,
                active:
                  pathname === paths.complaints ||
                  pathname.startsWith(`${paths.complaints}/`),
              },
              {
                label: "Offboarding",
                href: paths.offboardingApprovals,
                icon: UserMinus,
                active: isOffboardingSection,
              },
              {
                label: "Audit Logs",
                href: paths.audit,
                icon: ClipboardList,
                active: pathname === paths.audit,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                    item.active && activeSidebarItemClass
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-200 ease-out",
                      collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        ) : isDepartmentManager ? (
          <>
            {[
              {
                label: "Dashboard",
                href: paths.dashboard,
                icon: LayoutDashboard,
                active: pathname === paths.dashboard,
              },
              {
                label: "Employees",
                href: paths.employees,
                icon: Users,
                active: pathname === paths.employees,
              },
              {
                label: "Team Time",
                href: paths.teamTime,
                icon: Timer,
                active:
                  pathname === paths.teamTime || pathname.startsWith(`${paths.teamTime}/`),
              },
              {
                label: "Leave",
                href: `${paths.leave}?tab=dm-pending`,
                icon: CalendarDays,
                active: pathMatchesLeave(pathname, paths.leave),
              },
              {
                label: "Requests",
                href: paths.requests,
                icon: ClipboardList,
                active: pathname === paths.requests,
              },
              {
                label: "Complaints",
                href: `${paths.complaints}?panel=overview`,
                icon: FileText,
                active:
                  pathname === paths.complaints ||
                  pathname.startsWith(`${paths.complaints}/`),
              },
              {
                label: "Offboarding",
                href: paths.offboardingApprovals,
                icon: UserMinus,
                active: isOffboardingSection,
              },
              {
                label: "Audit Logs",
                href: paths.audit,
                icon: ClipboardList,
                active: pathname === paths.audit,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                    item.active && activeSidebarItemClass
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-200 ease-out",
                      collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        ) : isAuditorLike ? (
          <>
            {[
              {
                label: "Dashboard",
                href: paths.dashboard,
                icon: LayoutDashboard,
                active: pathname === paths.dashboard,
              },
              {
                label: "Employees",
                href: `${paths.employees}?view=records`,
                icon: Users,
                active: pathname === paths.employees,
              },
              {
                label: "Team Time",
                href: paths.teamTime,
                icon: Timer,
                active:
                  pathname === paths.teamTime || pathname.startsWith(`${paths.teamTime}/`),
              },
              {
                label: "Leave",
                href: `${paths.leave}?tab=audit-records`,
                icon: CalendarDays,
                active: pathMatchesLeave(pathname, paths.leave),
              },
              {
                label: "Requests",
                href: paths.requests,
                icon: ClipboardList,
                active: pathname === paths.requests,
              },
              {
                label: "Complaints",
                href: `${paths.complaints}?tab=records`,
                icon: FileText,
                active:
                  pathname === paths.complaints ||
                  pathname.startsWith(`${paths.complaints}/`),
              },
              {
                label: "Offboarding",
                href: paths.offboardingAudit,
                icon: UserMinus,
                active: isOffboardingSection,
              },
              {
                label: "Audit Logs",
                href: paths.audit,
                icon: ClipboardList,
                active: pathname === paths.audit,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                    item.active && activeSidebarItemClass
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-200 ease-out",
                      collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        ) : isExecutiveLike ? (
          <>
            {[
              {
                label: "Dashboard",
                href: paths.dashboard,
                icon: LayoutDashboard,
                active: pathname === paths.dashboard,
              },
              {
                label: "Employees",
                href: `${paths.employees}?view=records`,
                icon: Users,
                active: pathname === paths.employees,
              },
              {
                label: "Team Time",
                href: paths.teamTime,
                icon: Timer,
                active:
                  pathname === paths.teamTime || pathname.startsWith(`${paths.teamTime}/`),
              },
              {
                label: "Leave",
                href: `${paths.leave}?tab=exec-summary`,
                icon: CalendarDays,
                active: pathMatchesLeave(pathname, paths.leave),
              },
              {
                label: "Requests",
                href: paths.requests,
                icon: ClipboardList,
                active: pathname === paths.requests,
              },
              {
                label: "Complaints",
                href: `${paths.complaints}?scope=executive`,
                icon: FileText,
                active:
                  pathname === paths.complaints ||
                  pathname.startsWith(`${paths.complaints}/`),
              },
              {
                label: "Offboarding",
                href: paths.offboardingAnalytics,
                icon: UserMinus,
                active: isOffboardingSection,
              },
              {
                label: "Audit Logs",
                href: paths.audit,
                icon: ClipboardList,
                active: pathname === paths.audit,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                    item.active && activeSidebarItemClass
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" />
                  <span
                    className={cn(
                      "whitespace-nowrap transition-all duration-200 ease-out",
                      collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </>
        ) : (isDepartmentManager || isManager || isHRManager || isHrAdminLike || isAuditorLike || isExecutiveLike) ? (
          <>
            <Link
              href={paths.dashboard}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.dashboard && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <LayoutDashboard className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Dashboard
              </span>
            </Link>

            {/* Employees – simple link (no flyout) */}
            <Link
              href={
                isDepartmentManager || isManager
                  ? paths.employees
                  : `${paths.employees}?view=records`
              }
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.employees && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <Users className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                {isDepartmentManager || isManager ? "Employees" : "Employee Records"}
              </span>
            </Link>

            {/* Leave grouped section */}
            {canSeeLeaveSection && !collapsed && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setLeaveOpen((prev) => !prev)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:text-slate-300 dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]"
                >
                  <span className="flex items-center gap-3">
                    <CalendarDays className="size-4 shrink-0" />
                    <span className="ml-2">Leave</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      leaveOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    leaveOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="ml-5 space-y-0.5 overflow-hidden pl-2">
                    <Link
                      href={`${paths.leave}?tab=my-report`}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                        isMyLeaveTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                      )}
                    >
                      My Leave
                    </Link>
                    <Link
                      href={`${paths.leave}?tab=staff-process`}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                        isTeamLeaveTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                      )}
                    >
                      Leave Management
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* My Time + Team Time (no grouped "Time" section) */}
            {canSeeMyTime && (
              <Link
                href={paths.myTime}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  pathname === paths.myTime && "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
                title={collapsed ? "My Time" : undefined}
              >
                <Timer className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  My Time
                </span>
              </Link>
            )}
            {canSeeTeamTime && (
              <Link
                href={paths.teamTime}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  isTimeSection &&
                    pathname !== paths.myTime &&
                    "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
                title={collapsed ? "Team Time" : undefined}
              >
                <Timer className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  Team Time
                </span>
              </Link>
            )}

            {canSeeLeaveSection && collapsed && (
              <Link
                href={paths.leave}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                  pathMatchesLeave(pathname, paths.leave) && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                )}
                title="Leave"
              >
                <CalendarDays className="size-4 shrink-0" />
              </Link>
            )}

            {/* Workflow Request – grouped subsection for approver roles */}
            {canSeeWorkflowApprovalSubsection && !collapsed && (
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setWorkflowOpen((prev) => !prev)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:text-slate-300 dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]"
                >
                  <span className="flex items-center gap-3">
                    <ClipboardList className="size-4 shrink-0" />
                    <span className="ml-2">Workflow Request</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      workflowOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    workflowOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="ml-5 space-y-0.5 overflow-hidden pl-2">
                    <Link
                      href={paths.requests}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                        isWorkflowPage && !isWorkflowApprovalTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                      )}
                    >
                      My Request
                    </Link>
                    <Link
                      href={`${paths.requests}?tab=approve`}
                      className={cn(
                        "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                        isWorkflowPage && isWorkflowApprovalTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                      )}
                    >
                      Approval
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {isDepartmentManager && collapsed && (
              <Link
                href={paths.requests}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                  pathname === paths.requests && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                )}
                title="Workflow Request"
              >
                <ClipboardList className="size-4 shrink-0" />
              </Link>
            )}

            {/* Organization – simple link (no flyout) */}
            <Link
              href={paths.organization}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                (pathname === paths.organization || pathname === paths.departments) &&
                  "bg-[#FFE14E] text-[#2C2E60] font-medium"
              )}
            >
              <Building2 className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Organization
              </span>
            </Link>

            {isDepartmentManager && collapsed && (
              <Link
                href={paths.organization}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                  pathname === paths.organization && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                )}
                title="Organization"
              >
                <Building2 className="size-4 shrink-0" />
              </Link>
            )}


            {/* Payroll section – HR Staff only */}
            {isHRStaff && !collapsed && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payroll
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      payrollOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    payrollOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                        className={cn(
                          "group flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.payroll && searchParams.get("mode") === "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <Wallet className="size-4 shrink-0" />
                        My Payslip
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=export`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <CreditCard className="size-4 shrink-0" />
                        Payroll Integration
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Payroll section – HR Admin / System Admin */}
            {isHrAdminLike && !collapsed && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payroll
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      payrollOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    payrollOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.payroll &&
                            searchParams.get("mode") === "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <Wallet className="size-4 shrink-0" />
                        My Payslip
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                            searchParams.get("mode") !== "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <CreditCard className="size-4 shrink-0" />
                        Payroll Integration
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Payroll section – HR Manager */}
            {isHRManager && !collapsed && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payroll
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      payrollOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    payrollOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.payroll &&
                            searchParams.get("mode") === "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <Wallet className="size-4 shrink-0" />
                        My Payslip
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                            searchParams.get("mode") !== "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <CreditCard className="size-4 shrink-0" />
                        Payroll Integration
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Payroll section – Department Manager */}
            {isDepartmentManager && !collapsed && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payroll
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      payrollOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    payrollOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.payroll &&
                            searchParams.get("mode") === "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <Wallet className="size-4 shrink-0" />
                        My Payslip
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                            searchParams.get("mode") !== "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <CreditCard className="size-4 shrink-0" />
                        Team Payroll
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Payroll section – Auditor */}
            {isAuditorLike && !collapsed && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payroll
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      payrollOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    payrollOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.payroll &&
                            searchParams.get("mode") === "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <Wallet className="size-4 shrink-0" />
                        My Payslip
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`${paths.audit}?view=payroll-audit&entity=PAYROLL`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.audit &&
                            searchParams.get("entity") === "PAYROLL" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <ClipboardList className="size-4 shrink-0" />
                        Payroll Audit
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {/* Payroll section – Executive */}
            {isExecutiveLike && !collapsed && (
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => setPayrollOpen(!payrollOpen)}
                  className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="size-4" />
                    Payroll
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 transition-transform duration-300 ease-in-out",
                      payrollOpen ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div
                  className={cn(
                    "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                    payrollOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=payslips&mode=my-payslips`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          pathname === paths.payroll &&
                            searchParams.get("mode") === "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <Wallet className="size-4 shrink-0" />
                        My Payslip
                      </Link>
                    </li>
                    <li>
                      <Link
                        href={`${paths.payroll}?tab=overview&mode=payroll-overview`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                            searchParams.get("mode") !== "my-payslips" &&
                            "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        <CreditCard className="size-4 shrink-0" />
                        Payroll Overview
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {isHRStaff && collapsed && (
              <div className="pt-4 space-y-0.5">
                <Link
                  href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.payroll && searchParams.get("mode") === "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="My Payslip"
                >
                  <Wallet className="size-4 shrink-0" />
                </Link>
                <Link
                  href={`${paths.payroll}?tab=export`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="Payroll Integration"
                >
                  <CreditCard className="size-4 shrink-0" />
                </Link>
              </div>
            )}

            {isHrAdminLike && collapsed && (
              <div className="pt-4 space-y-0.5">
                <Link
                  href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.payroll &&
                      searchParams.get("mode") === "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="My Payslip"
                >
                  <Wallet className="size-4 shrink-0" />
                </Link>
                <Link
                  href={`${paths.payroll}?tab=overview`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                      searchParams.get("mode") !== "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="Payroll Integration"
                >
                  <CreditCard className="size-4 shrink-0" />
                </Link>
              </div>
            )}

            {isHRManager && collapsed && (
              <div className="pt-4 space-y-0.5">
                <Link
                        href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.payroll &&
                      searchParams.get("mode") === "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="My Payslip"
                >
                  <Wallet className="size-4 shrink-0" />
                </Link>
                <Link
                        href={`${paths.payroll}?tab=overview`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                      searchParams.get("mode") !== "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="Payroll Integration"
                >
                  <CreditCard className="size-4 shrink-0" />
                </Link>
              </div>
            )}

            {isDepartmentManager && collapsed && (
              <div className="pt-4 space-y-0.5">
                <Link
                  href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.payroll &&
                      searchParams.get("mode") === "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="My Payslip"
                >
                  <Wallet className="size-4 shrink-0" />
                </Link>
                <Link
                  href={`${paths.payroll}?tab=overview`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                      searchParams.get("mode") !== "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="Team Payroll"
                >
                  <CreditCard className="size-4 shrink-0" />
                </Link>
              </div>
            )}

            {isAuditorLike && collapsed && (
              <div className="pt-4 space-y-0.5">
                <Link
                  href={`${paths.payroll}?tab=overview&mode=my-payslips`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.payroll &&
                      searchParams.get("mode") === "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="My Payslip"
                >
                  <Wallet className="size-4 shrink-0" />
                </Link>
                <Link
                  href={`${paths.audit}?view=payroll-audit&entity=PAYROLL`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.audit &&
                      searchParams.get("entity") === "PAYROLL" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="Payroll Audit"
                >
                  <ClipboardList className="size-4 shrink-0" />
                </Link>
              </div>
            )}

            {isExecutiveLike && collapsed && (
              <div className="pt-4 space-y-0.5">
                <Link
                  href={`${paths.payroll}?tab=payslips&mode=my-payslips`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    pathname === paths.payroll &&
                      searchParams.get("mode") === "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="My Payslip"
                >
                  <Wallet className="size-4 shrink-0" />
                </Link>
                <Link
                  href={`${paths.payroll}?tab=overview&mode=payroll-overview`}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    (pathname === paths.payroll || pathname.startsWith(`${paths.payroll}/`)) &&
                      searchParams.get("mode") !== "my-payslips" &&
                      "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                  title="Payroll Overview"
                >
                  <CreditCard className="size-4 shrink-0" />
                </Link>
              </div>
            )}

            <Link
              href={paths.offboardingMy}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.offboardingMy && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <UserMinus className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                My Offboarding
              </span>
            </Link>

            <Link
              href={offboardingHref}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                isOffboardingSection && pathname !== paths.offboardingMy && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <UserMinus className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Offboarding
              </span>
            </Link>

            <Link
              href={paths.handbook}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.handbook && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
              title={collapsed ? "Handbook" : undefined}
            >
              <BookOpenText className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Handbook
              </span>
            </Link>

            <Link
              href={paths.notifications}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.notifications && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <Bell className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Notifications
              </span>
            </Link>

            <Link
              href={paths.audit}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.audit && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <ClipboardList className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Audit logs
              </span>
            </Link>

            {/* Disciplinary Records – HR-only */}
            {(isHRManager || isHRStaff || currentUser.role === "HR_ADMIN") && (
              <Link
                href={paths.discipline}
                className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  pathname === paths.discipline && "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
              >
                <ClipboardList className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  Disciplinary Records
                </span>
              </Link>
            )}

            {/* Complaints – HR Manager dashboard */}
            {(isHRManager || currentUser.role === "HR_ADMIN") && (
              <Link
                href={`${paths.complaints}?panel=overview`}
                className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?panel=overview`) &&
                    "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  Complaints
                </span>
              </Link>
            )}

            {/* Complaints – Auditor (read-only) */}
            {currentUser.role === "AUDITOR" && (
              <Link
                href={`${paths.complaints}?tab=records`}
                className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?tab=records`) &&
                    "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  Complaints
                </span>
              </Link>
            )}

            {/* Complaints – HR Staff dashboard */}
            {isHRStaff && (
              <Link
                href={`${paths.complaints}?panel=dashboard`}
                className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                  matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?panel=dashboard`) &&
                    "bg-[#FFE14E] text-[#111827] shadow-md"
                )}
              >
                <FileText className="size-4 shrink-0" />
                <span
                  className={cn(
                    "whitespace-nowrap transition-all duration-200 ease-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                  )}
                >
                  Complaints
                </span>
              </Link>
            )}

            <Link
              href={paths.settings}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.settings && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <Settings className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Settings
              </span>
            </Link>

            <Link
              href={paths.help}
              className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
                pathname === paths.help && "bg-[#FFE14E] text-[#111827] shadow-md"
              )}
            >
              <HelpCircle className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                Help Center
              </span>
            </Link>

            {/* Account profile card at bottom for Department Manager */}
            <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/20">
              <Link
                href={paths.account}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors text-inherit hover:bg-[#FFE14E] hover:text-[#111827]",
                  (pathname === paths.account || pathname === paths.profile) && "bg-[#FFE14E] text-[#111827] font-medium [&_p]:text-[#111827]"
                )}
              >
                <div className="relative flex size-9 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-white/20 dark:ring-white/30">
                  <Image
                    src={currentUser.profilePhoto}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="36px"
                  />
                </div>
                <div
                  className={cn(
                    "min-w-0 whitespace-nowrap transition-all duration-300 ease-in-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden ml-0 flex-none" : "opacity-100 flex-1 ml-2"
                  )}
                >
                  <p className="text-sm font-medium truncate text-inherit">
                    {currentUser.name}
                  </p>
                  <p className="text-xs truncate text-inherit">
                    {profileRoleLabel}
                  </p>
                </div>
              </Link>
            </div>
          </>
        ) : (
        <>
        {/* Complaints – HR Admin Control Center (prominent section) */}
        {currentUser.role === "HR_ADMIN" && (
          <Link
            href={`${paths.complaints}?tab=all`}
            className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
              matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?tab=all`) &&
                "bg-[#FFE14E] text-[#111827] shadow-md"
            )}
            title={collapsed ? "Complaints" : undefined}
          >
            <FileText className="size-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-200 ease-out",
                collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
              )}
            >
              Complaints
            </span>
          </Link>
        )}

        {/* Complaints – Auditor (read-only, control-style entry) */}
        {currentUser.role === "AUDITOR" && (
          <Link
            href={`${paths.complaints}?tab=records`}
            className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
              matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?tab=records`) &&
                "bg-[#FFE14E] text-[#111827] shadow-md"
            )}
            title={collapsed ? "Complaints" : undefined}
          >
            <FileText className="size-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-200 ease-out",
                collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
              )}
            >
              Complaints
            </span>
          </Link>
        )}

        {/* Complaints – Executive analytics (read-only, high-level) */}
        {currentUser.role === "EXECUTIVE" && (
          <Link
            href={`${paths.complaints}?scope=executive`}
            className={cn(
                "group relative flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 dark:text-slate-300 hover:bg-[#FFE14E] hover:text-[#111827]",
              matchesComplaintsHref(pathname, searchParams, `${paths.complaints}?scope=executive`) &&
                "bg-[#FFE14E] text-[#111827] shadow-md"
            )}
            title={collapsed ? "Complaints" : undefined}
          >
            <FileText className="size-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-200 ease-out",
                collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
              )}
            >
              Complaints
            </span>
          </Link>
        )}

        {nav
          .filter((item) => {
            // HR Staff + HR Admin use their own Payroll flyout section.
            if (
              (isHRStaff ||
                isHRManager ||
                isHrAdminLike ||
                isDepartmentManager ||
                isAuditorLike ||
                isExecutiveLike) &&
              item.href === paths.payroll
            )
              return false;
            return !item.roles || item.roles.includes(currentUser.role);
          })
          .filter((item) => {
            // Replace Leave link with expandable section for roles that can see it
            if (item.href === paths.leave && canSeeLeaveSection) return false;
            return true;
          })
          .map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== paths.dashboard && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] hover:translate-x-px motion-reduce:hover:translate-x-0",
                active && "bg-[#FFE14E] text-[#2C2E60] font-medium"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="size-4 shrink-0" />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-200 ease-out",
                  collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* HR Admin / Auditor / Executive: Leave section with My Leave + Leave Management */}
        {canSeeLeaveSection && useDirectLeaveLinks && !collapsed && (
          <div className="pt-1 space-y-1">
            <button
              type="button"
              onClick={() => setLeaveOpen((prev) => !prev)}
              className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                Leave
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-300 ease-in-out",
                  leaveOpen ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                leaveOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                <li>
                  <Link
                    href={`${paths.leave}?tab=my-report`}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                      isMyLeaveTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                    )}
                  >
                    My Leave
                  </Link>
                </li>
                <li>
                  <Link
                    href={
                      isAuditorLike
                        ? `${paths.leave}?tab=audit-records`
                        : isExecutiveLike
                          ? `${paths.leave}?tab=executive-approvals`
                          : `${paths.leave}?tab=hr-final`
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                      isTeamLeaveTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                    )}
                  >
                    Leave Management
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Leave expandable section – for Department Manager, HR Staff, HR Manager, HR Admin, Auditor, Executive, Super Admin */}
        {canSeeLeaveSection && !isEmployee && !collapsed && !useDirectLeaveLinks && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setLeaveOpen(!leaveOpen)}
              className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors"
            >
              <span className="flex items-center gap-2">
                <CalendarDays className="size-4" />
                Leave
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-300 ease-in-out",
                  leaveOpen ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                leaveOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <ul className="mt-1 space-y-0.5 overflow-hidden pl-2 ml-4">
                {(currentUser.role === "HR_ADMIN" ? hrAdminLeaveNav : employeeLeaveNav).map((item) => {
                  const isActive = pathMatchesLeave(pathname, paths.leave) && (leaveTab === item.tab || (!leaveTab && item.tab === "my-report"));
                  return (
                    <li key={item.label + item.tab}>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] transition-colors",
                          isActive && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {canSeeLeaveSection && !isEmployee && collapsed && (
          <Link
            href={paths.leave}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
              pathMatchesLeave(pathname, paths.leave) && "bg-[#FFE14E] text-[#2C2E60] font-medium"
            )}
            title="Leave"
          >
            <CalendarDays className="size-4 shrink-0" />
          </Link>
        )}

        {/* Workflow Request – grouped subsection for approver roles */}
        {isHrAdminLike && !collapsed && (
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setWorkflowOpen((prev) => !prev)}
              className="group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:text-slate-300 dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]"
            >
              <span className="flex items-center gap-3">
                <ClipboardList className="size-4 shrink-0" />
                <span className="whitespace-nowrap ml-2">Workflow Request</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 transition-transform duration-300 ease-in-out",
                  workflowOpen ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
                workflowOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              )}
            >
              <div className="ml-5 space-y-0.5 overflow-hidden pl-2">
                <Link
                  href={paths.requests}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    isWorkflowPage && !isWorkflowApprovalTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                >
                  My Request
                </Link>
                <Link
                  href={`${paths.requests}?tab=approve`}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                    isWorkflowPage && isWorkflowApprovalTab && "bg-[#FFE14E] text-[#2C2E60] font-medium"
                  )}
                >
                  Approval
                </Link>
              </div>
            </div>
          </div>
        )}
        {isHrAdminLike && collapsed && (
          <Link
            href={paths.requests}
            className={cn(
              "group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
              pathname === paths.requests && "bg-[#FFE14E] text-[#2C2E60] font-medium"
            )}
            title="Workflow Request"
          >
            <ClipboardList className="size-4 shrink-0" />
          </Link>
        )}

        {/* Settings, Help & Account – same active style as report tabs (yellow bg, dark text, rounded right) */}
        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-white/20 space-y-1">
          {currentUser.role === "HR_ADMIN" && (
            <Link
              href={paths.settings}
              className={cn(
                "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
                pathname === paths.settings && "bg-[#FFE14E] text-[#2C2E60] font-medium"
              )}
            >
              <Settings className="size-4 shrink-0" />
              <span
                className={cn(
                  "ml-2 transition-all duration-300",
                  collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                )}
              >
                Settings
              </span>
            </Link>
          )}
          <Link
            href={paths.help}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827]",
              pathname === paths.help && "bg-[#FFE14E] text-[#2C2E60] font-medium"
            )}
          >
            <HelpCircle className="size-4 shrink-0" />
            <span
              className={cn(
                "whitespace-nowrap transition-all duration-300 ease-in-out",
                collapsed ? "opacity-0 w-0 overflow-hidden ml-0" : "opacity-100 w-auto ml-2"
              )}
            >
              Help Center
            </span>
          </Link>
          {/* Account – link to /account, below Help Center */}
          <Link
            href={paths.account}
            className={cn(
              "group flex items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors text-inherit hover:bg-[#FFE14E] hover:text-[#111827] dark:hover:bg-[#FFE14E] dark:hover:text-[#111827] pt-2",
              (pathname === paths.account || pathname === paths.profile) && "bg-[#FFE14E] text-[#2C2E60] font-medium [&_p]:text-[#2C2E60]"
            )}
          >
            <div className="relative flex size-9 shrink-0 overflow-hidden rounded-full bg-slate-200 ring-1 ring-slate-300 dark:bg-white/20 dark:ring-white/30">
              <Image
                src={currentUser.profilePhoto}
                alt=""
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
            <div
              className={cn(
                "min-w-0 whitespace-nowrap transition-all duration-300 ease-in-out",
                collapsed ? "opacity-0 w-0 overflow-hidden ml-0 flex-none" : "opacity-100 flex-1 ml-2"
              )}
            >
              <p className="text-sm font-medium truncate text-inherit">
                {currentUser.name}
              </p>
              <p className="text-xs truncate text-inherit">
                {profileRoleLabel}
              </p>
            </div>
          </Link>
        </div>
        </>
        )}
          </nav>
        </div>
      </div>
    </aside>
  );
}
