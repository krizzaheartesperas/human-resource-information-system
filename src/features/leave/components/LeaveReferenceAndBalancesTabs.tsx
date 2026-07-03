"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays } from "lucide-react";
import { leaveTypeMetadata, type TimeOffType } from "@/lib/mock";
import { formatLeaveType } from "@/features/leave/utils/leaveFormatting";

type BalanceRow = {
  type: TimeOffType;
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  balanceDays: number;
};

type EmployeeBalances = {
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  rows: BalanceRow[];
};

type Props = {
  theme: string;
  currentUser: {
    name: string;
    employeeNumber?: string;
  };
  myBalanceRows: BalanceRow[];
  companyBalanceByEmployee: EmployeeBalances[];
};

export function LeaveReferenceAndBalancesTabs({
  theme,
  currentUser,
  myBalanceRows,
  companyBalanceByEmployee,
}: Props) {
  return (
    <>
      <TabsContent value="reference" className="space-y-4">
        <Card
          className={`h-[83vh] min-h-[480px] flex flex-col pt-1 pb-2 rounded-[32px] border-none shadow-sm ${
            theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
          }`}
        >
          <CardContent className="pt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div
              className={`mt-2 rounded-md border-none flex-1 min-h-0 overflow-auto scrollbar-hide p-0 ${
                theme === "dark" ? "bg-[#1B223D]" : "bg-white"
              }`}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-accent hover:bg-accent text-accent-foreground cursor-default [&>th:first-child]:rounded-tl-md [&>th:last-child]:rounded-tr-md">
                    <TableHead className="text-accent-foreground font-semibold">Leave type</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Paid or Unpaid</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Salary status</TableHead>
                    <TableHead className="text-accent-foreground font-semibold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(Object.entries(leaveTypeMetadata) as [TimeOffType, typeof leaveTypeMetadata[TimeOffType]][]).map(([type, meta]) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{meta.label}</TableCell>
                      <TableCell>{meta.paid ? "Paid" : "Unpaid"}</TableCell>
                      <TableCell className="text-muted-foreground">{meta.salaryStatus}</TableCell>
                      <TableCell className="text-muted-foreground">{meta.notes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="balances" className="space-y-4">
        <Card
          className={`h-[83vh] min-h-[480px] flex flex-col pt-1 pb-2 rounded-[32px] border-none shadow-sm ${
            theme === "dark" ? "bg-[#1B223D] text-slate-50" : "bg-white text-[#192853]"
          }`}
        >
          <CardHeader className="py-3">
            <CardTitle className="text-base">Leave balances</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your leave balances by leave type. Total, used, pending, and remaining days.
            </p>
          </CardHeader>
          <CardContent className="pt-6 flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="rounded-md border border-border flex-1 min-h-0 overflow-auto scrollbar-hide p-0">
              <div className="space-y-2 p-4 pt-5">
                <div className="flex items-center">
                  <div className="inline-flex items-center gap-2 rounded-md bg-[#FEE100] px-3 py-1.5 text-[#2C2E60] shadow-sm">
                    <CalendarDays className="size-4 text-[#2C2E60]" />
                    <span className="text-[15px] font-semibold leading-none">{currentUser.name}</span>
                    <span className="text-[13px] font-medium opacity-80 leading-none">
                      ({currentUser.employeeNumber ?? "-"})
                    </span>
                  </div>
                </div>
                <Table scrollable={false}>
                  <TableHeader>
                    <TableRow className="sticky top-0 z-10 bg-accent hover:bg-accent text-accent-foreground border-border [&>th:first-child]:rounded-tl-lg [&>th:last-child]:rounded-tr-lg shadow-[0_1px_0_0_var(--border)]">
                      <TableHead className="text-accent-foreground font-semibold">Leave type</TableHead>
                      <TableHead className="text-accent-foreground font-semibold text-right">Total</TableHead>
                      <TableHead className="text-accent-foreground font-semibold text-right">Used</TableHead>
                      <TableHead className="text-accent-foreground font-semibold text-right">Pending</TableHead>
                      <TableHead className="text-accent-foreground font-semibold text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Object.keys(leaveTypeMetadata) as TimeOffType[]).map((type) => {
                      const b = myBalanceRows.find((r) => r.type === type);
                      const total = b?.totalDays ?? 0;
                      const used = b?.usedDays ?? 0;
                      const pending = b?.pendingDays ?? 0;
                      const balance = b?.balanceDays ?? 0;
                      const consumed = used + pending;
                      const pct = total > 0 ? Math.min(100, Math.round((consumed / total) * 100)) : 0;
                      return (
                        <TableRow key={type}>
                          <TableCell>
                            <div className="space-y-1">
                              <div>{formatLeaveType(type)}</div>
                              {total > 0 && (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[11px] text-muted-foreground">
                                    <span>Used {used + pending} / {total} days</span>
                                    <span>{balance} remaining</span>
                                  </div>
                                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full bg-primary transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{total}</TableCell>
                          <TableCell className="text-right">{used}</TableCell>
                          <TableCell className="text-right">{pending}</TableCell>
                          <TableCell className={`text-right font-medium ${balance > 0 ? "text-primary" : ""}`}>
                            {balance}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="employee-balances" className="space-y-4">
        <Card className="pt-1 pb-2 min-h-[72vh]">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Employee Balances</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Leave balances by employee. Total, used, pending, and remaining days per leave type.
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="rounded-md border border-border h-[62vh] min-h-[62vh] overflow-auto scrollbar-hide p-0">
              {companyBalanceByEmployee.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No leave balances found.
                </p>
              ) : (
                <div className="space-y-6">
                  {companyBalanceByEmployee.map(({ employeeId, employeeName, employeeNumber, rows }) => (
                    <div key={employeeId} className="space-y-2">
                      <div className="flex items-center">
                        <div className="inline-flex items-center gap-2 rounded-md bg-[#FEE100] px-3 py-1.5 text-[#2C2E60] shadow-sm">
                          <CalendarDays className="size-4 text-[#2C2E60]" />
                          <span className="text-[15px] font-semibold leading-none">{employeeName}</span>
                          <span className="text-[13px] font-medium opacity-80 leading-none">
                            ({employeeNumber || employeeId})
                          </span>
                        </div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Leave type</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Used</TableHead>
                            <TableHead className="text-right">Pending</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(Object.keys(leaveTypeMetadata) as TimeOffType[]).map((type) => {
                            const b = rows.find((r) => r.type === type);
                            const total = b?.totalDays ?? 0;
                            const used = b?.usedDays ?? 0;
                            const pending = b?.pendingDays ?? 0;
                            const balance = b?.balanceDays ?? 0;
                            return (
                              <TableRow key={type}>
                                <TableCell>{formatLeaveType(type)}</TableCell>
                                <TableCell className="text-right">{total}</TableCell>
                                <TableCell className="text-right">{used}</TableCell>
                                <TableCell className="text-right">{pending}</TableCell>
                                <TableCell className="text-right font-medium text-primary">
                                  {balance}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}
