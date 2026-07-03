"use client";

import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { useTheme } from "@/components/theme/ThemeProvider";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  /** Breadcrumb row / section context under the topbar. */
  breadcrumb: ReactNode;
  /** Search placeholder for the module-level topbar input. */
  searchPlaceholder?: string;
  /** Controlled props for the topbar search input when needed. */
  searchInputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  /** Extra controls before theme / notifications (e.g. "Add widget"). */
  rightExtras?: ReactNode;
};

/**
 * Shared non-employee module topbar:
 * search field on the left, global actions on the right,
 * with optional breadcrumb/context row below.
 */
export function DashboardSectionTopBar({
  breadcrumb,
  searchPlaceholder = "Search",
  searchInputProps,
  rightExtras,
}: Props) {
  const { user: currentUser } = useCurrentUser();
  const { theme } = useTheme();
  if (currentUser.role === "EMPLOYEE") return null;

  return (
    <div className="space-y-3">
      <EmployeeModuleTopbar
        searchPlaceholder={searchPlaceholder}
        searchInputProps={searchInputProps}
        rightExtras={rightExtras}
      />

      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 px-1 text-sm sm:text-base",
          theme === "dark" ? "text-muted-foreground" : "text-[#192853]"
        )}
      >
        {breadcrumb}
      </div>
    </div>
  );
}
