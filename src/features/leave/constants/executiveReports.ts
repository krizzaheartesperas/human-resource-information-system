export type ExecutiveReportKey =
  | "MONTHLY_LEAVE_SUMMARY"
  | "DEPARTMENT_LEAVE_REPORT"
  | "WORKFORCE_AVAILABILITY_REPORT"
  | "LEAVE_TREND_REPORT"
  | "EXECUTIVE_LEAVE_OVERVIEW_REPORT";

export const EXECUTIVE_REPORTS: Array<{ key: ExecutiveReportKey; title: string; description: string }> = [
  {
    key: "MONTHLY_LEAVE_SUMMARY",
    title: "Monthly Leave Summary",
    description: "High-level leave totals and outcomes for the current month.",
  },
  {
    key: "DEPARTMENT_LEAVE_REPORT",
    title: "Department Leave Report",
    description: "Department-level comparison of leave volume and outcomes.",
  },
  {
    key: "WORKFORCE_AVAILABILITY_REPORT",
    title: "Workforce Availability Report",
    description: "Today’s department availability snapshot (present vs on leave).",
  },
  {
    key: "LEAVE_TREND_REPORT",
    title: "Leave Trend Report",
    description: "Simple trend indicators based on recent leave activity.",
  },
  {
    key: "EXECUTIVE_LEAVE_OVERVIEW_REPORT",
    title: "Executive Leave Overview Report",
    description: "Combined executive summary snapshot for leadership review.",
  },
];
