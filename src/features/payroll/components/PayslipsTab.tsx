"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PAYSLIPS, getPayslipById, type PayslipListItem } from "@/features/payroll/services/payroll-data";
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
import { Download, Eye, Printer } from "lucide-react";

type PayslipsTabMode = "payslips" | "history";

type PayslipsTabProps = {
  mode?: PayslipsTabMode;
  /** When present, adds `?from=...` to back-link destination in the full page. */
  from?: string;
};

export function PayslipsTab({ mode = "payslips", from }: PayslipsTabProps) {
  const { user } = useCurrentUser();
  const [year, setYear] = useState("2025");
  const [month, setMonth] = useState<string>("ALL");
  const [half, setHalf] = useState<"ALL" | "first" | "second">("ALL");
  const [modalId, setModalId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return PAYSLIPS.filter((p) => {
      if (String(p.year) !== year) return false;
      if (month !== "ALL" && String(p.month) !== month) return false;
      if (half !== "ALL" && p.half !== half) return false;
      return true;
    });
  }, [year, month, half]);

  const detail = modalId ? getPayslipById(modalId) : null;

  useEffect(() => {
    if (!modalId) return;
    if (!getPayslipById(modalId)) return;
    logPayslipViewed({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      payslipId: modalId,
      subjectDepartmentId: "dept-3",
    });
  }, [modalId, user.employeeId, user.name, user.role]);

  const openModal = (id: string) => setModalId(id);
  const inMyPayslipMode = from === "my-payslips";
  const fromQuery = inMyPayslipMode
    ? `?from=${encodeURIComponent(from)}&mode=my-payslips`
    : from
      ? `?from=${encodeURIComponent(from)}`
      : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {mode === "payslips" ? "Payslips" : "Payslip History"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {mode === "payslips"
              ? "View your payslips only. Download PDF (optional) and Print (read-only demo)."
              : "List of past payslips. Filter by year/month/half-period (demo)."}
          </p>
        </div>
        {mode === "payslips" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Optional — connect to API"
            >
              Download all
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payslip history</CardTitle>
          <p className="text-sm text-muted-foreground">
            The list updates as you change payroll year, month, or pay period.
          </p>
        </CardHeader>
        <CardContent className="space-y-0 p-0 sm:space-y-0">
          <div className="border-b border-border/70 px-4 py-3 sm:px-6">
            <p className="mb-3 text-xs font-medium text-muted-foreground">Filters</p>
            <div className="flex flex-wrap items-end gap-3">
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
                  <TableHead>Pay period</TableHead>
                  <TableHead>Payroll date</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row: PayslipListItem) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.payPeriodLabel}</TableCell>
                    <TableCell>{row.payrollDate}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      ₱{row.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => openModal(row.id)}
                        >
                          <Eye className="size-3.5" />
                          View
                        </Button>
                        <Button type="button" size="sm" variant="ghost" asChild>
                          <Link href={`/payroll/payslips/${row.id}${fromQuery}`}>Full page</Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filtered.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground sm:px-0">
                No payslips for this filter.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!modalId} onOpenChange={(o) => !o && setModalId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-card print:max-w-none">
          <DialogHeader className="print:hidden">
            <DialogTitle>Payslip</DialogTitle>
          </DialogHeader>
          {detail && (
            <>
              <PayslipDocument data={detail} periodCode={modalId} />
              <div className="flex flex-wrap gap-2 border-t border-border pt-4 print:hidden">
                <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
                  <Link href={`/payroll/payslips/${modalId}${fromQuery}`}>
                    <Eye className="size-3.5" />
                    View details
                  </Link>
                </Button>
                {mode === "payslips" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => window.print()}
                    >
                      <Printer className="size-3.5" />
                      Print
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      disabled
                      title="Optional — connect to PDF from API"
                    >
                      <Download className="size-3.5" />
                      PDF
                    </Button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
