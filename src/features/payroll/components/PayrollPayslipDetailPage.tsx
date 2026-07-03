"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PayslipDocument } from "@/features/payroll/components/PayslipDocument";
import { getPayslipById } from "@/features/payroll/services/payroll-data";
import { logPayslipViewed } from "@/features/payroll/services/payrollAudit";
import { useCurrentUser } from "@/lib/CurrentUserContext";

export default function PayslipDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const { user } = useCurrentUser();
  const payslipId = params?.id as string | undefined;
  const data = payslipId ? getPayslipById(payslipId) : null;
  const from = sp.get("from");
  const mode = sp.get("mode");
  const keepMyPayslipMode = from === "my-payslips" || mode === "my-payslips";
  const backHref = `/payroll?tab=payslips${keepMyPayslipMode ? "&mode=my-payslips" : ""}`;

  useEffect(() => {
    if (!payslipId || !data) return;
    logPayslipViewed({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      payslipId,
      subjectDepartmentId: "dept-3",
    });
  }, [payslipId, data, user.employeeId, user.name, user.role]);

  if (!payslipId || !data) {
    return (
      <div className="space-y-4 p-4">
        <Button type="button" variant="ghost" onClick={() => router.push(backHref)}>
          <ArrowLeft className="mr-2 size-4" />
          Back to payslips
        </Button>
        <p className="text-sm text-muted-foreground">Payslip not found.</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full max-w-full space-y-2 py-2">
      <div className="flex flex-col gap-2 px-3 sm:flex-row sm:items-center sm:justify-between sm:px-0 print:hidden">
        <button
          type="button"
          onClick={() => router.push(backHref)}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          <span>Back to payslips</span>
        </button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Print
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            disabled
            title="Optional — PDF from API"
          >
            <Download className="size-4" />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 justify-center px-3 pb-2 sm:px-0">
        <Card className="w-full min-w-0 max-w-3xl bg-white text-slate-900 shadow-md print:shadow-none dark:bg-card dark:text-slate-100">
          <CardContent className="p-3 md:p-5">
            <p className="mb-3 text-sm text-muted-foreground print:hidden">Employee copy</p>
            <PayslipDocument data={data} periodCode={payslipId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
