import { Suspense } from "react";
import PayrollPageClient from "@/features/payroll/components/PayrollPageClient";

export default function PayrollPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading payroll…</div>
      }
    >
      <PayrollPageClient />
    </Suspense>
  );
}
