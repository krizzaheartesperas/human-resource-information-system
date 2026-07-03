"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmployeeModuleTopbar } from "@/components/layout/EmployeeModuleTopbar";
import { EmployeeSectionHeader } from "@/components/layout/EmployeeSectionHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Download, Eye, FileText, Lock, Search, Wallet } from "lucide-react";
import PayoutAccountInformationCard from "@/features/employees/components/PayoutAccountInformationCard";
import { useCurrentUser } from "@/lib/CurrentUserContext";
import { getDemoLinkedMayaCard, getDemoPaymayaPayoutDefaults } from "@/lib/demo-paymaya-payout";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/supabaseAuth";

type PayslipRecord = {
  id: string;
  year: string;
  payPeriod: string;
  grossPay: number;
  deductions: number;
  netPay: number;
  status: "Paid" | "Processing" | "Pending";
};

const PAYSLIP_HISTORY: PayslipRecord[] = [
  {
    id: "PS-2026-04-15",
    year: "2026",
    payPeriod: "April 1–15, 2026",
    grossPay: 25000,
    deductions: 5000,
    netPay: 20000,
    status: "Paid",
  },
  {
    id: "PS-2026-03-31",
    year: "2026",
    payPeriod: "March 16–31, 2026",
    grossPay: 25000,
    deductions: 5200,
    netPay: 19800,
    status: "Paid",
  },
  {
    id: "PS-2025-12-31",
    year: "2025",
    payPeriod: "December 16–31, 2025",
    grossPay: 24000,
    deductions: 4900,
    netPay: 19100,
    status: "Paid",
  },
];

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
});

function maskPaymayaMobile(mobile: string) {
  const d = mobile.replace(/\D/g, "");
  if (d.length < 4) return "—";
  return `••••${d.slice(-4)}`;
}

function maskLinkedCard(card: string) {
  const d = card.replace(/\D/g, "");
  if (d.length >= 4) return `**** **** **** ${d.slice(-4)}`;
  return card.trim();
}

const statusPillClass: Record<PayslipRecord["status"], string> = {
  Paid:
    "border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  Processing:
    "border-0 bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  Pending:
    "border-0 bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

export function MyPayslipDashboard() {
  const { user } = useCurrentUser();
  const paymayaAccount = useMemo(
    () => getDemoPaymayaPayoutDefaults(user),
    [user.email, user.employeeNumber, user.name, user.personalPhone]
  );
  const [linkedCardMasked, setLinkedCardMasked] = useState(
    () => getDemoLinkedMayaCard(user.employeeNumber)?.cardNumberMasked ?? ""
  );

  const [activeTab, setActiveTab] = useState("my-payslip");
  const [yearFilter, setYearFilter] = useState("2026");
  const [search, setSearch] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const demoMask = getDemoLinkedMayaCard(user.employeeNumber)?.cardNumberMasked ?? "";

    async function loadLinkedCard() {
      if (!isSupabaseAuthConfigured()) {
        if (!cancelled) setLinkedCardMasked(demoMask);
        return;
      }
      const { data, error } = await supabase
        .from("employee_payout_accounts")
        .select("card_number")
        .eq("employee_id", user.employeeId)
        .maybeSingle<{ card_number: string | null }>();

      if (cancelled) return;
      if (error) {
        setLinkedCardMasked(demoMask);
        return;
      }
      setLinkedCardMasked(maskLinkedCard((data?.card_number ?? "").trim()) || demoMask);
    }

    void loadLinkedCard();
    return () => {
      cancelled = true;
    };
  }, [user.employeeId, user.employeeNumber]);

  const filteredPayslips = useMemo(
    () =>
      PAYSLIP_HISTORY.filter(
        (item) =>
          item.year === yearFilter && item.payPeriod.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [search, yearFilter]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6">
        <EmployeeModuleTopbar searchPlaceholder="Search" />
        <EmployeeSectionHeader
          title="My Pay"
          tabs={[
            { id: "my-payslip", label: "My Pay" },
            { id: "maya-account", label: "Maya Account" },
          ]}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

        {activeTab === "my-payslip" ? (
          <div className="space-y-8">
          <Card className="rounded-2xl border-0 bg-muted/30 p-1 shadow-sm">
            <CardContent className="space-y-8 p-6 lg:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Pay Period</p>
                  <p className="text-lg font-medium">April 1–15, 2026</p>
                  <Badge className={cn("w-fit rounded-full px-3 py-1 text-xs font-medium", statusPillClass.Paid)}>
                    Paid
                  </Badge>
                </div>

                <div className="space-y-1 text-center">
                  <p className="text-sm text-muted-foreground">Net Pay</p>
                  <p className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{peso.format(20000)}</p>
                </div>

                <div className="flex flex-col items-start gap-2 lg:items-end">
                  <Button type="button" variant="outline" onClick={() => setShowBreakdown(true)} className="min-w-40">
                    <Eye className="mr-2 size-4" />
                    View Breakdown
                  </Button>
                  <Button type="button" className="min-w-40">
                    <Download className="mr-2 size-4" />
                    Download PDF
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-background/80 p-4 dark:bg-background/40">
                  <p className="text-sm text-muted-foreground">Gross Pay</p>
                  <p className="text-base font-medium">{peso.format(25000)}</p>
                </div>
                <div className="rounded-xl bg-background/80 p-4 dark:bg-background/40">
                  <p className="text-sm text-muted-foreground">Total Deductions</p>
                  <p className="text-base font-medium">{peso.format(5000)}</p>
                </div>
                <div className="rounded-xl bg-background/80 p-4 dark:bg-background/40">
                  <p className="text-sm text-muted-foreground">Tax Amount</p>
                  <p className="text-base font-medium">{peso.format(3000)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Wallet className="size-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-foreground">Maya account</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground/90">{maskPaymayaMobile(paymayaAccount.paymayaMobile)}</span>
                    {paymayaAccount.paymayaEmail ? (
                      <>
                        {" "}
                        <span className="text-muted-foreground/80">·</span> {paymayaAccount.paymayaEmail}
                      </>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Salary payouts to your Maya wallet. Holder: {paymayaAccount.accountHolderName}
                  </p>
                  {linkedCardMasked ? (
                    <p className="text-xs text-muted-foreground">
                      Linked card: <span className="font-mono font-medium text-foreground/90">{linkedCardMasked}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="shrink-0 self-stretch sm:self-center"
                onClick={() => setActiveTab("maya-account")}
              >
                {"Manage Maya account"}
              </Button>
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" />
                <h2 className="text-lg font-medium">Payout History</h2>
              </div>
              <div className="flex w-full flex-wrap items-end justify-end gap-2 sm:w-auto">
                <div className="w-[110px]">
                  <label className="mb-1 block text-xs text-muted-foreground">Year</label>
                  <select
                    value={yearFilter}
                    onChange={(event) => setYearFilter(event.target.value)}
                    className="h-9 w-full rounded-lg border border-border/70 bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                </div>
                <div className="flex-1 sm:w-[260px]">
                  <label className="mb-1 block text-xs text-muted-foreground">Search period</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search pay period"
                      className="h-9 rounded-lg border-border/70 pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Card className="rounded-2xl border-0 bg-muted/20 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="space-y-2">
                  {filteredPayslips.length > 0 ? (
                    filteredPayslips.map((item) => (
                      <div
                        key={item.id}
                        className="grid gap-3 rounded-xl bg-background/90 p-4 transition-colors hover:bg-muted/40 dark:bg-background/40"
                      >
                        <div className="grid gap-4 md:grid-cols-[1.25fr_1fr_auto] md:items-center">
                          <div>
                            <p className="font-semibold text-foreground">{item.payPeriod}</p>
                            <p className="text-sm text-muted-foreground">Gross {peso.format(item.grossPay)}</p>
                          </div>
                          <div className="grid gap-0.5 text-sm">
                            <p className="text-muted-foreground">Deductions: {peso.format(item.deductions)}</p>
                            <p className="font-semibold text-foreground">Net Pay: {peso.format(item.netPay)}</p>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <Badge className={cn("rounded-full px-3 py-1 text-xs font-medium", statusPillClass[item.status])}>
                              {item.status}
                            </Badge>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title="View payslip"
                              aria-label="View payslip"
                              onClick={() => setShowBreakdown(true)}
                              className="size-8 rounded-md"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              title="Download payslip"
                              aria-label="Download payslip"
                              className="size-8 rounded-md"
                            >
                              <Download className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12">
                      <div className="flex flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                        <FileText className="size-5" />
                        <p>No payslips available for this period</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
        ) : activeTab === "maya-account" ? (
          <div className="space-y-6">
            <PayoutAccountInformationCard />

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-4" />
            <p>Your payout account information is securely encrypted and protected.</p>
          </div>
        </div>
        ) : null}

      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle>Payslip Breakdown</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium">Earnings</p>
              <div className="space-y-1 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Basic Pay</span>
                  <span>{peso.format(22000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Allowances</span>
                  <span>{peso.format(3000)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="font-medium">Deductions</p>
              <div className="space-y-1 rounded-lg border border-border/70 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{peso.format(3000)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Other deductions</span>
                  <span>{peso.format(2000)}</span>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Net Pay</span>
                <span className="text-xl font-bold">{peso.format(20000)}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
