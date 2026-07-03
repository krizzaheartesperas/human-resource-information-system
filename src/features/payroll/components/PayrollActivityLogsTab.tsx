"use client";

import { useEffect, useMemo, useState } from "react";
import { PAYROLL_PERIOD_OPTIONS } from "@/features/payroll/services/payroll-data";
import {
  loadPayrollActivityRowsForUser,
  matchesActionFilter,
  type PayrollActivityActionFilter,
  type PayrollActivityRow,
} from "@/features/payroll/services/payrollActivityLogs";
import { ensureExampleAuditLogs } from "@/features/audit/services/audit.service";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** When opening from Payroll History, filter to this export run / entity id */
  initialRunFilter?: string | null;
  /** When true, show only rows where the actor is the logged-in employee (employee-like view). */
  ownOnly?: boolean;
  /** When true, show only rows performed by HR_STAFF (HR processor view). */
  hrStaffActionsOnly?: boolean;
  /** When true, show only integration-related actions (export generated/validated/failed/rerun). */
  integrationActionsOnly?: boolean;
};

function badgeVariant(
  status: PayrollActivityRow["status"]
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Success":
      return "default";
    case "Failed":
      return "destructive";
    case "Warning":
      return "secondary";
    default:
      return "outline";
  }
}

function startOfDay(d: string): number {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

function endOfDay(d: string): number {
  const t = new Date(d);
  t.setHours(23, 59, 59, 999);
  return t.getTime();
}

export function PayrollActivityLogsTab({
  initialRunFilter,
  ownOnly,
  hrStaffActionsOnly,
  integrationActionsOnly,
}: Props) {
  const { user } = useCurrentUser();
  const [rows, setRows] = useState<PayrollActivityRow[]>([]);
  const [periodKey, setPeriodKey] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [actionFilter, setActionFilter] = useState<PayrollActivityActionFilter>("ALL");
  const [userFilter, setUserFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<PayrollActivityRow | null>(null);

  const reload = () => {
    ensureExampleAuditLogs();
    const loaded = loadPayrollActivityRowsForUser(user);
    let scoped = loaded;
    if (ownOnly) {
      scoped = scoped.filter((r) => r.entry.actorId === user.employeeId);
    }
    if (hrStaffActionsOnly) {
      scoped = scoped.filter((r) => r.entry.actorRole === "HR_STAFF");
    }
    if (integrationActionsOnly) {
      const allowed = new Set([
        "PAYROLL_EXPORT_GENERATED",
        "PAYROLL_DATA_VALIDATED",
        "PAYROLL_EXPORT_FAILED",
        "PAYROLL_EXPORT_APPROVED",
        "PAYROLL_EXPORT_REJECTED",
        "PAYROLL_EXPORT_EXPORTED",
        "PAYROLL_RERUN_EXPORT",
      ]);
      scoped = scoped.filter((r) => allowed.has(r.entry.action));
    }
    setRows(scoped);
  };

  useEffect(() => {
    reload();
  }, [user.id, user.employeeId, user.role, user.departmentId, ownOnly, hrStaffActionsOnly, integrationActionsOnly]);

  const performerOptions = useMemo(() => {
    const names = new Set(rows.map((r) => r.performedBy));
    return Array.from(names).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = rows;

    if (initialRunFilter?.trim()) {
      const q = initialRunFilter.trim();
      list = list.filter((r) => {
        if (r.technicalRef === q || r.logId === q) return true;
        const after = r.entry.after as Record<string, unknown> | undefined;
        if (after && String(after.previousRunId ?? "") === q) return true;
        return false;
      });
    }

    if (periodKey !== "ALL") {
      const opt = PAYROLL_PERIOD_OPTIONS.find((o) => o.value === periodKey);
      const labelPart = opt?.label ?? "";
      list = list.filter((r) => {
        const after = r.entry.after as Record<string, unknown> | undefined;
        const pl = String(after?.periodLabel ?? r.entry.summary);
        return pl.includes(labelPart.split("·")[0]?.trim() ?? labelPart);
      });
    }

    if (dateFrom) {
      const t0 = startOfDay(dateFrom);
      list = list.filter((r) => new Date(r.timestamp).getTime() >= t0);
    }
    if (dateTo) {
      const t1 = endOfDay(dateTo);
      list = list.filter((r) => new Date(r.timestamp).getTime() <= t1);
    }

    if (actionFilter !== "ALL") {
      list = list.filter((r) => matchesActionFilter(r.action, actionFilter));
    }

    if (userFilter !== "ALL") {
      list = list.filter((r) => r.performedBy === userFilter);
    }

    const sq = search.trim().toLowerCase();
    if (sq) {
      list = list.filter(
        (r) =>
          r.summary.toLowerCase().includes(sq) ||
          r.performedBy.toLowerCase().includes(sq) ||
          r.displayRef.toLowerCase().includes(sq) ||
          r.technicalRef.toLowerCase().includes(sq) ||
          r.actionLabel.toLowerCase().includes(sq)
      );
    }

    return list;
  }, [
    rows,
    initialRunFilter,
    periodKey,
    dateFrom,
    dateTo,
    actionFilter,
    userFilter,
    search,
  ]);

  const downloadCsv = () => {
    const header = ["Ref", "Technical ID", "Action", "Performed By", "Role", "Date/Time", "Status", "Summary"];
    const lines = [
      header.join(","),
      ...filtered.map((r) =>
        [
          r.displayRef,
          r.technicalRef,
          `"${r.actionLabel.replace(/"/g, '""')}"`,
          `"${r.performedBy.replace(/"/g, '""')}"`,
          r.performedRole,
          r.timestamp,
          r.status,
          `"${r.summary.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const after = detail?.entry.after as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Payroll Activity Logs</h2>
        <p className="text-sm text-muted-foreground">
          Track all payroll-related activities and export history (payroll module only — not system-wide
          audit).
        </p>
        {/* BRD: Payroll Integration logs are module-scoped; remove "own payroll" explanatory banner. */}
        {hrStaffActionsOnly && !integrationActionsOnly ? (
          <p className="mt-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Showing only <strong>HR Staff</strong> payroll actions (exports, validations, and payslip
            views performed by HR Staff).
          </p>
        ) : null}
        {integrationActionsOnly ? (
          <p className="mt-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Showing <strong>Payroll Integration</strong> actions only (export generated/validated/failed/rerun).
          </p>
        ) : null}
        {initialRunFilter ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Filtered to run / reference: <span className="font-mono">{initialRunFilter}</span>
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <label className="text-sm">
              <span className="text-muted-foreground">Payroll period</span>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={periodKey}
                onChange={(e) => setPeriodKey(e.target.value)}
              >
                <option value="ALL">All periods</option>
                {PAYROLL_PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Date from</span>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Date to</span>
              <input
                type="date"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Action type</span>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as PayrollActivityActionFilter)}
              >
                <option value="ALL">All actions</option>
                <option value="PAYROLL_EXPORT_GENERATED">Export Generated</option>
                <option value="PAYROLL_EXPORT_FAILED">Export Failed</option>
                <option value="PAYROLL_DATA_VALIDATED">Data Validated</option>
                <option value="PAYROLL_EXPORT_APPROVED">Export Approved</option>
                <option value="PAYROLL_EXPORT_REJECTED">Export Rejected</option>
                <option value="PAYROLL_EXPORT_EXPORTED">Exported</option>
                <option value="PAYSLIP_VIEWED">Payslip Viewed</option>
                <option value="PAYROLL_RERUN_EXPORT">Re-run Export</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="text-sm lg:col-span-2">
              <span className="text-muted-foreground">User</span>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              >
                <option value="ALL">All users</option>
                {performerOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm lg:col-span-2">
              <span className="text-muted-foreground">Search</span>
              <input
                type="search"
                placeholder="Summary, ref, name…"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={reload}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={downloadCsv}>
              <Download className="size-4" />
              Download logs (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activity log</CardTitle>
          <p className="text-sm text-muted-foreground">{filtered.length} entr{filtered.length === 1 ? "y" : "ies"}</p>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="max-h-[min(520px,60vh)] overflow-auto scrollbar-hide">
            <Table>
              <TableHeader>
                <TableRow>
                  {integrationActionsOnly ? (
                    <>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Related Run ID</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Run / Ref</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Performed by</TableHead>
                      <TableHead>Date / time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const hl =
                    !!initialRunFilter &&
                    (r.technicalRef === initialRunFilter ||
                      r.logId === initialRunFilter ||
                      String((r.entry.after as Record<string, unknown> | undefined)?.previousRunId ?? "") ===
                        initialRunFilter);
                  return integrationActionsOnly ? (
                    <TableRow
                      key={r.logId}
                      className={cn(hl && "bg-amber-500/12 dark:bg-amber-500/10")}
                    >
                      <TableCell className="text-sm">{r.actionLabel}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.performedBy}</div>
                        <div className="text-xs text-muted-foreground">{r.performedRole}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.technicalRef}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetail(r)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={r.logId}
                      className={cn(hl && "bg-amber-500/12 dark:bg-amber-500/10")}
                    >
                      <TableCell className="font-mono text-xs">
                        <span className="font-semibold">{r.displayRef}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground max-w-[140px]">
                          {r.technicalRef}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{r.actionLabel}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{r.performedBy}</div>
                        <div className="text-xs text-muted-foreground">{r.performedRole}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant(r.status)}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDetail(r)}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filtered.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No activity matches these filters.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto scrollbar-hide sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Activity details</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 text-sm">
              <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  General info
                </h3>
                <dl className="grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Display ref</dt>
                    <dd className="font-mono font-medium">{detail.displayRef}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Technical ID</dt>
                    <dd className="font-mono text-xs break-all">{detail.technicalRef}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Payroll period</dt>
                    <dd>{String(after?.periodLabel ?? "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Performed by</dt>
                    <dd>{detail.performedBy}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Role</dt>
                    <dd>{detail.performedRole}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Timestamp</dt>
                    <dd>{new Date(detail.timestamp).toLocaleString()}</dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-2 rounded-lg border border-border p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Action details
                </h3>
                <dl className="grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Action</dt>
                    <dd>{detail.actionLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Export type / format</dt>
                    <dd>{String(after?.format ?? "—")}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Template</dt>
                    <dd>{String(after?.template ?? "—")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Employees</dt>
                    <dd>{after?.employeeCount != null ? String(after.employeeCount) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Department scope</dt>
                    <dd>
                      {after?.departmentScopeId == null || after?.departmentScopeId === "ALL"
                        ? "All departments"
                        : String(after.departmentScopeId)}
                    </dd>
                  </div>
                  {after?.dataIncluded && typeof after.dataIncluded === "object" ? (
                    <div className="sm:col-span-2">
                      <dt className="text-muted-foreground">Data included</dt>
                      <dd className="text-xs">
                        {Object.entries(after.dataIncluded as Record<string, boolean>)
                          .filter(([, v]) => v)
                          .map(([k]) => k)
                          .join(", ") || "—"}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {(Array.isArray(after?.errors) && (after!.errors as unknown[]).length > 0) ||
              detail.entry.reason ? (
                <section className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-destructive">
                    Errors / warnings
                  </h3>
                  {detail.entry.reason ? (
                    <p className="text-sm text-muted-foreground">{detail.entry.reason}</p>
                  ) : null}
                  {Array.isArray(after?.errors) ? (
                    <ul className="list-inside list-disc text-sm text-muted-foreground">
                      {(after!.errors as string[]).map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                  {after?.warningsCount != null ? (
                    <p className="text-xs text-muted-foreground">
                      Validation warnings (count): {String(after.warningsCount)}
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section className="space-y-2 rounded-lg border border-border p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Output</h3>
                <p className="text-sm text-muted-foreground">
                  Export format: {String(after?.format ?? "—")}
                </p>
                {detail.entry.action === "PAYROLL_EXPORT_GENERATED" &&
                String(after?.status ?? "") !== "FAILED" ? (
                  <Button type="button" variant="outline" size="sm" disabled title="Demo — API would return file">
                    Download file
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">No file for this action type.</p>
                )}
              </section>

              <p className="text-xs text-muted-foreground">{detail.summary}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
