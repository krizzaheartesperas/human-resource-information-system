"use client";

import { memo, useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Menu, Moon, Sun } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/layout/Sidebar";
import { ThemeLogo } from "@/components/ui/theme-logo";
import { useSidebarLayout } from "@/components/layout/SidebarLayoutContext";
import NotificationsBellMenu from "@/components/layout/NotificationsBellMenu";
import SettingsIconLink from "@/components/layout/SettingsIconLink";
import TopbarAccountMenu from "@/components/layout/TopbarAccountMenu";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const DashboardRouteWarmup = lazy(() => import("@/components/layout/DashboardRouteWarmup"));

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const { mobileOpen, setMobileOpen, closeMobile } = useSidebarLayout();
  const { user: currentUser, isHydrated } = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const safeUser = currentUser ?? { role: "EMPLOYEE", name: "User" };
  const isEmployee = safeUser.role === "EMPLOYEE";
  const hideEmployeeTopbar = true;
  const firstName = safeUser.name.trim().split(/\s+/)[0] || safeUser.name;
  const employeeTopbarLead = useMemo(() => {
    if (pathname === "/") {
      return {
        isGreeting: true as const,
        base: `Welcome, ${firstName}!`,
        active: "",
      };
    }

    const labelMap: Record<string, string> = {
      leave: "My Leave",
      complaints: "Issues & Feedback",
      requests: "My Requests",
      payroll: "My Pay",
      organization: "People Directory",
      notifications: "Updates",
      settings: "Settings",
      help: "Help",
      account: "Account",
      profile: "Account",
      attendance: "Attendance",
      "my-time": "My Time",
      employees: "Employees",
      reports: "Reports",
      workforce: "Workforce",
      workflow: "Workflow",
      "my-payslips": "My Payslips",
      payslips: "Payslips",
      approval: "Approval",
      escalated: "Escalated",
      admin: "Admin",
      audit: "Audit",
      executive: "Executive",
      manager: "Manager",
      staff: "Staff",
    };
    const tabLabelBySection: Record<string, Record<string, string>> = {
      "my-time": {
        timeclock: "Timeclock",
        timecards: "Timecards",
        corrections: "Corrections",
        overtime: "Overtime",
      },
      leave: {
        "my-report": "My Leave Request",
        balances: "My Leave Balance",
        reference: "Leave Types",
        apply: "Apply Leave",
      },
      complaints: {
        file: "File Complaint",
        my: "My Complaints",
        status: "Complaint Status",
      },
      payroll: {
        overview: "Overview",
        payslips: "My Pay",
      },
    };

    const isIdLike = (segment: string) =>
      /^\d+$/.test(segment) ||
      /^[0-9a-f]{8,}$/i.test(segment) ||
      /^[0-9a-f-]{8,}$/i.test(segment);

    const prettify = (segment: string) => {
      if (isIdLike(segment)) return "Details";
      if (labelMap[segment]) return labelMap[segment];
      return segment
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
    };

    const pathParts = pathname.split("/").filter(Boolean);
    const section = pathParts[0] ?? "";
    const base = prettify(section);

    const tabValue =
      searchParams.get("tab") ??
      searchParams.get("report") ??
      searchParams.get("view");

    if (tabValue) {
      const active =
        tabLabelBySection[section]?.[tabValue] ?? prettify(tabValue);
      return { isGreeting: false as const, base, active };
    }

    const detailPart = pathParts[1];
    const active = detailPart ? prettify(detailPart) : "";
    return { isGreeting: false as const, base, active };
  }, [pathname, searchParams, firstName]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  if (!mounted || !isHydrated) return null;

  return (
    <div className={cn("flex h-dvh overflow-hidden flex-col", theme === "dark" ? "bg-[#1B223D]" : "bg-white")}>
      <Suspense fallback={null}>
        <DashboardRouteWarmup />
      </Suspense>
      {/* Mobile top bar */}
      <header
        className={cn(
          "sticky top-0 z-[95] flex h-14 items-center gap-3 border-b px-4 backdrop-blur-md lg:hidden",
          theme === "dark" ? "border-white/10 bg-[#161b30]/95" : "border-border/80 bg-white/95"
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl"
          onClick={() => setMobileOpen(true)}
          aria-expanded={mobileOpen}
          aria-controls="app-sidebar"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <ThemeLogo width={32} height={32} className="shrink-0" />
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">
            Workzen HRIS
          </span>
        </div>
      </header>

      {/* Dim overlay when mobile drawer open */}
      <button
        type="button"
        aria-label="Close menu"
        className={cn(
          "fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 overflow-hidden flex-col lg:flex-row",
          theme === "dark" ? "bg-[#1B223D]" : "bg-white"
        )}
      >
        <div className="w-0 shrink-0 overflow-visible lg:flex lg:h-full lg:min-h-0 lg:w-auto lg:shrink-0">
          <Sidebar />
        </div>
        <main className="h-full min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-3 py-4 scrollbar-hide sm:px-5 sm:py-5 lg:max-w-none lg:px-5 lg:pt-0 lg:pb-6">
          {isEmployee && !hideEmployeeTopbar && (
            <section
              className={cn(
                "hidden border-b pb-3 pt-2 lg:sticky lg:top-0 lg:z-20 lg:block lg:min-h-0 lg:py-3",
                "relative -mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-5 lg:px-5",
                theme === "dark" ? "border-white/10 bg-[#1B223D]" : "border-slate-300/80 bg-white",
                theme === "dark" ? "lg:shadow-sm lg:shadow-black/20" : "lg:shadow-sm lg:shadow-slate-900/5"
              )}
              aria-label="Employee top bar"
            >
              <div className="flex min-w-0 items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <p
                    className={cn(
                      "min-w-0 text-base leading-tight sm:text-lg",
                      theme === "dark" ? "text-slate-100" : "text-[#192853]"
                    )}
                  >
                    {employeeTopbarLead.isGreeting ? (
                      <span className="font-semibold">{employeeTopbarLead.base}</span>
                    ) : (
                      <>
                        <span className={cn("font-medium", theme === "dark" ? "text-slate-300" : "text-[#192853]")}>
                          {employeeTopbarLead.base}
                        </span>
                        {!!employeeTopbarLead.active && (
                          <>
                            <span className={cn("px-2", theme === "dark" ? "text-slate-500" : "text-slate-400")}>{">"}</span>
                            <span className={cn("font-bold", theme === "dark" ? "text-slate-100" : "text-[#192853]")}>
                              {employeeTopbarLead.active}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <div className="flex min-w-0 shrink-0 flex-row items-center justify-end gap-2">
                  <div className="mt-1.5 flex flex-row flex-wrap items-center justify-end gap-2 sm:mt-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className={cn(
                        "rounded-full hover:bg-transparent focus-visible:bg-transparent",
                        theme === "dark" ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900"
                      )}
                      onClick={toggleTheme}
                      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    >
                      {theme === "dark" ? (
                        <Sun className="size-8 scale-125" />
                      ) : (
                        <Moon className="size-8 scale-125" />
                      )}
                    </Button>
                    <div className="scale-125">
                      <NotificationsBellMenu
                        iconClassName={cn("size-8", theme === "dark" ? "text-slate-200" : "text-slate-700")}
                        buttonClassName={cn(
                          "hover:bg-transparent focus-visible:bg-transparent",
                          theme === "dark" ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900"
                        )}
                      />
                    </div>
                    <div className="scale-125">
                      <SettingsIconLink
                        iconClassName={cn("size-8", theme === "dark" ? "text-slate-200" : "text-slate-700")}
                        buttonClassName={cn(
                          "hover:bg-transparent focus-visible:bg-transparent",
                          theme === "dark" ? "text-slate-200 hover:text-white" : "text-slate-700 hover:text-slate-900"
                        )}
                      />
                    </div>
                  </div>
                  <TopbarAccountMenu />
                </div>
              </div>
            </section>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}