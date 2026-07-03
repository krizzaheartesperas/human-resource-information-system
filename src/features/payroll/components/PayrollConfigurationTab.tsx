"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logPayrollConfigUpdated } from "@/features/payroll/services/payrollAudit";
import { useCurrentUser } from "@/lib/CurrentUserContext";

export function PayrollConfigurationTab() {
  const { user } = useCurrentUser();
  const [mapping, setMapping] = useState({
    basicField: "basic_salary",
    otField: "overtime_amount",
    allowanceField: "allowances_total",
    taxField: "withholding_tax",
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const before = { mapping: "previous" };
    const after = { ...mapping };
    logPayrollConfigUpdated({
      actorId: user.employeeId,
      actorName: user.name,
      actorRole: user.role,
      field: "Export field mapping",
      before,
      after,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payroll configuration</CardTitle>
        <p className="text-sm text-muted-foreground">
          Template field mapping for exports (demo — changes appear in Payroll Activity Logs).
        </p>
      </CardHeader>
      <CardContent className="max-w-xl space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">Basic pay column</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={mapping.basicField}
              onChange={(e) => setMapping((m) => ({ ...m, basicField: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Overtime column</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={mapping.otField}
              onChange={(e) => setMapping((m) => ({ ...m, otField: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Allowances column</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={mapping.allowanceField}
              onChange={(e) => setMapping((m) => ({ ...m, allowanceField: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Tax column</span>
            <input
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={mapping.taxField}
              onChange={(e) => setMapping((m) => ({ ...m, taxField: e.target.value }))}
            />
          </label>
        </div>
        <Button type="button" onClick={handleSave}>
          Save mapping
        </Button>
        {saved && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Saved. Check Payroll Activity Logs.</p>
        )}
      </CardContent>
    </Card>
  );
}
