export type AuditorReportKey =
  | "monthly-transactions"
  | "approval-turnaround"
  | "rejected-requests"
  | "balance-adjustment-history"
  | "policy-violations"
  | "department-leave-summaries";

export const AUDITOR_REPORTS: Array<{ key: AuditorReportKey; label: string }> = [
  { key: "monthly-transactions", label: "Monthly leave transactions" },
  { key: "approval-turnaround", label: "Approval turnaround time" },
  { key: "rejected-requests", label: "Rejected leave requests" },
  { key: "balance-adjustment-history", label: "Leave balance adjustment history" },
  { key: "policy-violations", label: "Policy violation report" },
  { key: "department-leave-summaries", label: "Department leave summaries" },
];
