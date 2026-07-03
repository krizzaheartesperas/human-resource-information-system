"use client";

import { useMemo, useState } from "react";
import {
  PAYSLIPS,
  getPayslipById,
  type PayslipDetail,
  type PayslipListItem as PayslipListItemType,
} from "@/features/payroll/services/payroll-data";
import { employees, getDepartmentById, type Employee } from "@/lib/mock";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayslipDocument } from "@/features/payroll/components/PayslipDocument";
import { Eye } from "lucide-react";

type Row = {
  rowKey: string;
  employeeId: string;
  employeeName: string;
  payPeriodLabel: string;
  payrollDate: string;
  netPay: number;
  status: PayslipListItemType["status"];
  payslipPeriodId: string;
};

type TeamPayslipMockSeed = {
  employeeId: string;
  payslipPeriodId: string;
  netPay: number;
  status: PayslipListItemType["status"];
};

const TEAM_PAYSLIP_TABLE_MOCK: TeamPayslipMockSeed[] = [
  { employeeId: "emp-4", payslipPeriodId: "2025-02-p1", netPay: 17240, status: "Paid" },
  { employeeId: "emp-2", payslipPeriodId: "2025-02-p1", netPay: 28600, status: "Paid" },
  { employeeId: "emp-sa-1", payslipPeriodId: "2025-02-p1", netPay: 35200, status: "Processing" },
  { employeeId: "emp-4", payslipPeriodId: "2025-01-p2", netPay: 16880, status: "Paid" },
  { employeeId: "emp-2", payslipPeriodId: "2025-01-p2", netPay: 27950, status: "Paid" },
];

function hashToUnit(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1000;
  return h / 1000;
}

function buildAdjustedDetail(emp: Employee, periodId: string): PayslipDetail | null {
  const base = getPayslipById(periodId);
  if (!base) return null;
  const dept = getDepartmentById(emp.departmentId);
  const unit = hashToUnit(emp.id + ":" + periodId);
  const factor = 0.9 + unit * 0.2;
  const grossPay = Math.round(base.grossPay * factor);
  const totalDeductions = Math.round(base.totalDeductions * factor);
  const netPay = grossPay - totalDeductions;
  const ratioE = base.grossPay > 0 ? grossPay / base.grossPay : 1;
  const ratioD = base.totalDeductions > 0 ? totalDeductions / base.totalDeductions : 1;

  return {
    ...base,
    employeeName: `${emp.firstName} ${emp.lastName}`,
    employeeDisplayId: emp.employeeNumber,
    position: emp.jobTitle,
    department: dept?.name ?? base.department,
    dateHired: emp.startDate,
    grossPay,
    totalDeductions,
    netPay,
    netPayInWords: base.netPayInWords,
    earnings: base.earnings.map((e) => ({ ...e, amount: Math.round(e.amount * ratioE) })),
    deductions: base.deductions.map((d) => ({ ...d, amount: Math.round(d.amount * ratioD) })),
  };
}

export function DepartmentManagerTeamPayslipsTab() {
  const { user } = useCurrentUser();
  const [employeeFilter, setEmployeeFilter] = useState<string>("ALL");
  const [periodFilter, setPeriodFilter] = useState<string>("ALL");
  const [modal, setModal] = useState<{ employeeId: string; periodId: string } | null>(null);

  const teamEmployees = useMemo(
    () =>
      employees.filter(
        (e) => e.departmentId === user.departmentId && e.employmentStatus === "ACTIVE"
      ),
    [user.departmentId]
  );

  const rows = useMemo(() => {
    const teamIds = new Set(teamEmployees.map((e) => e.id));
    const periodById = new Map(PAYSLIPS.map((p) => [p.id, p] as const));
    const employeeById = new Map(employees.map((e) => [e.id, e] as const));

    // Use explicit mock seeds for stable demo table data.
    const seedsForScope =
      teamIds.size > 0
        ? TEAM_PAYSLIP_TABLE_MOCK.filter((r) => teamIds.has(r.employeeId))
        : TEAM_PAYSLIP_TABLE_MOCK;

    const scopedMockRows: Row[] = seedsForScope
      .map((seed, idx) => {
        const emp = employeeById.get(seed.employeeId);
        const period = periodById.get(seed.payslipPeriodId);
        if (!emp || !period) return null;
        return {
          rowKey: `mock-${idx}-${seed.employeeId}-${seed.payslipPeriodId}`,
          employeeId: seed.employeeId,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          payPeriodLabel: period.payPeriodLabel,
          payrollDate: period.payrollDate,
          netPay: seed.netPay,
          status: seed.status,
          payslipPeriodId: seed.payslipPeriodId,
        } satisfies Row;
      })
      .filter((r): r is Row => !!r);

    if (scopedMockRows.length > 0) return scopedMockRows;

    // Fallback generator when no mock seeds match the current team.
    const result: Row[] = [];
    for (const emp of teamEmployees) {
      for (const p of PAYSLIPS) {
        const base = getPayslipById(p.id);
        if (!base) continue;
        const unit = hashToUnit(emp.id + ":" + p.id);
        const factor = 0.9 + unit * 0.2;
        const grossPay = Math.round(base.grossPay * factor);
        const deductions = Math.round(base.totalDeductions * factor);
        result.push({
          rowKey: `${emp.id}:${p.id}`,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          payPeriodLabel: p.payPeriodLabel,
          payrollDate: p.payrollDate,
          netPay: grossPay - deductions,
          status: p.status,
          payslipPeriodId: p.id,
        });
      }
    }
    return result;
  }, [teamEmployees]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (employeeFilter !== "ALL" && r.employeeId !== employeeFilter) return false;
        if (periodFilter !== "ALL" && r.payslipPeriodId !== periodFilter) return false;
        return true;
      }),
    [rows, employeeFilter, periodFilter]
  );

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.employeeId, r.employeeName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const detail = useMemo(() => {
    if (!modal) return null;
    const emp = employees.find((e) => e.id === modal.employeeId);
    if (!emp) return null;
    return buildAdjustedDetail(emp, modal.periodId);
  }, [modal]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">Team Payslips</h2>
        <p className="text-sm text-muted-foreground">
          Department-only visibility. You can only view your team payslips.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Team payslip results</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-0 sm:p-6">
          <div className="grid gap-3 border-b border-border/70 px-4 py-3 sm:grid-cols-2 sm:px-0 sm:py-0 sm:pb-4">
            <label className="text-sm">
              <span className="text-muted-foreground">Employee</span>
              <select
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
              >
                <option value="ALL">All team members</option>
                {employeeOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-muted-foreground">Pay period</span>
              <select
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
              >
                <option value="ALL">All periods</option>
                {PAYSLIPS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.payPeriodLabel}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="overflow-x-auto px-0 pb-4 sm:px-0 sm:pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay Period</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.rowKey}>
                    <TableCell>{r.employeeName}</TableCell>
                    <TableCell>{r.payPeriodLabel}</TableCell>
                    <TableCell className="text-right">
                      P{r.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setModal({ employeeId: r.employeeId, periodId: r.payslipPeriodId })
                          }
                        >
                          <Eye className="mr-1 size-4" />
                          View Payslip
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No payslips found for your filters.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!modal}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Team Payslip Preview</DialogTitle>
          </DialogHeader>
          {detail ? <PayslipDocument data={detail} className="max-h-[70vh] overflow-auto scrollbar-hide" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

