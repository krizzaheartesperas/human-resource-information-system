"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PAYROLL_PERIOD_OPTIONS,
  getPayrollPreviewRows,
  type PayrollPeriodOption,
} from "@/features/payroll/services/payroll-data";
import { departments, employees } from "@/lib/mock";
import {
  loadExportRuns,
  saveExportRun,
  seedExportRunsIfEmpty,
  type PayrollExportRun,
} from "@/features/payroll/services/payrollExportRuns";
import {
  logPayrollExportGenerated,
  logPayrollExportFailed,
  logPayrollDataValidated,
  logPayrollRerunExport,
} from "@/features/payroll/services/payrollAudit";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getPortalPaths } from "@/core/routes/portal-routes";
import type { Role } from "@/lib/mock";
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
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileDown,
  ListOrdered,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ExportStep = "prepare" | "validate" | "preview" | "generate" | "results";

const steps: { id: ExportStep; label: string }[] = [
  { id: "prepare", label: "Prepare Export" },
  { id: "validate", label: "Validate Data" },
  { id: "preview", label: "Preview Data" },
  { id: "generate", label: "Generate Export" },
  { id: "results", label: "Export Results" },
];

function canGenerateExport(role: Role): boolean {
  return (
    role === "HR_ADMIN" ||
    role === "HR_STAFF" ||
    role === "HR_MANAGER" ||
    role === "SUPER_ADMIN" ||
    role === "DEPARTMENT_MANAGER"
  );
}

type Props = {
  initialStep?: ExportStep;
  onStepChange?: (step: ExportStep) => void;
};

export function PayrollExportWizard({ initialStep = "prepare", onStepChange }: Props) {
  const { user } = useCurrentUser();
  const paths = useMemo(() => getPortalPaths(user.role), [user.role]);
  const [step, setStep] = useState<ExportStep>(initialStep);
  const [period, setPeriod] = useState<PayrollPeriodOption>(PAYROLL_PERIOD_OPTIONS[0]!);
  const [departmentId, setDepartmentId] = useState<string>("ALL");
  const [scopeType, setScopeType] = useState<"DEPARTMENT" | "EMPLOYEE">("DEPARTMENT");
  const [scopeEmployeeId, setScopeEmployeeId] = useState<string>("ALL");
  const [employmentFilter, setEmploymentFilter] = useState<
    "ACTIVE" | "ONBOARDING" | "OFFBOARDED"
  >("ACTIVE");
  const [template, setTemplate] = useState("Default PH Payroll");
  const [mappingVersion, setMappingVersion] = useState("MAP-v1.0");
  const [format, setFormat] = useState<"CSV" | "Excel" | "JSON">("Excel");
  const [include, setInclude] = useState({
    compensation: true,
    allowances: true,
    overtime: true,
    attendance: true,
    leaveSummary: true,
    deductions: true,
    adjustments: true,
  });

  const [validationRun, setValidationRun] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [runs, setRuns] = useState<PayrollExportRun[]>([]);
  const [lastRun, setLastRun] = useState<PayrollExportRun | null>(null);
  const [generating, setGenerating] = useState(false);
  const [detailRun, setDetailRun] = useState<PayrollExportRun | null>(null);
  const [rerunFromId, setRerunFromId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const rerunFromIdParam = searchParams.get("rerun");

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  useEffect(() => {
    seedExportRunsIfEmpty();
    setRuns(loadExportRuns());
  }, []);

  useEffect(() => {
    if (!rerunFromIdParam) {
      setRerunFromId(null);
      return;
    }

    // Prefill prepare step from a previous export run (demo).
    seedExportRunsIfEmpty();
    const prev = loadExportRuns().find((r) => r.id === rerunFromIdParam);
    if (prev) {
      const matchedPeriod = PAYROLL_PERIOD_OPTIONS.find(
        (o) => o.start === prev.periodStart && o.end === prev.periodEnd
      );
      if (matchedPeriod) setPeriod(matchedPeriod);
      setTemplate(prev.template);
      setFormat(prev.format);
      setMappingVersion(prev.mappingVersion);
    }
    setRerunFromId(rerunFromIdParam);
  }, [rerunFromIdParam]);

  const go = (s: ExportStep) => {
    setStep(s);
    onStepChange?.(s);
  };

  const isHrStaffIntegrationView = user.role === "HR_STAFF";

  const isPeriodCutoffValid = useMemo(() => {
    const start = new Date(period.start).getTime();
    const end = new Date(period.end).getTime();
    return Number.isFinite(start) && Number.isFinite(end) && start <= end;
  }, [period.start, period.end]);

  const validation = useMemo(() => {
    const checklist = {
      // Demo checklist: shows what BRD expects without implementing full approval workflows.
      attendanceComplete: true,
      leavesApproved: true,
      overtimeApproved: true,
      employeeDataComplete: true,
      compensationConfigured: true,
    };
    const warnings = [
      "Pending approvals warning (BRD requirement)",
      "Missing data detection (BRD requirement): attendance",
    ];
    const blocking: string[] = [];
    if (!isPeriodCutoffValid) {
      blocking.push("Only valid period data may be included (BRD period validation)");
    }
    if (!checklist.attendanceComplete) {
      blocking.push("Cannot export: Missing required approved data (BRD approved-only)");
    }
    return { checklist, warnings, blocking, passed: blocking.length === 0 };
  }, [isPeriodCutoffValid]);

  const previewRows = useMemo(() => getPayrollPreviewRows(), []);
  const scopedPreviewRows = useMemo(() => {
    let rows = previewRows;
    if (scopeType === "EMPLOYEE" && scopeEmployeeId !== "ALL") {
      rows = rows.filter((r) => r.employeeId === scopeEmployeeId);
    }
    return rows;
  }, [previewRows, scopeType, scopeEmployeeId]);

  const scopedEmployeeCount = scopedPreviewRows.length;

  const previewEmployeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of previewRows) map.set(r.employeeId, r.name);
    return [
      { id: "ALL", label: "All employees" },
      ...Array.from(map.entries()).map(([id, label]) => ({ id, label })),
    ];
  }, [previewRows]);

  const filteredPreview = useMemo(() => {
    const q = previewSearch.trim().toLowerCase();
    if (!q) return scopedPreviewRows;
    return scopedPreviewRows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.employeeId.toLowerCase().includes(q)
    );
  }, [scopedPreviewRows, previewSearch]);

  const deptScope =
    scopeType === "DEPARTMENT" ? (departmentId === "ALL" ? null : departmentId) : null;

  const handleGenerate = () => {
    if (!canGenerateExport(user.role)) {
      logPayrollExportFailed({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        reason: "Insufficient permissions for payroll export",
        periodLabel: period.label,
        departmentScopeId: deptScope,
      });
      return;
    }
    if (!validation.passed) {
      logPayrollExportFailed({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        reason: "Validation did not pass",
        periodLabel: period.label,
        departmentScopeId: deptScope,
      });
      return;
    }

    if (rerunFromId) {
      logPayrollRerunExport({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        previousRunId: rerunFromId,
        periodLabel: period.label,
      });
      setRerunFromId(null);
    }
    setGenerating(true);
    window.setTimeout(() => {
      const status: "SUCCESS" | "PARTIAL" =
        validation.warnings.length > 0 ? "PARTIAL" : "SUCCESS";
      const errors =
        status === "PARTIAL"
          ? ["Employee HR-005 missing tax info", "Partial export due to failed records"]
          : undefined;
      const run = saveExportRun({
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        generatedBy: user.name,
        generatedById: user.id,
        status,
        mappingVersion,
        format,
        template,
        employeeCount: scopedEmployeeCount,
        errors,
      });
      logPayrollExportGenerated({
        actorId: user.employeeId,
        actorName: user.name,
        actorRole: user.role,
        runId: run.id,
        periodLabel: period.label,
        format,
        template,
        employeeCount: scopedEmployeeCount,
        status,
        errors,
        departmentScopeId: deptScope,
        dataIncluded: isHrStaffIntegrationView
          ? {
              compensation: include.compensation,
              attendance: include.attendance,
              leaveSummary: include.leaveSummary,
              adjustments: include.adjustments,
            }
          : { ...include },
      });
      setLastRun(run);
      setRuns(loadExportRuns());
      setGenerating(false);
      go("results");
    }, 900);
  };

  const activityHref = "/payroll?tab=activity";
  const activityRunHref = (runId: string) =>
    `/payroll?tab=activity&run=${encodeURIComponent(runId)}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={activityHref}>
            <ListOrdered className="mr-2 size-4" />
            View export logs
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 border-b border-border/70 pb-1">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => go(s.id)}
            className={cn(
              "relative rounded-md px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
              step === s.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {step === "prepare" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prepare export</CardTitle>
            <p className="text-sm text-muted-foreground">
              Select period, scope, template, and what to include in the payroll file.
            </p>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Payroll period</h3>
              <label className="block text-xs text-muted-foreground">Payroll period</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={period.value}
                onChange={(e) => {
                  const opt = PAYROLL_PERIOD_OPTIONS.find((o) => o.value === e.target.value);
                  if (opt) setPeriod(opt);
                }}
              >
                {PAYROLL_PERIOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Cutoff start</span>
                  <p className="font-medium">{period.start}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Cutoff end</span>
                  <p className="font-medium">{period.end}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Data scope</h3>
              {isHrStaffIntegrationView && (
                <>
                  <label className="block text-xs text-muted-foreground">
                    Employee / Department
                  </label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={scopeType}
                    onChange={(e) =>
                      setScopeType(e.target.value as typeof scopeType)
                    }
                  >
                    <option value="DEPARTMENT">Department</option>
                    <option value="EMPLOYEE">Employee</option>
                  </select>
                </>
              )}

              {(!isHrStaffIntegrationView || scopeType === "DEPARTMENT") && (
                <>
                  <label className="block text-xs text-muted-foreground">Department</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                  >
                    <option value="ALL">All departments</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {isHrStaffIntegrationView && scopeType === "EMPLOYEE" && (
                <>
                  <label className="block text-xs text-muted-foreground">Employee</label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={scopeEmployeeId}
                    onChange={(e) => setScopeEmployeeId(e.target.value)}
                  >
                    {previewEmployeeOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label className="block text-xs text-muted-foreground">Employment status</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={employmentFilter}
                onChange={(e) =>
                  setEmploymentFilter(e.target.value as typeof employmentFilter)
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="OFFBOARDED">Offboarded</option>
              </select>
            </div>

            <div className="space-y-3 md:col-span-2">
              <h3 className="text-sm font-semibold">Field mapping &amp; export format</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-muted-foreground">Mapping version</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={mappingVersion}
                    onChange={(e) => setMappingVersion(e.target.value)}
                  >
                    <option value="MAP-v1.0">MAP-v1.0</option>
                    <option value="MAP-v1.1">MAP-v1.1</option>
                    <option value="MAP-v2.0">MAP-v2.0</option>
                  </select>

                  <div className="mt-3 rounded-md border border-border/60 bg-muted/20 p-3">
                    <h4 className="mb-2 text-xs font-semibold text-muted-foreground">
                      HRIS Field → Payroll Field mapping
                    </h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>Compensation → Earnings</li>
                      <li>Attendance Summary → Worked Days</li>
                      <li>Leave Summary → Leaves</li>
                      <li>Approved Adjustments → Adjustments</li>
                    </ul>
                  </div>

                  <label className="block mt-3 text-xs text-muted-foreground">Template</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                  >
                    <option>Default PH Payroll</option>
                    <option>Custom Template</option>
                    <option>Accounting Export</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground">Format</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as typeof format)}
                  >
                    <option value="CSV">CSV</option>
                    <option value="Excel">Excel</option>
                    <option value="JSON">JSON</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <h3 className="text-sm font-semibold">Data inclusion</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  isHrStaffIntegrationView
                    ? ([
                        ["compensation", "Compensation"],
                        ["attendance", "Attendance Summary"],
                        ["leaveSummary", "Leave Summary"],
                        ["adjustments", "Approved Adjustments"],
                      ] as const)
                    : ([
                        ["compensation", "Compensation"],
                        ["allowances", "Allowances"],
                        ["overtime", "Overtime"],
                        ["attendance", "Attendance"],
                        ["leaveSummary", "Leave summary"],
                        ["deductions", "Deductions"],
                        ["adjustments", "Adjustments"],
                      ] as const)
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={include[key]}
                      onChange={(e) =>
                        setInclude((prev) => ({ ...prev, [key]: e.target.checked }))
                      }
                      className="rounded border-input"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end md:col-span-2">
              <Button type="button" onClick={() => go("validate")}>
                Continue to validation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "validate" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Validate data</CardTitle>
            <p className="text-sm text-muted-foreground">
              Approved data only: include only approved and effective payroll inputs. Pending approvals and missing data are shown below as warnings.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Validation checklist
              </h3>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Attendance complete
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Leaves approved
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Overtime approved
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Employee data complete
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-600" /> Compensation configured
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="size-4" />
                Validation warnings
              </h3>
              <ul className="list-inside list-disc text-sm text-amber-900/90 dark:text-amber-100/90">
                {validation.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>

            {validation.blocking.length > 0 && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
                <h3 className="mb-1 text-sm font-semibold text-destructive">Blocking errors</h3>
                <ul className="list-inside list-disc text-sm">
                  {validation.blocking.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setValidationRun(true);
                  logPayrollDataValidated({
                    actorId: user.employeeId,
                    actorName: user.name,
                    actorRole: user.role,
                    periodLabel: period.label,
                    warningsCount: validation.warnings.length,
                    passed: validation.passed,
                    departmentScopeId: deptScope,
                  });
                }}
              >
                Run validation
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href={paths.requests}>Fix issues (requests)</Link>
              </Button>
            </div>
            {validationRun && (
              <p className="text-sm text-muted-foreground">
                Validation finished — checklist passed with warnings only.
              </p>
            )}
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => go("prepare")}>
                Back
              </Button>
              <Button type="button" onClick={() => go("preview")} disabled={!validation.passed}>
                Continue to preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Preview data</CardTitle>
              <p className="text-sm text-muted-foreground">
                Payroll-ready rows before export (demo includes Glean Ramos).
              </p>
            </div>
            <input
              type="search"
              placeholder="Search employee…"
              value={previewSearch}
              onChange={(e) => setPreviewSearch(e.target.value)}
              className="w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-64"
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[min(420px,50vh)] overflow-auto scrollbar-hide rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Basic</TableHead>
                    <TableHead className="text-right">OT</TableHead>
                    <TableHead className="text-right">Allow.</TableHead>
                    <TableHead className="text-right">Deduct.</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPreview.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-mono text-xs">{row.employeeId}</TableCell>
                      <TableCell>{row.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.basicPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          row.flags?.includes("zero") && "bg-amber-500/15"
                        )}
                      >
                        {row.overtime.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.allowances.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {row.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {row.flags?.map((f) => (
                            <Badge key={f} variant="outline" className="text-[10px] capitalize">
                              {f}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between">
              <Button type="button" variant="ghost" onClick={() => go("validate")}>
                Back
              </Button>
              <Button type="button" onClick={() => go("generate")}>
                Continue to generate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "generate" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p>
                <span className="text-muted-foreground">Payroll period:</span>{" "}
                <span className="font-medium">{period.label}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Employee count:</span>{" "}
                <span className="font-medium">{scopedEmployeeCount}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Template:</span>{" "}
                <span className="font-medium">{template}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Format:</span>{" "}
                <span className="font-medium">{format}</span>
              </p>
            </div>

            {validation.warnings.length > 0 && (
              <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                <AlertTriangle className="size-4 shrink-0" />
                Some employees have pending adjustments. Export may be partial.
              </div>
            )}

            {!canGenerateExport(user.role) && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Your role cannot generate payroll exports. This attempt would be logged.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="lg"
                className="gap-2"
                disabled={generating || !validation.passed || !canGenerateExport(user.role)}
                onClick={handleGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <FileDown className="size-4" />
                    Generate export
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => go("preview")}>
                Cancel
              </Button>
            </div>

            {lastRun && (
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <p className="font-medium text-emerald-800 dark:text-emerald-200">
                  Last run: {lastRun.id} — {lastRun.status}
                </p>
              </div>
            )}

            <div className="flex justify-start">
              <Button type="button" variant="ghost" onClick={() => go("preview")}>
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "results" && (
        <Card>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Export results</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track downloads and open Payroll Activity Logs for payroll-only traceability.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={activityHref}>
                <ListOrdered className="mr-2 size-4" />
                View export logs
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-[min(400px,45vh)] overflow-auto scrollbar-hide rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run ID</TableHead>
                    <TableHead>Period</TableHead>
                    {isHrStaffIntegrationView ? <TableHead>Mapping Version</TableHead> : null}
                    <TableHead>Generated by</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{r.periodLabel}</TableCell>
                      {isHrStaffIntegrationView ? <TableCell>{r.mappingVersion}</TableCell> : null}
                      <TableCell>{r.generatedBy}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "SUCCESS"
                              ? "default"
                              : r.status === "PARTIAL"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setDetailRun(r)}
                          >
                            <Eye className="mr-1 size-3.5" />
                            Details
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            title="Demo: file would download from API"
                            onClick={() => {
                              /* demo — backend would stream file */
                            }}
                          >
                            <FileDown className="mr-1 size-3.5" />
                            Download
                          </Button>
                          <Button type="button" variant="ghost" size="sm" className="h-8" asChild>
                            <Link href={activityRunHref(r.id)}>View activity</Link>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              logPayrollRerunExport({
                                actorId: user.employeeId,
                                actorName: user.name,
                                actorRole: user.role,
                                previousRunId: r.id,
                                periodLabel: period.label,
                              });
                              go("prepare");
                            }}
                          >
                            <RefreshCw className="mr-1 size-3.5" />
                            Re-run
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {detailRun && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">Export details</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDetailRun(null)}>
                    Close
                  </Button>
                </div>
                <dl className="grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Run ID</dt>
                    <dd className="font-mono">{detailRun.id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Payroll period</dt>
                    <dd>{detailRun.periodLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Employee count</dt>
                    <dd>{detailRun.employeeCount}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">File format</dt>
                    <dd>{detailRun.format}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd>{detailRun.status}</dd>
                  </div>
                </dl>
                {detailRun.errors && detailRun.errors.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-1 font-medium text-destructive">Error logs</p>
                    <ul className="list-inside list-disc text-muted-foreground">
                      {detailRun.errors.map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <Link href={activityRunHref(detailRun.id)}>View activity for this run</Link>
                  </Button>
                </div>
              </div>
            )}

            <Button type="button" variant="outline" onClick={() => go("generate")}>
              Back to generate
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
