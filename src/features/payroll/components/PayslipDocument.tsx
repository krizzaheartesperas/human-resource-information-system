"use client";

import Image from "next/image";
import type { PayslipDetail } from "@/features/payroll/services/payroll-data";
import { cn } from "@/lib/utils";

type Props = {
  data: PayslipDetail;
  periodCode?: string | null;
  className?: string;
};

export function PayslipDocument({ data, periodCode, className }: Props) {
  return (
    <div
      className={cn(
        "space-y-3 text-[11px] md:text-xs leading-snug text-slate-900 dark:text-slate-100",
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-slate-200 pb-2 dark:border-slate-700">
        <div className="relative h-8 w-8 shrink-0">
          <Image
            src="/newlogo.png"
            alt={`${data.companyName} logo`}
            fill
            sizes="40px"
            className="rounded-md object-contain bg-slate-100"
          />
        </div>
        <div className="space-y-0.5">
          <h1 className="text-lg font-semibold">Payslip – {data.payPeriodTitle}</h1>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            <p className="font-medium">{data.companyName}</p>
            <p>{data.companyAddress}</p>
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold">Employee details</h2>
        <div className="grid gap-y-1 gap-x-8 text-xs sm:grid-cols-2">
          <p>
            <span className="font-medium">Name:</span> {data.employeeName}
          </p>
          <p>
            <span className="font-medium">Employee ID:</span> {data.employeeDisplayId}
          </p>
          <p>
            <span className="font-medium">Position:</span> {data.position}
          </p>
          <p>
            <span className="font-medium">Department:</span> {data.department}
          </p>
          <p>
            <span className="font-medium">Date hired:</span> {data.dateHired}
          </p>
          <p>
            <span className="font-medium">Pay period:</span> {data.payPeriodTitle}{" "}
            {periodCode ? <span className="text-muted-foreground">({periodCode})</span> : null}
          </p>
          <p>
            <span className="font-medium">Cut-off:</span> {data.cutoffLabel}
          </p>
          <p>
            <span className="font-medium">Worked days:</span> {data.workedDays}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
        <h2 className="mb-2 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
          Earnings
        </h2>
        <div className="overflow-hidden rounded-md border border-emerald-200/60 text-[10px] dark:border-emerald-800/60">
          <div className="grid grid-cols-[2fr,1fr] bg-emerald-100/80 font-medium dark:bg-emerald-900/40">
            <div className="border-r border-emerald-200 px-2 py-1 dark:border-emerald-800">
              Component
            </div>
            <div className="px-2 py-1 text-right">Amount (₱)</div>
          </div>
          {data.earnings.map((row) => (
            <div key={row.label} className="grid grid-cols-[2fr,1fr] border-t border-emerald-100 dark:border-emerald-900/50">
              <div className="border-r border-emerald-100 px-2 py-0.5 dark:border-emerald-900/50">
                {row.label}
              </div>
              <div className="px-2 py-0.5 text-right tabular-nums">
                {row.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[2fr,1fr] border-t border-emerald-200 bg-emerald-50/80 font-medium dark:border-emerald-800 dark:bg-emerald-900/30">
            <div className="border-r border-emerald-200 px-2 py-1 dark:border-emerald-800">Gross pay</div>
            <div className="px-2 py-1 text-right tabular-nums">
              {data.grossPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 dark:bg-rose-950/20">
        <h2 className="mb-2 text-sm font-semibold text-rose-800 dark:text-rose-200">Deductions</h2>
        <div className="overflow-hidden rounded-md border border-rose-200/60 text-[10px] dark:border-rose-800/60">
          <div className="grid grid-cols-[2fr,1fr] bg-rose-100/80 font-medium dark:bg-rose-900/40">
            <div className="border-r border-rose-200 px-2 py-1 dark:border-rose-800">Component</div>
            <div className="px-2 py-1 text-right">Amount (₱)</div>
          </div>
          {data.deductions.map((row) => (
            <div key={row.label} className="grid grid-cols-[2fr,1fr] border-t border-rose-100 dark:border-rose-900/50">
              <div className="border-r border-rose-100 px-2 py-0.5 dark:border-rose-900/50">{row.label}</div>
              <div className="px-2 py-0.5 text-right tabular-nums">
                {row.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[2fr,1fr] border-t border-rose-200 bg-rose-50/80 font-medium dark:border-rose-800 dark:bg-rose-900/30">
            <div className="border-r border-rose-200 px-2 py-1 dark:border-rose-800">Total deductions</div>
            <div className="px-2 py-1 text-right tabular-nums">
              {data.totalDeductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <h2 className="text-sm font-semibold">Summary</h2>
        <div className="mt-2 space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Gross pay:</span>{" "}
            <span className="tabular-nums font-medium">
              ₱{data.grossPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Total deductions:</span>{" "}
            <span className="tabular-nums font-medium">
              ₱{data.totalDeductions.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-base">
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Net pay:</span>{" "}
            <span className="tabular-nums font-bold">
              ₱{data.netPay.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">In words:</span> {data.netPayInWords}
          </p>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        This is a system-generated payslip. No signature required.
      </p>
    </div>
  );
}
