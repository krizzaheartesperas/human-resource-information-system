import { AlertCircle, CheckCircle2, Clock, DollarSign, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type FinalPayStatus = "Pending Clearance" | "On Hold" | "Ready for Payroll";

type FinalPayReadinessProps = {
  status: FinalPayStatus;
};

const statusConfig: Record<
  FinalPayStatus,
  { color: string; badgeStyle: string; icon: React.ReactNode; description: string }
> = {
  "Pending Clearance": {
    color: "border-amber-200/50 dark:border-amber-500/20",
    badgeStyle: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    icon: <Clock className="size-6 text-amber-500" />,
    description:
      "Your final pay computation is pending. Required clearance steps must be completed before Finance can process your final pay.",
  },
  "On Hold": {
    color: "border-rose-200/50 dark:border-rose-500/20",
    badgeStyle: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    icon: <AlertCircle className="size-6 text-rose-500" />,
    description:
      "Your final pay is currently on hold. This may be due to pending clearance items or unresolved obligations. Contact HR for more details.",
  },
  "Ready for Payroll": {
    color: "border-emerald-200/50 dark:border-emerald-500/20",
    badgeStyle: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    icon: <CheckCircle2 className="size-6 text-emerald-500" />,
    description:
      "All clearance steps are complete. Your final pay has been marked as ready for payroll processing by Finance.",
  },
};

export function FinalPayReadiness({ status }: FinalPayReadinessProps) {
  const config = statusConfig[status];

  return (
    <Card className={cn("rounded-3xl border shadow-sm dark:bg-[#161b30]", config.color)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
          <DollarSign className="size-5 text-[#FFE14E]" />
          Final Pay Readiness
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status indicator */}
        <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-5 dark:bg-white/5">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-white/10">
            {config.icon}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge className={cn("border-transparent font-bold", config.badgeStyle)}>
                {status}
              </Badge>
              {status === "Pending Clearance" ? (
                <Loader2 className="size-3.5 animate-spin text-amber-500" />
              ) : null}
            </div>
            <p className="text-sm font-medium leading-relaxed text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>

        {/* Read-only disclaimer */}
        <div className="rounded-xl bg-slate-100/50 px-4 py-3 dark:bg-white/5">
          <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
            <span className="font-bold text-foreground">Note:</span> Final pay readiness is
            determined by Finance after all required clearance steps are completed. This section is
            read-only and updated automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
