"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PAYSLIPS,
  getPayslipById,
  type PayslipDetail,
  type PayslipListItem,
} from "@/features/payroll/services/payroll-data";
import { employees, departments, getDepartmentById, type Employee } from "@/lib/mock";
import { logPayslipViewed } from "@/features/payroll/services/payrollAudit";
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
import { Download, Eye, Mail, Printer } from "lucide-react";
import type { PayslipListItem as PayslipListItemType } from "@/features/payroll/services/payroll-data";

type Row = {
  rowKey: string;
  employeeId: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  payPeriodLabel: string;
  payrollDate: string;
  netPay: number;
  status: PayslipListItemType["status"];
  payslipPeriodId: string;
  year: number;
  month: number;
  half: PayslipListItemType["half"];
};

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
  const factor = 0.92 + unit * 0.24; // 0.92 .. 1.16

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
    // Demo only: keep words as-is.
    netPayInWords: base.netPayInWords,
    earnings: base.earnings.map((e) => ({ ...e, amount: Math.round(e.amount * ratioE) })),
    deductions: base.deductions.map((d) => ({ ...d, amount: Math.round(d.amount * ratioD) })),
  };
}

export function HrAllEmployeesPayslipsTab() {
  const { user } = useCurrentUser();

  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("ALL");
  const [year, setYear] = useState("2025");
  const [month, setMonth] = useState<string>("ALL");
  const [half, setHalf] = useState<"ALL" | "first" | "second">("ALL");
  const [modal, setModal] = useState<{ employeeId: string; periodId: string } | null>(null);

  const allActiveEmployees = useMemo(
    () => employees.filter((e) => e.employmentStatus === "ACTIVE"),
    []
  );

  const rows: Row[] = useMemo(() => {
    const result: Row[] = [];
    for (const emp of allActiveEmployees) {
      const dept = getDepartmentById(emp.departmentId);
      for (const p of PAYSLIPS) {
        const base = getPayslipById(p.id);
        if (!base) continue;
        const unit = hashToUnit(emp.id + ":" + p.id);
        const factor = 0.92 + unit * 0.24;
        const grossPay = Math.round(base.grossPay * factor);
        const totalDeductions = Math.round(base.totalDeductions * factor);
        const netPay = grossPay - totalDeductions;
        result.push({
          rowKey: `${emp.id}:${p.id}`,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          departmentId: emp.departmentId,
          departmentName: dept?.name ?? "—",
          payPeriodLabel: p.payPeriodLabel,
          payrollDate: p.payrollDate,
          netPay,
          status: p.status,
          payslipPeriodId: p.id,
          year: p.year,
          month: p.month,
          half: p.half,
        });
      }
    }
    return result;
  }, [allActiveEmployees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (departmentId !== "ALL" && r.departmentId !== departmentId) return false;
      if (String(r.year) !== year) return false;
      if (month !== "ALL" && String(r.month) !== month) return false;
      if (half !== "ALL" && r.half !== half) return false;
      if (q) {
        return (
          r.employeeName.toLowerCase().includes(q) ||
          r.employeeId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, search, departmentId, year, month, half]);

  const detail = useMemo(() => {
    if (!modal) return null;
    const emp = employees.find((e) => e.id === modal.employeeId);
    if (!emp) return null;
    return buildAdjustedDetail(emp, modal.periodId);
  }, [modal]);

  useEffect(() => {
    if (!modal || !detail) return;
    if (!employees.find((e) => e.id === modal.employeeId)) return;
    const emp = employees.find((e) => e.id === modal.employeeId);
    if (!emp) return;
    logPayslipViewed({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      payslipId: modal.periodId,
      subjectDepartmentId: emp.departmentId,
      summary: `${user.name} viewed HR payslip for ${emp.firstName} ${emp.lastName}.`,
    });
  }, [modal, detail, user.employeeId, user.name, user.role]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Payslips (All Employees)</h2>
          <p className="text-sm text-muted-foreground">
            View all employee payslips (read-only demo). Filter by department and pay period.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payslip directory</CardTitle>
          <p className="text-sm text-muted-foreground">
            HR view: view payslips across employees, export-ready preview.
          </p>
        </CardHeader>
        <CardContent className="space-y-0 p-0 sm:space-y-0">
          <div className="border-b border-border/70 px-4 py-3 sm:px-6">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Filters</p>
            <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
              <label className="text-sm lg:min-w-[220px]">
                <span className="text-muted-foreground">Employee search</span>
                <input
                  type="search"
                  placeholder="Name or employee #"
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">Department</span>
                <select
                  className="mt-1 block min-w-44 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">Payroll year</span>
                <select
                  className="mt-1 block min-w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                >
                  <option value="2025">2025</option>
                  <option value="2026">2026</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">Month</span>
                <select
                  className="mt-1 block min-w-36 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                >
                  <option value="ALL">All months</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={String(m)}>
                      {new Date(2000, m - 1).toLocaleString("en", { month: "long" })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">Pay period</span>
                <select
                  className="mt-1 block min-w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={half}
                  onChange={(e) => setHalf(e.target.value as typeof half)}
                >
                  <option value="ALL">Full month</option>
                  <option value="first">1st half (1–15)</option>
                  <option value="second">2nd half (16–end)</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto px-0 pb-4 sm:px-6 sm:pb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Pay period</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.rowKey}>
                    <TableCell>
                      <div className="font-medium">{r.employeeName}</div>
                      <div className="text-xs text-muted-foreground">{r.departmentName}</div>
                    </TableCell>
                    <TableCell>
                      <div>{r.payPeriodLabel}</div>
                      <div className="text-xs text-muted-foreground">{r.payrollDate}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      ₱{r.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => setModal({ employeeId: r.employeeId, periodId: r.payslipPeriodId })}
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled
                          title="Download optional (demo)"
                        >
                          <Download className="size-3.5" />
                          Download
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled
                          title="Optional — connect to email / API"
                        >
                          <Mail className="size-3.5" />
                          Send
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-0">
                No payslips match these filters.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-card print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Payslip (HR read-only)</DialogTitle>
          </DialogHeader>
          {detail && modal && (
            <>
              <PayslipDocument data={detail} periodCode={modal.periodId} />
              <div className="flex flex-wrap gap-2 border-t border-border pt-4 print:hidden">
                <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
                  <Printer className="size-3.5" />
                  Print
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-1" disabled title="Optional — PDF from API">
                  <Download className="size-3.5" />
                  Download PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

