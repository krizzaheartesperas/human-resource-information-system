/**
 * Maps URL → skeleton layout while a `(dashboard)` route segment loads.
 */
export type DashboardLoadingVariant =
  | "home"
  | "tabs"
  | "tableFilters"
  | "dataTable"
  | "reports"
  | "payroll"
  | "moduleGrid"
  | "simple"
  | "detail"
  | "offboarding"
  | "default";

export function getDashboardLoadingVariant(
  pathname: string | null | undefined
): DashboardLoadingVariant {
  if (!pathname) return "default";
  const segments = pathname.split("/").filter(Boolean);
  const [a, b, c] = segments;

  if (a === "dashboard" && !b) return "home";

  if (a === "leave") return "tabs";

  if (a === "payroll") {
    if (b === "payslips" && c) return "detail";
    return "payroll";
  }

  if (a === "complaints") return b ? "detail" : "tableFilters";

  if (a === "employees") return b ? "detail" : "dataTable";

  if (a === "reports") return "reports";

  if (a === "my-time" || a === "attendance") return "moduleGrid";

  if (a === "organization" || a === "departments") return "dataTable";

  if (a === "offboarding") return "offboarding";

  if (
    [
      "settings",
      "account",
      "profile",
      "help",
      "handbook",
      "notifications",
      "user-management",
      "requests",
      "audit",
      "discipline",
    ].includes(a ?? "")
  ) {
    return "simple";
  }

  if (a === "workforce-overview") return "moduleGrid";

  return "default";
}
