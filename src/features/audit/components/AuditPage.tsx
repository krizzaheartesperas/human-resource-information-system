"use client";

import { Suspense, useState, useMemo, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeletonRows } from "@/components/ui/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { FileText, Filter } from "lucide-react";
import { ensureExampleAuditLogs, type AuditLogEntry, type AuditEntityType } from "@/features/audit/services/audit.service";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import { cn } from "@/lib/utils";
import {
  formatAction,
  formatEntityType,
  formatFieldName,
  formatSummary,
} from "@/features/audit/utils/auditFormatting";

/** Syncs ?entity= and ?highlight= from the URL into table filters (wrapped in Suspense for useSearchParams). */
function AuditQuerySync({
  onPayrollFilter,
  onPayrollAuditView,
  onHighlight,
}: {
  onPayrollFilter: () => void;
  onPayrollAuditView: (isPayrollAuditView: boolean) => void;
  onHighlight: (id: string | null) => void;
}) {
  const sp = useSearchParams();
  useEffect(() => {
    const e = sp.get("entity");
    const v = sp.get("view");
    const payrollView = e === "PAYROLL" || v === "payroll-audit";
    if (payrollView) onPayrollFilter();
    onPayrollAuditView(payrollView);
    onHighlight(sp.get("highlight"));
  }, [sp, onPayrollFilter, onPayrollAuditView, onHighlight]);
  return null;
}

export default function AuditPage() {
  const { user: currentUser } = useCurrentUser();
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => ensureExampleAuditLogs());
  const [entityFilter, setEntityFilter] = useState<AuditEntityType | "ALL">("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [payrollAuditView, setPayrollAuditView] = useState(false);

  const applyPayrollFilter = useCallback(() => {
    setEntityFilter("PAYROLL");
  }, []);

  const logsLoading = false;

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (entityFilter !== "ALL" && log.entityType !== entityFilter) return false;
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      return true;
    });
  }, [logs, entityFilter, actionFilter]);

  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.action));
    return Array.from(set.values()).sort();
  }, [logs]);

  const describeChanges = (beforeRaw: unknown, afterRaw: unknown): string | null => {
    const before = (beforeRaw && typeof beforeRaw === "object" ? beforeRaw : {}) as Record<
      string,
      unknown
    >;
    const after = (afterRaw && typeof afterRaw === "object" ? afterRaw : {}) as Record<
      string,
      unknown
    >;

    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    const allKeys = Array.from(new Set([...beforeKeys, ...afterKeys]));
    if (allKeys.length === 0) return null;

    // New record created
    if (beforeKeys.length === 0 && afterKeys.length > 0) {
      const parts = allKeys.map(
        (k) => `${formatFieldName(k)} ${String(after[k])}`
      );
      return `Initial values: ${parts.join(", ")}`;
    }

    const parts: string[] = [];
    for (const k of allKeys) {
      const b = beforeKeys.includes(k) ? String(before[k]) : "—";
      const a = afterKeys.includes(k) ? String(after[k]) : "—";
      if (b === a) continue;
      parts.push(`${formatFieldName(k)} from ${b} to ${a}`);
    }
    if (!parts.length) return null;
    return parts.join("; ");
  };

  const handleResetDemo = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem("hris-audit-logs");
    } catch {
      // ignore
    }
    const fresh = ensureExampleAuditLogs();
    setLogs(fresh);
    setExpandedId(null);
    setEntityFilter("ALL");
    setActionFilter("ALL");
  };

  // Simple role-based guard: restrict who can view audit logs
  if (
    currentUser.role !== "SUPER_ADMIN" &&
    currentUser.role !== "AUDITOR" &&
    currentUser.role !== "HR_ADMIN" &&
    currentUser.role !== "HR_MANAGER" &&
    currentUser.role !== "DEPARTMENT_MANAGER"
  ) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-6">
          <EmployeeModuleTopbar searchPlaceholder="Search audit logs..." />
          <EmployeeSectionHeader title="Audit Logs" />
        </div>
        <Card>
          <CardContent className="py-8">
            <p className="text-sm text-muted-foreground">
              You do not have permission to view audit logs. This area is restricted to Super Admins,
              Auditors, and Department Managers.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={null}>
        <AuditQuerySync
          onPayrollFilter={applyPayrollFilter}
          onPayrollAuditView={setPayrollAuditView}
          onHighlight={setHighlightQuery}
        />
      </Suspense>
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search audit logs..." />
        <EmployeeSectionHeader title={payrollAuditView ? "Payroll Audit" : "Audit Logs"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4" />
              {payrollAuditView ? "Payroll audit table (local demo)" : "Activity log (local demo)"}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {payrollAuditView
                ? "This shows payroll-related audit entries only (from the same general audit source)."
                : "This shows audit entries stored in your browser. In production this would come from the backend&apos;s audit_logs table."}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Filter className="size-3" />
                Filters
              </span>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value as AuditEntityType | "ALL")}
                disabled={payrollAuditView}
                className={cn(
                  "flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs",
                  payrollAuditView && "cursor-not-allowed opacity-60"
                )}
              >
                <option value="ALL">All entities</option>
                <option value="LEAVE_REQUEST">Leave requests</option>
                <option value="WORKFLOW_REQUEST">Workflow requests</option>
                <option value="EMPLOYEE">Employees</option>
                <option value="ACCOUNT">Account</option>
                <option value="ATTENDANCE">Attendance</option>
                <option value="SYSTEM">System</option>
                <option value="PAYROLL">Payroll</option>
              </select>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="ALL">All actions</option>
                {actionOptions.map((act) => (
                  <option key={act} value={act}>
                    {formatAction(act)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={handleResetDemo}
            >
              Reset demo audit data
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="rounded-md border border-border max-h-[70vh] overflow-y-auto scrollbar-hide">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead>{payrollAuditView ? "User" : "Who"}</TableHead>
                    <TableHead>{payrollAuditView ? "Payroll Action" : "Action"}</TableHead>
                    <TableHead>{payrollAuditView ? "Run ID" : "Entity"}</TableHead>
                    <TableHead>{payrollAuditView ? "Details" : "Summary"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeletonRows columns={5} prefix="audit-sk" />
                </TableBody>
              </Table>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              No audit entries yet. Approve or reject leave and workflow requests to generate logs.
            </div>
          ) : (
            <div className="rounded-md border border-border max-h-[70vh] overflow-y-auto scrollbar-hide">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">When</TableHead>
                    <TableHead>{payrollAuditView ? "User" : "Who"}</TableHead>
                    <TableHead>{payrollAuditView ? "Payroll Action" : "Action"}</TableHead>
                    <TableHead>{payrollAuditView ? "Run ID" : "Entity"}</TableHead>
                    <TableHead>{payrollAuditView ? "Details" : "Summary"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const tsLabel = new Date(log.timestamp).toLocaleString();
                    const isExpanded = expandedId === log.id;
                    const isHighlighted =
                      !!highlightQuery &&
                      (log.entityId === highlightQuery || log.id === highlightQuery);
                    return (
                      <TableRow
                        key={log.id}
                        className={cn(isHighlighted && "bg-amber-500/15 dark:bg-amber-500/10")}
                      >
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {tsLabel}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="font-medium">{log.actorName}</div>
                          <div className="text-xs text-muted-foreground">
                            {log.actorRole} · {log.actorId}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant="outline" className="text-xs">
                            {formatAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {payrollAuditView ? (
                            <span className="font-mono">{log.entityId}</span>
                          ) : (
                            <>
                              {formatEntityType(log.entityType)}{" "}
                              <span className="text-muted-foreground">({log.entityId})</span>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-xl">
                          <div>{formatSummary(log.summary)}</div>
                          {(log.before || log.after || log.reason) && (
                            <button
                              type="button"
                              className="mt-1 text-xs font-medium text-primary hover:underline"
                              onClick={() =>
                                setExpandedId((prev) => (prev === log.id ? null : log.id))
                              }
                            >
                              {isExpanded ? "Hide details" : "View details"}
                            </button>
                          )}
                          {isExpanded && (
                            <>
                              {(() => {
                                const before =
                                  log.before && typeof log.before === "object"
                                    ? (log.before as Record<string, unknown>)
                                    : undefined;
                                const after =
                                  log.after && typeof log.after === "object"
                                    ? (log.after as Record<string, unknown>)
                                    : undefined;
                                const hasStatusOnly =
                                  before &&
                                  after &&
                                  "status" in before &&
                                  "status" in after;

                                if (hasStatusOnly) {
                                  const afterTitle =
                                    typeof after?.title === "string" ? after.title : undefined;
                                  const beforeTitle =
                                    typeof before?.title === "string" ? before.title : undefined;
                                  const title = afterTitle ?? beforeTitle;
                                  return (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {title ? `${title} ` : ""}
                                      from {String(before.status)} to {String(after.status)}.
                                    </div>
                                  );
                                }

                                if (log.before || log.after) {
                                  const friendly = describeChanges(before, after);
                                  if (friendly) {
                                    return (
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        {friendly}
                                      </div>
                                    );
                                  }
                                  return (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      <span>Before: {JSON.stringify(log.before ?? {})}</span>
                                      <span className="mx-2">→</span>
                                      <span>After: {JSON.stringify(log.after ?? {})}</span>
                                    </div>
                                  );
                                }

                                return null;
                              })()}
                              {log.reason && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Reason: {log.reason}
                                </div>
                              )}
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
